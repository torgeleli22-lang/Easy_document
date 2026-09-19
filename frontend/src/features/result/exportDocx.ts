import type { Paragraph, Table, TableCell } from 'docx';
import type { AnalysisResult, Passage } from '@shared/schemas/result';
import type { AnalysisInput } from '@/lib/analysisClient';
import { formatDate } from '@/lib/date';

/**
 * 결과를 워드(.docx) 파일로 내려받습니다.
 *
 * 전부 브라우저 안에서 만들고 서버를 거치지 않습니다 (기획서 4.7).
 *
 * 문서 구성:
 *   1. 한 줄 요약과 해야 할 일 — 먼저 읽을 내용을 앞머리에
 *   2. 원문과 구간별 설명 — 원문 문단을 그대로 싣고 바로 아래에 들여쓴 설명 박스
 *
 * 설명을 워드 코멘트가 아니라 본문에 넣는 이유는, 인쇄하거나 휴대폰에서 열어도
 * 그대로 읽히기 때문입니다. 원본 서식·레이아웃은 보존되지 않습니다.
 */

/**
 * 워드 생성 라이브러리는 무겁습니다(gzip 기준 100KB 이상).
 * 첫 화면을 빨리 띄우는 쪽이 중요해서, 내려받기를 누를 때 비로소 받아옵니다.
 */
type DocxModule = typeof import('docx');

let cachedDocx: DocxModule | null = null;

async function loadDocx(): Promise<DocxModule> {
  cachedDocx ??= await import('docx');
  return cachedDocx;
}

const KOREAN_FONT = '맑은 고딕';
const COLOR_MUTED = '4A4F58';
const COLOR_ACCENT = '12379B';
const COLOR_BOX = 'F4F6FA';

/** 원문 구간 하나에 붙는 설명 */
interface Note {
  kind: string;
  text: string;
}

/** 각 항목을 자기가 속한 원문 구간으로 모읍니다. */
function collectNotes(result: AnalysisResult): {
  byPassage: Map<string, Note[]>;
  unattached: Note[];
} {
  const byPassage = new Map<string, Note[]>();
  const unattached: Note[] = [];

  const add = (passageId: string | null, note: Note) => {
    if (!passageId) {
      unattached.push(note);
      return;
    }
    const existing = byPassage.get(passageId);
    if (existing) existing.push(note);
    else byPassage.set(passageId, [note]);
  };

  for (const task of result.tasks) {
    const when = task.deadline ? `${formatDate(task.deadline)}까지` : '기한 확인 필요';
    add(task.passage_id, {
      kind: '해야 할 일',
      text: `${task.action} (${when})\n안 하면: ${task.if_missed}`,
    });
  }
  for (const term of result.terms) {
    add(term.passage_id, { kind: '어려운 말', text: `${term.original}: ${term.easy}` });
  }
  for (const warning of result.warnings) {
    const source = warning.source_kind === 'document' ? '문서에 적힌 내용' : '일반 안내';
    add(warning.passage_id, { kind: `주의할 점 · ${source}`, text: warning.text });
  }

  return { byPassage, unattached };
}

function heading(d: DocxModule, text: string): Paragraph {
  return new d.Paragraph({
    text,
    heading: d.HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
  });
}

/** 원문 문단. 설명과 섞이지 않게 굵게 두고 위아래를 띄웁니다. */
function originalParagraph(d: DocxModule, passage: Passage): Paragraph {
  return new d.Paragraph({
    children: [new d.TextRun({ text: passage.text, bold: true })],
    spacing: { before: 280, after: 80 },
  });
}

/** 설명 박스. 원문 바로 아래에 들여쓰고 배경을 깔아 구분합니다. */
function noteBox(d: DocxModule, note: Note): Paragraph[] {
  const lines = note.text.split('\n');

  return lines.map((line, index) => {
    const isFirst = index === 0;
    const isLast = index === lines.length - 1;

    return new d.Paragraph({
      children: [
        ...(isFirst
          ? [new d.TextRun({ text: `${note.kind} · `, bold: true, color: COLOR_ACCENT })]
          : []),
        new d.TextRun({ text: line }),
      ],
      indent: { left: 480 },
      shading: { fill: COLOR_BOX },
      spacing: { before: isFirst ? 60 : 0, after: isLast ? 120 : 0 },
    });
  });
}

function cell(
  d: DocxModule,
  text: string,
  options: { bold?: boolean; width: number },
): TableCell {
  return new d.TableCell({
    width: { size: options.width, type: d.WidthType.PERCENTAGE },
    children: [
      new d.Paragraph({
        children: [new d.TextRun({ text, bold: options.bold })],
      }),
    ],
  });
}

