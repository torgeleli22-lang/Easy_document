import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/state/AnalysisContext';
import './capture.css';

/**
 * 첫 화면. 사진·PDF를 올리거나 글을 붙여넣어 분석을 시작합니다.
 *
 * 문서 종류를 미리 고르게 하지 않고, 프롬프트도 받지 않습니다 (기획서 2장).
 */
export function CapturePage() {
  const navigate = useNavigate();
  const { start } = useAnalysis();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
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
    <main className="page">
      <header className="capture__header">
        <h1 className="capture__logo">쉬운말</h1>
        <p className="page__lead">
          어려운 문서를 찍어서 올리면 쉬운 말로 풀어드려요. 무엇을 언제까지 해야 하는지도 함께
          알려드립니다.
        </p>
      </header>

      <section className="card" aria-labelledby="upload-title">
        <h2 className="card__title" id="upload-title">
          문서 올리기
        </h2>

        <button
          type="button"
          className="button button--primary button--block capture__main-action"
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

        {selectedFileName && (
          <p className="capture__selected" role="status">
            {selectedFileName}
          </p>
        )}

        <div className="capture__guide">
          <h3 className="capture__guide-title">잘 찍는 방법</h3>
          <ul className="capture__guide-list">
            <li>문서의 네 귀퉁이가 모두 보이게 찍어주세요.</li>
            <li>밝은 곳에서 그림자가 지지 않게 찍어주세요.</li>
            <li>글씨가 흐리면 조금 더 가까이에서 다시 찍어주세요.</li>
          </ul>
        </div>
      </section>

      <section className="card" aria-labelledby="paste-title">
        <h2 className="card__title" id="paste-title">
          글로 붙여넣기
        </h2>
        <p className="page__lead">문자나 메일로 받은 내용은 여기에 붙여넣어도 됩니다.</p>

        <form onSubmit={handleTextSubmit} className="capture__form">
          <label className="sr-only" htmlFor="pasted-text">
            분석할 문서 내용
          </label>
          <textarea
            id="pasted-text"
            className="capture__textarea"
            value={pastedText}
            onChange={(event) => setPastedText(event.target.value)}
            rows={6}
            placeholder="여기에 붙여넣으세요"
          />
          <button
            type="submit"
            className="button button--secondary button--block"
            disabled={!pastedText.trim()}
          >
            이 내용 풀어보기
          </button>
        </form>
      </section>

      <p className="capture__privacy">
        올린 문서는 서버에 저장하지 않아요. 이해를 마치고 종료하면 바로 지워집니다.
      </p>
    </main>
  );
}
