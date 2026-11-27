import type { AnalysisResult } from '@shared/schemas/result';

/**
 * 학과 공문 목업 — 조교가 자주 받는 "기한이 여러 개 걸린 안내문".
 *
 * 일정 화면이 살아 있는 모습을 보여주려고 기한을 오늘 기준으로 만듭니다.
 * 실제 문서가 아니라 지어낸 가상 문서이고, 전화번호는 가려지는지 보여주려고 넣었습니다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function addDays(base: Date, days: number): Date {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  date.setDate(date.getDate() + days);
  return date;
}

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 공문에 흔히 쓰는 "2026. 11. 30.(월)" 모양 */
function official(date: Date): string {
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.(${WEEKDAYS[date.getDay()]})`;
}

export function buildDepartmentNotice(today: Date = new Date()) {
  const gradeDue = addDays(today, 3);
  const appealDue = addDays(today, 9);
  const logDue = addDays(today, 20);

  const text = `신구대학교 교무처

수신: 각 학과(부) 조교
제목: 2026학년도 2학기 성적 입력 및 강의평가 결과 확인 안내

1. 2026학년도 2학기 성적 입력 기간을 아래와 같이 안내하오니, 각 학과에서는 담당 교수님께 안내하여 기한 내 입력이 완료되도록 협조하여 주시기 바랍니다.

2. 성적 입력 마감: ${official(gradeDue)} 18:00까지. 마감 이후에는 학사정보시스템 입력 창이 닫히며, 정정은 성적정정원 제출로만 가능합니다.

3. 성적 이의신청 처리: 학생 이의신청 접수 건은 ${official(appealDue)}까지 처리 결과를 시스템에 등록하여야 합니다.

4. 조교 근무상황부 제출: 학기 근무상황부를 ${official(logDue)}까지 교무처로 제출하여 주십시오. 미제출 시 다음 학기 조교 배정에 반영될 수 있습니다.

5. 문의: 교무처 학사지원팀 (02-1234-5678)`;

  const narration = `받으신 문서는 교무처에서 각 학과 조교에게 보낸 공문이에요. 2학기 성적 입력과 관련해 해야 할 일 세 가지와 각각의 마감일이 적혀 있습니다.

가장 급한 것은 성적 입력 마감이에요. ${official(gradeDue)} 오후 6시가 지나면 입력 창이 닫혀서, 그 뒤에는 정정 서류를 따로 내야 합니다.

이어서 성적 이의신청 처리와 근무상황부 제출 기한이 있어요. 아래에 날짜순으로 정리했습니다.`;

  const result: AnalysisResult = {
    doc_type: '성적 입력 및 강의평가 결과 확인 안내',
    category: 'notice',
    confidence: 0.91,
    candidates: [],
    summary:
      '교무처가 조교에게 보낸 공문이에요. 성적 입력, 이의신청 처리, 근무상황부 제출에 각각 마감일이 있어요.',
    keywords: ['교무처', '성적 입력', '이의신청', '근무상황부', '학사정보시스템', '2학기'],
    full_text: text,
    passages: [
      {
        id: 'p1',
        order: 1,
        easy: '교수님들이 기한 안에 성적을 넣으시도록 학과에서 미리 알려드리라는 부탁이에요.',
        text: '1. 2026학년도 2학기 성적 입력 기간을 아래와 같이 안내하오니, 각 학과에서는 담당 교수님께 안내하여 기한 내 입력이 완료되도록 협조하여 주시기 바랍니다.',
      },
      {
        id: 'p2',
        order: 2,
        easy: `${official(gradeDue)} 오후 6시까지 성적을 넣어야 해요. 그 뒤에는 서류를 따로 내야 고칠 수 있어요.`,
        text: `2. 성적 입력 마감: ${official(gradeDue)} 18:00까지. 마감 이후에는 학사정보시스템 입력 창이 닫히며, 정정은 성적정정원 제출로만 가능합니다.`,
      },
      {
        id: 'p3',
        order: 3,
        easy: '학생이 성적에 이의를 신청한 건은 이 날짜까지 처리 결과를 시스템에 올려야 해요.',
        text: `3. 성적 이의신청 처리: 학생 이의신청 접수 건은 ${official(appealDue)}까지 처리 결과를 시스템에 등록하여야 합니다.`,
      },
      {
        id: 'p4',
        order: 4,
        easy: '이번 학기에 근무한 기록을 교무처에 내야 해요. 안 내면 다음 학기 배정에 불리할 수 있어요.',
        text: `4. 조교 근무상황부 제출: 학기 근무상황부를 ${official(logDue)}까지 교무처로 제출하여 주십시오. 미제출 시 다음 학기 조교 배정에 반영될 수 있습니다.`,
      },
    ],
    tasks: [
      {
        action: '담당 교수님께 성적 입력 마감 알려드리고 입력 여부 확인하기',
        deadline: iso(gradeDue),
        deadline_kind: 'explicit',
        evidence: `성적 입력 마감: ${official(gradeDue)} 18:00까지.`,
        passage_id: 'p2',
        if_missed: '입력 창이 닫혀서 성적정정원을 따로 받아 제출해야 해요.',
      },
      {
        action: '성적 이의신청 처리 결과 시스템에 등록하기',
        deadline: iso(appealDue),
        deadline_kind: 'explicit',
        evidence: `학생 이의신청 접수 건은 ${official(appealDue)}까지 처리 결과를 시스템에 등록하여야 합니다.`,
        passage_id: 'p3',
        if_missed: '학생이 결과를 받지 못해 민원이 생길 수 있어요.',
      },
      {
        action: '학기 근무상황부 교무처에 제출하기',
        deadline: iso(logDue),
        deadline_kind: 'explicit',
        evidence: `학기 근무상황부를 ${official(logDue)}까지 교무처로 제출하여 주십시오.`,
        passage_id: 'p4',
        if_missed: '다음 학기 조교 배정에 반영될 수 있다고 적혀 있어요.',
      },
    ],
    terms: [
      {
        original: '성적정정원',
        easy: '이미 확정된 성적을 고쳐 달라고 내는 신청서예요.',
        evidence: '정정은 성적정정원 제출로만 가능합니다.',
        passage_id: 'p2',
      },
      {
        original: '근무상황부',
        easy: '언제 출근하고 무슨 일을 했는지 적어 두는 근무 기록장이에요.',
        evidence: '학기 근무상황부를',
        passage_id: 'p4',
      },
    ],
    warnings: [
      {
        level: 'high',
        text: '성적 입력은 날짜뿐 아니라 시각(오후 6시)까지 정해져 있어요. 마감 당일 저녁에는 입력할 수 없습니다.',
        evidence: `${official(gradeDue)} 18:00까지.`,
        passage_id: 'p2',
        source_kind: 'document',
      },
      {
        level: 'medium',
        text: '근무상황부를 내지 않으면 다음 학기 조교 배정에 반영될 수 있다고 적혀 있어요.',
        evidence: '미제출 시 다음 학기 조교 배정에 반영될 수 있습니다.',
        passage_id: 'p4',
        source_kind: 'document',
      },
    ],
    needs_expert: false,
    specialization_hint: false,
  };

  return { text, narration, result };
}
