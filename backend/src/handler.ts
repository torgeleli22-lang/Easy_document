import { analyzeDocument, UserFacingError, type AnalyzeRequest } from './analyze';

/**
 * AWS Lambda 함수 URL 진입점.
 *
 * POST / 에 JSON(AnalyzeRequest)을 받아 { result } 또는 { error }를 돌려줍니다.
 * 문서는 메모리에서만 다루고 어디에도 저장하지 않습니다 (S3·DB 없음, 본문 로그 없음).
 */

interface FunctionUrlEvent {
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  requestContext?: { http?: { method?: string } };
}

interface FunctionUrlResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** 쉼표로 여러 개. 비어 있으면 모든 출처를 허용합니다 (개발용) */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed =
    ALLOWED_ORIGINS.length === 0
      ? '*'
      : origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
}

function reply(statusCode: number, body: unknown, origin: string | undefined): FunctionUrlResponse {
  return { statusCode, headers: corsHeaders(origin), body: JSON.stringify(body) };
}

export async function handler(event: FunctionUrlEvent): Promise<FunctionUrlResponse> {
  const origin = event.headers?.origin;
  const method = event.requestContext?.http?.method ?? 'POST';

  if (method === 'OPTIONS') return reply(204, {}, origin);
  if (method !== 'POST') return reply(405, { error: '허용되지 않는 요청이에요.' }, origin);
  if (ALLOWED_ORIGINS.length > 0 && (!origin || !ALLOWED_ORIGINS.includes(origin))) {
    return reply(403, { error: '허용되지 않는 출처예요.' }, origin);
  }

  let request: AnalyzeRequest;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '');
    request = JSON.parse(raw) as AnalyzeRequest;
  } catch {
    return reply(400, { error: '요청 형식이 올바르지 않아요.' }, origin);
  }

  try {
    const result = await analyzeDocument(request);
    return reply(200, { result }, origin);
  } catch (error) {
    if (error instanceof UserFacingError) {
      return reply(error.status, { error: error.message }, origin);
    }
    console.error('예상하지 못한 오류', error instanceof Error ? error.name : 'unknown');
    return reply(500, { error: '점검 중 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.' }, origin);
  }
}
