import type { AnalysisResult, Category } from '@shared/schemas/result';

/**
 * 분석 클라이언트 인터페이스.
 *
 * 지금은 목업 구현(mockClient.ts)만 있고, 백엔드가 준비되면
 * 같은 인터페이스의 WebSocket 구현(socket.ts)으로 갈아끼웁니다.
 * 화면 쪽 코드는 어느 구현인지 알 필요가 없습니다.
 */

/** 진행 단계 — 기획서 FR-18의 "문서 유형 확인 중 → 분석 중 → 검증 중" */
export type Stage = 'uploading' | 'classifying' | 'analyzing' | 'verifying' | 'done';

export type AnalysisEvent =
  /** 진행 상태가 바뀜 */
  | { type: 'progress'; stage: Stage; message: string }
  /** 라우터(경량 모델)가 표시 라벨과 처리 카테고리를 판단함 */
  | { type: 'label'; docType: string; category: Category; confidence: number }
  /** 본 분석 스트리밍 조각 — 받는 즉시 화면에 이어붙임 */
  | { type: 'delta'; text: string }
  /** 검증까지 끝난 최종 구조화 결과 */
  | { type: 'result'; result: AnalysisResult }
  | { type: 'error'; message: string };

export type AnalysisInput =
  | { kind: 'file'; file: File }
  | { kind: 'text'; text: string };

export interface AnalysisClient {
  /**
   * 분석을 시작하고, 이벤트가 생길 때마다 onEvent를 호출합니다.
   * 완료되거나 취소되면 Promise가 끝납니다.
   */
  analyze(input: AnalysisInput, onEvent: (event: AnalysisEvent) => void): Promise<void>;
  /** 사용자가 화면을 떠나거나 종료를 누르면 호출 */
  cancel(): void;
}
