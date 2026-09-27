import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitIntoPassages } from '../src/core/passages';
import { attachPassageNotes, normalizeResult, normalizeTranscribedPassages } from '../src/core/validate';
import { verifyEvidence } from '../src/core/verify';

test('빈 줄로 문단을 나누고 순서대로 id를 붙인다', () => {
  const passages = splitIntoPassages('제1조 목적\n이 계약은…\n\n\n제2조 임금\r\n월 250만 원');
  assert.deepEqual(
    passages.map((passage) => [passage.id, passage.order]),
    [
      ['p1', 1],
      ['p2', 2],
    ],
  );
  assert.equal(passages[1].text, '제2조 임금\n월 250만 원');
});

test('빈 줄이 없는 글은 줄 단위로 나눈다', () => {
  assert.equal(splitIntoPassages('첫째 줄\n둘째 줄\n셋째 줄').length, 3);
  assert.equal(splitIntoPassages('   ').length, 0);
});

const passages = [
  { id: 'p1', text: '근로시간은 09:00부터 18:00까지로 한다.', order: 1 },
  { id: 'p2', text: '임금은 매월 25일에 지급한다.', order: 2 },
];

const base = {
  doc_type: '근로계약서',
  category: 'contract' as const,
  confidence: 0.9,
  summary: '요약',
  needs_expert: false,
  specialization_hint: false,
};

test('인용이 없는 항목은 빼고, 구간을 잘못 짚은 항목은 고친다', () => {
  const { result, report } = verifyEvidence(
    {
      ...base,
      tasks: [],
      terms: [
        { original: '임금', easy: '월급', evidence: '매월 25일에  지급한다', passage_id: 'p1' },
        { original: '수습', easy: '연습 기간', evidence: '수습 기간은 3개월', passage_id: 'p1' },
      ],
      warnings: [
        { level: 'low', text: '사본 받기', evidence: '', passage_id: 'p9', source_kind: 'general_guide' },
      ],
    },
    passages,
  );
  assert.equal(result.terms.length, 1);
  assert.equal(result.terms[0].passage_id, 'p2');
  assert.deepEqual(report, { dropped: 1, relinked: 1 });
  assert.equal(result.warnings[0].passage_id, null);
});

test('두 구간에 걸친 인용은 남긴다', () => {
  const { result } = verifyEvidence(
    {
      ...base,
      tasks: [],
      terms: [{ original: 'x', easy: 'y', evidence: '18:00까지로 한다. 임금은', passage_id: 'p1' }],
      warnings: [],
    },
    passages,
  );
  assert.equal(result.terms.length, 1);
});

test('모델 출력의 잘못된 값을 스키마에 맞게 고친다', () => {
  const result = normalizeResult({
    summary: ' 요약 ',
    category: 'weird',
    confidence: 3,
    tasks: [
      { action: '서명', deadline: '다음 주', deadline_kind: 'explicit', evidence: 'a', passage_id: '' },
      { action: '', deadline: null },
    ],
    warnings: [{ text: '확인', level: 'critical' }],
  });
  assert.equal(result.category, 'unknown');
  assert.equal(result.confidence, 1);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].deadline, null);
  assert.equal(result.tasks[0].deadline_kind, 'unclear');
  assert.equal(result.tasks[0].passage_id, null);
  assert.equal(result.warnings[0].level, 'medium');
  assert.equal(result.doc_type, '문서');
});

test('요약이 없으면 오류', () => {
  assert.throws(() => normalizeResult({ tasks: [] }));
});

test('옮겨 적은 원문의 빈 구간을 버리고 겹치는 id를 새로 붙인다', () => {
  const result = normalizeTranscribedPassages(
    {
      passages: [
        { id: 'p1', text: '가', easy: '풀이', image_index: 0, top: 0.1, bottom: 0.2 },
        { id: 'p1', text: '나', image_index: 5, top: 0.1, bottom: 0.2 },
        { id: 'p3', text: ' ' },
      ],
    },
    2,
  );
  assert.deepEqual(
    result.map((passage) => passage.id),
    ['p1', 'p2'],
  );
  assert.equal(result[0].easy, '풀이');
  assert.deepEqual(result[0].region, { image_index: 0, top: 0.1, bottom: 0.2 });
  // 없는 사진 번호를 가리키면 위치를 버립니다.
  assert.equal(result[1].region, null);
  assert.equal('easy' in result[1], false);
});

test('글 입력의 구간별 풀이를 id로 붙인다', () => {
  const result = attachPassageNotes(
    { passage_notes: [{ id: 'p2', easy: '25일에 월급을 받아요' }, { id: 'p9', easy: '없는 구간' }] },
    passages,
  );
  assert.equal(result[0].easy, undefined);
  assert.equal(result[1].easy, '25일에 월급을 받아요');
});
