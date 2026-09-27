import type { Passage } from '../../../shared/schemas/result';

/**
 * 붙여넣은 글을 원문 구간(문단)으로 나눕니다.
 *
 * 글 입력은 서버가 직접 나눠서 원문을 확정하고, AI는 이 구간 id만 가리키게 합니다.
 * 빈 줄로 나누되, 빈 줄 없이 붙여넣은 긴 글은 줄 단위로 나눕니다.
 */
export function splitIntoPassages(text: string): Passage[] {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];

  let blocks = normalized.split(/\n\s*\n+/);
  // 빈 줄이 전혀 없는 글(문자 메시지 복사 등)은 한 줄씩 끊습니다.
  if (blocks.length === 1 && normalized.includes('\n')) {
    blocks = normalized.split('\n');
  }

  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block, index) => ({ id: `p${index + 1}`, text: block, order: index + 1 }));
}
