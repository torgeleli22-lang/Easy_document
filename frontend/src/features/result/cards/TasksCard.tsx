import type { Task } from '@shared/schemas/result';
import { daysUntil, formatDate, formatDday } from '@/lib/date';

interface Props {
  tasks: Task[];
}

/** 남은 기간에 따라 표시를 다르게 합니다. 색만이 아니라 날짜도 늘 함께 적습니다. */
function ddayTone(isoDate: string): 'danger' | 'warning' | 'neutral' {
  const days = daysUntil(isoDate);
  if (days <= 7) return 'danger';
  if (days <= 30) return 'warning';
  return 'neutral';
}

/**
 * 해야 할 일과 기한. 임박한 순으로 정렬합니다 (기획서 FR-5).
 * 기한이 없거나 불분명한 항목은 뒤로 보냅니다.
 */
export function TasksCard({ tasks }: Props) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.deadline && b.deadline) return daysUntil(a.deadline) - daysUntil(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  return (
    <>
      <ol className="task-list">
        {sorted.map((task, index) => (
          <li key={index} className="task">
            <div className="task__head">
              <h3 className="task__action">{task.action}</h3>
              {task.deadline ? (
                <span className={`tag tag--${ddayTone(task.deadline)}`}>
                  {formatDday(task.deadline)}
                </span>
              ) : (
                <span className="tag tag--neutral">기한 확인 필요</span>
              )}
            </div>

            <p className="task__deadline">
              {task.deadline ? (
                <>
                  {formatDate(task.deadline)}까지
                  {task.deadline_kind === 'relative' && ' (문서에 적힌 기준으로 계산했어요)'}
                </>
              ) : (
                '문서에 날짜가 적혀 있지 않아요.'
              )}
            </p>

            <p className="task__missed">{task.if_missed}</p>

            {task.evidence && <blockquote className="evidence">{task.evidence}</blockquote>}
          </li>
        ))}
      </ol>

      <p className="note">실제 기한은 문서에 적힌 기관에 한 번 더 확인해 주세요.</p>
    </>
  );
}
