import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/state/AnalysisContext';
import type { Stage } from '@/lib/analysisClient';
import { withRo } from '@/lib/korean';
import './analysis.css';

/** 사용자에게 보여줄 점검 단계 (기획서 FR-18) */
const STEPS: { stage: Stage; label: string; detail: string }[] = [
  { stage: 'uploading', label: '접수', detail: '문서를 받고 있습니다' },
  { stage: 'classifying', label: '문서 확인', detail: '어떤 문서인지 살펴봅니다' },
  { stage: 'analyzing', label: '내용 점검', detail: '조항과 기한을 하나씩 짚습니다' },
  { stage: 'verifying', label: '검증', detail: '날짜와 금액이 맞는지 대조합니다' },
];

const stageOrder: Stage[] = ['uploading', 'classifying', 'analyzing', 'verifying', 'done'];

/**
 * 점검 중 화면.
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
    <div className="container section">
      <div className="progress-layout">
        <div className="progress-layout__rail">
          <span className="eyebrow">진행 상황</span>

          <ol className="rail">
            {STEPS.map((step, index) => {
              const state =
                index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'waiting';
              return (
                <li key={step.stage} className={`rail__item rail__item--${state}`}>
                  <span className="rail__marker" aria-hidden="true">
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <span className="rail__body">
                    <span className="rail__label">{step.label}</span>
                    <span className="rail__detail">{step.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="progress-layout__main stack">
          <div>
            <h1 className="page-title title">문서를 점검하고 있습니다</h1>
            <p className="analysis__status" role="status" aria-live="polite">
              {statusMessage}
            </p>
          </div>

          {label && (
            <section className="identified" aria-live="polite">
              <div className="identified__text">
                <span className="eyebrow">확인된 문서</span>
                <h2 className="identified__name title">{label.docType}</h2>
                <p className="meta">{withRo(label.docType)} 보고 점검을 진행합니다</p>
              </div>
              <button type="button" className="button button--secondary">
                다른 문서예요
              </button>
            </section>
          )}

          {narration && (
            <section className="transcript" aria-labelledby="narration-title">
              <h2 className="transcript__title" id="narration-title">
                점검 내용
              </h2>
              {/* 스트리밍 중에는 계속 바뀌므로 끝난 뒤에만 읽어주도록 off */}
              <p className="transcript__body" aria-live="off">
                {narration}
                {stage !== 'done' && <span className="transcript__caret" aria-hidden="true" />}
              </p>
            </section>
          )}

          {error && (
            <section className="card analysis__error" role="alert">
              <h2 className="card__title">점검을 마치지 못했습니다</h2>
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
        </div>
      </div>
    </div>
  );
}
