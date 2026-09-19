/**
 * 기한 표시용 날짜 계산.
 *
 * 기획서 4.4: 날짜 계산은 모델이 아니라 코드가 합니다.
 * 백엔드에도 같은 계산이 도구(deadline_calculator)로 들어가고,
 * 여기서는 화면 표시용 D-day만 구합니다.
 */

/** 시각을 버리고 날짜만 남깁니다 (하루 단위로 세기 위해) */
function toDateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** 오늘부터 며칠 남았는지. 지났으면 음수 */
export function daysUntil(isoDate: string, today: Date = new Date()): number {
  const target = toDateOnly(new Date(`${isoDate}T00:00:00`));
  const base = toDateOnly(today);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - base.getTime()) / millisecondsPerDay);
}

/** "3일 남음", "오늘까지" 처럼 쉬운 말로 */
export function formatDday(isoDate: string, today: Date = new Date()): string {
  const days = daysUntil(isoDate, today);
  if (days === 0) return '오늘까지';
  if (days > 0) return `${days}일 남음`;
  return `${Math.abs(days)}일 지남`;
}

/** "2026년 10월 5일" */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}
