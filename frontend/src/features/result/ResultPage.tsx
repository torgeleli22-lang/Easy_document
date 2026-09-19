import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/state/AnalysisContext';
import { ReportSection } from './ReportSection';
import { SummaryCard } from './cards/SummaryCard';
import { TasksCard } from './cards/TasksCard';
import { TermsCard } from './cards/TermsCard';
import { WarningsCard } from './cards/WarningsCard';
import { DisclaimerCard } from './cards/DisclaimerCard';
import { buildShareText } from './shareText';
import { downloadResultDocx } from './exportDocx';
import './result.css';

/** 결과서 머리글에 찍는 점검 일시 */
function formatToday(): string {
  const today = new Date();
  return `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`;
}

/**
 * 점검 결과 화면.
 *
 * 자유 형식 답변이 아니라 서식이 정해진 결과서처럼 읽히게 구성했습니다.
 * 머리글에 문서명과 점검 일시를 박고, 아래로 번호가 매겨진 항목이 이어집니다.
 */
export function ResultPage() {
  const navigate = useNavigate();
  const { started, input, result, reset } = useAnalysis();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    if (!started || !result) navigate('/', { replace: true });
  }, [started, result, navigate]);

  if (!result) return null;

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

  return (
    <div className="container section">
      <div className="result-layout">
        <article className="report">
          <header className="report__header">
            <div className="report__heading">
              <span className="eyebrow">점검 결과서</span>
              <h1 className="report__doc-type title">{result.doc_type}</h1>
            </div>
            <span className="tag tag--seal">점검 완료</span>
          </header>

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

          <ReportSection number="01" title="한 줄 요약">
            <SummaryCard summary={result.summary} />
          </ReportSection>

          {result.tasks.length > 0 && (
            <ReportSection number="02" title="해야 할 일" count={`${result.tasks.length}건`}>
              <TasksCard tasks={result.tasks} />
            </ReportSection>
          )}

          {result.terms.length > 0 && (
            <ReportSection number="03" title="어려운 말 풀이" count={`${result.terms.length}개`}>
              <TermsCard terms={result.terms} />
            </ReportSection>
          )}

          {result.warnings.length > 0 && (
            <ReportSection number="04" title="주의할 점" count={`${result.warnings.length}건`}>
              <WarningsCard warnings={result.warnings} />
            </ReportSection>
          )}

          <ReportSection number="05" title="알아두실 점">
            <DisclaimerCard
              needsExpert={result.needs_expert}
              specializationHint={result.specialization_hint}
            />
          </ReportSection>
        </article>

        <aside className="result-actions" aria-label="결과 활용하기">
          <h2 className="result-actions__title">결과 보관하기</h2>

          <button
            type="button"
            className="button button--primary button--block"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? '워드 파일 만드는 중…' : '워드 파일로 내려받기'}
          </button>
          <p className="result-actions__hint">원본과 설명이 함께 담긴 문서로 저장됩니다.</p>

          <button
            type="button"
            className="button button--secondary button--block"
            onClick={handleShare}
          >
            가족에게 보내기
          </button>
          <p className="result-actions__hint">요약만 전달되고 원본은 보내지 않습니다.</p>

          {downloadError && (
            <p className="result-actions__error" role="alert">
              파일을 만들지 못했어요. 잠시 뒤에 다시 눌러주세요.
            </p>
          )}

          <p className="result-actions__status" role="status">
            {copied ? '요약을 복사했어요. 붙여넣어 보내세요.' : ''}
          </p>

          <div className="result-actions__finish">
            <button type="button" className="button button--quiet" onClick={handleFinish}>
              이해했어요, 삭제하고 종료
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
