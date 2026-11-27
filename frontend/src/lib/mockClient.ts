import type { AnalysisResult, DocTypeCandidate } from '@shared/schemas/result';
import type { AnalysisClient, AnalysisEvent, AnalysisInput } from './analysisClient';
import {
  laborContractResult,
  laborContractNarration,
  laborContractText,
} from '@/mocks/laborContract';
import { buildDepartmentNotice } from '@/mocks/departmentNotice';
import { filesOf } from '@/features/result/source';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 확신도가 낮은 문서에서 물어볼 후보 */
const GENERIC_CANDIDATES: DocTypeCandidate[] = [
  { doc_type: '안내문·공문', category: 'notice' },
  { doc_type: '계약서', category: 'contract' },
  { doc_type: '증명서·설명서', category: 'informational' },
];

/**
 * 입력과 사용자가 고른 종류를 보고 어떤 목업을 보여줄지 정합니다.
 *   - 근로계약서 예시 글 → 근로계약서
 *   - 공문·안내 같은 낱말이 든 글 → 학과 공문 (기한이 오늘 기준이라 일정 화면 확인용)
 *   - 그 밖의 글 → 확신도를 낮춰서 "어떤 문서인가요?" 질문 화면을 확인할 수 있게
 *   - 종류를 골라 다시 점검하면 → 그 종류에 맞는 목업
 */
function pickScenario(input: AnalysisInput, hint?: DocTypeCandidate) {
  const notice = buildDepartmentNotice();
  const labor = { result: laborContractResult, narration: laborContractNarration };

  if (hint) {
    if (hint.category === 'contract') return relabel(labor, hint);
    if (hint.category === 'notice') return relabel(notice, hint);
    return relabel(referenceScenario(input), hint);
  }

  if (input.kind === 'file') return labor;
  if (input.text.includes(laborContractText.slice(0, 20)) || /근로계약/.test(input.text))
    return labor;
  if (/공문|안내|제출|마감|성적/.test(input.text)) return notice;

  return {
    narration:
      '문서를 읽어 봤는데, 어떤 종류인지 확실하지 않아요. 아래에서 골라 주시면 그에 맞게 다시 점검할게요.',
    result: {
      ...laborContractResult,
      doc_type: '종류를 알 수 없는 문서',
      category: 'unknown' as const,
      confidence: 0.48,
      candidates: GENERIC_CANDIDATES,
      keywords: guessKeywords(input.text),
      full_text: input.text,
    },
  };
}

function relabel(scenario: { result: AnalysisResult; narration: string }, hint: DocTypeCandidate) {
  return {
    narration: scenario.narration,
    result: {
      ...scenario.result,
      doc_type: hint.doc_type,
      category: hint.category,
      confidence: 1,
      candidates: [],
    },
  };
}

/** 해야 할 일이 없는 참고용 문서 (증명서·설명서) */
function referenceScenario(input: AnalysisInput) {
  const text = input.kind === 'text' ? input.text : laborContractText;
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  const result: AnalysisResult = {
    ...laborContractResult,
    summary: '(목업) 해야 할 일은 없는 참고용 문서예요. 보관해 두면 나중에 다시 찾아볼 수 있어요.',
    keywords: guessKeywords(text),
    full_text: text,
    passages: paragraphs.map((paragraph, index) => ({
      id: `p${index + 1}`,
      order: index + 1,
      text: paragraph,
      easy: '(목업) 이 문단을 쉬운 말로 풀어 쓴 설명이 여기에 들어갑니다.',
    })),
    tasks: [],
    terms: [],
    warnings: [],
  };
  return {
    result,
    narration: '참고용 문서예요. 해야 할 일이나 기한은 없고, 내용을 쉬운 말로 풀어 드릴게요.',
  };
}

/** 목업용 핵심어 — 두 글자 이상 한글 낱말 중 자주 나온 것 */
function guessKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  for (const word of text.match(/[가-힣]{2,}/g) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * 백엔드 없이 화면을 완성하기 위한 목업 클라이언트.
 *
 * 실제 백엔드 호출과 타이밍을 비슷하게 흉내 냅니다.
 * 설명 텍스트를 한 조각씩 흘려보내므로, 스트리밍 화면이
 * 실제 응답에서도 그대로 동작하는지 미리 확인할 수 있습니다.
 */
export function createMockAnalysisClient(): AnalysisClient {
  let cancelled = false;

  return {
    cancel() {
      cancelled = true;
    },

    async analyze(input, onEvent, options) {
      cancelled = false;
      const scenario = pickScenario(input, options?.docTypeHint);

      const emit = (event: AnalysisEvent) => {
        if (!cancelled) onEvent(event);
      };

      emit({ type: 'progress', stage: 'uploading', message: '문서를 올리고 있어요' });
      await sleep(600);
      if (cancelled) return;

      emit({ type: 'progress', stage: 'classifying', message: '어떤 문서인지 확인하고 있어요' });
      await sleep(900);
      if (cancelled) return;

      emit({
        type: 'label',
        docType: scenario.result.doc_type,
        category: scenario.result.category,
        confidence: scenario.result.confidence,
      });

      emit({ type: 'progress', stage: 'analyzing', message: '내용을 읽고 쉬운 말로 풀고 있어요' });
      for (const chunk of chunkText(scenario.narration)) {
        await sleep(30);
        if (cancelled) return;
        emit({ type: 'delta', text: chunk });
      }

      emit({ type: 'progress', stage: 'verifying', message: '숫자와 근거를 확인하고 있어요' });
      await sleep(700);
      if (cancelled) return;

      emit({ type: 'result', result: fitMockToInput(scenario.result, input) });
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

  const images = filesOf(input).filter((file) => file.type.startsWith('image/'));
  if (images.length > 0) {
    // 구간을 사진마다 고르게 나눠 싣습니다
    const perImage = Math.ceil(result.passages.length / images.length);
    return {
      ...result,
      passages: result.passages.map((passage, index) => ({
        ...passage,
        region: {
          image_index: Math.floor(index / perImage),
          top: 0.1 + (0.8 * (index % perImage)) / perImage,
          bottom: 0.1 + (0.8 * ((index % perImage) + 1)) / perImage,
        },
      })),
    };
  }

  return result;
}
