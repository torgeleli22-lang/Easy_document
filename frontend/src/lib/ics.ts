/**
 * 달력 파일(.ics) 만들기.
 *
 * 휴대폰·구글·아웃룩 달력 어디서나 열 수 있는 표준 형식입니다. 파일은 브라우저 안에서
 * 만들고 서버로 보내지 않습니다. 기한은 하루 종일 일정으로 넣고, 하루 전 오전 9시에
 * 알림이 울리게 합니다.
 */

export interface CalendarEvent {
  /** 같은 일을 다시 내보내도 달력에 두 번 생기지 않게 하는 고유 값 */
  uid: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  description?: string;
}

/** 달력 형식에서 특별한 뜻을 가진 글자를 이스케이프합니다 */
function escape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** 한 줄이 75바이트를 넘으면 접습니다 (RFC 5545). 한글이 깨지지 않게 글자 단위로 자릅니다 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compact = (isoDate: string) => isoDate.replace(/-/g, '');

function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function stamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function buildIcs(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Easy Document//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const now = stamp();

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}@easy-document`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${compact(event.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(event.date))}`,
      `SUMMARY:${escape(`[마감] ${event.title}`)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escape(event.description)}`);
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(`내일 마감: ${event.title}`)}`,
      // 하루 종일 일정은 0시에 시작하므로 15시간 전 = 전날 오전 9시
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(events: CalendarEvent[], fileName: string) {
  const blob = new Blob([buildIcs(events)], { type: 'text/calendar;charset=utf-8' });
  downloadBlob(blob, fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
