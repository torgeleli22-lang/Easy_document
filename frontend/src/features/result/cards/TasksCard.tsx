import type { Task } from '@shared/schemas/result';
import { daysUntil, formatDate, formatDday } from '@/lib/date';

interface Props {
  tasks: Task[];
}

/**
 * 해야 할 일과 기한. 임박한 순으로 정렬합니다 (기획서 FR-5).
 * 기한이 없거나 불분명한 항목은 뒤로 보냅니다.
 */
/** 남은 기간에 따라 D-day 색을 다르게 합니다. 색만으로 구분하지 않고 날짜도 함께 적습니다. */
function ddayTone(isoDate: string): 'soon' | 'near' | 'far' {
  const days = daysUntil(isoDate);
  if (days <= 7) return 'soon';
  if (days <= 30) return 'near';
  return 'far';
}

export function TasksCard({ tasks }: Props) {
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => {
    if (a.deadline && b.deadline) return daysUntil(a.deadline) - daysUntil(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  return (
    <section className="card" aria-labelledby="tasks-title">
      <h2 className="card__title" id="tasks-title">
        해야 할 일
      </h2>

      <ul className="result__task-list">
        {sorted.map((task, index) => (
          <li key={index} className="result__task">
            <p className="result__task-action">{task.action}</p>

            <p className="result__task-deadline">
              {task.deadline ? (
                <>
                  <span className={`result__dday result__dday--${ddayTone(task.deadline)}`}>
                    {formatDday(task.deadline)}
                  </span>
                  <span>{formatDate(task.deadline)}까지</span>
                  {task.deadline_kind === 'relative' && (
                    <span className="result__task-note">(문서에 적힌 기준으로 계산했어요)</span>
                  )}
                </>
              ) : (
                <span className="result__task-note">기한이 적혀 있지 않아요. 확인이 필요해요.</span>
              )}
            </p>

            <p className="result__task-missed">{task.if_missed}</p>

            {task.evidence && <blockquote className="evidence">{task.evidence}</blockquote>}
          </li>
        ))}
      </ul>

      <p className="result__caution">실제 기한은 문서에 적힌 기관에 한 번 더 확인해 주세요.</p>
    </section>
  );
}
