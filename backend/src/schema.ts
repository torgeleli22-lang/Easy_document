import { z } from 'zod/v4';

/**
 * Claude에게 요구하는 응답 형식.
 *
 * shared/schemas/result.ts 의 AnalysisResult와 거의 같지만, 구조화 출력은
 * "있을 수도 없을 수도 있는" 필드보다 "늘 있고 값이 null일 수 있는" 필드가 안정적이라
 * 선택 필드를 모두 nullable로 바꿔 받습니다. 화면용 모양으로는 verify.ts가 옮깁니다.
 *
 * 숫자 범위(0~1 등)는 구조화 출력이 강제하지 않으므로 verify.ts에서 잘라냅니다.
 */

const category = z
  .enum(['contract', 'notice', 'informational', 'statute', 'unknown'])
  .describe(
    'contract=계약서, notice=공문·안내문·고지서, informational=증명서·설명서 등 정보성 문서, statute=법령·조문, unknown=판단 불가',
  );

const region = z
  .object({
    image_index: z.number().int().describe('몇 번째 사진인지 (0부터)'),
    top: z.number().describe('사진 높이를 1로 볼 때 이 구간이 시작하는 위치 (0~1)'),
    bottom: z.number().describe('사진 높이를 1로 볼 때 이 구간이 끝나는 위치 (0~1)'),
  })
  .nullable();

const passage = z.object({
  id: z.string().describe('p1, p2 처럼 짧게'),
  text: z.string().describe('원문 그대로. 고쳐 쓰지 말 것'),
  order: z.number().int(),
  easy: z.string().nullable().describe('이 구간을 쉬운 말로 푼 한두 문장'),
  region: region.describe('사진 입력일 때만. 글이나 PDF면 null'),
});

const task = z.object({
  action: z.string(),
  deadline: z.string().nullable().describe('YYYY-MM-DD. 알 수 없으면 null'),
  deadline_kind: z.enum(['explicit', 'relative', 'unclear']),
  evidence: z.string().describe('근거가 되는 원문 인용. 원문 그대로'),
  passage_id: z.string().nullable(),
  if_missed: z.string(),
});

const term = z.object({
  original: z.string(),
  easy: z.string(),
  evidence: z.string(),
  passage_id: z.string().nullable(),
});

const warning = z.object({
  level: z.enum(['high', 'medium', 'low']),
  text: z.string(),
  evidence: z.string(),
  passage_id: z.string().nullable(),
  source_kind: z.enum(['document', 'general_guide']),
});

export const ModelOutputSchema = z.object({
  doc_type: z.string().describe('문서에 적힌 실제 명칭 그대로'),
  category,
  confidence: z.number().describe('문서 종류 판단의 확신도 0~1'),
  candidates: z
    .array(z.object({ doc_type: z.string(), category }))
    .describe('확신도가 0.7 미만이면 가능성 높은 순으로 2~4개. 아니면 빈 배열'),
  summary: z.string(),
  keywords: z.array(z.string()).describe('나중에 찾아볼 때 쓸 핵심어 3~8개'),
  full_text: z.string().describe('문서 전체를 옮겨 적은 글. 개인 식별 정보는 가려서'),
  passages: z.array(passage),
  tasks: z.array(task),
  terms: z.array(term),
  warnings: z.array(warning),
  needs_expert: z.boolean(),
  specialization_hint: z.boolean(),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;
