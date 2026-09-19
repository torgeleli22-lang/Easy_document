import type { AnalysisResult } from '@shared/schemas/result';

/**
 * 근로계약서 목업.
 *
 * 기획서 10장 1단계가 "근로계약서 한 유형으로 처음부터 끝까지 동작"이라
 * 첫 화면 작업의 기준으로 삼았습니다. 실제 문서가 아니라 공개 표준 서식을
 * 바탕으로 지어낸 가상 문서입니다.
 */

/** 본 분석이 스트리밍으로 흘려보내는 설명 텍스트 */
export const laborContractNarration = `받으신 문서는 근로계약서예요. 일을 시작하기 전에 조건을 서로 확인하고 서명하는 서류입니다.

여기 적힌 조건을 하나씩 쉬운 말로 풀어볼게요. 급여는 월 2,100,000원이고 매달 25일에 받습니다. 일하는 시간은 하루 8시간, 주 5일이에요.

수습기간이 3개월 있고, 그동안은 급여의 90%를 받는다고 적혀 있어요. 확인이 필요한 부분이 몇 군데 있어서 아래에 따로 정리했습니다.`;

export const laborContractResult: AnalysisResult = {
  doc_type: '근로계약서',
  category: 'contract',
  confidence: 0.93,
  summary: '이 회사에서 일하는 조건을 정한 계약서예요. 서명하기 전에 급여와 수습 조건을 꼭 확인하세요.',

  // 원문 구간. 워드로 내려받을 때 이 순서대로 싣고 아래에 설명을 붙입니다.
  passages: [
    {
      id: 'p1',
      order: 1,
      text: '제3조(임금) 임금은 월 2,100,000원으로 하며, 매월 25일에 지급한다.',
    },
    {
      id: 'p2',
      order: 2,
      text: '제4조(소정근로시간) 소정근로시간은 1일 8시간, 1주 40시간으로 한다.',
    },
    {
      id: 'p3',
      order: 3,
      text: '제5조(수습기간) 수습기간은 근로개시일로부터 3개월로 한다. 수습기간 중 임금은 월 급여액의 90%를 지급한다.',
    },
    {
      id: 'p4',
      order: 4,
      text: '제7조(연차유급휴가) 연차유급휴가는 관계 법령에 따른다.',
    },
    {
      id: 'p5',
      order: 5,
      text: '제9조(계약서 보관) 본 계약은 2026년 10월 5일까지 서명하여 각 1부씩 보관한다.',
    },
  ],

  tasks: [
    {
      action: '계약서에 서명하고 한 부를 받아서 보관하기',
      deadline: '2026-10-05',
      deadline_kind: 'explicit',
      evidence: '본 계약은 2026년 10월 5일까지 서명하여 각 1부씩 보관한다.',
      passage_id: 'p5',
      if_missed: '서명한 계약서를 받아두지 않으면 나중에 조건이 달라졌을 때 확인할 방법이 없어요.',
    },
    {
      action: '수습기간이 끝나는 날짜를 달력에 적어두기',
      deadline: '2026-12-31',
      deadline_kind: 'relative',
      evidence: '수습기간은 근로개시일로부터 3개월로 한다.',
      passage_id: 'p3',
      if_missed: '수습이 끝났는데도 급여가 그대로면 바로 알아차리기 어려워요.',
    },
    {
      action: '연차휴가 일수를 회사에 물어보기',
      deadline: null,
      deadline_kind: 'unclear',
      evidence: '연차유급휴가는 관계 법령에 따른다.',
      passage_id: 'p4',
      if_missed: '며칠을 쓸 수 있는지 모른 채 지나가면 쓰지 못하고 사라질 수 있어요.',
    },
  ],

  terms: [
    {
      original: '수습기간',
      easy: '정식으로 일하기 전에 서로 맞는지 확인해보는 기간이에요. 이 기간에는 급여를 조금 적게 주는 경우가 있습니다.',
      evidence: '수습기간은 근로개시일로부터 3개월로 한다.',
      passage_id: 'p3',
    },
    {
      original: '소정근로시간',
      easy: '회사와 미리 정해둔, 일하기로 한 시간이에요. 이 시간을 넘겨 일하면 추가 수당을 받습니다.',
      evidence: '소정근로시간은 1일 8시간, 1주 40시간으로 한다.',
      passage_id: 'p2',
    },
    {
      original: '연차유급휴가',
      easy: '쉬어도 급여가 나오는 휴가예요. 1년 동안 일하면 법으로 정해진 만큼 생깁니다.',
      evidence: '연차유급휴가는 관계 법령에 따른다.',
      passage_id: 'p4',
    },
  ],

  warnings: [
    {
      level: 'high',
      text: '수습기간 3개월 동안 급여의 90%만 받는다고 적혀 있어요. 최저임금의 90%까지만 깎을 수 있고, 1년 미만 계약이면 아예 깎을 수 없습니다. 내 급여가 여기에 해당하는지 확인해보세요.',
      evidence: '수습기간 중 임금은 월 급여액의 90%를 지급한다.',
      passage_id: 'p3',
      source_kind: 'general_guide',
    },
    {
      level: 'medium',
      text: '연차휴가 일수가 숫자로 적혀 있지 않고 "관계 법령에 따른다"고만 되어 있어요. 몇 일인지 회사에 직접 물어보는 게 좋습니다.',
      evidence: '연차유급휴가는 관계 법령에 따른다.',
      passage_id: 'p4',
      source_kind: 'document',
    },
    {
      level: 'low',
      text: '퇴직금에 관한 내용이 이 문서에는 없어요. 1년 이상 일하면 받을 수 있으니 따로 확인해보세요.',
      evidence: '',
      passage_id: null,
      source_kind: 'general_guide',
    },
  ],

  needs_expert: false,
  specialization_hint: false,
};
