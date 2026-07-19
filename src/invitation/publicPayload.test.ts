import { describe, expect, it } from "vitest";
import { createSampleDocument } from "./fixtures/sample";
import { buildPublicPayload, publicPageMeta, manifestResolver } from "./publicPayload";

const MANIFEST = [
  { id: "asset-1", url: "https://cdn.example/a.png", thumbUrl: null, width: 800, height: 1000 },
];

describe("buildPublicPayload (public projection)", () => {
  it("문서 스키마 밖의 키(편집기 상태·내부 메타)를 제거한다", () => {
    const doc = createSampleDocument();
    const tampered = {
      ...doc,
      _internalNote: "노출되면 안 되는 값",
      undoStack: [{ patches: [] }],
      sections: doc.sections.map((section) => ({ ...section, _editorSelected: true })),
    };
    const payload = buildPublicPayload(tampered, MANIFEST);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("_internalNote");
    expect(serialized).not.toContain("undoStack");
    expect(serialized).not.toContain("_editorSelected");
    expect(payload.doc.sections).toHaveLength(doc.sections.length); // 내용은 보존
  });

  it("asset manifest에 내부 storage 필드가 섞여 있으면 통과가 아니라 실패한다 (fail fast)", () => {
    expect(() =>
      buildPublicPayload(createSampleDocument(), [
        { ...MANIFEST[0], storagePath: "projects/secret/path.png" },
      ]),
    ).toThrow();
    expect(() => buildPublicPayload(createSampleDocument(), [{ id: "x", url: "u" }])).toThrow(); // 필수 필드 누락도 거부
  });

  it("잘못된 문서는 거부한다", () => {
    expect(() => buildPublicPayload({ schemaVersion: 3, sections: [] }, [])).toThrow();
  });

  it("숨긴 섹션은 내용째 제거된다 — 숨긴 계좌·연락처가 게스트 응답에 실리지 않는다", () => {
    const doc = createSampleDocument();
    for (const section of doc.sections) {
      if (section.type === "giftAccount" || section.type === "contacts") {
        section.visible = false;
      }
    }
    const payload = buildPublicPayload(doc, []);
    const serialized = JSON.stringify(payload);
    expect(payload.doc.sections.some((s) => s.type === "giftAccount")).toBe(false);
    expect(payload.doc.sections.some((s) => s.type === "contacts")).toBe(false);
    expect(serialized).not.toContain("123456-01-234567"); // 샘플 계좌번호
    expect(serialized).not.toContain("010-1234-5678"); // 샘플 전화번호
    // 보이는 섹션은 그대로
    expect(payload.doc.sections.some((s) => s.type === "closing")).toBe(true);
  });
});

describe("publicPageMeta (social metadata)", () => {
  it("제목·설명·대표 이미지를 파생한다", () => {
    const doc = createSampleDocument();
    const hero = doc.sections[0];
    if (hero.type === "hero") hero.content.photoAssetId = "asset-1";
    const meta = publicPageMeta(buildPublicPayload(doc, MANIFEST));
    expect(meta.title).toBe("김민준 ♥ 이서연 결혼합니다");
    expect(meta.description).toContain("2026년 11월 14일");
    expect(meta.description).toContain("라온컨벤션 3층 그랜드볼룸");
    expect(meta.heroImageUrl).toBe("https://cdn.example/a.png");
  });

  it("대표 사진이 manifest에 없으면(기본 샘플 등) 이미지 없이 동작한다", () => {
    const meta = publicPageMeta(buildPublicPayload(createSampleDocument(), MANIFEST));
    expect(meta.heroImageUrl).toBeNull(); // hero-main은 업로드 asset이 아니다
  });

  it("이름이 비어 있으면 일반 제목으로 fallback", () => {
    const doc = createSampleDocument();
    doc.wedding.groom.name = "";
    const meta = publicPageMeta(buildPublicPayload(doc, []));
    expect(meta.title).toBe("모바일 청첩장");
  });
});

describe("manifestResolver", () => {
  it("manifest 우선, 없으면 fallback, 둘 다 없으면 null", () => {
    const fallback = (id: string) =>
      id === "builtin-1" ? { src: "/samples/builtin-1.svg", width: 800, height: 800 } : null;
    const resolve = manifestResolver(
      [{ id: "a", url: "u", thumbUrl: "t", width: 1600, height: 900 }],
      fallback,
    );
    expect(resolve("a")).toEqual({ src: "u", srcSet: "t 640w, u 1600w", width: 1600, height: 900 });
    expect(resolve("builtin-1")?.src).toBe("/samples/builtin-1.svg");
    expect(resolve("missing")).toBeNull();
  });
});
