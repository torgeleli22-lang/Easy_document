import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteDocument,
  getDocument,
  markViewed,
  setTaskDone,
  updateDocument,
  useArchive,
  type SavedDocument,
} from '@/lib/archive';
import { maskText } from '@shared/pii';
import { formatAgo, formatDate, formatDday, toIso } from '@/lib/date';
import { downloadIcs } from '@/lib/ics';
import './archive.css';

const LEVEL_LABEL = { high: '꼭 확인', medium: '확인 권장', low: '참고' } as const;
const LEVEL_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;

/**
 * 보관한 문서 하나.
 *
 * 열 때마다 "마지막으로 본 날"을 갱신해서, 보관함에서 "며칠 전에 본 것"으로 찾을 수 있게 합니다.
 */
export function ArchiveDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const documents = useArchive();
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);

  // 처음 열 때 한 번 "봤다"고 표시합니다
  useEffect(() => {
    void getDocument(id).then((found) => {
      if (!found) setMissing(true);
      else void markViewed(id);
    });
  }, [id]);

  const doc = documents?.find((item) => item.id === id);

  if (missing) {
    return (
      <div className="container section">
        <section className="card empty">
          <h2 className="card__title">문서를 찾을 수 없어요</h2>
          <p>지워졌거나 다른 기기에 저장된 문서예요.</p>
          <div>
            <Link to="/archive" className="button button--primary">
              보관함으로
            </Link>
          </div>
        </section>
      </div>
    );
  }
  if (!doc) return <div className="container section" aria-busy="true" />;

  const datedOpen = doc.tasks.filter((task) => task.deadline && !task.done);

  const handleDelete = async () => {
    if (!window.confirm(`"${doc.title}"을(를) 보관함에서 지울까요? 되돌릴 수 없어요.`)) return;
    await deleteDocument(doc.id);
    navigate('/archive', { replace: true });
  };

  return (
    <div className="container section archive-detail">
      <p>
        <Link to="/archive" className="archive-detail__back">
          ‹ 보관함
        </Link>
      </p>

      <header className="archive-detail__head">
        <span className="eyebrow">{doc.docType}</span>
        <h1 className="page-title title">{doc.title}</h1>
        <p className="meta">
          {formatDate(toIso(new Date(doc.savedAt)))} 저장 · 마지막으로 본 날{' '}
          {formatAgo(doc.viewedAt)}
          {doc.maskedLabels.length > 0 && ` · ${doc.maskedLabels.join(', ')} 가림`}
        </p>
        {doc.keywords.length > 0 && (
          <ul className="keyword-list">
            {doc.keywords.map((keyword) => (
              <li key={keyword} className="keyword">
                {keyword}
              </li>
            ))}
          </ul>
        )}
      </header>

      {editing ? (
        <EditForm doc={doc} onDone={() => setEditing(false)} />
      ) : (
        <section className="card">
          {doc.summary && <p className="archive-detail__summary">{doc.summary}</p>}
          <p className={doc.memo ? '' : 'meta'}>
            {doc.memo ? `메모: ${doc.memo}` : '메모가 없어요.'}
          </p>
          <div>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setEditing(true)}
            >
              이름·메모 고치기
            </button>
          </div>
        </section>
      )}

      {doc.tasks.length > 0 && (
        <section className="card" aria-labelledby="tasks-title">
          <div className="archive-detail__section-head">
            <h2 className="card__title" id="tasks-title">
              해야 할 일
            </h2>
            {datedOpen.length > 0 && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() =>
                  downloadIcs(
                    datedOpen.map((task) => ({
                      uid: task.id,
                      date: task.deadline!,
                      title: task.action,
                      description: [doc.title, task.if_missed].filter(Boolean).join('\n'),
                    })),
                    `${doc.title} 기한.ics`,
                  )
                }
              >
                휴대폰 달력에 추가
              </button>
            )}
          </div>
          <ul className="deadline-list">
            {doc.tasks.map((task) => (
              <li key={task.id} className={`deadline${task.done ? ' deadline--done' : ''}`}>
                <input
                  id={`detail-${task.id}`}
                  type="checkbox"
                  className="deadline__check"
                  checked={task.done}
                  onChange={(event) => void setTaskDone(doc.id, task.id, event.target.checked)}
                />
                <div className="deadline__body">
                  <label htmlFor={`detail-${task.id}`} className="deadline__action">
                    {task.action}
                  </label>
                  <p className="deadline__meta">
                    {task.deadline ? `${formatDate(task.deadline)}까지` : '날짜 확인 필요'}
                  </p>
                  {task.if_missed && <p className="deadline__meta">{task.if_missed}</p>}
                </div>
                {task.deadline && !task.done && (
                  <span className="tag tag--neutral deadline__dday">
                    {formatDday(task.deadline)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.warnings.length > 0 && (
        <section className="card" aria-labelledby="warnings-title">
          <h2 className="card__title" id="warnings-title">
            주의할 점
          </h2>
          <ul className="archive-detail__list">
            {doc.warnings.map((warning, index) => (
              <li key={index}>
                <span className={`tag tag--${LEVEL_TONE[warning.level]}`}>
                  {LEVEL_LABEL[warning.level]}
                </span>{' '}
                {warning.text}
                {warning.source_kind === 'general_guide' && (
                  <span className="meta"> (일반 안내)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.passages.length > 0 && (
        <section className="card" aria-labelledby="passages-title">
          <h2 className="card__title" id="passages-title">
            원문과 풀이
          </h2>
          <ol className="archive-detail__passages">
            {doc.passages.map((passage, index) => (
              <li key={index}>
                <blockquote className="evidence">{passage.text}</blockquote>
                {passage.easy && <p className="archive-detail__easy">{passage.easy}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {doc.terms.length > 0 && (
        <section className="card" aria-labelledby="terms-title">
          <h2 className="card__title" id="terms-title">
            어려운 말
          </h2>
          <dl className="archive-detail__terms">
            {doc.terms.map((term) => (
              <div key={term.original}>
                <dt>{term.original}</dt>
                <dd>{term.easy}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {doc.fullText && (
        <details className="card archive-detail__full">
          <summary className="card__title">옮겨 적은 전체 글 보기</summary>
          <pre className="archive-detail__text">{doc.fullText}</pre>
        </details>
      )}

      <div className="archive-detail__danger">
        <button type="button" className="button button--quiet" onClick={handleDelete}>
          이 문서 지우기
        </button>
      </div>
    </div>
  );
}

function EditForm({ doc, onDone }: { doc: SavedDocument; onDone: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [memo, setMemo] = useState(doc.memo);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    await updateDocument(doc.id, (current) => ({
      ...current,
      title: maskText(title.trim() || current.docType),
      memo: maskText(memo),
    }));
    onDone();
  };

  return (
    <form className="card" onSubmit={save}>
      <div>
        <label className="field-label" htmlFor="edit-title">
          이름
        </label>
        <input
          id="edit-title"
          className="field save-panel__field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="edit-memo">
          메모
        </label>
        <textarea
          id="edit-memo"
          className="field save-panel__field"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>
      <p className="meta">전화번호·주민등록번호를 적어도 가려서 저장돼요.</p>
      <div className="save-panel__actions">
        <button type="submit" className="button button--primary">
          저장
        </button>
        <button type="button" className="button button--quiet" onClick={onDone}>
          취소
        </button>
      </div>
    </form>
  );
}
