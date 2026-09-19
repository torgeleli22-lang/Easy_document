import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/state/AnalysisContext';
import type { Stage } from '@/lib/analysisClient';
import { withRo } from '@/lib/korean';
import './analysis.css';

/** 사용자에게 보여줄 진행 단계 (기획서 FR-18) */
const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'uploading', label: '문서 올리는 중' },
  { stage: 'classifying', label: '문서 유형 확인 중' },
  { stage: 'analyzing', label: '내용 분석 중' },
  { stage: 'verifying', label: '숫자와 근거 검증 중' },
];

const stageOrder: Stage[] = ['uploading', 'classifying', 'analyzing', 'verifying', 'done'];

/**
 * 분석 중 화면.
 *
 * 결과를 다 기다렸다가 한 번에 보여주지 않고, 만들어지는 대로 흘려보냅니다.
 * 사용자가 "멈춘 건가?" 하고 불안해하지 않게 하는 것이 목적입니다 (기획서 2장).
 */
export function AnalysisPage() {
  const navigate = useNavigate();
  const { started, stage, statusMessage, label, narration, result, error } = useAnalysis();

  // 새로고침 등으로 상태가 없으면 첫 화면으로 돌려보냅니다.
  useEffect(() => {
    if (!started) navigate('/', { replace: true });
  }, [started, navigate]);

  // 검증까지 끝나면 결과 화면으로 넘어갑니다.
  useEffect(() => {
    if (result) navigate('/result', { replace: true });
  }, [result, navigate]);

  const currentIndex = stageOrder.indexOf(stage);

  return (
    <main className="page">
      <h1 className="page__title">문서를 읽고 있어요</h1>

      {/* 진행 상태가 바뀔 때마다 스크린리더도 읽도록 합니다 */}
      <p className="analysis__status" role="status" aria-live="polite">
        {statusMessage}
      </p>

      <ol className="analysis__steps">
        {STEPS.map((step, index) => {
          const state =
            index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'waiting';
          return (
            <li key={step.stage} className={`analysis__step analysis__step--${state}`}>
              <span className="analysis__step-mark" aria-hidden="true">
                {state === 'done' ? '✓' : '•'}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {label && (
        <section className="card analysis__label" aria-live="polite">
          <h2 className="card__title">{withRo(label.docType)} 인식했어요</h2>
          <button type="button" className="button button--secondary">
            아니에요
          </button>
        </section>
      )}

      {narration && (
        <section className="card" aria-labelledby="narration-title">
          <h2 className="card__title" id="narration-title">
            쉬운 말로 풀어보면
          </h2>
          {/* 스트리밍 중에는 계속 바뀌므로 끝난 뒤에만 읽어주도록 off */}
          <p className="analysis__narration" aria-live="off">
            {narration}
            {stage !== 'done' && <span className="analysis__caret" aria-hidden="true" />}
          </p>
        </section>
      )}

      {error && (
        <section className="card analysis__error" role="alert">
          <h2 className="card__title">문제가 생겼어요</h2>
          <p>{error}</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => navigate('/', { replace: true })}
          >
            처음으로 돌아가기
          </button>
        </section>
      )}
    </main>
  );
}
