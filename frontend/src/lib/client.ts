import type { AnalysisClient } from './analysisClient';
import { createMockAnalysisClient } from './mockClient';
import { createHttpAnalysisClient } from './httpClient';

/**
 * 화면이 쓸 분석 클라이언트를 고르는 단 한 곳.
 *
 * VITE_API_URL이 있고 VITE_USE_MOCK이 'true'가 아니면 실제 백엔드를,
 * 그렇지 않으면 목업을 씁니다. 화면 코드는 어느 쪽인지 알 필요가 없습니다.
 */
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
const useMock = import.meta.env.VITE_USE_MOCK === 'true' || !apiUrl;

export const isMockMode = useMock;

export function createAnalysisClient(): AnalysisClient {
  return useMock ? createMockAnalysisClient() : createHttpAnalysisClient(apiUrl!);
}
