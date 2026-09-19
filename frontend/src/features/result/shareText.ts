import type { AnalysisResult } from '@shared/schemas/result';
import { formatDate } from '@/lib/date';

/**
 * 공유용 요약 텍스트를 만듭니다.
 *
 * 기본값은 요약만입니다. 원본 서류는 포함하지 않습니다 (기획서 4.7).
 * AI가 만든 설명이라는 표시와 면책 문구는 반드시 들어갑니다.
 */
export function buildShareText(result: AnalysisResult): string {
  const lines: string[] = [`[${result.doc_type}]`, result.summary];

  if (result.tasks.length > 0) {
    lines.push('', '해야 할 일');
    for (const task of result.tasks) {
      const when = task.deadline ? `${formatDate(task.deadline)}까지` : '기한 확인 필요';
      lines.push(`- ${task.action} (${when})`);
    }
  }

  const importantWarnings = result.warnings.filter((warning) => warning.level === 'high');
  if (importantWarnings.length > 0) {
    lines.push('', '주의할 점');
    for (const warning of importantWarnings) {
      lines.push(`- ${warning.text}`);
    }
  }

  lines.push(
    '',
    '쉬운말 AI가 만든 설명이에요. 법률 자문이 아니며, 실제 기한은 해당 기관에 확인해 주세요.',
  );

  return lines.join('\n');
}
