import { describe, expect, it } from "vitest";
import { summarizeRsvp, type RsvpResponse } from "./responses";

let seq = 0;
function response(overrides: Partial<RsvpResponse>): RsvpResponse {
  seq += 1;
  return {
    id: `r${seq}`,
    guestName: `게스트${seq}`,
    side: null,
    attending: true,
    companions: null,
    meal: null,
    phone: null,
    message: null,
    createdAt: "2026-10-01T10:00:00+09:00",
    updatedAt: "2026-10-01T10:00:00+09:00",
    ...overrides,
  };
}

describe("summarizeRsvp — 집계 카드 (PRODUCT_SPEC §8)", () => {
  it("빈 목록은 전부 0이다", () => {
    expect(summarizeRsvp([])).toEqual({
      total: 0,
      attending: 0,
      declined: 0,
      companionTotal: 0,
      expectedGuests: 0,
      attendingBySide: { groom: 0, bride: 0, unspecified: 0 },
      meals: { yes: 0, no: 0, undecided: 0, unanswered: 0 },
    });
  });

  it("참석/불참·동반 합계·예상 인원을 집계한다", () => {
    const summary = summarizeRsvp([
      response({ attending: true, companions: 2, side: "groom", meal: "yes" }),
      response({ attending: true, companions: 0, side: "bride", meal: "no" }),
      response({ attending: true, companions: null, side: null, meal: null }),
      response({ attending: false, companions: 5, side: "groom", meal: "yes" }),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.attending).toBe(3);
    expect(summary.declined).toBe(1);
    // 불참자의 동반·식사는 예상 인원에 넣지 않는다
    expect(summary.companionTotal).toBe(2);
    expect(summary.expectedGuests).toBe(5);
    expect(summary.attendingBySide).toEqual({ groom: 1, bride: 1, unspecified: 1 });
    expect(summary.meals).toEqual({ yes: 1, no: 1, undecided: 0, unanswered: 1 });
  });
});
