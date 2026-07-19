import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { remapAssetIds } from "./remapAssetIds";

describe("remapAssetIds (프로젝트 복제)", () => {
  it("hero photoAssetId와 gallery photos의 참조를 매핑대로 바꾼다", () => {
    const doc = createSampleDocument();
    const map = new Map([
      ["hero-main", "new-hero"],
      ["gallery-01", "new-g1"],
    ]);
    const result = remapAssetIds(doc, map);

    const hero = result.sections[0];
    expect(hero.type === "hero" && hero.content.photoAssetId).toBe("new-hero");
    const gallery = result.sections.find((s) => s.type === "gallery");
    if (gallery?.type !== "gallery") throw new Error("gallery가 없습니다");
    expect(gallery.content.photos[0].assetId).toBe("new-g1");
    expect(gallery.content.photos[0].alt).toBe("한강 산책 스냅"); // metadata 보존
    // 매핑에 없는 참조(다른 샘플)는 그대로
    expect(gallery.content.photos[1].assetId).toBe("gallery-02");
  });

  it("신랑신부 소개와 맺음말의 사진 참조도 바꾼다", () => {
    const doc = createSampleDocument();
    const map = new Map([
      ["gallery-04", "new-groom"],
      ["gallery-06", "new-closing"],
    ]);
    const result = remapAssetIds(doc, map);

    const profile = result.sections.find((s) => s.type === "coupleProfile");
    if (profile?.type !== "coupleProfile") throw new Error("coupleProfile이 없습니다");
    expect(profile.content.groom.photoAssetId).toBe("new-groom");
    expect(profile.content.bride.photoAssetId).toBe("gallery-05"); // 매핑 밖은 그대로

    const closing = result.sections.find((s) => s.type === "closing");
    if (closing?.type !== "closing") throw new Error("closing이 없습니다");
    expect(closing.content.photoAssetId).toBe("new-closing");
  });

  it("원본 문서를 변경하지 않는다 (불변)", () => {
    const doc = createSampleDocument();
    const snapshot = structuredClone(doc);
    remapAssetIds(doc, new Map([["hero-main", "x"]]));
    expect(doc).toEqual(snapshot);
  });

  it("빈 매핑이면 내용이 동일하다", () => {
    const doc = createSampleDocument();
    expect(remapAssetIds(doc, new Map())).toEqual(doc);
  });
});
