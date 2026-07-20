import { describe, expect, it } from "vitest";
import { customFontAssetIds, referencedAssetIds } from "../lib/assetRefs";
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

    doc.typography.roles.heading.font = "custom:font-a";
    doc.sections[1].style.text.body.font = "custom:font-b";
    doc.sections[2].style.text.label.font = "gowun-dodum";
    expect([...customFontAssetIds(doc)].sort()).toEqual(["font-a", "font-b"]);

    // 메인 사진 위 문구는 역할 밖에서 자기 글꼴을 갖는다 — 빠뜨리면 @font-face가 주입되지
    // 않아 업로드한 글꼴이 조용히 기본 글꼴로 떨어진다 (실제로 그랬다)
    const hero = doc.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    hero.content.overlay.font = "custom:font-c";
    expect([...customFontAssetIds(doc)].sort()).toEqual(["font-a", "font-b", "font-c"]);
    // 삭제 보호도 같은 목록을 쓴다 — 쓰고 있는 폰트 파일이 경고 없이 지워지면 안 된다
    expect(referencedAssetIds(doc).has("font-c")).toBe(true);
  });
});
