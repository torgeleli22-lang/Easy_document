import type { ReactNode } from 'react';

interface Props {
  /** 결과서 안에서의 순번. 서식처럼 읽히도록 매깁니다 */
  number: string;
  title: string;
  /** 제목 옆에 붙는 짧은 요약 (예: "3건") */
  count?: string;
  children: ReactNode;
}

/**
 * 결과서의 한 항목.
 *
 * 모든 항목이 같은 머리글 모양을 쓰기 때문에, 화면이 자유 형식 답변이 아니라
 * 정해진 서식으로 점검한 결과처럼 읽힙니다 (기획서 1.4).
 */
export function ReportSection({ number, title, count, children }: Props) {
  const id = `section-${number}`;

  return (
    <section className="report-section" aria-labelledby={id}>
      <header className="report-section__header">
        <span className="report-section__number title" aria-hidden="true">
          {number}
        </span>
        <h2 className="report-section__title" id={id}>
          {title}
        </h2>
        {count && <span className="tag tag--neutral">{count}</span>}
      </header>

      <div className="report-section__body">{children}</div>
    </section>
  );
}
