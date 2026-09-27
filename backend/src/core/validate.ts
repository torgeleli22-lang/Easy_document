import type {
  AnalysisResult,
  Category,
  DeadlineKind,
  Passage,
  SourceKind,
  Task,
  Term,
  Warning,
  WarningLevel,
} from '../../../shared/schemas/result';
import { AnalysisError } from './errors';

/**
 * AI가 도구로 제출한 값을 결과 스키마에 맞게 검사하고 다듬습니다.
 *
 * 모델 출력은 형식이 어긋날 수 있으므로 믿지 않고 하나씩 확인합니다.
 * 고칠 수 있는 것(빠진 선택값, 범위를 벗어난 숫자)은 고치고,
 * 핵심 값이 없으면 오류로 처리합니다.
 */

type Raw = Record<string, unknown>;

const CATEGORIES: Category[] = ['contract', 'notice', 'informational', 'statute', 'unknown'];
const DEADLINE_KINDS: DeadlineKind[] = ['explicit', 'relative', 'unclear'];
const LEVELS: WarningLevel[] = ['high', 'medium', 'low'];
const SOURCE_KINDS: SourceKind[] = ['document', 'general_guide'];

const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const nullableStr = (value: unknown): string | null => {
  const text = str(value);
  return text ? text : null;
};

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const list = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter(isObject) : []);

/** YYYY-MM-DD 형식이 아니면 버립니다. 화면과 .ics가 이 형식을 전제로 합니다 */
const isoDate = (value: unknown): string | null => {
  const text = str(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? null : text;
};

/** 공통 결과 항목을 검사합니다. passages는 입력 종류에 따라 따로 채웁니다 */
export function normalizeResult(raw: unknown): Omit<AnalysisResult, 'passages'> {
  if (!isObject(raw)) throw new AnalysisError('invalid_output', '결과 형식이 올바르지 않아요.');

  const summary = str(raw.summary);
  if (!summary) throw new AnalysisError('invalid_output', '결과에 요약이 없어요.');

  const confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.5;

  const tasks: Task[] = list(raw.tasks)
    .map((task) => {
      const deadline = isoDate(task.deadline);
      return {
        action: str(task.action),
        deadline,
        // 날짜를 못 읽었는데 "명시"라고 하면 화면이 빈 날짜를 확정처럼 보여주므로 낮춥니다.
        deadline_kind:
          deadline === null && task.deadline_kind === 'explicit'
            ? 'unclear'
            : oneOf(task.deadline_kind, DEADLINE_KINDS, 'unclear'),
        evidence: str(task.evidence),
        passage_id: nullableStr(task.passage_id),
        if_missed: str(task.if_missed),
      };
    })
    .filter((task) => task.action);

  const terms: Term[] = list(raw.terms)
    .map((term) => ({
      original: str(term.original),
      easy: str(term.easy),
      evidence: str(term.evidence),
      passage_id: nullableStr(term.passage_id),
    }))
    .filter((term) => term.original && term.easy);

  const warnings: Warning[] = list(raw.warnings)
    .map((warning) => ({
      level: oneOf(warning.level, LEVELS, 'medium'),
      text: str(warning.text),
      evidence: str(warning.evidence),
      passage_id: nullableStr(warning.passage_id),
      source_kind: oneOf(warning.source_kind, SOURCE_KINDS, 'document'),
    }))
    .filter((warning) => warning.text);

  return {
    doc_type: str(raw.doc_type) || '문서',
    category: oneOf(raw.category, CATEGORIES, 'unknown'),
    confidence: Math.min(1, Math.max(0, confidence)),
    summary,
    tasks,
    terms,
    warnings,
    needs_expert: raw.needs_expert === true,
    specialization_hint: raw.specialization_hint === true,
  };
}

/** 사진 입력에서 AI가 옮겨 적은 원문 구간을 검사합니다 */
export function normalizeTranscribedPassages(raw: unknown): Passage[] {
  if (!isObject(raw)) return [];
  const seen = new Set<string>();
  const passages: Passage[] = [];

  for (const item of list(raw.passages)) {
    const text = str(item.text);
    if (!text) continue;
    let id = str(item.id);
    // id가 비었거나 겹치면 순서대로 새로 붙입니다. 항목의 참조는 인용 확인에서 다시 맞춥니다.
    if (!id || seen.has(id)) id = `p${passages.length + 1}`;
    seen.add(id);
    passages.push({ id, text, order: passages.length + 1 });
  }
  return passages;
}
