import type { Passage } from '@shared/schemas/result';
import type { AnalysisInput } from '@/lib/analysisClient';

/**
 * 결과 화면 왼쪽에 보여줄 원본.
 *
 * 사용자가 올린 그대로를 보여주는 것이 원칙입니다. 원본 모양 그대로 보여줄 수
 * 없는 형식(PDF 등)만 AI가 옮겨 적은 글로 대신합니다.
 */
export type SourceView =
  | { kind: 'text'; text: string }
  | { kind: 'images'; files: File[] }
  | { kind: 'transcript'; fileName: string | null };

/**
 * 입력에 담긴 파일 목록. 사진 여러 장을 받는 형태({ files })와 예전 한 장 형태({ file })를
 * 모두 받아, 백엔드 연결 작업과 어느 쪽이 먼저 합쳐져도 동작하게 합니다.
 */
export function filesOf(input: AnalysisInput): File[] {
  const loose = input as unknown as { file?: File; files?: File[] };
  return loose.files ?? (loose.file ? [loose.file] : []);
}

export function sourceFromInput(input: AnalysisInput | null): SourceView {
  if (!input) return { kind: 'transcript', fileName: null };
  if (input.kind === 'text') return { kind: 'text', text: input.text };

  const files = filesOf(input);
  if (files.length > 0 && files.every((file) => file.type.startsWith('image/'))) {
    return { kind: 'images', files };
  }
  return { kind: 'transcript', fileName: files[0]?.name ?? null };
}

/** 원문을 구간 단위로 자른 조각. passageId가 없으면 풀이가 붙지 않은 부분입니다 */
export interface TextSegment {
  text: string;
  passageId: string | null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 원문에서 구간 하나의 위치를 찾습니다. 띄어쓰기·줄바꿈 차이는 봐줍니다. */
function locate(source: string, text: string, from: number): [number, number] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const exact = source.indexOf(trimmed, from);
  if (exact >= 0) return [exact, exact + trimmed.length];

  const pattern = new RegExp(trimmed.split(/\s+/).map(escapeRegExp).join('\\s+'), 'g');
  pattern.lastIndex = from;
  const match = pattern.exec(source);
  return match ? [match.index, match.index + match[0].length] : null;
}

/**
 * 붙여넣은 원문을 구간이 있는 부분과 없는 부분으로 나눕니다.
 *
 * 구간은 문서 순서대로 앞에서부터 찾고, 못 찾으면 처음부터 한 번 더 찾습니다.
 * 하나도 찾지 못하면 null을 돌려주고, 화면은 옮겨 적은 글로 대신 보여줍니다.
 */
export function splitByPassages(source: string, passages: Passage[]): TextSegment[] | null {
  const ordered = [...passages].sort((a, b) => a.order - b.order);
  const ranges: { start: number; end: number; id: string }[] = [];
  let cursor = 0;

  for (const passage of ordered) {
    const found = locate(source, passage.text, cursor) ?? locate(source, passage.text, 0);
    if (!found) continue;
    const [start, end] = found;
    // 이미 찾은 구간과 겹치면 버립니다
    if (ranges.some((range) => start < range.end && end > range.start)) continue;
    ranges.push({ start, end, id: passage.id });
    cursor = end;
  }

  if (ranges.length === 0) return null;
  ranges.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let position = 0;
  for (const range of ranges) {
    if (range.start > position) {
      segments.push({ text: source.slice(position, range.start), passageId: null });
    }
    segments.push({ text: source.slice(range.start, range.end), passageId: range.id });
    position = range.end;
  }
  if (position < source.length) {
    segments.push({ text: source.slice(position), passageId: null });
  }
  return segments;
}
