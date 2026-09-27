import type { AnalysisResult } from '@shared/schemas/result';
import type { AnalysisClient, AnalysisEvent, AnalysisInput } from './analysisClient';
import { laborContractResult, laborContractNarration } from '@/mocks/laborContract';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 백엔드 없이 화면을 완성하기 위한 목업 클라이언트.
 *
 * 진짜 WebSocket 구현과 타이밍을 비슷하게 흉내 냅니다.
 * 요약 텍스트를 한 조각씩 흘려보내므로, 스트리밍 화면이
 * 실제 응답에서도 그대로 동작하는지 미리 확인할 수 있습니다.
 */
export function createMockAnalysisClient(): AnalysisClient {
  let cancelled = false;

  return {
    cancel() {
      cancelled = true;
    },

    async analyze(input: AnalysisInput, onEvent: (event: AnalysisEvent) => void) {
      cancelled = false;

      const emit = (event: AnalysisEvent) => {
        if (!cancelled) onEvent(event);
      };

      // 1. 업로드 (실제로는 presigned URL로 S3에 직접 업로드)
      emit({ type: 'progress', stage: 'uploading', message: '문서를 올리고 있어요' });
      await sleep(600);
      if (cancelled) return;

      // 2. 라우터(경량 모델)가 표시 라벨과 처리 카테고리를 판단
      emit({ type: 'progress', stage: 'classifying', message: '어떤 문서인지 확인하고 있어요' });
      await sleep(900);
      if (cancelled) return;

      emit({
        type: 'label',
        docType: laborContractResult.doc_type,
        category: laborContractResult.category,
        confidence: laborContractResult.confidence,
      });

      // 3. 본 분석 스트리밍 — 멀티모달 모델이 토큰 단위로 흘려보내는 부분
      emit({ type: 'progress', stage: 'analyzing', message: '내용을 읽고 쉬운 말로 풀고 있어요' });
      for (const chunk of chunkText(laborContractNarration)) {
        await sleep(45);
        if (cancelled) return;
        emit({ type: 'delta', text: chunk });
      }

      // 4. 검증 — 인용 존재 확인, 날짜·금액 교차 검증
      emit({ type: 'progress', stage: 'verifying', message: '숫자와 근거를 확인하고 있어요' });
      await sleep(800);
      if (cancelled) return;

      emit({ type: 'result', result: fitMockToInput(laborContractResult, input) });
      emit({ type: 'progress', stage: 'done', message: '다 됐어요' });
    },
  };
}

/** 모델이 토큰 단위로 보내는 모습을 흉내 내기 위해 짧게 자릅니다 */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 3) {
    chunks.push(text.slice(i, i + 3));
  }
  return chunks;
}

/**
 * 목업 결과를 사용자가 올린 원본에 맞춰 조금 고칩니다.
 *
 * 결과 화면은 원본과 풀이를 구간으로 이어 보여주므로, 아무 글이나 사진을
 * 올려도 그 연결이 어떻게 보이는지 확인할 수 있게 합니다.
 *   - 목업 원문을 그대로 붙여넣었으면: 손대지 않습니다.
 *   - 다른 글이면: 붙여넣은 글의 문단을 원문 구간으로 삼습니다.
 *   - 사진이면: 사진 위아래로 고르게 나눈 위치를 구간마다 붙입니다.
 */
function fitMockToInput(result: AnalysisResult, input: AnalysisInput): AnalysisResult {
  if (input.kind === 'text') {
    const matchesMock = result.passages.every((passage) => input.text.includes(passage.text));
    if (matchesMock) return result;

    const paragraphs = input.text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, result.passages.length);
    if (paragraphs.length === 0) return result;

    // 목업 구간 순서대로 새 문단에 하나씩 대응시킵니다. 문단이 적으면 돌려 씁니다.
    const idMap = new Map(
      result.passages.map((passage, index) => [passage.id, `p${(index % paragraphs.length) + 1}`]),
    );
    const remap = (id: string | null) => (id ? (idMap.get(id) ?? null) : null);

    return {
      ...result,
      passages: paragraphs.map((text, index) => ({
        id: `p${index + 1}`,
        order: index + 1,
        text,
        easy: `(목업) 이 문단을 쉬운 말로 풀어 쓴 설명이 여기에 들어갑니다.`,
      })),
      tasks: result.tasks.map((task) => ({ ...task, passage_id: remap(task.passage_id) })),
      terms: result.terms.map((term) => ({ ...term, passage_id: remap(term.passage_id) })),
      warnings: result.warnings.map((warning) => ({
        ...warning,
        passage_id: remap(warning.passage_id),
      })),
    };
  }

  if (input.file.type.startsWith('image/')) {
    const count = result.passages.length;
    return {
      ...result,
      passages: result.passages.map((passage, index) => ({
        ...passage,
        region: {
          image_index: 0,
          top: 0.1 + (0.8 * index) / count,
          bottom: 0.1 + (0.8 * (index + 1)) / count,
        },
      })),
    };
  }

  return result;
}
