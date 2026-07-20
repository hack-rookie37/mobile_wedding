import { describe, expect, it } from "vitest";
import { slugError } from "./slug";

describe("slugError (slug validation)", () => {
  it("유효한 slug는 통과한다", () => {
    for (const slug of ["abc", "minjun-seoyeon", "wedding-2026", "a1b", "x".repeat(40)]) {
      expect(slugError(slug)).toBeNull();
    }
  });

  it("길이·문자·하이픈 규칙 위반을 이유와 함께 거부한다", () => {
    expect(slugError("ab")).toMatch(/3~40자/);
    expect(slugError("x".repeat(41))).toMatch(/3~40자/);
    expect(slugError("한글주소")).toMatch(/영문 소문자/);
    expect(slugError("UPPER")).toMatch(/영문 소문자/);
    expect(slugError("has space")).toMatch(/영문 소문자/);
    expect(slugError("-lead")).toMatch(/하이픈으로 시작/);
    expect(slugError("trail-")).toMatch(/하이픈으로 시작/);
    expect(slugError("a--b")).toMatch(/연속/);
  });
});
