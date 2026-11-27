import { useEffect, useState } from 'react';
import type {
  AnalysisResult,
  Category,
  DeadlineKind,
  SourceKind,
  WarningLevel,
} from '@shared/schemas/result';
import { maskPersonalInfo } from '@shared/pii';
import { daysUntil } from './date';

/**
 * 보관함 — 사용자가 고른 문서만, 이 기기 안(IndexedDB)에 보관합니다.
 *
 * 서버로는 아무것도 보내지 않습니다. 원본 사진·파일도 저장하지 않고,
 * 점검 결과와 옮겨 적은 글만 남기며, 저장 직전에 주민등록번호·전화번호·카드 번호를
 * 가립니다 (shared/pii.ts). 그래서 브라우저 데이터를 지우면 보관함도 사라집니다.
 */

export interface SavedTask {
  id: string;
  action: string;
  /** YYYY-MM-DD. 없으면 날짜 미정 */
  deadline: string | null;
  deadline_kind: DeadlineKind;
  if_missed: string;
  evidence: string;
  done: boolean;
  doneAt: string | null;
}

export interface SavedDocument {
  id: string;
  /** 점검 결과를 저장한 것인지, 일정에서 직접 적은 것인지 */
  source: 'analysis' | 'manual';
  /** 사용자가 고칠 수 있는 이름. 처음엔 문서 종류 */
  title: string;
  docType: string;
  category: Category;
  summary: string;
  keywords: string[];
  memo: string;
  /** 처음 보관한 시각 (ISO) */
  savedAt: string;
  /** 마지막으로 열어본 시각 — "며칠 전에 봤던 그 문서" 찾기에 씁니다 */
  viewedAt: string;
  passages: { text: string; easy?: string }[];
  terms: { original: string; easy: string }[];
  warnings: { level: WarningLevel; text: string; source_kind: SourceKind }[];
  tasks: SavedTask[];
  fullText: string;
  /** 저장할 때 가린 항목 (예: ["전화번호"]) */
  maskedLabels: string[];
}

// ── 저장소 ──────────────────────────────────────────────

const DB_NAME = 'easy-document';
const STORE = 'documents';

let dbPromise: Promise<IDBDatabase | null> | null = null;
/** IndexedDB를 못 쓰는 환경(일부 사생활 보호 모드)에서는 메모리에만 둡니다 */
const memoryStore = new Map<string, SavedDocument>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function isPersistent(): Promise<boolean> {
  return (await openDb()) !== null;
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) {
          reject(new Error('no-db'));
          return;
        }
        const request = work(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}

export async function listDocuments(): Promise<SavedDocument[]> {
  try {
    return await run('readonly', (store) => store.getAll() as IDBRequest<SavedDocument[]>);
  } catch {
    return [...memoryStore.values()];
  }
}

export async function getDocument(id: string): Promise<SavedDocument | undefined> {
  try {
    return await run('readonly', (store) => store.get(id) as IDBRequest<SavedDocument | undefined>);
  } catch {
    return memoryStore.get(id);
  }
}

export async function putDocument(doc: SavedDocument): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(doc));
  } catch {
    memoryStore.set(doc.id, doc);
  }
  notify();
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    memoryStore.delete(id);
  }
  notify();
}

export async function updateDocument(
  id: string,
  change: (doc: SavedDocument) => SavedDocument,
): Promise<SavedDocument | undefined> {
  const doc = await getDocument(id);
  if (!doc) return undefined;
  const next = change(doc);
  await putDocument(next);
  return next;
}

export function markViewed(id: string) {
  return updateDocument(id, (doc) => ({ ...doc, viewedAt: new Date().toISOString() }));
}

export function setTaskDone(docId: string, taskId: string, done: boolean) {
  return updateDocument(docId, (doc) => ({
    ...doc,
    tasks: doc.tasks.map((task) =>
      task.id === taskId ? { ...task, done, doneAt: done ? new Date().toISOString() : null } : task,
    ),
  }));
}

/** 보관함 목록을 읽고, 바뀌면 다시 읽는 훅 */
export function useArchive() {
  const [documents, setDocuments] = useState<SavedDocument[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void listDocuments().then((docs) => {
        if (alive) setDocuments(docs);
      });
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);

  return documents;
}

// ── 만들기 ──────────────────────────────────────────────

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 점검 결과를 보관용 모양으로 바꿉니다. 모든 글을 개인정보 가리기에 통과시킵니다.
 */
export function documentFromResult(
  result: AnalysisResult,
  options: { title: string; memo: string },
): SavedDocument {
  const masked = new Set<string>();
  const mask = (text: string) => {
    const outcome = maskPersonalInfo(text);
    outcome.masked.forEach((label) => masked.add(label));
    return outcome.text;
  };
  const now = new Date().toISOString();

  const doc: SavedDocument = {
    id: newId(),
    source: 'analysis',
    title: mask(options.title.trim() || result.doc_type),
    docType: mask(result.doc_type),
    category: result.category,
    summary: mask(result.summary),
    keywords: result.keywords.map(mask),
    memo: mask(options.memo),
    savedAt: now,
    viewedAt: now,
    passages: [...result.passages]
      .sort((a, b) => a.order - b.order)
      .map((passage) => ({ text: mask(passage.text), easy: passage.easy && mask(passage.easy) })),
    terms: result.terms.map((term) => ({ original: mask(term.original), easy: mask(term.easy) })),
    warnings: result.warnings.map((warning) => ({
      level: warning.level,
      text: mask(warning.text),
      source_kind: warning.source_kind,
    })),
    tasks: result.tasks.map((task) => ({
      id: newId(),
      action: mask(task.action),
      deadline: task.deadline,
      deadline_kind: task.deadline_kind,
      if_missed: mask(task.if_missed),
      evidence: mask(task.evidence),
      done: false,
      doneAt: null,
    })),
    fullText: mask(result.full_text || result.passages.map((passage) => passage.text).join('\n\n')),
    maskedLabels: [],
  };
  doc.maskedLabels = [...masked];
  return doc;
}

