import { describe, expect, it } from "vitest";
import { rsvpLogLine } from "./logSafe";

// log redaction (ADR-021): 게스트 입력값은 어떤 형태의 에러를 통해서도 로그에 새지 않는다

describe("rsvpLogLine", () => {
  it("이벤트 이름과 SQLSTATE 코드만 통과시킨다", () => {
    const line = rsvpLogLine("submit_failed", { code: "23514", message: "…" });
    expect(JSON.parse(line)).toEqual({ scope: "rsvp", event: "submit_failed", code: "23514" });
  });

  it("에러 message·details·hint에 든 게스트 입력값을 버린다", () => {
    // Postgres 제약 위반은 details에 행 전체를 실어줄 수 있다
    const dbError = {
      code: "23514",
      message: 'new row violates check constraint — guest_name "홍길동"',
      details: "Failing row contains (홍길동, 010-1234-5678, 축하 메시지입니다)",
      hint: "010-1234-5678",
    };
    const line = rsvpLogLine("submit_failed", dbError);
    expect(line).not.toContain("홍길동");
    expect(line).not.toContain("010-1234-5678");
    expect(line).not.toContain("축하");
    expect(line).toContain("23514");
  });

  it("code가 SQLSTATE 형식이 아니면(자유 텍스트 오염 가능) 버린다", () => {
    const line = rsvpLogLine("submit_failed", {
      code: "이름: 홍길동 (자유 텍스트)",
      message: "x",
    });
    expect(line).not.toContain("홍길동");
    expect(JSON.parse(line)).toEqual({ scope: "rsvp", event: "submit_failed" });
  });

  it("에러가 없거나 형태가 달라도 안전하다", () => {
    expect(JSON.parse(rsvpLogLine("unexpected_status"))).toEqual({
      scope: "rsvp",
      event: "unexpected_status",
    });
    expect(() => rsvpLogLine("x", null)).not.toThrow();
    expect(() => rsvpLogLine("x", "raw string with 010-1234-5678")).not.toThrow();
    expect(rsvpLogLine("x", "raw string with 010-1234-5678")).not.toContain("010");
  });
});
