import type { Warning, WarningLevel } from '@shared/schemas/result';

interface Props {
  warnings: Warning[];
}

const LEVEL_LABEL: Record<WarningLevel, string> = {
  high: '꼭 확인하세요',
  medium: '한 번 살펴보세요',
  low: '알아두면 좋아요',
};

const LEVEL_ORDER: WarningLevel[] = ['high', 'medium', 'low'];

/**
 * 주의할 점.
 *
 * 색만으로 등급을 구분하지 않고 글자 라벨을 함께 답니다.
 * 문서에 적힌 내용인지 일반 안내인지도 반드시 구분해 표시합니다 (기획서 FR-8).
 */
export function WarningsCard({ warnings }: Props) {
  if (warnings.length === 0) return null;

  const sorted = [...warnings].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  );

  return (
    <section className="card" aria-labelledby="warnings-title">
      <h2 className="card__title" id="warnings-title">
        주의할 점
      </h2>

      <ul className="result__warning-list">
        {sorted.map((warning, index) => (
          <li key={index} className={`result__warning result__warning--${warning.level}`}>
            <p className="result__warning-level">{LEVEL_LABEL[warning.level]}</p>
            <p>{warning.text}</p>

            <p className="result__source">
              {warning.source_kind === 'document'
                ? '문서에 적힌 내용이에요'
                : '문서에는 없지만 알아두면 좋은 일반 안내예요'}
            </p>

            {warning.evidence && <blockquote className="evidence">{warning.evidence}</blockquote>}
          </li>
        ))}
      </ul>
    </section>
  );
}
