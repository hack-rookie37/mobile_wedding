import { describe, expect, it } from "vitest";
import { daysUntilWedding, weddingCalendarMonth } from "./calendarGrid";

describe("weddingCalendarMonth", () => {
  it("예식 달의 그리드를 서울 시간 기준으로 만든다 (2026년 11월 — 1일이 일요일, 30일)", () => {
    const month = weddingCalendarMonth("2026-11-14T14:00:00+09:00");
    expect(month.year).toBe(2026);
    expect(month.month).toBe(11);
    expect(month.day).toBe(14);
    expect(month.weeks[0][0]).toBe(1); // 11/1은 일요일
    expect(month.weeks.at(-1)).toContain(30);
    expect(month.weeks.flat().filter((d) => d !== null)).toHaveLength(30);
    // 14일은 둘째 주 토요일
    expect(month.weeks[1][6]).toBe(14);
  });

  it("주 배열은 항상 7칸이고 달 밖은 null이다", () => {
    // 2026년 12월: 1일이 화요일, 31일
    const month = weddingCalendarMonth("2026-12-25T11:00:00+09:00");
    for (const week of month.weeks) expect(week).toHaveLength(7);
    expect(month.weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(month.weeks[0][2]).toBe(1);
  });

  it("UTC 자정 경계에서도 서울 날짜를 쓴다", () => {
    // UTC 2026-11-13 23:00 = 서울 11-14 08:00
    const month = weddingCalendarMonth("2026-11-14T08:00:00+09:00");
    expect(month.day).toBe(14);
  });
});

describe("daysUntilWedding", () => {
  const wedding = "2026-11-14T14:00:00+09:00";

  it("예식 전이면 양수, 당일이면 0, 이후면 음수", () => {
    expect(daysUntilWedding(wedding, new Date("2026-11-07T14:00:00+09:00"))).toBe(7);
    expect(daysUntilWedding(wedding, new Date("2026-11-14T23:00:00+09:00"))).toBe(0);
    expect(daysUntilWedding(wedding, new Date("2026-11-15T01:00:00+09:00"))).toBe(-1);
  });

  it("시각이 달라도 달력 날짜 차이로 계산한다", () => {
    // 예식 시각(14:00)보다 늦은 저녁이어도 하루 전이면 D-1
    expect(daysUntilWedding(wedding, new Date("2026-11-13T22:00:00+09:00"))).toBe(1);
  });
});
