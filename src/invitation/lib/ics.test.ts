import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { buildIcs, weddingIcsEvent } from "./ics";

describe("buildIcs", () => {
  const event = {
    uid: "2026-11-14T14:00:00+09:00-김민준-이서연@marriage-invitation",
    title: "김민준♥이서연 결혼식",
    startIso: "2026-11-14T14:00:00+09:00",
    durationMinutes: 120,
    location: "라온컨벤션 3층 그랜드볼룸 서울특별시 강남구 테헤란로 132",
    description: "2026년 11월 14일 토요일 오후 2시",
  };

  it("서울 시간을 UTC로 변환해 기록한다 (+09:00 14:00 → 05:00Z)", () => {
    const ics = buildIcs(event);
    expect(ics).toContain("DTSTART:20261114T050000Z");
    expect(ics).toContain("DTEND:20261114T070000Z"); // 120분 뒤
  });

  it("VCALENDAR/VEVENT 구조와 필수 속성을 갖춘다", () => {
    const ics = buildIcs(event);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    for (const prop of ["UID:", "DTSTAMP:", "SUMMARY:", "LOCATION:", "DESCRIPTION:"]) {
      expect(ics).toContain(prop);
    }
  });

  it("콤마·세미콜론·개행을 RFC 5545 규칙으로 이스케이프한다", () => {
    const ics = buildIcs({
      ...event,
      location: "라온컨벤션, 3층; 그랜드볼룸",
      description: "첫 줄\n둘째 줄",
    });
    expect(ics).toContain("LOCATION:라온컨벤션\\, 3층\\; 그랜드볼룸");
    expect(ics).toContain("DESCRIPTION:첫 줄\\n둘째 줄");
  });
});

describe("weddingIcsEvent", () => {
  it("신랑·신부 이름을 하트로 붙인다", () => {
    expect(weddingIcsEvent(createSampleDocument().wedding).title).toBe("이정훈♥양은진 결혼식");
  });

  it("이름이 비면 하트만 남은 제목을 만들지 않는다", () => {
    const wedding = createSampleDocument().wedding;
    const event = weddingIcsEvent({ ...wedding, groom: { ...wedding.groom, name: "" } });
    expect(event.title).toBe("결혼식");
  });
});
