import type { Person } from "../schema/document";

// 표기 헬퍼 — 순수 함수 (renderer와 public metadata가 공유)

const partsFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "long",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h12",
});

function partMap(iso: string): Record<string, string> {
  const parts = partsFormatter.formatToParts(new Date(iso));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

// "2026년 11월 14일 토요일 오후 2시" (0분이 아니면 "… 2시 30분")
export function formatWeddingDate(iso: string): string {
  const p = partMap(iso);
  const minute = Number(p.minute);
  const time = minute === 0 ? `${p.hour}시` : `${p.hour}시 ${minute}분`;
  return `${p.year}년 ${p.month}월 ${p.day}일 ${p.weekday} ${p.dayPeriod} ${time}`;
}

// "2026.11.14 토 오후 2:00" — film diary의 스탬프형 표기
export function formatDateStamp(iso: string): string {
  const p = partMap(iso);
  const weekdayShort = p.weekday.replace("요일", "");
  return `${p.year}.${p.month.padStart(2, "0")}.${p.day.padStart(2, "0")} ${weekdayShort} ${p.dayPeriod} ${p.hour}:${p.minute.padStart(2, "0")}`;
}

export interface ParentsLineParts {
  parents: string; // "김영호 · 박정숙" (故 표기 포함)
  relation: string; // "장남" 등 (없으면 "아들"/"딸" 미추정 — 빈 문자열)
  name: string;
}

export function parentsLineOf(person: Person): ParentsLineParts | null {
  const names = [person.father, person.mother]
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => (p.deceased ? `故 ${p.name}` : p.name));
  if (names.length === 0) return null;
  return {
    parents: names.join(" · "),
    relation: person.familyRole ?? "",
    name: person.name,
  };
}
