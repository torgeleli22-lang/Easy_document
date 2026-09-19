import { withRo } from '@/lib/korean';

interface Props {
  docType: string;
  summary: string;
}

/** 한 줄 요약. 화면 맨 위에 가장 크게 놓습니다 (기획서 4.4 화면 구성). */
export function SummaryCard({ docType, summary }: Props) {
  return (
    <section className="card result__summary" aria-labelledby="summary-title">
      <p className="result__doc-type">{withRo(docType)} 인식했어요</p>
      <h2 className="result__summary-text" id="summary-title">
        {summary}
      </h2>
      {/*
        음성 읽어주기(FR-13)는 2차에서 붙입니다.
        브라우저 내장 음성 합성을 쓸지 TTS 서비스를 쓸지 아직 정하지 않았습니다.
      */}
    </section>
  );
}
