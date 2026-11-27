import { Link, NavLink } from 'react-router-dom';
import { scheduleItems, useArchive } from '@/lib/archive';
import { daysUntil } from '@/lib/date';
import './siteHeader.css';

/**
 * 사이트 헤더.
 *
 * 화면마다 같은 자리에 있어서 "어느 서비스 안에 들어와 있다"는 감각을 줍니다.
 * 점검 · 일정 · 보관함 세 곳을 오가고, 일정 옆에는 7일 안에 닥친 마감 수를 띄워
 * 어느 화면에 있든 급한 일이 있는지 알 수 있게 합니다.
 */
export function SiteHeader() {
  const documents = useArchive();
  const urgent = documents
    ? scheduleItems(documents).filter(
        (item) => !item.task.done && daysUntil(item.task.deadline!) <= 7,
      ).length
    : 0;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `site-nav__link${isActive ? ' site-nav__link--active' : ''}`;

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand">
          <span className="site-header__mark" aria-hidden="true">
            쉬
          </span>
          <span className="site-header__name">
            <span className="site-header__title title">쉬운말</span>
            <span className="site-header__tagline">문서 풀이 · 마감 일정</span>
          </span>
        </Link>

        <p className="site-header__note">
          <span className="site-header__dot" aria-hidden="true" />
          문서는 서버에 저장하지 않습니다
        </p>
      </div>

      <nav className="site-nav" aria-label="주 메뉴">
        <div className="container site-nav__inner">
          <NavLink to="/" end className={navClass}>
            점검하기
          </NavLink>
          <NavLink to="/schedule" className={navClass}>
            일정
            {urgent > 0 && (
              <span className="site-nav__badge" aria-label={`7일 안에 마감 ${urgent}건`}>
                {urgent}
              </span>
            )}
          </NavLink>
          <NavLink to="/archive" className={navClass}>
            보관함
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
