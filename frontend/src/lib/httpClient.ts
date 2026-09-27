import type { AnalysisResult } from '@shared/schemas/result';
import type { AnalysisClient, AnalysisEvent, AnalysisInput } from './analysisClient';
import { resizeImage } from './resizeImage';

/**
 * 실제 서버(Lambda Function URL)에 연결하는 분석 클라이언트.
 *
 * 글은 바로 보내고, 사진은 서버에서 업로드 주소를 받아 S3에 직접 올린 뒤
 * 분석을 요청합니다. 1차는 결과를 한 번에 받으므로 delta 이벤트는 보내지 않습니다.
 */

const MAX_IMAGES = 10;

interface UploadSlot {
  url: string;
  fields: Record<string, string>;
}

/** 서버가 보낸 오류 메시지는 쉬운 말로 되어 있어 화면에 그대로 씁니다 */
class ServerError extends Error {}

export function createHttpAnalysisClient(baseUrl: string): AnalysisClient {
  const root = baseUrl.replace(/\/+$/, '');
  let controller: AbortController | null = null;

  async function post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (data as { error?: { message?: unknown } } | null)?.error?.message;
      throw new ServerError(
        typeof message === 'string' ? message : '서버에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
      );
    }
    return data as T;
  }

  async function uploadImages(files: File[], signal: AbortSignal) {
    const images = await Promise.all(files.map(resizeImage));
    const { uploadId, slots } = await post<{ uploadId: string; slots: UploadSlot[] }>(
      '/upload-urls',
      { contentTypes: images.map(() => 'image/jpeg') },
      signal,
    );

    await Promise.all(
      slots.map(async (slot, index) => {
        const form = new FormData();
        for (const [key, value] of Object.entries(slot.fields)) form.append(key, value);
        // S3는 file 필드가 맨 마지막에 와야 받아들입니다.
        form.append('file', images[index]);
        const response = await fetch(slot.url, { method: 'POST', body: form, signal });
        if (!response.ok) throw new ServerError('사진을 올리지 못했어요. 다시 시도해 주세요.');
      }),
    );

    return { uploadId, count: images.length };
  }

  return {
    cancel() {
      controller?.abort();
    },

    async analyze(input: AnalysisInput, onEvent: (event: AnalysisEvent) => void) {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const { signal } = current;

      const emit = (event: AnalysisEvent) => {
        if (!signal.aborted) onEvent(event);
      };

      try {
        let request: unknown;

        if (input.kind === 'text') {
          emit({ type: 'progress', stage: 'uploading', message: '문서를 받고 있어요' });
          request = { kind: 'text', text: input.text };
        } else {
          const files = input.files;
          if (files.some((file) => !file.type.startsWith('image/'))) {
            throw new ServerError('PDF 점검은 준비 중이에요. 지금은 사진이나 붙여넣기로 맡겨 주세요.');
          }
          if (files.length > MAX_IMAGES) {
            throw new ServerError(`사진은 한 번에 ${MAX_IMAGES}장까지 올릴 수 있어요.`);
          }
          emit({
            type: 'progress',
            stage: 'uploading',
            message: files.length > 1 ? `사진 ${files.length}장을 올리고 있어요` : '사진을 올리고 있어요',
          });
          request = { kind: 'images', ...(await uploadImages(files, signal)) };
        }

        emit({ type: 'progress', stage: 'analyzing', message: '내용을 읽고 쉬운 말로 풀고 있어요' });
        const { result } = await post<{ result: AnalysisResult }>('/analyze', request, signal);

        emit({
          type: 'label',
          docType: result.doc_type,
          category: result.category,
          confidence: result.confidence,
        });
        emit({ type: 'progress', stage: 'verifying', message: '근거를 확인하고 있어요' });
        emit({ type: 'result', result });
        emit({ type: 'progress', stage: 'done', message: '다 됐어요' });
      } catch (error) {
        if (signal.aborted) return;
        emit({
          type: 'error',
          message:
            error instanceof ServerError
              ? error.message
              : '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
        });
      }
    },
  };
}
