// '일정 저장' 버튼용 iCalendar(.ics) 생성 — 순수 문자열 조립.
// 시간은 UTC로 변환해 기록한다(TZID 배포 없이 모든 캘린더 앱에서 동일하게 해석).

export interface IcsEventInput {
  uid: string; // 결정적 값 — 같은 청첩장의 재저장이 중복 일정을 만들지 않게 한다
  title: string;
  startIso: string; // offset 포함 ISO (wedding.datetime)
  durationMinutes: number;
  location: string;
  description: string;
}

// RFC 5545 TEXT 이스케이프: 백슬래시 → 세미콜론/콤마 → 개행
function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/g, "\\n");
}

// "2026-11-14T14:00:00+09:00" → "20261114T050000Z"
function toUtcStamp(iso: string, offsetMinutes = 0): string {
  const date = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildIcs(event: IcsEventInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//marriage//wedding-invitation//KO",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${toUtcStamp(event.startIso)}`,
    `DTSTART:${toUtcStamp(event.startIso)}`,
    `DTEND:${toUtcStamp(event.startIso, event.durationMinutes)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText(event.location)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
