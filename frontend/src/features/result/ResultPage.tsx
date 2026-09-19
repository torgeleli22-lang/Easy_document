import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/state/AnalysisContext';
import { SummaryCard } from './cards/SummaryCard';
import { TasksCard } from './cards/TasksCard';
import { TermsCard } from './cards/TermsCard';
import { WarningsCard } from './cards/WarningsCard';
import { DisclaimerCard } from './cards/DisclaimerCard';
import { buildShareText } from './shareText';
import { downloadResultDocx } from './exportDocx';
import './result.css';

/**
 * 결과 화면.
 *
 * 카드를 위에서 아래로 한 줄씩 쌓습니다. 한 화면에 한 정보씩 보이도록
 * 폭을 좁게 묶고 카드 사이를 넉넉히 띄웁니다 (기획서 4.4).
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
        await navigator.share({ title: `${result.doc_type} 요약`, text });
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
    if (!result) return;

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

  return (
    <main className="page">
      <SummaryCard docType={result.doc_type} summary={result.summary} />
      <TasksCard tasks={result.tasks} />
      <TermsCard terms={result.terms} />
      <WarningsCard warnings={result.warnings} />
      <DisclaimerCard
        needsExpert={result.needs_expert}
        specializationHint={result.specialization_hint}
      />

      <section className="result__actions" aria-label="결과 활용하기">
        <button type="button" className="button button--secondary button--block" onClick={handleShare}>
          가족에게 보내기
        </button>

        <button
          type="button"
          className="button button--secondary button--block"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? '워드 파일 만드는 중…' : '워드 파일로 내려받기'}
        </button>

        <button type="button" className="button button--primary button--block" onClick={handleFinish}>
          이해했어요, 삭제하고 종료
        </button>

        <p className="result__copied" role="status">
          {copied ? '요약을 복사했어요. 붙여넣어 보내세요.' : ''}
        </p>

        {downloadError && (
          <p className="result__download-error" role="alert">
            파일을 만들지 못했어요. 잠시 뒤에 다시 눌러주세요.
          </p>
        )}
      </section>
    </main>
  );
}
