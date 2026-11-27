import { useState } from 'react';
import type { DocTypeCandidate } from '@shared/schemas/result';

/** 후보가 없을 때("다른 문서예요"를 눌렀을 때) 보여줄 기본 선택지 */
const COMMON_TYPES: DocTypeCandidate[] = [
  { doc_type: '계약서', category: 'contract' },
  { doc_type: '공문·안내문', category: 'notice' },
  { doc_type: '고지서·납부 안내', category: 'notice' },
  { doc_type: '증명서', category: 'informational' },
  { doc_type: '설명서·안내 책자', category: 'informational' },
  { doc_type: '법령·조문', category: 'statute' },
];

interface Props {
  /** AI가 고른 후보. 비어 있으면 기본 선택지를 보여줍니다 */
  candidates: DocTypeCandidate[];
  /** 처음 판단한 종류. 있으면 "이게 맞아요" 버튼을 보여줍니다 */
  current?: string;
  /** 확신이 낮아서 묻는 것인지, 사용자가 먼저 고치려는 것인지 */
  reason: 'low-confidence' | 'user';
  onChoose: (candidate: DocTypeCandidate) => void;
  onKeep?: () => void;
  onClose?: () => void;
}

/**
 * "이 문서가 무엇인가요?" 질문 (기획서 4.3 후보 라벨).
 *
 * 종류를 맞게 알아야 점검 깊이와 화면 구성이 맞아집니다. 고르면 그 종류로 다시 점검합니다.
 */
export function DocTypeChooser({ candidates, current, reason, onChoose, onKeep, onClose }: Props) {
  const [custom, setCustom] = useState('');
  const options = candidates.length > 0 ? candidates : COMMON_TYPES;

  const submitCustom = (event: React.FormEvent) => {
    event.preventDefault();
    const docType = custom.trim();
    if (docType) onChoose({ doc_type: docType, category: 'unknown' });
  };

  return (
    <section className="chooser" aria-labelledby="chooser-title">
      <div>
        <span className="eyebrow">문서 종류 확인</span>
        <h2 className="chooser__title title" id="chooser-title">
          이 문서가 무엇인가요?
        </h2>
        <p className="chooser__lead">
          {reason === 'low-confidence'
            ? '어떤 문서인지 확실하지 않아요. 골라 주시면 그에 맞게 다시 점검할게요.'
            : '맞는 종류를 골라 주시면 그에 맞게 다시 점검할게요.'}
        </p>
      </div>

      <ul className="chooser__options">
        {options.map((option) => (
          <li key={`${option.doc_type}-${option.category}`}>
            <button
              type="button"
              className="button button--secondary button--block"
              onClick={() => onChoose(option)}
            >
              {option.doc_type}
            </button>
          </li>
        ))}
      </ul>

      <form className="chooser__custom" onSubmit={submitCustom}>
        <label htmlFor="custom-doc-type" className="chooser__custom-label">
          목록에 없으면 직접 적어 주세요
        </label>
        <div className="chooser__custom-row">
          <input
            id="custom-doc-type"
            className="field"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="예: 재직증명서, 장학금 신청 안내"
          />
          <button type="submit" className="button button--primary" disabled={!custom.trim()}>
            이걸로 점검
          </button>
        </div>
      </form>

      <div className="chooser__footer">
        {onKeep && current && (
          <button type="button" className="button button--quiet" onClick={onKeep}>
            잘 모르겠어요, 그대로 볼게요
          </button>
        )}
        {onClose && (
          <button type="button" className="button button--quiet" onClick={onClose}>
            닫기
          </button>
        )}
      </div>
    </section>
  );
}
