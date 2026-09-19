import type { Warning, WarningLevel } from '@shared/schemas/result';

interface Props {
  warnings: Warning[];
}

const LEVEL_LABEL: Record<WarningLevel, string> = {
  high: '꼭 확인하세요',
  medium: '한 번 살펴보세요',
  low: '알아두면 좋아요',
};

const LEVEL_TAG: Record<WarningLevel, string> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const LEVEL_ORDER: WarningLevel[] = ['high', 'medium', 'low'];

/**
 * 주의할 점.
 *
 * 색만으로 등급을 구분하지 않고 글자 라벨을 함께 답니다.
 * 문서에 적힌 내용인지 일반 안내인지도 반드시 구분해 표시합니다 (기획서 FR-8).
 */
export function WarningsCard({ warnings }: Props) {
  const sorted = [...warnings].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
  );

  return (
    <ul className="warning-list">
      {sorted.map((warning, index) => (
        <li key={index} className={`warning warning--${warning.level}`}>
          <div className="warning__head">
            <span className={`tag tag--${LEVEL_TAG[warning.level]}`}>
              {LEVEL_LABEL[warning.level]}
            </span>
            <span className="warning__source">
              {warning.source_kind === 'document' ? '문서에 적힌 내용' : '일반 안내'}
            </span>
          </div>

          <p className="warning__text">{warning.text}</p>

          {warning.evidence && <blockquote className="evidence">{warning.evidence}</blockquote>}
        </li>
      ))}
    </ul>
  );
}
