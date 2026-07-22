import { describe, expect, it } from "vitest";
import { withEmojiPresentation } from "./emoji";

const VS16 = "️";

describe("withEmojiPresentation", () => {
  it("표시 지정자가 빠진 옛 기호에 붙인다 — ☎가 작은 흑백 활자로 그려지지 않게", () => {
    expect(withEmojiPresentation("☎")).toBe(`☎${VS16}`); // ☎ → ☎️
    expect(withEmojiPresentation("✈")).toBe(`✈${VS16}`); // ✈ → ✈️
    expect(withEmojiPresentation("❤")).toBe(`❤${VS16}`); // ❤ → ❤️
  });

  it("이미 지정자가 있으면 그대로 둔다 (두 번 붙이지 않는다)", () => {
    const parking = `\u{1F17F}${VS16}`; // 🅿️
    expect(withEmojiPresentation(parking)).toBe(parking);
    const phone = `☎${VS16}`; // ☎️
    expect(withEmojiPresentation(phone)).toBe(phone);
  });

  it("기본이 컬러 이모지인 그림은 손대지 않는다", () => {
    for (const emoji of ["🚇", "🚌", "🚗", "🚐", "📍", "📞"]) {
      expect(withEmojiPresentation(emoji)).toBe(emoji);
    }
  });

  it("ZWJ 조합·복수 그림도 깨뜨리지 않는다", () => {
    const family = "👨‍👩‍👧"; // ZWJ 시퀀스 — 구성 글자 모두 컬러 기본
    expect(withEmojiPresentation(family)).toBe(family);
    expect(withEmojiPresentation("🚗☎")).toBe(`🚗☎${VS16}`);
  });

  it("일반 글자·숫자는 그대로다 — 숫자에 지정자를 붙이면 키캡 이모지가 되어버린다", () => {
    expect(withEmojiPresentation("셔틀 3번")).toBe("셔틀 3번");
    expect(withEmojiPresentation("P")).toBe("P");
    expect(withEmojiPresentation("")).toBe("");
  });

  it("글자 표시를 일부러 고른 경우(U+FE0E)는 존중한다", () => {
    const textStyle = "☎︎"; // ☎︎ — 흑백 활자를 의도한 선택
    expect(withEmojiPresentation(textStyle)).toBe(textStyle);
  });
});
