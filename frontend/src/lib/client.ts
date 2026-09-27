import type { AnalysisClient } from './analysisClient';
import { createHttpAnalysisClient } from './httpClient';
import { createMockAnalysisClient } from './mockClient';

/**
 * 화면이 쓸 분석 클라이언트를 고르는 단 한 곳.
 *
 * VITE_API_URL(서버 주소)이 있으면 실제 서버에, 없으면 목업에 연결합니다.
 * 주소가 있어도 VITE_USE_MOCK=true면 목업을 씁니다.
 * 화면 코드는 어느 쪽인지 알 필요가 없습니다.
 */
export function createAnalysisClient(): AnalysisClient {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl && import.meta.env.VITE_USE_MOCK !== 'true') {
    return createHttpAnalysisClient(apiUrl);
  }
  return createMockAnalysisClient();
}
