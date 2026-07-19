// 예식 달력 표시용 순수 계산 — 모든 날짜는 Asia/Seoul 기준 (wedding.datetime 저장 규칙과 동일)

const seoulYmdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function seoulYmd(date: Date): { year: number; month: number; day: number } {
  const [year, month, day] = seoulYmdFormatter.format(date).split("-").map(Number);
  return { year, month, day };
}

export interface CalendarMonth {
  year: number;
  month: number; // 1~12
  day: number; // 예식일
  weeks: (number | null)[][]; // 일요일 시작, 달 밖의 칸은 null
}

export function weddingCalendarMonth(iso: string): CalendarMonth {
  const { year, month, day } = seoulYmd(new Date(iso));
  // 같은 달력 날짜의 요일·일수는 시간대와 무관하므로 UTC 산술로 충분하다
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return { year, month, day, weeks };
}

// D-day: 서울 기준 달력 날짜 차이. 양수=예식 전, 0=당일, 음수=예식 후.
// now는 호출자가 주입한다 — 렌더 중 Date.now 사용으로 인한 SSR hydration 불일치를 막는다.
export function daysUntilWedding(iso: string, now: Date): number {
  const target = seoulYmd(new Date(iso));
  const today = seoulYmd(now);
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((targetUtc - todayUtc) / 86_400_000);
}

export const WEEKDAY_HEADINGS = ["일", "월", "화", "수", "목", "금", "토"] as const;

// 실시간 카운트다운: 예식 '시각'까지 남은 시간 (D-day의 날짜 차이와 달리 시각 기준).
// now는 호출자가 주입한다 (daysUntilWedding과 같은 이유 — hydration 안전).
export interface WeddingCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean; // 예식 시각이 지났으면 true (표시값은 0으로 고정)
}

export function countdownToWedding(iso: string, now: Date): WeddingCountdown {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const total = Math.max(0, Math.floor(diffMs / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
    past: diffMs < 0,
  };
}
