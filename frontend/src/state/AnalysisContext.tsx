import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CONFIDENCE_THRESHOLD,
  type AnalysisResult,
  type Category,
  type DocTypeCandidate,
} from '@shared/schemas/result';
import type { AnalysisInput, Stage } from '@/lib/analysisClient';
import { createAnalysisClient } from '@/lib/client';

/**
 * 분석 한 건의 상태.
 *
 * 모두 메모리에만 둡니다. 새로고침하면 사라지는 것이 정상입니다.
 * 사용자가 "보관하기"를 눌렀을 때만 보관함(lib/archive.ts)에 기기 안으로 옮깁니다.
 */
interface DocumentLabel {
  docType: string;
  category: Category;
  confidence: number;
}

interface AnalysisState {
  /** 분석을 시작한 적이 있는지 */
  started: boolean;
  /**
   * 사용자가 올린 원본. 워드로 내려받을 때 문서에 함께 담습니다.
   * 메모리에만 두고 서버로는 보내지 않습니다.
   */
  input: AnalysisInput | null;
  stage: Stage;
  statusMessage: string;
  label: DocumentLabel | null;
  /** 스트리밍으로 지금까지 받은 설명 텍스트 */
  narration: string;
  result: AnalysisResult | null;
  error: string | null;
  /**
   * 문서 종류를 사용자에게 물어봐야 하는지. 확신도가 낮고 후보가 있으며,
   * 아직 사용자가 답하지 않았을 때 true입니다.
   */
  needsConfirmation: boolean;
  start: (input: AnalysisInput, hint?: DocTypeCandidate) => void;
  /** "이 문서는 ○○예요" — 고른 종류로 다시 점검합니다 */
  chooseDocType: (candidate: DocTypeCandidate) => void;
  /** "처음 판단이 맞아요" — 그대로 결과로 넘어갑니다 */
  keepDocType: () => void;
  /** "삭제하고 종료" — 들고 있던 내용을 전부 버립니다 */
  reset: () => void;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

const initialStatus = '준비하고 있어요';

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState<AnalysisInput | null>(null);
  const [stage, setStage] = useState<Stage>('uploading');
  const [statusMessage, setStatusMessage] = useState(initialStatus);
  const [label, setLabel] = useState<DocumentLabel | null>(null);
  const [narration, setNarration] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const clientRef = useRef(createAnalysisClient());

  const start = useCallback((input: AnalysisInput, hint?: DocTypeCandidate) => {
    clientRef.current.cancel();
    clientRef.current = createAnalysisClient();

    setStarted(true);
    setInput(input);
    setStage('uploading');
    setStatusMessage(initialStatus);
    setLabel(null);
    setNarration('');
    setResult(null);
    setError(null);
    // 사용자가 종류를 직접 골랐으면 다시 묻지 않습니다
    setConfirmed(Boolean(hint));

    void clientRef.current.analyze(
      input,
      (event) => {
        switch (event.type) {
          case 'progress':
            setStage(event.stage);
            setStatusMessage(event.message);
            break;
          case 'label':
            setLabel({
              docType: event.docType,
              category: event.category,
              confidence: event.confidence,
            });
            break;
          case 'delta':
            setNarration((previous) => previous + event.text);
            break;
          case 'result':
            setResult(event.result);
            break;
          case 'error':
            setError(event.message);
            break;
        }
      },
      { docTypeHint: hint },
    );
  }, []);

  const chooseDocType = useCallback(
    (candidate: DocTypeCandidate) => {
      if (input) start(input, candidate);
    },
    [input, start],
  );

  const keepDocType = useCallback(() => setConfirmed(true), []);

  const needsConfirmation = Boolean(
    result &&
    !confirmed &&
    result.confidence < CONFIDENCE_THRESHOLD &&
    result.candidates.length > 0,
  );

  const reset = useCallback(() => {
    clientRef.current.cancel();
    setStarted(false);
    setInput(null);
    setStage('uploading');
    setStatusMessage(initialStatus);
    setLabel(null);
    setNarration('');
    setResult(null);
    setError(null);
    setConfirmed(false);
  }, []);

  const value = useMemo<AnalysisState>(
    () => ({
      started,
      input,
      stage,
      statusMessage,
      label,
      narration,
      result,
      error,
      needsConfirmation,
      start,
      chooseDocType,
      keepDocType,
      reset,
    }),
    [
      started,
      input,
      stage,
      statusMessage,
      label,
      narration,
      result,
      error,
      needsConfirmation,
      start,
      chooseDocType,
      keepDocType,
      reset,
    ],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisState {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis는 AnalysisProvider 안에서만 쓸 수 있습니다.');
  }
  return context;
}
