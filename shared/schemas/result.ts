/**
 * 분석 결과 스키마 (기획서 4.4).
 *
 * 프런트엔드와 백엔드가 함께 쓰는 단일 출처입니다.
 * 화면 카드 구조가 이 타입과 1:1로 대응하므로, 여기를 바꾸면
 * 결과 화면과 Lambda 응답을 같이 손봐야 합니다.
 */

/**
 * 처리 카테고리 (기획서 4.3). 화면에는 보이지 않고 시스템 내부에서만 쓰며,
 * 위험 등급 · AI 역할 범위 · 분석 깊이 · 화면 구성을 결정합니다.
 */
export type Category =
  | 'contract' // 계약서형 — 점검형, 위험 조항까지
  | 'notice' // 공문·안내문형 — 안내형, 법적 판단 금지
  | 'informational' // 정보성 문서 — 경량 설명
  | 'statute' // 법령·조문 — 설명형
  | 'unknown'; // 판단 불가 — 쉬운 말 풀이 + 후보 라벨

/** 기한이 어떤 형태로 적혀 있었는지. 상대 기한과 불분명은 화면에서 다르게 다룹니다. */
export type DeadlineKind = 'explicit' | 'relative' | 'unclear';

/** 주의할 점의 출처. 문서에 적힌 내용과 일반 안내를 반드시 구분해 표시합니다. */
export type SourceKind = 'document' | 'general_guide';

export type WarningLevel = 'high' | 'medium' | 'low';

/**
 * 원문 한 구간 (대체로 문단 하나).
 *
 * 워드로 내보낼 때 원문을 그대로 싣고 그 아래에 설명을 붙이므로,
 * 설명이 어느 구간에 붙는지 이어주는 참조가 필요합니다.
 * 화면에서는 쓰지 않고, 내보내기와 원문 대조에만 씁니다.
 */
export interface Passage {
  /** 이 구간의 식별자. 항목의 passage_id가 이 값을 가리킵니다 */
  id: string;
  /** 문서에서 읽어낸 원문 그대로 */
  text: string;
  /** 문서 안에서의 순서. 원본 순서대로 싣기 위해 씁니다 */
  order: number;
}

export interface Task {
  /** 해야 할 일 */
  action: string;
  /** ISO 날짜(YYYY-MM-DD). 불분명하면 null */
  deadline: string | null;
  deadline_kind: DeadlineKind;
  /** 원문 인용 — 인용 존재 확인(4.5)의 대상 */
  evidence: string;
  /** 이 인용이 속한 원문 구간. 없으면 문서에 없는 일반 안내입니다 */
  passage_id: string | null;
  /** 하지 않으면 생기는 일 */
  if_missed: string;
}

export interface Term {
  /** 문서에 적힌 어려운 용어 */
  original: string;
  /** 쉬운 말 설명 */
  easy: string;
  evidence: string;
  passage_id: string | null;
}

export interface Warning {
  level: WarningLevel;
  text: string;
  evidence: string;
  passage_id: string | null;
  source_kind: SourceKind;
}

export interface AnalysisResult {
  /** 표시 라벨 — 문서에 적힌 실제 명칭을 그대로 (예: "임용계약서") */
  doc_type: string;
  /** 내부 처리 카테고리 */
  category: Category;
  /** 0~1. 낮으면 후보 라벨을 물어봅니다 (임계값은 평가 후 확정) */
  confidence: number;
  /** 문서가 무엇이고 나에게 무엇을 요구하는지 한 줄 요약 */
  summary: string;
  /**
   * 원문 구간 목록. 워드 내보내기가 원본을 순서대로 싣고
   * 각 구간 아래에 설명을 붙일 때 씁니다.
   */
  passages: Passage[];
  tasks: Task[];
  terms: Term[];
  warnings: Warning[];
  /** 공식 기관·전문가 확인 안내를 띄울지 */
  needs_expert: boolean;
  /** "이 서비스는 계약서·공문 분석에 특화되어 있어요" 안내를 띄울지 */
  specialization_hint: boolean;
}