/** 해야 할 일과 기한을 앞머리에 표로 정리합니다. */
function taskTable(d: DocxModule, result: AnalysisResult): Table {
  const header = new d.TableRow({
    tableHeader: true,
    children: [
      cell(d, '해야 할 일', { bold: true, width: 45 }),
      cell(d, '기한', { bold: true, width: 25 }),
      cell(d, '안 하면', { bold: true, width: 30 }),
    ],
  });

  const rows = result.tasks.map(
    (task) =>
      new d.TableRow({
        children: [
          cell(d, task.action, { width: 45 }),
          cell(d, task.deadline ? `${formatDate(task.deadline)}까지` : '기한 확인 필요', {
            width: 25,
          }),
          cell(d, task.if_missed, { width: 30 }),
        ],
      }),
  );

  return new d.Table({
    width: { size: 100, type: d.WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

/** 업로드한 사진을 원본 자리에 싣습니다. 워드에 넣을 수 없는 형식은 안내만. */
async function originalFileBlocks(
  d: DocxModule,
  input: AnalysisInput | null,
): Promise<(Paragraph | Table)[]> {
  if (!input || input.kind !== 'file') return [];

  const { file } = input;

  if (file.type.startsWith('image/')) {
    const data = new Uint8Array(await file.arrayBuffer());
    return [
      new d.Paragraph({
        children: [
          new d.ImageRun({
            data,
            type: file.type === 'image/png' ? 'png' : 'jpg',
            // A4 본문 폭에 맞춘 크기. 세로로 긴 문서 사진을 기준으로 잡았습니다.
            transformation: { width: 440, height: 600 },
          }),
        ],
        alignment: d.AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    ];
  }

  return [
    new d.Paragraph({
      children: [
        new d.TextRun({
          text: `원본 파일: ${file.name} (이 형식은 워드 안에 넣을 수 없어 따로 보관해 주세요.)`,
          color: COLOR_MUTED,
        }),
      ],
      spacing: { after: 200 },
    }),
  ];
}

export async function buildResultDocx(
  result: AnalysisResult,
  input: AnalysisInput | null,
): Promise<Blob> {
  const d = await loadDocx();
  const { byPassage, unattached } = collectNotes(result);
  const today = new Date();
  const madeOn = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const children: (Paragraph | Table)[] = [
    new d.Paragraph({
      text: `${result.doc_type} 쉬운 말 풀이`,
      heading: d.HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
    new d.Paragraph({
      children: [
        new d.TextRun({
          text: `쉬운말 AI가 ${madeOn}에 만든 설명이에요. 법률 자문이 아니며, 실제 기한은 문서에 적힌 기관에 확인해 주세요.`,
          color: COLOR_MUTED,
          size: 20,
        }),
      ],
      spacing: { after: 280 },
    }),

    heading(d, '한 줄 요약'),
    new d.Paragraph({ text: result.summary }),
  ];

  if (result.tasks.length > 0) {
    children.push(heading(d, '해야 할 일과 기한'), taskTable(d, result));
  }

  children.push(heading(d, '원문과 설명'));
  children.push(...(await originalFileBlocks(d, input)));

  const orderedPassages = [...result.passages].sort((a, b) => a.order - b.order);
  for (const passage of orderedPassages) {
    children.push(originalParagraph(d, passage));
    for (const note of byPassage.get(passage.id) ?? []) {
      children.push(...noteBox(d, note));
    }
  }

  if (unattached.length > 0) {
    children.push(heading(d, '문서에는 없지만 알아두면 좋은 안내'));
    for (const note of unattached) {
      children.push(...noteBox(d, note));
    }
  }

  children.push(
    heading(d, '알아두실 점'),
    new d.Paragraph({
      text: '이 설명은 AI가 만든 것이고 법률 자문이 아니에요. 중요한 결정을 하기 전에는 문서에 적힌 기관이나 전문가에게 한 번 더 확인해 주세요.',
    }),
  );

  const document = new d.Document({
    styles: {
      default: {
        document: { run: { font: KOREAN_FONT, size: 22 } },
        title: { run: { font: KOREAN_FONT, size: 36, bold: true, color: '14161A' } },
        heading1: { run: { font: KOREAN_FONT, size: 26, bold: true, color: COLOR_ACCENT } },
      },
    },
    sections: [{ children }],
  });

  return d.Packer.toBlob(document);
}

/** 만든 워드 파일을 내려받습니다. */
export async function downloadResultDocx(
  result: AnalysisResult,
  input: AnalysisInput | null,
): Promise<void> {
  const blob = await buildResultDocx(result, input);
  const url = URL.createObjectURL(blob);

  // 문서에 붙이지 않고 클릭하면 브라우저가 download 속성을 무시하고
  // 파일명이 "download"로 떨어집니다. 붙였다가 바로 떼어냅니다.
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${result.doc_type} 쉬운 말 풀이.docx`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // 내려받기가 시작되기 전에 주소를 거둬들이면 파일이 비어버립니다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
