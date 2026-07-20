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
    expect(migrated.theme).toEqual({ id: "warm-editorial", palette: {} });
    expect(migrated.sections).toEqual(base.sections); // 콘텐츠 보존

    const v1snow = {
      ...base,
      schemaVersion: 1,
      theme: { preset: "snow", fontPair: "modern-sans" },
    };
    expect(migrateDocument(v1snow).theme).toEqual({ id: "modern-monochrome", palette: {} });
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

  it("v5 → v7: v6 신규 필드가 주입되고 v7의 pt·효과까지 이어진다 (기존 콘텐츠 보존)", () => {
    const base = createSampleDocument();
    const V6_FIELDS = ["photoAspect", "ddayStyle", "mapImageAssetId", "effects"];
    // v5 문서에는 music·typography가 없었다
    const baseWithoutMusic = Object.fromEntries(
      Object.entries(base).filter(([k]) => k !== "music" && k !== "typography"),
    );
    const v5 = {
      ...baseWithoutMusic,
      schemaVersion: 5,
      // v5 문서에는 v6 신규 필드가 없었고, hero는 아치, rsvp variant는 "default"뿐이었다
      sections: base.sections.map((s) => ({
        ...s,
        ...(s.type === "hero" ? { layout: { variant: "photoArch" } } : {}),
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
    expect(hero.layout.variant).toBe("photoFull"); // 전면 사진으로 통일 (v7)
    expect(hero.content.photoAspect).toBe("3/4");
    expect(hero.content.effects.fadeBottom).toBe(true);
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
    // 폰트는 테마 그대로, 크기는 v6의 '보통' → 11pt로 환산된 뒤 v8에서 제목·본문으로 갈린다.
    // 제목 14.5pt는 기존 화면 크기(19.6px)를 지키는 값이다 — 새 문서 기본값(15pt = 20px)과는 다르다.
    expect(migrated.typography).toEqual({
      headingFont: "theme",
      bodyFont: "theme",
      headingPt: 14.5,
      bodyPt: 11,
    });
  });

  it("v6 → v7: 글자 크기가 pt로 환산되고 hero·closing·gallery가 새 표현으로 옮겨진다", () => {
    const base = createSampleDocument();
    const v6 = {
      ...base,
      schemaVersion: 6,
      typography: { headingFont: "gowun-batang", bodyFont: "theme", scale: "lg" },
      sections: base.sections.map((s) => {
        const without = (content: object, drop: string[]) =>
          Object.fromEntries(Object.entries(content).filter(([k]) => !drop.includes(k)));
        if (s.type === "hero") {
          return {
            ...s,
            style: { ...s.style, fontScale: "sm" },
            layout: { variant: "textOnly" },
            content: { ...without(s.content, ["effects"]), fadeBottom: false },
          };
        }
        if (s.type === "closing") {
          return {
            ...s,
            layout: { variant: "photo" },
            content: without(s.content, ["effects", "photoAspect"]),
          };
        }
        if (s.type === "gallery") return { ...s, layout: { variant: "filmstrip" } };
        return s;
      }),
    };
    const migrated = migrateDocument(v6);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // 3단계 enum → pt (lg = 12pt), 그리고 v8에서 제목은 본문의 4/3배로 갈린다
    expect(migrated.typography.bodyPt).toBe(12);
    expect(migrated.typography.headingPt).toBe(16);
    expect(migrated.typography.headingFont).toBe("gowun-batang"); // 폰트 선택 보존
    const hero = migrated.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.layout.variant).toBe("photoFull"); // 레이아웃 통일
    expect(hero.content.effects.fadeBottom).toBe(false); // 기존 선택 승계
    expect(hero.content.effects.brightness).toBe(1); // 새 효과는 원본 그대로가 기본
    expect(hero.style.bodyPt).toBe(10); // 섹션 override도 pt로 환산된 뒤 둘로 갈린다
    expect(hero.style.headingPt).toBe(13.5);
    const closing = migrated.sections.find((s) => s.type === "closing");
    if (closing?.type !== "closing") throw new Error("closing이 없습니다");
    expect(closing.content.photoAspect).toBe("4/5");
    expect(closing.content.effects.sparkle).toBe(false);
    const gallery = migrated.sections.find((s) => s.type === "gallery");
    if (gallery?.type !== "gallery") throw new Error("gallery가 없습니다");
    expect(gallery.layout.variant).toBe("slider"); // 필름 제거 → 가장 가까운 가로 스크롤
  });

  it("v7 → v8: 맺음말의 공유 버튼이 켜져 있었으면 그 뒤에 공유 섹션이 생긴다", () => {
    const base = createSampleDocument();
    // v7 문서: 공유 섹션이 없고, 맺음말이 showShare를 들고 있었다
    const v7Of = (showShare: boolean) => ({
      ...base,
      schemaVersion: 7,
      sections: base.sections
        .filter((s) => s.type !== "share")
        .map((s) => (s.type === "closing" ? { ...s, content: { ...s.content, showShare } } : s)),
    });

    const on = migrateDocument(v7Of(true));
    const closingIndex = on.sections.findIndex((s) => s.type === "closing");
    expect(on.sections[closingIndex + 1].type).toBe("share"); // 맺음말 바로 뒤
    expect("showShare" in on.sections[closingIndex].content).toBe(false); // 옛 필드는 사라진다

    // 꺼 두었던 문서에는 새 영역이 생기지 않는다
    expect(migrateDocument(v7Of(false)).sections.some((s) => s.type === "share")).toBe(false);

    // 같은 입력은 항상 같은 문서 — 섹션 id가 실행마다 달라지면 재현이 깨진다
    expect(migrateDocument(v7Of(true))).toEqual(on);
  });

  it("v8 → v9: 갤러리 모서리·간격이 그때까지 보이던 값 그대로 문서에 심긴다", () => {
    const base = createSampleDocument();
    // v8 갤러리에는 모서리·간격 필드가 없었다 — 테마와 레이아웃이 정했다
    const v8Of = (variant: string) => ({
      ...base,
      schemaVersion: 8,
      sections: base.sections.map((s) =>
        s.type === "gallery"
          ? {
              ...s,
              layout: { variant },
              content: Object.fromEntries(
                Object.entries(s.content).filter(
                  ([k]) => k !== "photoCorner" && k !== "photoGapPx",
                ),
              ),
            }
          : s,
      ),
    });
    const galleryOf = (doc: ReturnType<typeof migrateDocument>) => {
      const gallery = doc.sections.find((s) => s.type === "gallery");
      if (gallery?.type !== "gallery") throw new Error("gallery가 없습니다");
      return gallery;
    };

    // 3열 격자는 6px 간격에 둥근 모서리였다
    const grid3 = galleryOf(migrateDocument(v8Of("grid3")));
    expect(grid3.content.photoCorner).toBe("rounded");
    expect(grid3.content.photoGapPx).toBe(6);
    expect(grid3.content.photos.length).toBeGreaterThan(0); // 콘텐츠 보존

    // 대형 스트립만 각진 모서리에 2px 간격이었다
    const strip = galleryOf(migrateDocument(v8Of("strip")));
    expect(strip.content.photoCorner).toBe("sharp");
    expect(strip.content.photoGapPx).toBe(2);
  });

  it("v9 → v10: 눈썹 라벨과 좌우 여백이 그때까지 보이던 값 그대로 심긴다", () => {
    const base = createSampleDocument();
    const strip = (v10Section: (typeof base.sections)[number]) =>
      v10Section.type === "gallery" ? { ...v10Section, layout: { variant: "strip" } } : v10Section;
    const v9 = {
      ...base,
      schemaVersion: 9,
      // v9 섹션에는 content.label도 style.paddingX도 없었다
      sections: base.sections.map(strip).map((s) => ({
        ...s,
        style: Object.fromEntries(Object.entries(s.style).filter(([k]) => k !== "paddingX")),
        content: Object.fromEntries(Object.entries(s.content).filter(([k]) => k !== "label")),
      })),
    };
    const migrated = migrateDocument(v9);
    const find = (type: string) => {
      const section = migrated.sections.find((s) => s.type === type);
      if (section === undefined) throw new Error(`${type}이(가) 없습니다`);
      return section;
    };

    // 라벨: 렌더러가 박아 두었던 값 그대로. 맺음말만 눈썹이 없었다.
    const greeting = find("greeting");
    if (greeting.type !== "greeting") throw new Error("greeting이 아닙니다");
    expect(greeting.content.label).toBe("INVITATION");
    expect(greeting.content.body).toContain("서로가 마주 보며"); // 콘텐츠 보존
    const closing = find("closing");
    if (closing.type !== "closing") throw new Error("closing이 아닙니다");
    expect(closing.content.label).toBe("");

    // 좌우 여백: 전면 사진(메인·맺음말 photo)과 대형 스트립만 0이었다
    expect(find("hero").style.paddingX).toBe(0);
    expect(closing.style.paddingX).toBe(0); // 샘플의 맺음말은 photo variant다
    expect(find("gallery").style.paddingX).toBe(0); // 위에서 strip으로 바꿔 두었다
    expect(greeting.style.paddingX).toBe(24);
    expect(find("venue").style.paddingX).toBe(24);
  });

  it("마이그레이션은 이미 현재 모양인 값을 기본값으로 되돌리지 않는다", () => {
    // 옛 버전 번호가 찍혔지만 내용은 이미 최신 모양인 문서 — 두 번 태워도 결과가 같아야 한다.
    // 덮어쓰면 사용자가 맞춰 둔 사진 밝기·페이드가 조용히 초기화된다.
    const base = createSampleDocument();
    const closing = base.sections.find((s) => s.type === "closing");
    if (closing?.type !== "closing") throw new Error("closing이 없습니다");
    expect(closing.content.effects.brightness).not.toBe(1); // 기본값과 달라야 의미 있는 검증

    expect(migrateDocument({ ...base, schemaVersion: 6 })).toEqual(base);
    expect(migrateDocument(base)).toEqual(base);
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
    expect(Object.keys(rsvp.content).sort()).toEqual([
      "body",
      "collect",
      "deadline",
      "label",
      "title",
    ]);
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
      style: { paddingY: "md", paddingX: 24, animation: "none" },
      content: { title: "우리의 영상", label: "VIDEO", url: "" },
    });
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });
});
