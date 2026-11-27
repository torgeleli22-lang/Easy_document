import type { AnalysisResult } from '@shared/schemas/result';
import type { AnalysisClient, AnalysisEvent, AnalysisInput } from './analysisClient';
import { filesOf } from '@/features/result/source';
import { todayIso } from './date';

/**
 * 실제 백엔드(backend/ 의 Lambda 함수 URL)를 부르는 분석 클라이언트.
 *
 * 백엔드는 결과를 한 번에 돌려주므로, 기다리는 동안 진행 단계를 시간에 맞춰
 * 넘겨 사용자가 "멈춘 건가?" 하지 않게 합니다. 문서는 서버에 저장되지 않습니다.
 */

/** Lambda 함수 URL의 요청 크기 한도(6MB)보다 넉넉히 작게 */
const MAX_REQUEST_BYTES = 5_500_000;
/** 사진 긴 변 최대 길이. 글씨를 읽기에 충분하고 용량은 크게 줄어듭니다 */
const MAX_IMAGE_SIDE = 2000;

interface EncodedFile {
  name: string;
  media_type: string;
  data: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 사진을 긴 변 MAX_IMAGE_SIDE 이하의 JPEG로 줄입니다. 실패하면 원본을 그대로 씁니다 */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

async function encodeFiles(input: AnalysisInput): Promise<EncodedFile[]> {
  const encoded: EncodedFile[] = [];
  for (const file of filesOf(input)) {
    if (file.type.startsWith('image/')) {
      const blob = await shrinkImage(file);
      encoded.push({
        name: file.name,
        media_type: blob.type || 'image/jpeg',
        data: await blobToBase64(blob),
      });
    } else {
      encoded.push({ name: file.name, media_type: file.type, data: await blobToBase64(file) });
    }
  }
  return encoded;
}

export function createHttpAnalysisClient(apiUrl: string): AnalysisClient {
  let controller: AbortController | null = null;
  let timers: number[] = [];

  const clearTimers = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  };

  return {
    cancel() {
      controller?.abort();
      clearTimers();
    },

    async analyze(input, onEvent, options) {
      controller?.abort();
      clearTimers();
      const current = new AbortController();
      controller = current;
      const emit = (event: AnalysisEvent) => {
        if (!current.signal.aborted) onEvent(event);
      };

      emit({ type: 'progress', stage: 'uploading', message: '문서를 올리고 있어요' });

      try {
        const files = input.kind === 'file' ? await encodeFiles(input) : [];
        const body = JSON.stringify({
          text: input.kind === 'text' ? input.text : undefined,
          files: files.length ? files : undefined,
          doc_type_hint: options?.docTypeHint?.doc_type,
          today: todayIso(),
        });
        if (body.length > MAX_REQUEST_BYTES) {
          emit({
            type: 'error',
            message: '파일이 너무 커요. 사진 장수를 줄이거나 PDF를 나눠서 올려 주세요.',
          });
          return;
        }

        // 서버가 한 번에 답하므로, 기다리는 동안 단계를 차례로 넘깁니다.
        emit({ type: 'progress', stage: 'classifying', message: '어떤 문서인지 확인하고 있어요' });
        timers.push(
          window.setTimeout(
            () =>
              emit({
                type: 'progress',
                stage: 'analyzing',
                message: '내용을 읽고 쉬운 말로 풀고 있어요',
              }),
            4000,
          ),
          window.setTimeout(
            () =>
              emit({
                type: 'progress',
                stage: 'analyzing',
                message: '조항과 기한을 하나씩 짚고 있어요. 조금만 기다려 주세요',
              }),
            20000,
          ),
        );

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: current.signal,
        });
        clearTimers();

        const payload = (await response.json().catch(() => ({}))) as {
          result?: AnalysisResult;
          error?: string;
        };
        if (!response.ok || !payload.result) {
          emit({
            type: 'error',
            message: payload.error ?? '점검 중 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
          });
          return;
        }

        const result = payload.result;
        emit({
          type: 'label',
          docType: result.doc_type,
          category: result.category,
          confidence: result.confidence,
        });
        emit({ type: 'delta', text: result.summary });
        emit({ type: 'progress', stage: 'verifying', message: '숫자와 근거를 확인하고 있어요' });
        emit({ type: 'result', result });
        emit({ type: 'progress', stage: 'done', message: '다 됐어요' });
      } catch {
        clearTimers();
        if (current.signal.aborted) return;
        emit({ type: 'error', message: '인터넷 연결을 확인하고 다시 시도해 주세요.' });
      }
    },
  };
}
