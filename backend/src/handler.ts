import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from 'aws-lambda';
import { analyzeDocument, type AnalyzeRequest, type ModelConfig } from './core/analyze';
import { AnalysisError } from './core/errors';
import { MAX_IMAGES, createUploadSlots, isAllowedType, takeImages } from './core/uploads';

/**
 * Lambda Function URL 진입점.
 *
 *   POST /upload-urls  사진 N장을 올릴 S3 업로드 주소 발급
 *   POST /analyze      글 또는 올린 사진을 분석해 결과 스키마로 응답
 *
 * CORS 응답 헤더와 OPTIONS 요청은 Function URL 설정(infra/template.yaml)이 처리합니다.
 */

/** 붙여넣기 글 최대 길이. 계약서 여러 장 분량이면 충분합니다 */
const MAX_TEXT_LENGTH = 30000;

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`환경 변수 ${name}이(가) 없습니다`);
  return value;
};

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const modelConfig: ModelConfig = {
  model: process.env.MODEL_ID ?? 'anthropic.claude-opus-5',
  fallbackModel: process.env.FALLBACK_MODEL_ID || null,
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
};

const json = (statusCode: number, body: unknown): LambdaFunctionURLResult => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

function parseBody(event: LambdaFunctionURLEvent): Record<string, unknown> {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : (event.body ?? '');
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 아래에서 같은 오류로 처리합니다.
  }
  throw new AnalysisError('bad_request', '요청 형식이 올바르지 않아요.');
}

async function handleUploadUrls(body: Record<string, unknown>) {
  const contentTypes = body.contentTypes;
  if (
    !Array.isArray(contentTypes) ||
    contentTypes.length < 1 ||
    contentTypes.length > MAX_IMAGES ||
    !contentTypes.every(isAllowedType)
  ) {
    throw new AnalysisError('bad_request', `사진은 JPG·PNG·WEBP로 ${MAX_IMAGES}장까지 올릴 수 있어요.`);
  }
  return createUploadSlots(env('UPLOAD_BUCKET'), contentTypes);
}

async function handleAnalyze(body: Record<string, unknown>) {
  let request: AnalyzeRequest;

  if (body.kind === 'text') {
    const text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) throw new AnalysisError('bad_request', '점검할 내용이 비어 있어요.');
    if (text.length > MAX_TEXT_LENGTH) {
      throw new AnalysisError('too_large', `글은 ${MAX_TEXT_LENGTH.toLocaleString('ko-KR')}자까지 점검할 수 있어요.`);
    }
    request = { kind: 'text', text };
  } else if (body.kind === 'images') {
    const images = await takeImages(env('UPLOAD_BUCKET'), String(body.uploadId ?? ''), Number(body.count));
    request = { kind: 'images', images };
  } else {
    throw new AnalysisError('bad_request', '요청 형식이 올바르지 않아요.');
  }

  return { result: await analyzeDocument(request, modelConfig) };
}

export async function handler(event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    // 브라우저 밖에서 주소만 알고 호출하는 것을 한 번 걸러냅니다.
    // 완전한 차단은 아니므로 예산 알림을 함께 둡니다.
    const origin = event.headers.origin ?? '';
    if (!allowedOrigins.includes(origin)) {
      throw new AnalysisError('forbidden_origin', '허용되지 않은 곳에서 온 요청이에요.');
    }
    if (method !== 'POST') throw new AnalysisError('not_found', '없는 주소예요.');

    if (path === '/upload-urls') return json(200, await handleUploadUrls(parseBody(event)));
    if (path === '/analyze') return json(200, await handleAnalyze(parseBody(event)));
    throw new AnalysisError('not_found', '없는 주소예요.');
  } catch (error) {
    if (error instanceof AnalysisError) {
      return json(error.status, { error: { code: error.code, message: error.message } });
    }
    console.error('unexpected error', error);
    return json(500, {
      error: { code: 'internal', message: '서버에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.' },
    });
  }
}
