import type { AnalysisResult, Passage } from '../../shared/schemas/result';
import { maskText } from '../../shared/pii';
import type { ModelOutput } from './schema';

/**
 * 검증 단계 (기획서 4.5).
 *
 * 모델이 돌려준 결과를 화면에 보내기 전에 코드로 한 번 더 걸러냅니다.
 *   - 숫자 범위를 맞춥니다 (확신도, 사진 위치).
 *   - 날짜 형식이 틀린 기한은 "불분명"으로 돌립니다.
 *   - 글 입력이면, 원문에서 찾을 수 없는 구간과 인용을 걷어냅니다 (인용 존재 확인).
 *   - 옮겨 적은 전체 글의 개인 식별 정보를 한 번 더 가립니다.
 */

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function normalize(text: string): string {
  return text.replace(/\s+/g, '');
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function toAnalysisResult(output: ModelOutput, sourceText: string | null): AnalysisResult {
  const source = sourceText ? normalize(sourceText) : null;
  const foundInSource = (quote: string) => !source || !quote || source.includes(normalize(quote));

  const passages: Passage[] = output.passages
    .filter((passage) => passage.text.trim() && foundInSource(passage.text))
    .map((passage) => ({
      id: passage.id,
      text: passage.text,
      order: passage.order,
      easy: passage.easy ?? undefined,
      region: passage.region
        ? {
            image_index: Math.max(0, Math.round(passage.region.image_index)),
            top: clamp(Math.min(passage.region.top, passage.region.bottom)),
            bottom: clamp(Math.max(passage.region.top, passage.region.bottom)),
          }
        : undefined,
    }));

  const known = new Set(passages.map((passage) => passage.id));
  const linkTo = (id: string | null) => (id && known.has(id) ? id : null);
  const checkedQuote = (quote: string) => (foundInSource(quote) ? quote : '');

  const keywords = [...new Set(output.keywords.map((word) => word.trim()).filter(Boolean))].slice(
    0,
    8,
  );

  return {
    doc_type: output.doc_type.trim() || '문서',
    category: output.category,
    confidence: clamp(output.confidence),
    candidates: output.candidates.slice(0, 4),
    summary: output.summary,
    keywords,
    full_text: maskText(output.full_text),
    passages,
    tasks: output.tasks.map((task) => {
      const valid = task.deadline !== null && isValidIsoDate(task.deadline);
      return {
        ...task,
        deadline: valid ? task.deadline : null,
        deadline_kind: valid ? task.deadline_kind : 'unclear',
        evidence: checkedQuote(task.evidence),
        passage_id: linkTo(task.passage_id),
      };
    }),
    terms: output.terms.map((term) => ({
      ...term,
      evidence: checkedQuote(term.evidence),
      passage_id: linkTo(term.passage_id),
    })),
    warnings: output.warnings.map((warning) => ({
      ...warning,
      evidence: checkedQuote(warning.evidence),
      passage_id: linkTo(warning.passage_id),
    })),
    needs_expert: output.needs_expert,
    specialization_hint: output.specialization_hint,
  };
}
