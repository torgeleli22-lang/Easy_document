import { useEffect, useState, type RefObject } from 'react';

/** 좌우로 나란히 놓이는 넓은 화면인지. result.css의 기준과 같아야 합니다 */
export const WIDE_QUERY = '(min-width: 64rem)';

/** 구간 사이 빈틈에 걸려도 앞 구간을 계속 읽는 중으로 봅니다 (px) */
const GAP_TOLERANCE = 48;

/**
 * 오른쪽 풀이에서 지금 읽고 있는 구간을 찾습니다.
 *
 * 화면의 "읽는 줄"을 하나 정하고, 그 줄에 걸친 풀이 구간을 읽는 중으로 봅니다.
 * 넓은 화면은 화면 위에서 1/3쯤, 좁은 화면은 위쪽에 붙은 원본 띠 바로 아래가
 * 읽는 줄입니다. 요약이나 일반 안내처럼 구간이 없는 곳을 읽으면 null입니다.
 */
export function useActivePassage(
  containerRef: RefObject<HTMLElement>,
  stripRef: RefObject<HTMLElement>,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const wide = window.matchMedia(WIDE_QUERY);
    let frame = 0;

    const measure = () => {
      frame = 0;
      const container = containerRef.current;
      if (!container) return;

      const strip = stripRef.current;
      const line =
        !wide.matches && strip
          ? strip.getBoundingClientRect().bottom + 24
          : window.innerHeight * 0.33;

      let found: string | null = null;
      const sections = container.querySelectorAll<HTMLElement>('[data-passage-id]');
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= line && rect.bottom + GAP_TOLERANCE >= line) {
          found = section.dataset.passageId ?? null;
        }
      }
      setActiveId(found);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    wide.addEventListener('change', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      wide.removeEventListener('change', schedule);
    };
  }, [containerRef, stripRef]);

  return activeId;
}
