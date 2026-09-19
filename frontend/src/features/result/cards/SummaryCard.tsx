interface Props {
  summary: string;
}

/** 한 줄 요약. 결과서에서 가장 먼저, 가장 크게 놓입니다 (기획서 4.4). */
export function SummaryCard({ summary }: Props) {
  return <p className="summary-text title">{summary}</p>;
}
