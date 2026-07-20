import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { documentSchema } from "./document";
import { CURRENT_SCHEMA_VERSION, InvalidDocumentError, migrateDocument } from "./migrate";

describe("documentSchema", () => {
  it("샘플 문서가 스키마를 통과한다", () => {
    const doc = createSampleDocument();
    expect(documentSchema.parse(doc)).toEqual(doc);
  });

  it("hero가 최상단이 아니면 거부한다", () => {
    const doc = createSampleDocument();
    doc.sections.reverse();
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });

  it("hero가 2개면 거부한다", () => {
    const doc = createSampleDocument();
    doc.sections.push({ ...doc.sections[0], id: "hero-2" });
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });

  it("hero가 없으면 거부한다", () => {
    const doc = createSampleDocument();
    doc.sections = doc.sections.slice(1);
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });

  it("갤러리 31장은 거부한다", () => {
    const doc = createSampleDocument();
    const gallery = doc.sections.find((s) => s.type === "gallery");
    if (gallery?.type !== "gallery") throw new Error("fixture에 gallery가 없습니다");
    gallery.content.photos = Array.from({ length: 31 }, (_, i) => ({ assetId: `p${i}` }));
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });

  it("datetime은 offset 있는 ISO 8601이어야 한다", () => {
    const doc = createSampleDocument();
    doc.wedding.datetime = "2026-11-14 14:00";
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });
});

