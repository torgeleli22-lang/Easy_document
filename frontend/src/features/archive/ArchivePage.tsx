import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  excerpt,
  exportBackup,
  importBackup,
  searchDocuments,
  useArchive,
  type RecentFilter,
  type SavedDocument,
} from '@/lib/archive';
import { formatAgo, formatDate, toIso } from '@/lib/date';
import { downloadBlob } from '@/lib/ics';
import './archive.css';

type KindFilter = 'all' | 'deadline' | 'reference';

const RECENT_OPTIONS: { value: RecentFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '7', label: '최근 7일 안에 본 것' },
  { value: '30', label: '최근 30일 안에 본 것' },
];

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: '모든 문서' },
  { value: 'deadline', label: '기한 있는 문서' },
  { value: 'reference', label: '참고용 문서' },
];

const hasDeadline = (doc: SavedDocument) => doc.tasks.some((task) => task.deadline);

/**
 * 보관함.
 *
 * "그 문서 무슨 내용이었지?", "며칠 전에 찾아봤던 그거"를 찾는 곳입니다.
 * 낱말로 찾거나, 최근에 본 순서로 훑어볼 수 있습니다. 모든 내용은 이 기기 안에만 있습니다.
 */
export function ArchivePage() {
  const documents = useArchive();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [backupMessage, setBackupMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!documents) return [];
    return searchDocuments(documents, query, recent).filter((doc) => {
      if (kind === 'deadline') return hasDeadline(doc);
      if (kind === 'reference') return !hasDeadline(doc);
      return true;
    });
  }, [documents, query, recent, kind]);

  const handleExport = async () => {
    downloadBlob(await exportBackup(), `쉬운말 보관함 백업 ${toIso(new Date())}.json`);
    setBackupMessage('백업 파일을 내려받았어요. 다른 기기에서 "백업 불러오기"로 옮길 수 있어요.');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const count = await importBackup(file);
      setBackupMessage(`문서 ${count}건을 불러왔어요.`);
    } catch {
      setBackupMessage('쉬운말 백업 파일이 아니라서 불러오지 못했어요.');
    }
  };

  if (documents === null) return <div className="container section" aria-busy="true" />;

  return (
    <div className="container section archive">
      <header>
        <span className="eyebrow">내 보관함</span>
        <h1 className="page-title title">보관한 문서</h1>
        <p className="lead">
          저장한 문서 {documents.length}건. 무슨 내용이었는지 낱말 하나만 떠올려도 찾을 수 있어요.
        </p>
      </header>

      <div className="archive__search">
        <label htmlFor="archive-query" className="sr-only">
          보관함에서 찾기
        </label>
        <input
          id="archive-query"
          type="search"
          className="field archive__query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 성적, 근로계약, 교무처, 증명서"
          autoComplete="off"
        />

        <div className="archive__filters">
          <FilterGroup
            label="언제 본 문서"
            options={RECENT_OPTIONS}
            value={recent}
            onChange={setRecent}
          />
          <FilterGroup label="문서 종류" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        </div>
      </div>

      {documents.length === 0 ? (
        <section className="card empty">
          <h2 className="card__title">아직 보관한 문서가 없어요</h2>
          <p>
            문서를 점검한 뒤 <strong>보관함에 저장</strong>을 누르면 여기에 모여요. 기본증명서나
            설명서처럼 기한이 없는 문서도 보관해 두면 나중에 다시 찾아볼 수 있어요.
          </p>
          <div>
            <Link to="/" className="button button--primary">
              문서 점검하러 가기
            </Link>
          </div>
        </section>
      ) : (
        <section aria-live="polite" aria-label="찾은 문서">
          <p className="meta archive__count">
            {query.trim()
              ? `"${query.trim()}"로 찾은 문서 ${results.length}건`
              : `최근에 본 순서 · ${results.length}건`}
          </p>
          {results.length === 0 ? (
            <p className="archive__none">
              찾는 문서가 없어요. 다른 낱말로 찾아보거나 기간을 넓혀 보세요.
            </p>
          ) : (
            <ul className="archive__list">
              {results.map((doc) => (
                <ArchiveCard key={doc.id} doc={doc} query={query} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="archive__backup" aria-labelledby="backup-title">
        <h2 id="backup-title" className="archive__backup-title">
          보관함은 이 기기에만 있어요
        </h2>
        <p className="meta">
          서버에 올리지 않기 때문에, 브라우저 기록을 지우거나 기기를 바꾸면 사라져요. 가끔 백업
          파일로 받아 두세요.
        </p>
        <div className="archive__backup-actions">
          <button type="button" className="button button--secondary" onClick={handleExport}>
            백업 파일 내려받기
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => fileRef.current?.click()}
          >
            백업 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={handleImport}
          />
        </div>
        <p className="meta" role="status">
          {backupMessage}
        </p>
      </section>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="filter" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="filter__chip"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ArchiveCard({ doc, query }: { doc: SavedDocument; query: string }) {
  const openTasks = doc.tasks.filter((task) => !task.done && task.deadline);
  const snippet = query.trim() ? excerpt(doc, query) : null;

  return (
    <li>
      <Link to={`/archive/${doc.id}`} className="archive-card">
        <div className="archive-card__head">
          <h3 className="archive-card__title">{doc.title}</h3>
          {openTasks.length > 0 ? (
            <span className="tag tag--warning">남은 기한 {openTasks.length}건</span>
          ) : doc.tasks.length === 0 ? (
            <span className="tag tag--neutral">참고용</span>
          ) : (
            <span className="tag tag--safe">할 일 끝</span>
          )}
        </div>
        <p className="archive-card__meta">
          {doc.docType !== doc.title && `${doc.docType} · `}
          {formatAgo(doc.viewedAt)} 봄 · {formatDate(toIso(new Date(doc.savedAt)))} 저장
        </p>
        {doc.summary && <p className="archive-card__summary">{doc.summary}</p>}
        {snippet && <p className="archive-card__snippet">{snippet}</p>}
        {doc.memo && <p className="archive-card__memo">메모: {doc.memo}</p>}
        {doc.keywords.length > 0 && (
          <ul className="keyword-list">
            {doc.keywords.map((keyword) => (
              <li key={keyword} className="keyword">
                {keyword}
              </li>
            ))}
          </ul>
        )}
      </Link>
    </li>
  );
}
