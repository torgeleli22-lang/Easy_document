import type { Term } from '@shared/schemas/result';

interface Props {
  terms: Term[];
}

/**
 * 어려운 용어 풀이. 눌러서 펼쳐 보는 방식입니다 (기획서 4.4).
 * details/summary를 쓰면 키보드·스크린리더 동작을 브라우저가 알아서 해줍니다.
 */
export function TermsCard({ terms }: Props) {
  if (terms.length === 0) return null;

  return (
    <section className="card" aria-labelledby="terms-title">
      <h2 className="card__title" id="terms-title">
        어려운 말 풀이
      </h2>

      <ul className="result__term-list">
        {terms.map((term, index) => (
          <li key={index}>
            <details className="result__term">
              <summary className="result__term-summary">{term.original}</summary>
              <div className="result__term-body">
                <p>{term.easy}</p>
                {term.evidence && <blockquote className="evidence">{term.evidence}</blockquote>}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
