/**
 * 개인 식별 정보 가리기.
 *
 * 보관함에 저장하기 직전과, 백엔드가 AI 결과를 돌려주기 직전에 둘 다 거칩니다.
 * AI에게도 가려서 옮겨 적으라고 시키지만, 모델이 놓칠 수 있으므로 코드로 한 번 더 막습니다.
 *
 * 가리는 것: 주민등록번호·외국인등록번호, 휴대전화·일반전화 번호, 카드 번호.
 * 계좌번호는 은행마다 모양이 달라 날짜·금액과 헷갈리기 쉬워서 일부러 건드리지 않습니다.
 */

export interface MaskRule {
  /** 화면에 "무엇을 가렸는지" 알려줄 때 쓰는 이름 */
  label: string;
  pattern: RegExp;
  replace: string;
}

// 앞뒤가 숫자로 이어지면 다른 숫자의 일부이므로 건드리지 않습니다 (날짜·금액 보호).
const NOT_DIGIT_BEFORE = '(?<![0-9])';
const NOT_DIGIT_AFTER = '(?![0-9])';
const SEP = '[\\s.\\-–]?';

export const MASK_RULES: MaskRule[] = [
  {
    label: '주민등록번호',
    // 생년월일 6자리 - 성별 숫자(1~8) + 6자리. 외국인등록번호도 같은 모양입니다.
    pattern: new RegExp(`${NOT_DIGIT_BEFORE}\\d{6}\\s*[-–]?\\s*[1-8]\\d{6}${NOT_DIGIT_AFTER}`, 'g'),
    replace: '******-*******',
  },
  {
    label: '카드 번호',
    pattern: new RegExp(
      `${NOT_DIGIT_BEFORE}\\d{4}${SEP}\\d{4}${SEP}\\d{4}${SEP}\\d{4}${NOT_DIGIT_AFTER}`,
      'g',
    ),
    replace: '****-****-****-****',
  },
  {
    label: '휴대전화 번호',
    pattern: new RegExp(
      `${NOT_DIGIT_BEFORE}01[016789]${SEP}\\d{3,4}${SEP}\\d{4}${NOT_DIGIT_AFTER}`,
      'g',
    ),
    replace: '010-****-****',
  },
  {
    label: '전화번호',
    // 지역번호(02, 031 등)나 대표번호(1588 등)로 시작하는 번호. 구분자가 있어야만 잡습니다.
    pattern: new RegExp(
      `${NOT_DIGIT_BEFORE}(?:0[2-9]\\d?|15\\d\\d|16\\d\\d|18\\d\\d)[\\s.\\-–)]\\s*\\d{3,4}(?:[\\s.\\-–]\\d{4})?${NOT_DIGIT_AFTER}`,
      'g',
    ),
    replace: '***-****-****',
  },
];

export interface MaskOutcome {
  text: string;
  /** 실제로 가린 항목 이름 (중복 없음) */
  masked: string[];
}

export function maskPersonalInfo(text: string): MaskOutcome {
  const masked = new Set<string>();
  let output = text;
  for (const rule of MASK_RULES) {
    output = output.replace(rule.pattern, () => {
      masked.add(rule.label);
      return rule.replace;
    });
  }
  return { text: output, masked: [...masked] };
}

/** 가린 결과만 필요할 때 */
export function maskText(text: string): string {
  return maskPersonalInfo(text).text;
}
