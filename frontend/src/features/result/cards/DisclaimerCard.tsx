interface Props {
  needsExpert: boolean;
  specializationHint: boolean;
}

/**
 * 근거와 전문가 연결, 면책 안내.
 *
 * 법률 자문이 아니라는 점은 화면에도 내려받는 파일에도 항상 들어갑니다
 * (기획서 4.7, 6장).
 */
export function DisclaimerCard({ needsExpert, specializationHint }: Props) {
  return (
    <section className="card result__disclaimer" aria-labelledby="disclaimer-title">
      <h2 className="card__title" id="disclaimer-title">
        알아두실 점
      </h2>

      <p>
        이 설명은 AI가 만든 것이고 법률 자문이 아니에요. 중요한 결정을 하기 전에는 문서에 적힌
        기관이나 전문가에게 한 번 더 확인해 주세요.
      </p>

      {needsExpert && (
        <p className="result__expert">
          이 문서는 내용이 중요해서, 공식 기관의 대표번호로 직접 확인해 보시는 것을 권해요.
        </p>
      )}

      {specializationHint && (
        <p className="result__hint">이 서비스는 계약서와 공문 분석에 특히 강해요.</p>
      )}
    </section>
  );
}