describe("migrateDocument", () => {
  it("현재 버전 문서는 그대로 통과한다", () => {
    const doc = createSampleDocument();
    expect(migrateDocument(doc)).toEqual(doc);
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("schemaVersion이 없으면 명시적 에러", () => {
    expect(() => migrateDocument({})).toThrow(InvalidDocumentError);
  });

  it("미래 버전은 명시적 에러", () => {
    expect(() => migrateDocument({ schemaVersion: 99 })).toThrow(/지원하지 않는 문서 버전/);
  });

  it("현재 버전이지만 깨진 문서는 검증 에러", () => {
    expect(() => migrateDocument({ schemaVersion: 3, sections: [] })).toThrow(/문서 검증 실패/);
  });

  it("v1 문서는 현재 버전까지 마이그레이션된다 (theme preset → theme id)", () => {
    const base = createSampleDocument();
    const v1 = { ...base, schemaVersion: 1, theme: { preset: "ivory", fontPair: "classic-serif" } };
    const migrated = migrateDocument(v1);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.theme).toEqual({ id: "warm-editorial" });
    expect(migrated.sections).toEqual(base.sections); // 콘텐츠 보존

    const v1snow = {
      ...base,
      schemaVersion: 1,
      theme: { preset: "snow", fontPair: "modern-sans" },
    };
    expect(migrateDocument(v1snow).theme).toEqual({ id: "modern-monochrome" });
  });

  it("v2 문서는 v3로 마이그레이션된다 (gallery carousel → slider, 콘텐츠 보존)", () => {
    const base = createSampleDocument();
    const v2 = {
      ...base,
      schemaVersion: 2,
      sections: base.sections.map((section) =>
        section.type === "gallery"
          ? {
              ...section,
              layout: { variant: "carousel" },
              // v2 photos에는 caption·frame이 없었다
              content: {
                ...section.content,
                photos: section.content.photos.map(({ assetId, alt }) => ({ assetId, alt })),
              },
            }
          : section,
      ),
    };
    const migrated = migrateDocument(v2);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const gallery = migrated.sections.find((s) => s.type === "gallery");
    if (gallery?.type !== "gallery") throw new Error("gallery가 없습니다");
    expect(gallery.layout.variant).toBe("slider");
    expect(gallery.content.photos.map((p) => p.assetId)).toEqual(
      base.sections.flatMap((s) =>
        s.type === "gallery" ? s.content.photos.map((p) => p.assetId) : [],
      ),
    );
    expect(gallery.content.photos[0].alt).toBe("한강 산책 스냅"); // metadata 보존
  });

  it("v2 grid 갤러리는 variant를 유지한 채 현재 버전으로 승격된다", () => {
    const base = createSampleDocument();
    const v2 = { ...base, schemaVersion: 2 };
    const migrated = migrateDocument(v2);
    const gallery = migrated.sections.find((s) => s.type === "gallery");
    if (gallery?.type !== "gallery") throw new Error("gallery가 없습니다");
    expect(gallery.layout.variant).toBe("grid3");
  });

  it("v3 → v4: video variant 'default'는 기존 동작(즉시 임베드)을 보존하는 'embed'가 된다", () => {
    const base = createSampleDocument();
    const v3 = {
      ...base,
      schemaVersion: 3,
      sections: [
        ...base.sections.filter((s) => s.type === "hero" || s.type === "greeting"),
        {
          id: "video-1",
          type: "video",
          visible: true,
          layout: { variant: "default" },
          style: { paddingY: "md", animation: "none" },
          content: { title: "우리의 영상", url: "https://youtu.be/abc12345" },
        },
      ],
    };
    const migrated = migrateDocument(v3);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const video = migrated.sections.find((s) => s.type === "video");
    if (video?.type !== "video") throw new Error("video가 없습니다");
    expect(video.layout.variant).toBe("embed");
    expect(video.content.url).toBe("https://youtu.be/abc12345"); // 콘텐츠 보존
  });

  it("v4 → v5: 변환 없이 버전만 오른다 (RSVP 타입 추가는 additive)", () => {
    const base = createSampleDocument();
    const v4 = {
      ...base,
      schemaVersion: 4,
      // v4 문서에는 rsvp 섹션이 존재할 수 없다
      sections: base.sections.filter((s) => s.type !== "rsvp"),
    };
    const migrated = migrateDocument(v4);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.sections).toEqual(v4.sections); // 콘텐츠 완전 보존
  });

  it("v5 → v6: hero에 photoAspect·fadeBottom, calendar에 ddayStyle이 주입된다 (기존 콘텐츠 보존)", () => {
    const base = createSampleDocument();
    const V6_FIELDS = ["photoAspect", "fadeBottom", "ddayStyle", "mapImageAssetId"];
    // v5 문서에는 music이 없었다
    const baseWithoutMusic = Object.fromEntries(
      Object.entries(base).filter(([k]) => k !== "music"),
    );
    const v5 = {
      ...baseWithoutMusic,
      schemaVersion: 5,
      // v5 문서에는 v6 신규 필드가 없었고, rsvp variant는 "default"뿐이었다
      sections: base.sections.map((s) => ({
        ...s,
        ...(s.type === "rsvp" ? { layout: { variant: "default" } } : {}),
        content: Object.fromEntries(
          Object.entries(s.content).filter(([k]) => !V6_FIELDS.includes(k)),
        ),
      })),
    };
    const migrated = migrateDocument(v5);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const hero = migrated.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.content.photoAspect).toBe("3/4");
    expect(hero.content.fadeBottom).toBe(true);
    expect(hero.content.tagline).toBe("THE MARRIAGE OF"); // 콘텐츠 보존
    const calendar = migrated.sections.find((s) => s.type === "calendar");
    if (calendar?.type !== "calendar") throw new Error("calendar가 없습니다");
    expect(calendar.content.ddayStyle).toBe("countdown");
    expect(calendar.content.showDday).toBe(true); // 콘텐츠 보존
    const gallery = migrated.sections.find((s) => s.type === "gallery");
    if (gallery?.type !== "gallery") throw new Error("gallery가 없습니다");
    expect(gallery.content.photoAspect).toBe("3/4");
    expect(gallery.content.photos.length).toBeGreaterThan(0); // 콘텐츠 보존
    const venue = migrated.sections.find((s) => s.type === "venue");
    if (venue?.type !== "venue") throw new Error("venue가 없습니다");
    expect(venue.content.mapImageAssetId).toBeNull();
    expect(venue.content.showMapButtons).toBe(true); // 콘텐츠 보존
    const rsvp = migrated.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    expect(rsvp.layout.variant).toBe("sheet"); // default → sheet 개명
    expect(migrated.music).toEqual({ assetId: null }); // 배경음악 슬롯 신설
  });

  it("v3 → v4: venue에 showMapButtons가 추가된다 (기존 note 보존)", () => {
    const base = createSampleDocument();
    const v3 = {
      ...base,
      schemaVersion: 3,
      sections: base.sections
        .filter((s) => s.type === "hero" || s.type === "venue")
        .map((s) =>
          s.type === "venue" ? { ...s, content: { title: s.content.title, note: "주차 안내" } } : s,
        ),
    };
    const migrated = migrateDocument(v3);
    const venue = migrated.sections.find((s) => s.type === "venue");
    if (venue?.type !== "venue") throw new Error("venue가 없습니다");
    expect(venue.content.showMapButtons).toBe(true);
    expect(venue.content.note).toBe("주차 안내");
  });
});

