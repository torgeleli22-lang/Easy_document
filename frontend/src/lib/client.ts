import type { AnalysisClient } from './analysisClient';
import { createMockAnalysisClient } from './mockClient';

/**
 * 화면이 쓸 분석 클라이언트를 고르는 단 한 곳.
 *
 * 지금은 목업만 있습니다. 백엔드가 올라오면 여기서
 * VITE_USE_MOCK 값에 따라 WebSocket 구현을 돌려주도록 바꾸면 되고,
 * 화면 코드는 건드릴 필요가 없습니다.
 */
export function createAnalysisClient(): AnalysisClient {
  return createMockAnalysisClient();
}
