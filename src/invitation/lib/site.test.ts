import { describe, expect, it } from "vitest";
import { publicUrlOf } from "./site";

const ORIGIN = "https://junghoon-eunjin.com";

describe("publicUrlOf", () => {
  it("루트에 걸린 청첩장은 도메인만 준다", () => {
    expect(publicUrlOf(ORIGIN, "our-wedding", "our-wedding")).toBe(ORIGIN);
  });

  it("루트가 아닌 청첩장은 /i/<slug>를 준다", () => {
    expect(publicUrlOf(ORIGIN, "draft-b", "our-wedding")).toBe(`${ORIGIN}/i/draft-b`);
  });

  it("루트 청첩장이 설정되지 않았으면 어느 것도 도메인을 차지하지 않는다", () => {
    expect(publicUrlOf(ORIGIN, "our-wedding", null)).toBe(`${ORIGIN}/i/our-wedding`);
  });
});