describe("photoFrame (crop metadata)", () => {
  it("zoom·focal 범위를 벗어나면 거부한다", () => {
    const doc = createSampleDocument();
    const gallery = doc.sections.find((s) => s.type === "gallery");
    if (gallery?.type !== "gallery") throw new Error("gallery가 없습니다");
    gallery.content.photos[0].frame = { zoom: 1.5, focalX: 0.3, focalY: 0.7 };
    expect(documentSchema.safeParse(doc).success).toBe(true);

    gallery.content.photos[0].frame = { zoom: 5, focalX: 0.3, focalY: 0.7 };
    expect(documentSchema.safeParse(doc).success).toBe(false);

    gallery.content.photos[0].frame = { zoom: 1.5, focalX: 1.2, focalY: 0.7 };
    expect(documentSchema.safeParse(doc).success).toBe(false);
  });

  it("hero photoFrame도 같은 스키마를 쓴다", () => {
    const doc = createSampleDocument();
    const hero = doc.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    hero.content.photoFrame = { zoom: 2, focalX: 0.5, focalY: 0.2 };
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });
});

describe("rsvp 섹션", () => {
  it("샘플의 rsvp 섹션이 스키마를 통과하고, content에는 폼 구성만 있다", () => {
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    // 응답을 담을 자리가 없다 — 공개 스냅샷·AI projection에 응답이 실릴 수 없는 구조적 근거
    expect(Object.keys(rsvp.content).sort()).toEqual(["body", "collect", "deadline", "title"]);
  });

  it("rsvp 섹션이 2개면 거부한다 (A-06)", () => {
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    doc.sections.push({ ...rsvp, id: "rsvp-2" });
    const result = documentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it("content에 섞여 들어온 스키마 밖 키(예: responses)는 parse가 제거한다", () => {
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    const tampered = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.id === rsvp.id
          ? { ...s, content: { ...s.content, responses: [{ guestName: "누군가", phone: "010" }] } }
          : s,
      ),
    };
    const parsed = documentSchema.parse(tampered);
    expect(JSON.stringify(parsed)).not.toContain("responses");
  });

  it("deadline은 offset 있는 ISO 8601 또는 null이어야 한다", () => {
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    rsvp.content.deadline = "2026-11-01T23:59:00+09:00";
    expect(documentSchema.safeParse(doc).success).toBe(true);
    rsvp.content.deadline = "2026-11-01";
    expect(documentSchema.safeParse(doc).success).toBe(false);
    rsvp.content.deadline = null;
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });
});

describe("video 섹션", () => {
  it("video 섹션이 스키마를 통과한다 (빈 URL 허용 — 작성 중 상태)", () => {
    const doc = createSampleDocument();
    doc.sections.push({
      id: "video-1",
      type: "video",
      visible: true,
      layout: { variant: "facade" },
      style: { paddingY: "md", animation: "none" },
      content: { title: "우리의 영상", url: "" },
    });
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });
});
