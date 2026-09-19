import './siteFooter.css';

/**
 * 사이트 푸터.
 *
 * 면책 문구가 들어가는 자리입니다. 기획서 6장에서 화면과 파일 모두에
 * "법률 자문이 아니에요"를 명시하라고 되어 있어, 모든 화면 아래에 둡니다.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__block">
          <h2 className="site-footer__title title">쉬운말</h2>
          <p className="site-footer__text">
            어려운 문서를 쉬운 말로 풀고, 해야 할 일과 기한을 정리해 드립니다.
          </p>
        </div>

        <div className="site-footer__block">
          <h3 className="site-footer__heading">꼭 알아두실 점</h3>
          <ul className="site-footer__list">
            <li>AI가 만든 설명이며 법률 자문이 아닙니다.</li>
            <li>중요한 결정 전에는 해당 기관이나 전문가에게 확인해 주세요.</li>
            <li>올리신 문서는 서버에 저장하지 않습니다.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
