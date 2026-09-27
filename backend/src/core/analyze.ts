import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisResult, Passage } from '../../../shared/schemas/result';
import { AnalysisError } from './errors';
import { splitIntoPassages } from './passages';
import {
  IMAGE_MODE_INSTRUCTIONS,
  IMAGE_MODE_TOOL,
  SUBMIT_TOOL_NAME,
  SYSTEM_PROMPT,
  TEXT_MODE_INSTRUCTIONS,
  TEXT_MODE_TOOL,
} from './prompt';
import { normalizeResult, normalizeTranscribedPassages } from './validate';
import { verifyEvidence } from './verify';

/**
 * 분석 로직. Lambda 핸들러와 떼어두어서, 나중에 스트리밍이나 다른 실행 환경으로
 * 옮겨도 이 파일은 그대로 쓸 수 있게 했습니다.
 */

export interface ImagePart {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** base64 */
  data: string;
}

export type AnalyzeRequest = { kind: 'text'; text: string } | { kind: 'images'; images: ImagePart[] };

export interface ModelConfig {
  /** 기본 모델. 예: anthropic.claude-opus-5 */
  model: string;
  /** 기본 모델이 정책상 답을 거절했을 때 한 번 더 시도할 모델 */
  fallbackModel: string | null;
  region: string | undefined;
}

/**
 * 사진으로 읽은 결과는 글자를 잘못 읽었을 수 있어서 신뢰도를 이 값 아래로 묶습니다.
 * 숫자 교차 검증이 붙으면 다시 조정합니다.
 */
const IMAGE_CONFIDENCE_CAP = 0.85;

let client: AnthropicBedrockMantle | null = null;

function getClient(region: string | undefined): AnthropicBedrockMantle {
  // Lambda 실행 역할의 임시 자격 증명을 SDK가 알아서 읽습니다. 키를 코드에 두지 않습니다.
  client ??= new AnthropicBedrockMantle({ awsRegion: region });
  return client;
}

/** 기한 계산의 기준이 되는 오늘 날짜 (한국 시간) */
function todayInSeoul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function buildUserContent(
  request: AnalyzeRequest,
  passages: Passage[],
): Anthropic.ContentBlockParam[] {
  const dateLine = `오늘 날짜: ${todayInSeoul()} (한국 시간)`;

  if (request.kind === 'text') {
    const body = passages.map((passage) => `[${passage.id}] ${passage.text}`).join('\n\n');
    return [
      {
        type: 'text',
        text: `${TEXT_MODE_INSTRUCTIONS}\n${dateLine}\n\n<document>\n${body}\n</document>`,
      },
    ];
  }

  return [
    ...request.images.map(
      (image): Anthropic.ImageBlockParam => ({
        type: 'image',
        source: { type: 'base64', media_type: image.mediaType, data: image.data },
      }),
    ),
    { type: 'text', text: `${IMAGE_MODE_INSTRUCTIONS}\n${dateLine}` },
  ];
}

async function callModel(
  config: ModelConfig,
  model: string,
  tool: Anthropic.Tool,
  content: Anthropic.ContentBlockParam[],
): Promise<Anthropic.Message> {
  // 사진 여러 장을 옮겨 적으면 출력이 길어서 스트리밍으로 받습니다(HTTP 시간 제한 회피).
  // 화면으로 흘려보내는 스트리밍은 다음 단계에서 붙입니다.
  const stream = getClient(config.region).messages.stream({
    model,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    tools: [tool],
    // 생각(thinking)이 켜진 모델은 도구 강제 호출을 받지 않아서 auto로 두고 프롬프트로 지시합니다.
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content }],
  });
  return stream.finalMessage();
}

async function callWithFallback(
  config: ModelConfig,
  tool: Anthropic.Tool,
  content: Anthropic.ContentBlockParam[],
): Promise<Anthropic.Message> {
  try {
    const message = await callModel(config, config.model, tool, content);
    if (message.stop_reason !== 'refusal' || !config.fallbackModel) return message;
    console.warn('model refused, retrying with fallback', {
      model: config.model,
      category: message.stop_details?.category ?? null,
    });
    return await callModel(config, config.fallbackModel, tool, content);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new AnalysisError('upstream', '지금 사용하는 분이 많아요. 잠시 뒤에 다시 시도해 주세요.');
    }
    if (error instanceof Anthropic.APIError) {
      console.error('bedrock error', { status: error.status, message: error.message });
      throw new AnalysisError('upstream', 'AI 연결에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.');
    }
    throw error;
  }
}

function toolInput(message: Anthropic.Message): unknown {
  if (message.stop_reason === 'refusal') {
    throw new AnalysisError('refused', '이 문서는 점검해 드릴 수 없어요.');
  }
  const block = message.content.find(
    (item): item is Anthropic.ToolUseBlock => item.type === 'tool_use' && item.name === SUBMIT_TOOL_NAME,
  );
  if (!block) {
    console.error('no tool call', { stop_reason: message.stop_reason });
    throw new AnalysisError('invalid_output', '점검 결과를 만들지 못했어요. 다시 시도해 주세요.');
  }
  return block.input;
}

export async function analyzeDocument(
  request: AnalyzeRequest,
  config: ModelConfig,
): Promise<AnalysisResult> {
  // 글은 서버가 원문을 먼저 확정합니다. 사진은 AI가 옮겨 적은 글이 원문이 됩니다.
  let passages = request.kind === 'text' ? splitIntoPassages(request.text) : [];
  if (request.kind === 'text' && passages.length === 0) {
    throw new AnalysisError('bad_request', '점검할 내용이 비어 있어요.');
  }

  const tool = request.kind === 'text' ? TEXT_MODE_TOOL : IMAGE_MODE_TOOL;
  const message = await callWithFallback(config, tool, buildUserContent(request, passages));
  const raw = toolInput(message);

  if (request.kind === 'images') {
    const readable = (raw as { readable?: unknown }).readable;
    passages = normalizeTranscribedPassages(raw);
    if (readable === false || passages.length === 0) {
      const reason = (raw as { unreadable_reason?: unknown }).unreadable_reason;
      throw new AnalysisError(
        'unreadable',
        typeof reason === 'string' && reason.trim()
          ? `사진을 읽기 어려워요. ${reason.trim()} 다시 찍어 주세요.`
          : '사진을 읽기 어려워요. 밝은 곳에서 문서 전체가 보이게 다시 찍어 주세요.',
      );
    }
  }

  const { result, report } = verifyEvidence(normalizeResult(raw), passages);
  if (report.dropped > 0 || report.relinked > 0) {
    console.info('evidence check', report);
  }

  return {
    ...result,
    confidence:
      request.kind === 'images' ? Math.min(result.confidence, IMAGE_CONFIDENCE_CAP) : result.confidence,
    passages,
  };
}
