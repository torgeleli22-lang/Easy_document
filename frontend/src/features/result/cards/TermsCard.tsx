import type { Term } from '@shared/schemas/result';

interface Props {
  terms: Term[];
}

/**
 * 어려운 용어 풀이. 눌러서 펼쳐 보는 방식입니다 (기획서 4.4).
 * details/summary를 쓰면 키보드·스크린리더 동작을 브라우저가 알아서 해줍니다.
 */
export function TermsCard({ terms }: Props) {
  return (
    <ul className="term-list">
      {terms.map((term, index) => (
        <li key={index}>
          <details className="term">
            <summary className="term__summary">
              <span className="term__word">{term.original}</span>
              <span className="term__hint" aria-hidden="true">
                뜻 보기
              </span>
            </summary>
            <div className="term__body">
              <p>{term.easy}</p>
              {term.evidence && <blockquote className="evidence">{term.evidence}</blockquote>}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
