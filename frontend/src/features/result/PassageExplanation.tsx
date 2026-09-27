import type { Passage, Task, Term, Warning } from '@shared/schemas/result';
import { TasksCard } from './cards/TasksCard';
import { TermsCard } from './cards/TermsCard';
import { WarningsCard } from './cards/WarningsCard';

interface Props {
  passage: Passage;
  tasks: Task[];
  terms: Term[];
  warnings: Warning[];
  active: boolean;
}

/** 원문 앞부분을 짧게 잘라 풀이 제목 옆에 붙입니다. 원본에서 찾기 쉽게 하려는 것입니다 */
function excerpt(text: string, length = 28): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

/**
 * 원문 한 구간의 풀이.
 *
 * 쉬운 말 풀이를 먼저 두고, 이 구간에 걸린 주의할 점 · 해야 할 일 · 어려운 말을
 * 이어 붙입니다. data-passage-id로 왼쪽 원본의 같은 구간과 이어집니다.
 */
export function PassageExplanation({ passage, tasks, terms, warnings, active }: Props) {
  const headingId = `passage-${passage.id}`;

  return (
    <section
      className={`passage-note${active ? ' is-active' : ''}`}
      data-passage-id={passage.id}
      id={`note-${passage.id}`}
      aria-labelledby={headingId}
    >
      <header className="passage-note__header">
        <span className="passage-note__number title" aria-hidden="true">
          {String(passage.order).padStart(2, '0')}
        </span>
        <h3 className="passage-note__quote" id={headingId}>
          {excerpt(passage.text)}
        </h3>
      </header>

      {passage.easy && <p className="passage-note__easy">{passage.easy}</p>}

      {warnings.length > 0 && (
        <div className="passage-note__group">
          <h4 className="passage-note__group-title">주의할 점</h4>
          <WarningsCard warnings={warnings} />
        </div>
      )}

      {tasks.length > 0 && (
        <div className="passage-note__group">
          <h4 className="passage-note__group-title">해야 할 일</h4>
          <TasksCard tasks={tasks} showNote={false} />
        </div>
      )}

      {terms.length > 0 && (
        <div className="passage-note__group">
          <h4 className="passage-note__group-title">어려운 말</h4>
          <TermsCard terms={terms} />
        </div>
      )}

      {!passage.easy && warnings.length + tasks.length + terms.length === 0 && (
        <p className="note">이 부분은 따로 짚을 내용이 없어요.</p>
      )}
    </section>
  );
}
