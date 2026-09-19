interface Props {
  needsExpert: boolean;
  specializationHint: boolean;
}

/**
 * 면책과 전문가 연결 안내.
 *
 * 법률 자문이 아니라는 점은 화면에도 내려받는 파일에도 항상 들어갑니다
 * (기획서 4.7, 6장). 화면이 전문적으로 보일수록 이 구분이 더 분명해야 합니다.
 */
export function DisclaimerCard({ needsExpert, specializationHint }: Props) {
  return (
    <div className="disclaimer">
      <p>
        이 점검 결과는 AI가 문서를 읽고 정리한 것이며 법률 자문이 아닙니다. 중요한 결정을 하기
        전에는 문서에 적힌 기관이나 전문가에게 한 번 더 확인해 주세요.
      </p>

      {needsExpert && (
        <p className="disclaimer__expert">
          이 문서는 내용이 중요해서, 공식 기관의 대표번호로 직접 확인해 보시는 것을 권합니다.
        </p>
      )}

      {specializationHint && (
        <p className="note">이 서비스는 계약서와 공문 점검에 특히 강합니다.</p>
      )}
    </div>
  );
}
