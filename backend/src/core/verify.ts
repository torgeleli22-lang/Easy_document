import type { AnalysisResult, Passage } from '../../../shared/schemas/result';

/**
 * 인용 존재 확인 (기획서 4.5).
 *
 * AI가 "원문에 이렇게 적혀 있다"고 한 evidence가 정말 원문에 있는지 확인합니다.
 * - 가리킨 구간에 있으면 그대로 둡니다.
 * - 다른 구간에 있으면 passage_id를 그 구간으로 고칩니다.
 * - 어디에도 없으면 근거 없는 주장이므로 항목을 뺍니다.
 *   단, 문서 밖 일반 안내(general_guide)는 원래 인용이 없으므로 남깁니다.
 */

/** 공백·줄바꿈·따옴표 차이는 같은 글로 봅니다 */
function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[“”„‟"]/g, '"')
    .replace(/[‘’‚‛']/g, "'")
    .replace(/\s+/g, '')
    .toLowerCase();
}

interface Located {
  evidence: string;
  passage_id: string | null;
}

export interface VerifyReport {
  /** 인용을 찾지 못해 뺀 항목 수 */
  dropped: number;
  /** 구간 참조를 고친 항목 수 */
  relinked: number;
}

export function verifyEvidence(
  result: Omit<AnalysisResult, 'passages'>,
  passages: Passage[],
): { result: Omit<AnalysisResult, 'passages'>; report: VerifyReport } {
  const index = passages.map((passage) => ({ id: passage.id, text: normalize(passage.text) }));
  const report: VerifyReport = { dropped: 0, relinked: 0 };

  /** 인용이 있는 구간 id. 없으면 null */
  const locate = (item: Located): string | null => {
    const needle = normalize(item.evidence);
    if (!needle) return null;
    const claimed = index.find((passage) => passage.id === item.passage_id);
    if (claimed?.text.includes(needle)) return claimed.id;
    // AI가 구간을 잘못 짚은 경우. 인용이 실제로 있는 구간을 찾습니다.
    const found = index.find((passage) => passage.text.includes(needle));
    if (found) return found.id;
    return null;
  };

  const check = <T extends Located>(item: T): T | null => {
    const id = locate(item);
    if (id === null) {
      // 인용이 두 구간에 걸친 경우도 있어서, 이어 붙인 전체에서 한 번 더 찾습니다.
      const whole = index.map((passage) => passage.text).join('');
      const needle = normalize(item.evidence);
      if (needle && whole.includes(needle)) return item;
      report.dropped += 1;
      return null;
    }
    if (id !== item.passage_id) report.relinked += 1;
    return { ...item, passage_id: id };
  };

  const keep = <T>(value: T | null): value is T => value !== null;

  return {
    result: {
      ...result,
      tasks: result.tasks.map(check).filter(keep),
      terms: result.terms.map(check).filter(keep),
      warnings: result.warnings
        .map((warning) =>
          warning.source_kind === 'general_guide'
            ? { ...warning, passage_id: null }
            : check(warning),
        )
        .filter(keep),
    },
    report,
  };
}
