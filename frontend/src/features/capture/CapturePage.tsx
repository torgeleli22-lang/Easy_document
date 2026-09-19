import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/state/AnalysisContext';
import './capture.css';

/** 점검 절차 안내. 맡기기 전에 무슨 일이 일어나는지 먼저 보여줍니다 */
const STEPS = [
  {
    number: '01',
    title: '문서를 맡깁니다',
    body: '사진을 찍거나 파일을 고르면 됩니다. 어떤 종류인지 고르실 필요는 없어요.',
  },
  {
    number: '02',
    title: '항목별로 점검합니다',
    body: '무슨 문서인지 확인하고, 해야 할 일과 기한, 주의할 조항을 하나씩 짚습니다.',
  },
  {
    number: '03',
    title: '결과를 받습니다',
    body: '쉬운 말로 정리된 점검 결과를 보고, 워드 파일로 받거나 가족에게 보낼 수 있습니다.',
  },
];

/** 점검 범위. 무엇까지 봐주는지 미리 알려야 맡길 마음이 생깁니다 */
const SCOPE = [
  { label: '계약서', detail: '근로계약서, 전세계약서 등 조항을 꼼꼼히 봅니다' },
  { label: '공문·고지서', detail: '언제까지 무엇을 해야 하는지 정리합니다' },
  { label: '그 밖의 문서', detail: '영수증, 안내문도 쉬운 말로 풀어 드립니다' },
];

/**
 * 첫 화면.
 *
 * 문서 종류를 미리 고르게 하지 않고, 프롬프트도 받지 않습니다 (기획서 2장).
 * 화면은 "맡기면 점검해 드립니다"라는 흐름 하나로 읽히게 구성했습니다.
 */
export function CapturePage() {
  const navigate = useNavigate();
  const { start } = useAnalysis();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    start({ kind: 'file', file });
    navigate('/analysis');
  };

  const handleTextSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!pastedText.trim()) return;

    start({ kind: 'text', text: pastedText });
    navigate('/analysis');
  };

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <span className="eyebrow">문서 점검</span>
            <h1 className="hero__title title">
              이 문서가 무엇을 요구하는지,
              <br />
              대신 짚어 드립니다
            </h1>
            <p className="hero__lead">
              계약서든 공문이든 사진 한 장만 맡기시면 됩니다. 어려운 말을 쉽게 풀고, 언제까지
              무엇을 해야 하는지, 조심할 부분은 없는지 항목별로 점검해 알려드려요.
            </p>

            <ul className="hero__assurances">
              <li>서버에 저장하지 않음</li>
              <li>가입 없이 바로</li>
              <li>결과를 워드로 저장</li>
            </ul>
          </div>

          <div className="intake">
            <div className="intake__header">
              <h2 className="intake__title title">점검 맡기기</h2>
              <p className="intake__subtitle">사진, PDF, 붙여넣기 모두 됩니다</p>
            </div>

            <button
              type="button"
              className="button button--primary button--block button--large"
              onClick={() => fileInputRef.current?.click()}
            >
              사진 찍거나 파일 고르기
            </button>

            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileChange}
            />

            <div className="intake__divider">
              <span>또는 글로 붙여넣기</span>
            </div>

            <form onSubmit={handleTextSubmit} className="intake__form">
              <label className="sr-only" htmlFor="pasted-text">
                점검할 문서 내용
              </label>
              <textarea
                id="pasted-text"
                className="intake__textarea"
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                rows={4}
                placeholder="문자나 메일로 받은 내용을 붙여넣으세요"
              />
              <button
                type="submit"
                className="button button--secondary button--block"
                disabled={!pastedText.trim()}
              >
                이 내용 점검하기
              </button>
            </form>

            <div className="intake__guide">
              <h3 className="intake__guide-title">사진은 이렇게 찍어주세요</h3>
              <ul className="intake__guide-list">
                <li>문서의 네 귀퉁이가 모두 보이게</li>
                <li>밝은 곳에서 그림자가 지지 않게</li>
                <li>글씨가 흐리면 조금 더 가까이에서</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section__title title">점검은 이렇게 진행됩니다</h2>

          <ol className="steps">
            {STEPS.map((step) => (
              <li key={step.number} className="steps__item">
                <span className="steps__number title" aria-hidden="true">
                  {step.number}
                </span>
                <h3 className="steps__title">{step.title}</h3>
                <p className="steps__body">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section scope">
        <div className="container">
          <h2 className="section__title title">어떤 문서를 봐 드리나요</h2>

          <ul className="scope__list">
            {SCOPE.map((item) => (
              <li key={item.label} className="scope__item">
                <h3 className="scope__label">{item.label}</h3>
                <p className="scope__detail">{item.detail}</p>
              </li>
            ))}
          </ul>

          <p className="scope__note">
            종류를 가리지 않습니다. 무엇을 올리셔도 먼저 어떤 문서인지 확인한 뒤, 그에 맞는
            방식으로 점검합니다.
          </p>
        </div>
      </section>
    </>
  );
}
