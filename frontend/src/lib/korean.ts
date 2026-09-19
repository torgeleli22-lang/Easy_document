/**
 * 한국어 조사 처리.
 *
 * "근로계약서(으)로 인식했어요" 같은 괄호 표기는 읽기에 걸리적거립니다.
 * 노약자 기준으로 문장을 다듬는 서비스라 조사까지 맞춰서 보여줍니다.
 */

/** 마지막 글자의 받침 번호. 받침이 없으면 0, 한글이 아니면 null */
function finalConsonant(word: string): number | null {
  const last = word.trim().at(-1);
  if (!last) return null;

  const code = last.charCodeAt(0);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangulSyllable) return null;

  return (code - 0xac00) % 28;
}

const RIEUL = 8;

/** "근로계약서로", "고지서로", "영수증으로" */
export function withRo(word: string): string {
  const jongseong = finalConsonant(word);
  // 숫자나 영문으로 끝나면 읽는 방식이 갈려서 판단하지 않습니다.
  if (jongseong === null) return `${word}(으)로`;
  return jongseong === 0 || jongseong === RIEUL ? `${word}로` : `${word}으로`;
}
