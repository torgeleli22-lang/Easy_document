import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Passage, PassageRegion } from '@shared/schemas/result';
import { splitByPassages, type SourceView } from './source';

interface Props {
  source: SourceView;
  passages: Passage[];
  /** 오른쪽에서 지금 읽고 있는 구간 */
  activeId: string | null;
  /** 원본에서 구간을 누르면 오른쪽 풀이를 그 자리로 옮깁니다 */
  onSelect: (passageId: string) => void;
}

/** AI가 짐작한 위치라 위아래로 조금씩 여유를 둡니다 (사진 높이 대비) */
const REGION_MARGIN = 0.02;

/** 지금 읽는 부분이 창 위쪽 1/4 지점쯤 오도록 맞춥니다 */
const FOLLOW_OFFSET = 0.25;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 누를 수 있는 구간에 키보드 동작을 붙입니다 */
function activateOnKey(event: KeyboardEvent, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

/**
 * 결과 화면 왼쪽의 원본.
 *
 * 올린 원본을 그대로 보여주고, 오른쪽에서 읽고 있는 구간만 밝게 두고
 * 나머지는 옅게 가립니다. 읽는 위치가 바뀌면 원본도 그 자리로 따라 움직입니다.
 * 좁은 화면에서는 화면 위쪽에 붙은 띠가 되어 같은 일을 합니다.
 */
export function SourcePane({ source, passages, activeId, onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'original' | 'transcript'>('original');
  const [expanded, setExpanded] = useState(false);

  const segments = useMemo(
    () => (source.kind === 'text' ? splitByPassages(source.text, passages) : null),
    [source, passages],
  );

  // 글을 붙여넣었는데 구간을 하나도 찾지 못했거나, 원본 모양을 보여줄 수 없는 형식이면
  // 옮겨 적은 글로 대신합니다.
  const showTranscript =
    source.kind === 'transcript' ||
    (source.kind === 'text' && segments === null) ||
    (source.kind === 'images' && view === 'transcript');

  // 읽는 위치가 바뀌면 원본을 그 자리로 옮깁니다. 페이지 전체가 아니라 이 칸만 움직입니다.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !activeId) return;

    const target = scroller.querySelector<HTMLElement>(`[data-target-for="${activeId}"]`);
    if (!target) return;

    const offset =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      scroller.clientHeight * FOLLOW_OFFSET;

    scroller.scrollTo({
      top: Math.max(0, offset),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [activeId, showTranscript, expanded]);

  const ordered = useMemo(() => [...passages].sort((a, b) => a.order - b.order), [passages]);

  return (
    <aside
      className={`source-pane${expanded ? ' source-pane--expanded' : ''}`}
      aria-label="올리신 원본"
    >
      <div className="source-pane__bar">
        <span className="source-pane__label">
          {source.kind === 'transcript' ? '원문 (옮겨 적은 글)' : '올리신 원본'}
        </span>

        {source.kind === 'images' && (
          <div className="source-pane__tabs" role="group" aria-label="원본 보기 방식">
            <button
              type="button"
              className="source-pane__tab"
              aria-pressed={view === 'original'}
              onClick={() => setView('original')}
            >
              사진
            </button>
            <button
              type="button"
              className="source-pane__tab"
              aria-pressed={view === 'transcript'}
              onClick={() => setView('transcript')}
            >
              옮겨 적은 글
            </button>
          </div>
        )}

        <button
          type="button"
          className="source-pane__expand"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? '작게 보기' : '크게 보기'}
        </button>
      </div>

      <div
        ref={scrollerRef}
        className={`source-pane__scroller${activeId ? ' is-focusing' : ''}`}
        tabIndex={0}
        aria-label="원본 내용"
      >
        {showTranscript ? (
          <Transcript passages={ordered} activeId={activeId} onSelect={onSelect} />
        ) : source.kind === 'text' && segments ? (
          <p className="source-text">
            {segments.map((segment, index) =>
              segment.passageId ? (
                <PassageMark
                  key={index}
                  passageId={segment.passageId}
                  active={segment.passageId === activeId}
                  onSelect={onSelect}
                >
                  {segment.text}
                </PassageMark>
              ) : (
                <span key={index} className="source-text__rest">
                  {segment.text}
                </span>
              ),
            )}
          </p>
        ) : source.kind === 'images' ? (
          <ImagePages files={source.files} passages={ordered} activeId={activeId} onSelect={onSelect} />
        ) : null}

        {source.kind === 'transcript' && source.fileName && (
          <p className="source-pane__note">
            {source.fileName} 파일은 아직 원본 모양 그대로 보여드리지 못해, AI가 옮겨 적은 글로
            보여드려요.
          </p>
        )}
      </div>
    </aside>
  );
}

interface MarkProps {
  passageId: string;
  active: boolean;
  onSelect: (passageId: string) => void;
  children: string;
}

/** 풀이가 붙은 원문 구간. 누르면 오른쪽 풀이로 이동합니다 */
function PassageMark({ passageId, active, onSelect, children }: MarkProps) {
  return (
    <span
      className={`source-text__passage${active ? ' is-active' : ''}`}
      data-target-for={passageId}
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect(passageId)}
      onKeyDown={(event) => activateOnKey(event, () => onSelect(passageId))}
    >
      {children}
    </span>
  );
}

interface TranscriptProps {
  passages: Passage[];
  activeId: string | null;
  onSelect: (passageId: string) => void;
}

/** AI가 옮겨 적은 원문. 구간마다 한 문단으로 보여줍니다 */
function Transcript({ passages, activeId, onSelect }: TranscriptProps) {
  return (
    <div className="source-transcript">
      {passages.map((passage) => (
        <p key={passage.id} className="source-transcript__item">
          <PassageMark
            passageId={passage.id}
            active={passage.id === activeId}
            onSelect={onSelect}
          >
            {passage.text}
          </PassageMark>
        </p>
      ))}
    </div>
  );
}

interface ImagePagesProps {
  files: File[];
  passages: Passage[];
  activeId: string | null;
  onSelect: (passageId: string) => void;
}

function clampRegion(region: PassageRegion): { top: number; bottom: number } {
  const top = Math.max(0, Math.min(region.top, region.bottom) - REGION_MARGIN);
  const bottom = Math.min(1, Math.max(region.top, region.bottom) + REGION_MARGIN);
  return { top, bottom };
}

/**
 * 올린 사진을 순서대로 세로로 늘어놓습니다.
 *
 * 읽고 있는 구간의 위치를 알면 그 가로 띠만 밝게 두고 위아래를 가립니다.
 * 위치를 모르는 구간이면 사진을 가리지 않고 그대로 둡니다.
 */
function ImagePages({ files, passages, activeId, onSelect }: ImagePagesProps) {
  const [urls, setUrls] = useState<string[]>([]);

  // 사진은 브라우저 안에서만 보여줍니다. 화면을 떠나면 바로 놓아줍니다.
  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file));
    setUrls(created);
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const active = passages.find((passage) => passage.id === activeId);
  const activeRegion = active?.region ?? null;

  return (
    <div className="source-images">
      {urls.map((url, imageIndex) => {
        const onThisImage = activeRegion?.image_index === imageIndex;
        const band = onThisImage && activeRegion ? clampRegion(activeRegion) : null;
        const hideWhole = activeRegion !== null && !onThisImage;
        const regions = passages.filter((passage) => passage.region?.image_index === imageIndex);

        return (
          <figure key={url} className="source-image">
            <img src={url} alt={`올리신 사진 ${imageIndex + 1}번째 장`} />
            {files.length > 1 && (
              <figcaption className="source-image__caption">
                {imageIndex + 1} / {files.length}
              </figcaption>
            )}

            {/* 각 구간 자리를 누르면 해당 풀이로 이동합니다 */}
            {regions.map((passage) => {
              const { top, bottom } = clampRegion(passage.region as PassageRegion);
              return (
                <span
                  key={passage.id}
                  className="source-image__hit"
                  style={{ top: `${top * 100}%`, height: `${(bottom - top) * 100}%` }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${passage.order}번째 부분 풀이 보기`}
                  onClick={() => onSelect(passage.id)}
                  onKeyDown={(event) => activateOnKey(event, () => onSelect(passage.id))}
                />
              );
            })}

            {band && (
              <>
                <span className="source-image__shade" style={{ top: 0, height: `${band.top * 100}%` }} />
                <span
                  className="source-image__band"
                  data-target-for={activeId ?? undefined}
                  style={{ top: `${band.top * 100}%`, height: `${(band.bottom - band.top) * 100}%` }}
                />
                <span
                  className="source-image__shade"
                  style={{ top: `${band.bottom * 100}%`, bottom: 0 }}
                />
              </>
            )}
            {hideWhole && <span className="source-image__shade" style={{ inset: 0 }} />}
          </figure>
        );
      })}
    </div>
  );
}
