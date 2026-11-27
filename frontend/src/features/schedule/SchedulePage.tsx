import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  manualDocument,
  putDocument,
  scheduleItems,
  setTaskDone,
  useArchive,
  type ScheduleItem,
} from '@/lib/archive';
import { daysUntil, formatDday, formatShortDate, todayIso } from '@/lib/date';
import { downloadIcs } from '@/lib/ics';
import { MonthCalendar } from './MonthCalendar';
import './schedule.css';

type GroupKey = 'overdue' | 'today' | 'week' | 'month' | 'later';

const GROUPS: { key: GroupKey; title: string; hint?: string }[] = [
  { key: 'overdue', title: '기한이 지났어요', hint: '아직 끝내지 않은 일이에요' },
  { key: 'today', title: '오늘까지' },
  { key: 'week', title: '7일 안에' },
  { key: 'month', title: '30일 안에' },
  { key: 'later', title: '그 뒤에' },
];

function groupOf(isoDate: string): GroupKey {
  const days = daysUntil(isoDate);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'later';
}

function tone(isoDate: string): 'danger' | 'warning' | 'neutral' {
  const days = daysUntil(isoDate);
  if (days <= 3) return 'danger';
  if (days <= 7) return 'warning';
  return 'neutral';
}

/**
 * 일정 화면.
 *
 * 보관한 문서에서 뽑아낸 기한을 한곳에 모아, "다음에 뭘 해야 하지?"에 바로 답합니다.
 * 왼쪽(좁은 화면에선 위)은 임박한 순서의 목록, 오른쪽은 한 달 달력입니다.
 */
