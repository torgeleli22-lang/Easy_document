import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { AnalysisResult } from '../../shared/schemas/result';
import { ModelOutputSchema } from './schema';
import { SYSTEM_PROMPT } from './prompt';
import { toAnalysisResult } from './verify';

/** 브라우저가 보내는 요청 본문 */
export interface AnalyzeRequest {
  /** 붙여넣은 글 */
  text?: string;
  /** 사진(JPEG/PNG/WebP/GIF)이나 PDF. base64, 줄바꿈 없이 */
  files?: { name: string; media_type: string; data: string }[];
  /** 사용자가 "이 문서는 ○○예요"라고 골라준 종류 */
  doc_type_hint?: string;
  /** 사용자 기기 기준 오늘 (YYYY-MM-DD). 상대 기한 계산에 씁니다 */
  today?: string;
}

export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-opus-5-5';
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORT = (process.env.CLAUDE_EFFORT ?? 'medium') as Effort;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// 키는 환경 변수(ANTHROPIC_API_KEY)에서 읽습니다. 코드나 프런트엔드에 넣지 않습니다.
const client = new Anthropic();

function todayInSeoul(): string {
  // sv-SE 로캘은 YYYY-MM-DD 모양으로 찍힙니다
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function buildContent(request: AnalyzeRequest): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];

  for (const file of request.files ?? []) {
    if (IMAGE_TYPES.has(file.media_type)) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.media_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: file.data,
        },
      });
    } else if (file.media_type === 'application/pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.data },
      });
    } else {
      throw new UserFacingError('사진(JPG, PNG)이나 PDF 파일만 점검할 수 있어요.', 400);
    }
  }

  const today =
    request.today && /^\d{4}-\d{2}-\d{2}$/.test(request.today) ? request.today : todayInSeoul();
  const lines = [`오늘 날짜: ${today}`];
  if (request.files?.length) {
    lines.push(`사진·파일 ${request.files.length}개를 순서대로 첨부했습니다.`);
  }
  if (request.doc_type_hint) {
    lines.push(`사용자가 알려준 문서 종류: ${request.doc_type_hint}`);
  }
  if (request.text) {
    lines.push('', '<document>', request.text, '</document>');
  }
  lines.push('', '이 문서를 점검해 주세요.');
  content.push({ type: 'text', text: lines.join('\n') });

  return content;
}

export async function analyzeDocument(request: AnalyzeRequest): Promise<AnalysisResult> {
  const hasText = Boolean(request.text?.trim());
  const hasFiles = Boolean(request.files?.length);
  if (!hasText && !hasFiles) {
    throw new UserFacingError('점검할 문서가 비어 있어요.', 400);
  }

  // 출력이 길 수 있어(원문 전체 + 구간별 풀이) 스트리밍으로 받고 끝난 뒤 한 번에 씁니다.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    // 안전 분류기가 거절하면 서버가 다른 모델로 이어서 처리합니다.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT, format: betaZodOutputFormat(ModelOutputSchema) },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildContent(request) }],
  });

  let message;
  try {
    message = await stream.finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new UserFacingError('지금 점검 요청이 많아요. 잠시 뒤에 다시 시도해 주세요.', 429);
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error('Claude 요청 거부', error.status, error.message);
      throw new UserFacingError(
        '이 파일은 읽을 수 없었어요. 다른 사진으로 다시 시도해 주세요.',
        400,
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API 오류', error.status);
      throw new UserFacingError('점검 서버에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.', 502);
    }
    throw error;
  }

  if (message.stop_reason === 'refusal') {
    throw new UserFacingError('이 문서는 점검해 드릴 수 없어요.', 422);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new UserFacingError('문서가 너무 길어서 다 읽지 못했어요. 나눠서 올려 주세요.', 413);
  }
  if (!message.parsed_output) {
    throw new UserFacingError('결과를 정리하지 못했어요. 다시 시도해 주세요.', 502);
  }

  // 문서 내용은 로그에 남기지 않습니다. 사용량만 남깁니다.
  console.log('analysis done', {
    model: message.model,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    cache_read: message.usage.cache_read_input_tokens,
  });

  return toAnalysisResult(message.parsed_output, hasText && !hasFiles ? request.text! : null);
}
