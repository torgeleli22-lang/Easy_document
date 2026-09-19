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

    async analyze(_input: AnalysisInput, onEvent: (event: AnalysisEvent) => void) {
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

      emit({ type: 'result', result: laborContractResult });
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
