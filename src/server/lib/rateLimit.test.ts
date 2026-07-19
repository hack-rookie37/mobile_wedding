import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "./rateLimit";

describe("SlidingWindowLimiter — /api/rsvp의 1차 방어선", () => {
  it("윈도우 안에서는 limit까지만 허용한다", () => {
    const limiter = new SlidingWindowLimiter(3, 60_000);
    const t = 1_000_000;
    expect(limiter.allow("a", t)).toBe(true);
    expect(limiter.allow("a", t + 1)).toBe(true);
    expect(limiter.allow("a", t + 2)).toBe(true);
    expect(limiter.allow("a", t + 3)).toBe(false);
    expect(limiter.allow("a", t + 59_999)).toBe(false);
  });

  it("윈도우가 지나면 다시 허용한다 (sliding)", () => {
    const limiter = new SlidingWindowLimiter(2, 60_000);
    const t = 1_000_000;
    expect(limiter.allow("a", t)).toBe(true);
    expect(limiter.allow("a", t + 30_000)).toBe(true);
    expect(limiter.allow("a", t + 40_000)).toBe(false);
    // 첫 히트(t)가 윈도우를 벗어나면 한 자리가 빈다
    expect(limiter.allow("a", t + 60_001)).toBe(true);
    expect(limiter.allow("a", t + 60_002)).toBe(false); // t+30s 히트가 아직 윈도우 안
  });

  it("키(IP+slug)별로 독립적으로 계산한다", () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    const t = 1_000_000;
    expect(limiter.allow("ip1:slug-a", t)).toBe(true);
    expect(limiter.allow("ip1:slug-a", t + 1)).toBe(false);
    expect(limiter.allow("ip2:slug-a", t + 1)).toBe(true);
    expect(limiter.allow("ip1:slug-b", t + 1)).toBe(true);
  });

  it("거부된 요청은 히트로 계산하지 않는다 (거부가 차단을 연장하지 않음)", () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    const t = 1_000_000;
    expect(limiter.allow("a", t)).toBe(true);
    expect(limiter.allow("a", t + 30_000)).toBe(false);
    // 거부가 히트로 남았다면 t+60_001에도 차단됐을 것
    expect(limiter.allow("a", t + 60_001)).toBe(true);
  });
});