/** 일정 화면에서 직접 적는 할 일 하나 */
export function manualDocument(input: {
  action: string;
  deadline: string | null;
  memo: string;
}): SavedDocument {
  const now = new Date().toISOString();
  const mask = (text: string) => maskPersonalInfo(text).text;
  const action = mask(input.action.trim());
  return {
    id: newId(),
    source: 'manual',
    title: action,
    docType: '직접 추가한 일정',
    category: 'unknown',
    summary: '',
    keywords: [],
    memo: mask(input.memo),
    savedAt: now,
    viewedAt: now,
    passages: [],
    terms: [],
    warnings: [],
    tasks: [
      {
        id: newId(),
        action,
        deadline: input.deadline,
        deadline_kind: input.deadline ? 'explicit' : 'unclear',
        if_missed: '',
        evidence: '',
        done: false,
        doneAt: null,
      },
    ],
    fullText: '',
    maskedLabels: [],
  };
}

// ── 찾기 ────────────────────────────────────────────────

export type RecentFilter = 'all' | '7' | '30';

/**
 * 보관함 검색. 띄어쓰기로 나눈 낱말이 모두 들어 있는 문서만 남기고,
 * 제목·핵심어에 걸리면 본문에 걸린 것보다 위로 올립니다.
 * 검색어가 없으면 최근에 본 순서대로 돌려줍니다.
 */
export function searchDocuments(
  docs: SavedDocument[],
  query: string,
  recent: RecentFilter = 'all',
): SavedDocument[] {
  const limit = recent === 'all' ? null : Number(recent);
  const pool = docs.filter((doc) => {
    if (limit === null) return true;
    const daysAgo = -daysUntil(doc.viewedAt.slice(0, 10));
    return daysAgo <= limit;
  });

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const byViewed = (a: SavedDocument, b: SavedDocument) => b.viewedAt.localeCompare(a.viewedAt);
  if (words.length === 0) return [...pool].sort(byViewed);

  const scored = pool
    .map((doc) => {
      const head = [doc.title, doc.docType, ...doc.keywords].join(' ').toLowerCase();
      const body = [
        doc.summary,
        doc.memo,
        doc.fullText,
        ...doc.tasks.map((task) => task.action),
        ...doc.terms.map((term) => `${term.original} ${term.easy}`),
      ]
        .join(' ')
        .toLowerCase();
      let score = 0;
      for (const word of words) {
        if (head.includes(word)) score += 3;
        else if (body.includes(word)) score += 1;
        else return null;
      }
      return { doc, score };
    })
    .filter((entry): entry is { doc: SavedDocument; score: number } => entry !== null);

  return scored
    .sort((a, b) => b.score - a.score || byViewed(a.doc, b.doc))
    .map((entry) => entry.doc);
}

/** 검색어 주변 한 토막을 보여주기 위한 발췌 */
export function excerpt(doc: SavedDocument, query: string, radius = 40): string | null {
  const word = query.trim().split(/\s+/)[0];
  if (!word) return null;
  const haystack = `${doc.memo}\n${doc.fullText}`;
  const index = haystack.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) return null;
  const start = Math.max(0, index - radius);
  const end = Math.min(haystack.length, index + word.length + radius);
  return `${start > 0 ? '…' : ''}${haystack.slice(start, end).replace(/\s+/g, ' ')}${end < haystack.length ? '…' : ''}`;
}

// ── 일정 ────────────────────────────────────────────────

export interface ScheduleItem {
  doc: SavedDocument;
  task: SavedTask;
}

/** 보관함 전체에서 기한이 있는 할 일을 날짜순으로 */
export function scheduleItems(docs: SavedDocument[]): ScheduleItem[] {
  return docs
    .flatMap((doc) => doc.tasks.map((task) => ({ doc, task })))
    .filter((item) => item.task.deadline !== null)
    .sort((a, b) => a.task.deadline!.localeCompare(b.task.deadline!));
}

// ── 백업 ────────────────────────────────────────────────

/** 기기를 바꾸거나 브라우저를 지우기 전에 보관함을 파일로 받아둡니다 */
export async function exportBackup(): Promise<Blob> {
  const docs = await listDocuments();
  return new Blob(
    [JSON.stringify({ app: 'easy-document', version: 1, documents: docs }, null, 2)],
    {
      type: 'application/json',
    },
  );
}

export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as { app?: string; documents?: SavedDocument[] };
  if (data.app !== 'easy-document' || !Array.isArray(data.documents)) {
    throw new Error('not-a-backup');
  }
  for (const doc of data.documents) {
    if (typeof doc?.id === 'string' && Array.isArray(doc.tasks)) {
      // 다른 곳에서 만든 파일일 수 있으니 불러올 때도 한 번 더 가립니다
      const mask = (text: string) => maskPersonalInfo(text ?? '').text;
      await putDocument({ ...doc, fullText: mask(doc.fullText), memo: mask(doc.memo) });
    }
  }
  return data.documents.length;
}
