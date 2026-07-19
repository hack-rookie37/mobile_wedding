import type { ContactSide } from "../schema/document";
import type { RsvpMeal } from "./submission";

// 저장된 RSVP 응답 한 건 — invitation 문서 밖(rsvp_responses 테이블)에만 존재하며
// 프로젝트 소유자만 조회할 수 있다 (ADR-021).

export const RSVP_SIDE_LABELS: Record<ContactSide, string> = {
  groom: "신랑측",
  bride: "신부측",
};

export const RSVP_MEAL_LABELS: Record<RsvpMeal, string> = {
  yes: "식사 예정",
  no: "식사 안 함",
  undecided: "미정",
};

export interface RsvpResponse {
  id: string;
  guestName: string;
  side: ContactSide | null; // null = 미수집·미선택
  attending: boolean;
  companions: number | null; // 본인 제외 동반 인원, null = 미수집
  meal: RsvpMeal | null;
  phone: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

// 집계 카드용 요약 (PRODUCT_SPEC §8 — 참석/불참/동행 합계, 측별·식사별)
export interface RsvpSummary {
  total: number;
  attending: number;
  declined: number;
  companionTotal: number; // 참석 응답의 동반 인원 합
  expectedGuests: number; // 참석 응답 수 + 동반 인원 합
  attendingBySide: { groom: number; bride: number; unspecified: number };
  meals: { yes: number; no: number; undecided: number; unanswered: number }; // 참석 응답 기준
}

export function summarizeRsvp(responses: RsvpResponse[]): RsvpSummary {
  const attending = responses.filter((r) => r.attending);
  const companionTotal = attending.reduce((sum, r) => sum + (r.companions ?? 0), 0);
  const countSide = (side: ContactSide) => attending.filter((r) => r.side === side).length;
  const countMeal = (meal: RsvpMeal) => attending.filter((r) => r.meal === meal).length;
  return {
    total: responses.length,
    attending: attending.length,
    declined: responses.length - attending.length,
    companionTotal,
    expectedGuests: attending.length + companionTotal,
    attendingBySide: {
      groom: countSide("groom"),
      bride: countSide("bride"),
      unspecified: attending.filter((r) => r.side === null).length,
    },
    meals: {
      yes: countMeal("yes"),
      no: countMeal("no"),
      undecided: countMeal("undecided"),
      unanswered: attending.filter((r) => r.meal === null).length,
    },
  };
}
