import { RSVP_MEAL_LABELS, RSVP_SIDE_LABELS, type RsvpResponse } from "./responses";

// RSVP 응답 CSV export (PRODUCT_SPEC §8) — 스프레드시트 수식 주입(CSV injection) 방어 포함.
// =, +, -, @, 탭, CR로 시작하는 값은 엑셀류가 수식으로 실행할 수 있어(OWASP)
// 작은따옴표를 앞에 붙여 텍스트로 고정한다.

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvField(value: string): string {
  const guarded = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replaceAll('"', '""')}"`;
  }
  return guarded;
}

const HEADER = ["이름", "구분", "참석 여부", "동반 인원", "식사", "연락처", "메시지", "제출 시각"];

export function buildRsvpCsv(responses: RsvpResponse[]): string {
  const rows = responses.map((r) => [
    r.guestName,
    r.side === null ? "" : RSVP_SIDE_LABELS[r.side],
    r.attending ? "참석" : "불참",
    r.companions === null ? "" : String(r.companions),
    r.meal === null ? "" : RSVP_MEAL_LABELS[r.meal],
    r.phone ?? "",
    r.message ?? "",
    r.createdAt,
  ]);
  // BOM: 엑셀이 UTF-8 한글을 올바르게 읽게 한다
  const body = [HEADER, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}
