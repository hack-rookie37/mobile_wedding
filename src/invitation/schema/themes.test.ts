import { describe, expect, it } from "vitest";
import { customFontAssetIds } from "../lib/assetRefs";
import { createSampleDocument } from "../fixtures/sample";
import {
  BASE_BODY_PX,
  customFontAssetIdOf,
  customFontFamily,
  DEFAULT_BODY_PT,
  fontCssOf,
  fontScaleFromPt,
} from "./themes";

describe("fontScaleFromPt", () => {
  it("기본 pt는 본문 기준선(15px)과 거의 같은 배율이다", () => {
    expect(fontScaleFromPt(DEFAULT_BODY_PT)).toBeCloseTo((11 * 4) / 3 / BASE_BODY_PX, 5);
    expect(fontScaleFromPt(DEFAULT_BODY_PT)).toBeGreaterThan(0.95);
    expect(fontScaleFromPt(DEFAULT_BODY_PT)).toBeLessThan(1.0);
  });

  it("pt가 커질수록 배율이 단조 증가한다", () => {
    expect(fontScaleFromPt(9)).toBeLessThan(fontScaleFromPt(11));
    expect(fontScaleFromPt(11)).toBeLessThan(fontScaleFromPt(16));
  });
});

describe("fontCssOf", () => {
  it("theme은 null — 호출자가 테마 토큰으로 대체한다", () => {
    expect(fontCssOf("theme")).toBeNull();
  });

  it("내장 폰트는 CSS 스택을 돌려준다", () => {
    expect(fontCssOf("nanum-myeongjo")).toContain("Nanum Myeongjo");
  });

  it("업로드 폰트는 asset id에서 파생한 family를 쓴다", () => {
    const css = fontCssOf("custom:abc-123");
    expect(css).toContain(`"${customFontFamily("abc-123")}"`);
    expect(customFontAssetIdOf("custom:abc-123")).toBe("abc-123");
    expect(customFontAssetIdOf("sans")).toBeNull();
  });

  it("알 수 없는 id는 조용히 넘어가지 않고 즉시 실패한다", () => {
    expect(() => fontCssOf("없는폰트" as never)).toThrow(/알 수 없는 폰트/);
  });
});

describe("customFontAssetIds", () => {
  it("전역 typography와 섹션 override 양쪽에서 모은다", () => {
    const doc = createSampleDocument();
    expect(customFontAssetIds(doc).size).toBe(0); // 샘플은 내장 폰트만 쓴다

    doc.typography.headingFont = "custom:font-a";
    doc.sections[1].style.fontFamily = "custom:font-b";
    doc.sections[2].style.fontFamily = "gowun-dodum";
    expect([...customFontAssetIds(doc)].sort()).toEqual(["font-a", "font-b"]);
  });
});