export function SchedulePage() {
  const documents = useArchive();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const items = useMemo(() => (documents ? scheduleItems(documents) : []), [documents]);
  const open = items.filter((item) => !item.task.done);
  const done = items.filter((item) => item.task.done);
  const undated = useMemo(
    () =>
      (documents ?? []).flatMap((doc) =>
        doc.tasks.filter((task) => !task.deadline && !task.done).map((task) => ({ doc, task })),
      ),
    [documents],
  );

  const grouped = GROUPS.map((group) => ({
    ...group,
    items: open.filter((item) => groupOf(item.task.deadline!) === group.key),
  })).filter((group) => group.items.length > 0);

  const selectedItems = selectedDate
    ? items.filter((item) => item.task.deadline === selectedDate)
    : [];
  const soon = open.filter((item) => {
    const days = daysUntil(item.task.deadline!);
    return days >= 0 && days <= 7;
  }).length;
  const overdue = open.filter((item) => daysUntil(item.task.deadline!) < 0).length;

  const exportAll = () =>
    downloadIcs(
      open.map((item) => ({
        uid: item.task.id,
        date: item.task.deadline!,
        title: item.task.action,
        description:
          item.doc.source === 'manual'
            ? item.doc.memo
            : [item.doc.title, item.task.if_missed].filter(Boolean).join('\n'),
      })),
      '쉬운말 일정.ics',
    );

  if (documents === null) {
    return <div className="container section" aria-busy="true" />;
  }

  return (
    <div className="container section schedule">
      <header className="schedule__head">
        <div>
          <span className="eyebrow">내 일정</span>
          <h1 className="page-title title">마감 일정</h1>
          <p className="schedule__summary" aria-live="polite">
            {open.length === 0
              ? '남은 마감이 없어요.'
              : `남은 마감 ${open.length}건 · 7일 안에 ${soon}건${overdue ? ` · 지난 일 ${overdue}건` : ''}`}
          </p>
        </div>
        <div className="schedule__tools">
          <button
            type="button"
            className="button button--primary"
            onClick={() => setAdding((value) => !value)}
            aria-expanded={adding}
          >
            할 일 직접 추가
          </button>
          {open.length > 0 && (
            <button type="button" className="button button--secondary" onClick={exportAll}>
              휴대폰 달력으로 보내기
            </button>
          )}
        </div>
      </header>

      {adding && <AddTaskForm onDone={() => setAdding(false)} defaultDate={selectedDate} />}

      {items.length === 0 && undated.length === 0 ? (
        <section className="empty card">
          <h2 className="card__title">아직 모인 일정이 없어요</h2>
          <p>
            문서를 점검한 뒤 <strong>보관함에 저장</strong>을 누르면, 문서에 적힌 기한이 이곳에
            날짜순으로 모입니다. 받은 공문이나 안내문을 올려 보세요.
          </p>
          <div>
            <Link to="/" className="button button--primary">
              문서 점검하러 가기
            </Link>
          </div>
        </section>
      ) : (
        <div className="schedule__layout">
          <section className="schedule__list" aria-labelledby="upcoming-title">
            <h2 className="sr-only" id="upcoming-title">
              다가오는 마감
            </h2>

            {grouped.map((group) => (
              <div key={group.key} className={`deadline-group deadline-group--${group.key}`}>
                <h3 className="deadline-group__title">
                  {group.title} <span className="deadline-group__count">{group.items.length}</span>
                </h3>
                {group.hint && <p className="meta">{group.hint}</p>}
                <ul className="deadline-list">
                  {group.items.map((item) => (
                    <DeadlineRow key={item.task.id} item={item} />
                  ))}
                </ul>
              </div>
            ))}

            {open.length === 0 && <p className="schedule__clear">남은 마감을 모두 끝냈어요.</p>}

            {undated.length > 0 && (
              <div className="deadline-group">
                <h3 className="deadline-group__title">
                  날짜 확인이 필요한 일{' '}
                  <span className="deadline-group__count">{undated.length}</span>
                </h3>
                <p className="meta">문서에 날짜가 분명하지 않았어요. 담당 기관에 확인해 보세요.</p>
                <ul className="deadline-list">
                  {undated.map((item) => (
                    <DeadlineRow key={item.task.id} item={item} />
                  ))}
                </ul>
              </div>
            )}

            {done.length > 0 && (
              <details className="deadline-group deadline-group--done">
                <summary className="deadline-group__title">
                  끝낸 일 <span className="deadline-group__count">{done.length}</span>
                </summary>
                <ul className="deadline-list">
                  {[...done].reverse().map((item) => (
                    <DeadlineRow key={item.task.id} item={item} />
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="schedule__calendar" aria-label="달력">
            <MonthCalendar items={items} selectedDate={selectedDate} onSelect={setSelectedDate} />

            {selectedDate && (
              <div className="day-detail" aria-live="polite">
                <h3 className="day-detail__title">{formatShortDate(selectedDate)}</h3>
                {selectedItems.length === 0 ? (
                  <p className="meta">이 날은 마감이 없어요.</p>
                ) : (
                  <ul className="deadline-list">
                    {selectedItems.map((item) => (
                      <DeadlineRow key={item.task.id} item={item} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function DeadlineRow({ item }: { item: ScheduleItem }) {
  const { doc, task } = item;
  const checkboxId = `task-${task.id}`;

  return (
    <li className={`deadline${task.done ? ' deadline--done' : ''}`}>
      <input
        id={checkboxId}
        type="checkbox"
        className="deadline__check"
        checked={task.done}
        onChange={(event) => void setTaskDone(doc.id, task.id, event.target.checked)}
      />
      <div className="deadline__body">
        <label htmlFor={checkboxId} className="deadline__action">
          {task.action}
        </label>
        <p className="deadline__meta">
          {task.deadline ? formatShortDate(task.deadline) : '날짜 미정'}
          {' · '}
          {doc.source === 'manual' ? (
            <span>직접 추가</span>
          ) : (
            <Link to={`/archive/${doc.id}`}>{doc.title}</Link>
          )}
        </p>
        {doc.keywords.length > 0 && (
          <p className="deadline__keywords">{doc.keywords.slice(0, 3).join(' · ')}</p>
        )}
      </div>
      {task.deadline && !task.done && (
        <span className={`tag tag--${tone(task.deadline)} deadline__dday`}>
          {formatDday(task.deadline)}
        </span>
      )}
      {task.done && <span className="tag tag--safe deadline__dday">완료</span>}
    </li>
  );
}

function AddTaskForm({ onDone, defaultDate }: { onDone: () => void; defaultDate: string | null }) {
  const [action, setAction] = useState('');
  const [date, setDate] = useState(defaultDate ?? todayIso());
  const [memo, setMemo] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action.trim()) return;
    await putDocument(manualDocument({ action, deadline: date || null, memo }));
    onDone();
  };

  return (
    <form className="add-task card" onSubmit={submit}>
      <h2 className="card__title">할 일 직접 추가</h2>
      <div className="add-task__row">
        <div className="add-task__field add-task__field--grow">
          <label className="field-label" htmlFor="add-action">
            무엇을
          </label>
          <input
            id="add-action"
            className="field"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="예: 연구비 영수증 정산 제출"
            required
          />
        </div>
        <div className="add-task__field">
          <label className="field-label" htmlFor="add-date">
            언제까지
          </label>
          <input
            id="add-date"
            type="date"
            className="field"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>
      <div className="add-task__field">
        <label className="field-label" htmlFor="add-memo">
          메모 <span className="meta">(선택)</span>
        </label>
        <input
          id="add-memo"
          className="field"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </div>
      <div className="add-task__actions">
        <button type="submit" className="button button--primary" disabled={!action.trim()}>
          추가하기
        </button>
        <button type="button" className="button button--quiet" onClick={onDone}>
          취소
        </button>
      </div>
    </form>
  );
}
