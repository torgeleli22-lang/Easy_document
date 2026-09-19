import { Link } from 'react-router-dom';
import './siteHeader.css';

/**
 * 사이트 헤더.
 *
 * 화면마다 같은 자리에 있어서 "어느 서비스 안에 들어와 있다"는 감각을 줍니다.
 * 접수 → 검토 → 결과로 넘어가는 동안 머리글이 바뀌지 않는 것이 중요합니다.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand">
          <span className="site-header__mark" aria-hidden="true">
            쉬
          </span>
          <span className="site-header__name">
            <span className="site-header__title title">쉬운말</span>
            <span className="site-header__tagline">문서 쉬운 말 풀이 서비스</span>
          </span>
        </Link>

        <p className="site-header__note">
          <span className="site-header__dot" aria-hidden="true" />
          문서를 저장하지 않습니다
        </p>
      </div>
    </header>
  );
}
