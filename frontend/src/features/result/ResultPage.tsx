import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnalysisResult } from '@shared/schemas/result';
import { useAnalysis } from '@/state/AnalysisContext';
import { ReportSection } from './ReportSection';
import { SummaryCard } from './cards/SummaryCard';
import { TasksCard } from './cards/TasksCard';
import { TermsCard } from './cards/TermsCard';
import { WarningsCard } from './cards/WarningsCard';
import { DisclaimerCard } from './cards/DisclaimerCard';
import { PassageExplanation } from './PassageExplanation';
import { SourcePane } from './SourcePane';
import { sourceFromInput } from './source';
import { useActivePassage } from './useActivePassage';
import { buildShareText } from './shareText';
import { downloadResultDocx } from './exportDocx';
import './result.css';

/** 결과서 머리글에 찍는 점검 일시 */
function formatToday(): string {
  const today = new Date();
  return `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;
}

/**
 * 항목을 자기가 걸린 원문 구간별로 나눕니다.
 * 구간이 없거나 없는 구간을 가리키는 항목은 "문서 밖의 안내"로 따로 모읍니다.
 */
function groupByPassage(result: AnalysisResult) {
  const known = new Set(result.passages.map((passage) => passage.id));
  const belongs = (id: string | null, passageId: string) => id === passageId;
  const outside = (id: string | null) => !id || !known.has(id);

  return {
    passages: [...result.passages]
      .sort((a, b) => a.order - b.order)
      .map((passage) => ({
        passage,
        tasks: result.tasks.filter((task) => belongs(task.passage_id, passage.id)),
        terms: result.terms.filter((term) => belongs(term.passage_id, passage.id)),
        warnings: result.warnings.filter((warning) => belongs(warning.passage_id, passage.id)),
      })),
    general: {
      tasks: result.tasks.filter((task) => outside(task.passage_id)),
      terms: result.terms.filter((term) => outside(term.passage_id)),
      warnings: result.warnings.filter((warning) => outside(warning.passage_id)),
    },
  };
}

/**
 * 점검 결과 화면.
 *
 * 왼쪽에 올린 원본을 그대로 두고, 오른쪽에 원문 순서대로 구간별 풀이를 놓습니다.
 * 오른쪽을 읽어 내려가면 왼쪽 원본에서 그 풀이에 해당하는 부분만 밝게 표시됩니다.
 * 좁은 화면에서는 원본이 화면 위쪽에 붙은 띠가 되고 풀이가 그 아래로 이어집니다.
 */
export function ResultPage() {
  const navigate = useNavigate();
  const { started, input, result, reset } = useAnalysis();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const explainRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const activeId = useActivePassage(explainRef, sourceRef);

  const source = useMemo(() => sourceFromInput(input), [input]);
  const groups = useMemo(() => (result ? groupByPassage(result) : null), [result]);

  useEffect(() => {
    if (!started || !result) navigate('/', { replace: true });
  }, [started, result, navigate]);

  // 원본에서 구간을 누르면 오른쪽 풀이를 읽는 줄 위치로 옮깁니다
  const handleSelect = useCallback((passageId: string) => {
    const target = document.getElementById(`note-${passageId}`);
    if (!target) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  if (!result || !groups) return null;

  const handleShare = async () => {
    const text = buildShareText(result);

    // 기기의 공유 시트를 띄웁니다. 서버를 거치지 않습니다 (기획서 4.7).
    if (navigator.share) {
      try {
        await navigator.share({ title: `${result.doc_type} 점검 결과`, text });
        return;
      } catch {
        // 사용자가 공유를 취소한 경우입니다. 복사로 넘어갑니다.
      }
    }

    // 공유 기능이 없는 브라우저를 위한 대체 수단
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(false);
    try {
      // 파일은 브라우저 안에서 만듭니다. 서버로 아무것도 보내지 않습니다.
      await downloadResultDocx(result, input);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  const handleFinish = () => {
    reset();
    navigate('/', { replace: true });
  };

  const highWarnings = result.warnings.filter((warning) => warning.level === 'high').length;
  const { general } = groups;
  const hasGeneral = general.tasks.length + general.terms.length + general.warnings.length > 0;

  let sectionNumber = 0;
  const nextNumber = () => String(++sectionNumber).padStart(2, '0');

  return (
    <div className="result-page">
      <header className="report-head">
        <div className="report-head__main">
          <div className="report__heading">
            <span className="eyebrow">점검 결과서</span>
            <h1 className="report__doc-type title">{result.doc_type}</h1>
          </div>

          <dl className="report__facts">
            <div className="report__fact">
              <dt>점검일</dt>
              <dd>{formatToday()}</dd>
            </div>
            <div className="report__fact">
              <dt>해야 할 일</dt>
              <dd>{result.tasks.length}건</dd>
            </div>
            <div className="report__fact">
              <dt>꼭 확인할 점</dt>
              <dd>{highWarnings}건</dd>
            </div>
          </dl>
        </div>

        <div className="result-actions" aria-label="결과 보관하기" role="group">
          <button
            type="button"
            className="button button--primary"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? '워드 파일 만드는 중…' : '워드 파일로 내려받기'}
          </button>
          <button type="button" className="button button--secondary" onClick={handleShare}>
            가족에게 보내기
          </button>
          <p className="result-actions__hint">
            워드 파일에는 원본과 설명이 함께 담기고, 가족에게는 요약만 전달됩니다.
          </p>
          {downloadError && (
            <p className="result-actions__error" role="alert">
              파일을 만들지 못했어요. 잠시 뒤에 다시 눌러주세요.
            </p>
          )}
          <p className="result-actions__status" role="status">
            {copied ? '요약을 복사했어요. 붙여넣어 보내세요.' : ''}
          </p>
        </div>
      </header>

      <div className="compare">
        <div ref={sourceRef} className="compare__source">
          <SourcePane
            source={source}
            passages={result.passages}
            activeId={activeId}
            onSelect={handleSelect}
          />
        </div>

        <article ref={explainRef} className="report compare__explain">
          <ReportSection number={nextNumber()} title="한 줄 요약">
            <SummaryCard summary={result.summary} />
          </ReportSection>

          {groups.passages.length > 0 && (
            <ReportSection
              number={nextNumber()}
              title="원문 풀이"
              count={`${groups.passages.length}곳`}
            >
              <p className="note">
                읽고 있는 부분이 원본에 밝게 표시됩니다. 원본을 누르면 그 부분 풀이로 이동해요.
              </p>
              {groups.passages.map((group) => (
                <PassageExplanation
                  key={group.passage.id}
                  passage={group.passage}
                  tasks={group.tasks}
                  terms={group.terms}
                  warnings={group.warnings}
                  active={group.passage.id === activeId}
                />
              ))}
              {result.tasks.length > 0 && (
                <p className="note">실제 기한은 문서에 적힌 기관에 한 번 더 확인해 주세요.</p>
              )}
            </ReportSection>
          )}

          {hasGeneral && (
            <ReportSection number={nextNumber()} title="문서 밖의 안내">
              <p className="note">문서에는 적혀 있지 않지만 알아두면 좋은 내용이에요.</p>
              {general.warnings.length > 0 && <WarningsCard warnings={general.warnings} />}
              {general.tasks.length > 0 && <TasksCard tasks={general.tasks} showNote={false} />}
              {general.terms.length > 0 && <TermsCard terms={general.terms} />}
            </ReportSection>
          )}

          <ReportSection number={nextNumber()} title="알아두실 점">
            <DisclaimerCard
              needsExpert={result.needs_expert}
              specializationHint={result.specialization_hint}
            />
          </ReportSection>

          <div className="result-finish">
            <button type="button" className="button button--quiet" onClick={handleFinish}>
              이해했어요, 삭제하고 종료
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
