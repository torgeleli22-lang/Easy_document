import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnalysisResult } from '@shared/schemas/result';
import { documentFromResult, putDocument, type SavedDocument } from '@/lib/archive';

interface Props {
  result: AnalysisResult;
  onClose: () => void;
}

/**
 * 보관함에 저장하기.
 *
 * 무엇이 어디에 남는지 저장 전에 분명히 알립니다. 원본 사진은 남기지 않고,
 * 개인 식별 정보는 가린 뒤 이 기기 안에만 저장합니다.
 */
export function SavePanel({ result, onClose }: Props) {
  const [title, setTitle] = useState(result.doc_type);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedDocument | null>(null);
  const [failed, setFailed] = useState(false);

  const deadlines = result.tasks.filter((task) => task.deadline).length;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFailed(false);
    try {
      const doc = documentFromResult(result, { title, memo });
      await putDocument(doc);
      setSaved(doc);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <section className="save-panel" aria-live="polite">
        <h2 className="save-panel__title">보관함에 저장했어요</h2>
        <p>
          {deadlines > 0
            ? `기한 ${deadlines}건이 일정에 올라갔어요.`
            : '기한이 없는 문서라 보관함에서 다시 찾아볼 수 있어요.'}
        </p>
        {saved.maskedLabels.length > 0 && (
          <p className="save-panel__masked">{saved.maskedLabels.join(', ')}는 가려서 저장했어요.</p>
        )}
        <div className="save-panel__actions">
          {deadlines > 0 && (
            <Link to="/schedule" className="button button--primary">
              일정 보기
            </Link>
          )}
          <Link to={`/archive/${saved.id}`} className="button button--secondary">
            보관함에서 열기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form className="save-panel" onSubmit={handleSave}>
      <h2 className="save-panel__title">보관함에 저장</h2>
      <ul className="save-panel__facts">
        <li>이 기기(브라우저) 안에만 저장돼요. 서버로 보내지 않아요.</li>
        <li>주민등록번호·전화번호·카드 번호는 가려서 저장해요.</li>
        <li>원본 사진은 남기지 않고, 풀이와 옮겨 적은 글만 남겨요.</li>
      </ul>

      <div>
        <label className="field-label" htmlFor="save-title">
          이름
        </label>
        <input
          id="save-title"
          className="field save-panel__field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="save-memo">
          메모 <span className="meta">(나중에 찾을 때 도움이 돼요)</span>
        </label>
        <textarea
          id="save-memo"
          className="field save-panel__field"
          rows={2}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="예: 김 교수님 수업, 11월 행정실에서 받음"
        />
      </div>

      {failed && (
        <p className="result-actions__error" role="alert">
          저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.
        </p>
      )}

      <div className="save-panel__actions">
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? '저장하는 중…' : '저장하기'}
        </button>
        <button type="button" className="button button--quiet" onClick={onClose}>
          닫기
        </button>
      </div>
    </form>
  );
}
