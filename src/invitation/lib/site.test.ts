import { describe, expect, it } from "vitest";
import { publicUrlOf } from "./site";

const ORIGIN = "https://junghoon-eunjin.com";

describe("publicUrlOf", () => {
  it("공개 주소를 따로 두지 않은 발행본은 도메인 그대로다", () => {
    expect(publicUrlOf(ORIGIN, null)).toBe(ORIGIN);
  });

  it("공개 주소를 적은 발행본은 /i/<slug>로 열린다", () => {
    expect(publicUrlOf(ORIGIN, "draft-b")).toBe(`${ORIGIN}/i/draft-b`);
  });
});
