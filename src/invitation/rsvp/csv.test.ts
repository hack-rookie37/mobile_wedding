import { describe, expect, it } from "vitest";
import type { RsvpResponse } from "./responses";
import { buildRsvpCsv, csvField } from "./csv";

function response(overrides: Partial<RsvpResponse>): RsvpResponse {
  return {
    id: "r1",
    guestName: "홍길동",
    side: "groom",
    attending: true,
    companions: 1,
    meal: "yes",
    phone: "010-1234-5678",
    message: "축하합니다",
    createdAt: "2026-10-01T10:00:00+09:00",
    updatedAt: "2026-10-01T10:00:00+09:00",
    ...overrides,
  };
}

describe("csvField — CSV injection 방어 (OWASP)", () => {
  it("수식 트리거 문자로 시작하는 값은 작은따옴표로 무력화한다", () => {
    expect(csvField("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvField("+1234")).toBe("'+1234");
    expect(csvField("-cmd")).toBe("'-cmd");
    expect(csvField("@import")).toBe("'@import");
  });

  it("쉼표·따옴표·개행은 RFC 4180 방식으로 감싼다", () => {
    expect(csvField("김, 이")).toBe('"김, 이"');
    expect(csvField('그는 "네"라고 답했다')).toBe('"그는 ""네""라고 답했다"');
    expect(csvField("첫 줄\n둘째 줄")).toBe('"첫 줄\n둘째 줄"');
  });

  it("수식 트리거 + 쉼표 조합도 안전하다", () => {
    expect(csvField('=HYPERLINK("http://evil", "click")')).toBe(
      '"\'=HYPERLINK(""http://evil"", ""click"")"',
    );
  });

  it("평범한 값은 그대로 둔다", () => {
    expect(csvField("홍길동")).toBe("홍길동");
  });
});

describe("buildRsvpCsv", () => {
  it("BOM + 헤더 + CRLF 형식으로 만든다", () => {
    const csv = buildRsvpCsv([response({})]);
    expect(csv.startsWith("\uFEFF이름,구분,참석 여부,동반 인원,식사,연락처,메시지,제출 시각")).toBe(
      true,
    );
    expect(csv).toContain("\r\n홍길동,신랑측,참석,1,식사 예정,010-1234-5678,축하합니다,");
  });

  it("악의적 이름·메시지가 수식으로 나가지 않는다", () => {
    const csv = buildRsvpCsv([response({ guestName: "=cmd|' /C calc'!A0", message: "@SUM(1+9)" })]);
    // 작은따옴표 prefix로 수식이 무력화된다 (쉼표·큰따옴표가 없으면 감싸지 않는다)
    expect(csv).toContain("'=cmd|' /C calc'!A0,");
    expect(csv).toContain("'@SUM(1+9)");
  });

  it("미수집(null) 필드는 빈 칸으로 나간다", () => {
    const csv = buildRsvpCsv([
      response({ side: null, companions: null, meal: null, phone: null, message: null }),
    ]);
    expect(csv).toContain("홍길동,,참석,,,,,2026-10-01T10:00:00+09:00");
  });
});
