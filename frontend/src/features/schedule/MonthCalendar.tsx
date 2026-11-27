import { useMemo, useState } from 'react';
import type { ScheduleItem } from '@/lib/archive';
import { daysUntil, toIso, todayIso } from '@/lib/date';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  items: ScheduleItem[];
  selectedDate: string | null;
  onSelect: (isoDate: string | null) => void;
}

/** 한 달 달력. 날짜 칸마다 그날 마감인 일을 짧게 보여주고, 누르면 아래에 자세히 펼칩니다 */
export function MonthCalendar({ items, selectedDate, onSelect }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = todayIso();

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const key = item.task.deadline!;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);

  // 달력 첫 칸은 그 달 1일이 들어 있는 주의 일요일
  const cells = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(1 - cursor.getDay());
    const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const weeks = Math.ceil((cursor.getDay() + lastOfMonth.getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        iso: toIso(date),
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.getMonth(),
        weekday: date.getDay(),
      };
    });
  }, [cursor]);

  const move = (months: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + months, 1));
  const monthLabel = `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;

  return (
    <div className="month">
      <div className="month__bar">
        <button type="button" className="month__nav" onClick={() => move(-1)} aria-label="이전 달">
          ‹
        </button>
        <h2 className="month__label title" aria-live="polite">
          {monthLabel}
        </h2>
        <button type="button" className="month__nav" onClick={() => move(1)} aria-label="다음 달">
          ›
        </button>
        <button
          type="button"
          className="button button--quiet month__today"
          onClick={() => {
            const now = new Date();
            setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            onSelect(today);
          }}
        >
          오늘
        </button>
      </div>

      <div className="month__grid">
        {WEEKDAYS.map((weekday, index) => (
          <div
            key={weekday}
            aria-hidden="true"
            className={`month__weekday${index === 0 ? ' month__weekday--sun' : ''}`}
          >
            {weekday}
          </div>
        ))}

        {cells.map((cell) => {
          const dayItems = byDate.get(cell.iso) ?? [];
          const openItems = dayItems.filter((item) => !item.task.done);
          const urgent = openItems.length > 0 && daysUntil(cell.iso) <= 3;
          const classes = [
            'month__cell',
            cell.inMonth ? '' : 'month__cell--outside',
            cell.iso === today ? 'month__cell--today' : '',
            cell.iso === selectedDate ? 'month__cell--selected' : '',
            urgent ? 'month__cell--urgent' : '',
            cell.weekday === 0 ? 'month__cell--sun' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const label = `${cell.iso}${dayItems.length ? `, 마감 ${dayItems.length}건` : ''}`;

          return (
            <button
              key={cell.iso}
              type="button"
              className={classes}
              aria-label={label}
              aria-pressed={cell.iso === selectedDate}
              onClick={() => onSelect(cell.iso === selectedDate ? null : cell.iso)}
            >
              <span className="month__day">{cell.day}</span>
              {dayItems.length > 0 && (
                <span className="month__items" aria-hidden="true">
                  {dayItems.slice(0, 2).map((item) => (
                    <span
                      key={item.task.id}
                      className={`month__item${item.task.done ? ' month__item--done' : ''}`}
                    >
                      {item.task.action}
                    </span>
                  ))}
                  {dayItems.length > 2 && (
                    <span className="month__more">+{dayItems.length - 2}</span>
                  )}
                  <span className="month__dots">
                    {dayItems.slice(0, 3).map((item) => (
                      <span
                        key={item.task.id}
                        className={`month__dot${item.task.done ? ' month__dot--done' : ''}`}
                      />
                    ))}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
