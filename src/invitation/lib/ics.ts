// '일정 저장' 버튼용 iCalendar(.ics) 생성 — 순수 문자열 조립.
// 시간은 UTC로 변환해 기록한다(TZID 배포 없이 모든 캘린더 앱에서 동일하게 해석).

import { coupleNames, formatWeddingDate } from "./format";
import type { Wedding } from "../schema/document";

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

const WEDDING_EVENT_MINUTES = 120;

// 청첩장 문서 → 캘린더 이벤트. 서버 라우트와 테스트가 이 하나를 공유한다.
export function weddingIcsEvent(wedding: Wedding): IcsEventInput {
  const { groom, bride, venue } = wedding;
  const couple = coupleNames(wedding);
  return {
    uid: `${wedding.datetime}-${groom.name}-${bride.name}@marriage-invitation`,
    title: couple !== null ? `${couple} 결혼식` : "결혼식",
    startIso: wedding.datetime,
    durationMinutes: WEDDING_EVENT_MINUTES,
    location: [venue.name, venue.hall, venue.address].filter(Boolean).join(" "),
    description: formatWeddingDate(wedding.datetime),
  };
}

// 캘린더 앱이 열리려면 파일 다운로드가 아니라 text/calendar 응답이어야 한다 —
// iOS Safari는 blob 다운로드로는 '캘린더에 추가' 시트를 띄우지 않는다.
//
// disposition을 attachment가 아니라 inline으로 두는 이유: iOS Safari는 attachment를
// 파일 저장으로 처리해 캘린더가 열리지 않는다. inline이면 iOS는 일정 미리보기를 띄우고,
// Chrome 계열(안드로이드·데스크톱)은 text/calendar를 화면에 그릴 수 없으니 그대로 내려받는다.
// 파일명은 라우트 경로(.../wedding.ics)와 여기 filename이 함께 보장한다.
export function weddingIcsResponse(wedding: Wedding): Response {
  return new Response(buildIcs(weddingIcsEvent(wedding)), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="wedding.ics"',
      "cache-control": "no-store",
    },
  });
}
