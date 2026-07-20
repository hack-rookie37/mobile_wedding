import { applyPatches } from "immer";
import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import type { InvitationDocument, SectionType } from "../schema/document";
import type { ApplicableAction } from "./actions";
import { applyAction, InvalidActionError, type ApplyResult } from "./apply";

function sectionIdOf(doc: InvitationDocument, type: SectionType): string {
  const section = doc.sections.find((s) => s.type === type);
  if (!section) throw new Error(`fixture에 ${type} 섹션이 없습니다`);
  return section.id;
}

function applied(result: ApplyResult): Extract<ApplyResult, { outcome: "applied" }> {
  if (result.outcome !== "applied") throw new Error(`applied 결과를 기대했지만 ${result.outcome}`);
  return result;
}

// 결정적 id 생성기 (stable id 주입점 검증)
function idSequence(...ids: string[]): () => string {
  let i = 0;
  return () => ids[i++] ?? `auto-${i}`;
}

describe("applyAction 공통 경계", () => {
  it("스키마에 없는 action type은 거부한다", () => {
    const doc = createSampleDocument();
    expect(() => applyAction(doc, { type: "정체불명" } as unknown as ApplicableAction)).toThrow(
      InvalidActionError,
    );
  });

  it("hero는 addSection 스키마 수준에서 추가할 수 없다", () => {
    const doc = createSampleDocument();
    expect(() =>
      applyAction(doc, {
        type: "addSection",
        sectionType: "hero",
        index: 1,
      } as unknown as ApplicableAction),
    ).toThrow(InvalidActionError);
  });

  it("버전 경계: 구버전 문서에는 action을 적용할 수 없다", () => {
    const doc = { ...createSampleDocument(), schemaVersion: 1 } as unknown as InvitationDocument;
    expect(() => applyAction(doc, { type: "setTheme", themeId: "film-diary" })).toThrow(
      /migrateDocument/,
    );
  });

  it("invalid action은 원본 문서를 변경하지 않는다", () => {
    const doc = createSampleDocument();
    const snapshot = structuredClone(doc);
    expect(() => applyAction(doc, { type: "removeSection", sectionId: "없는섹션" })).toThrow(
      /섹션을 찾을 수 없습니다/,
    );
    expect(doc).toEqual(snapshot);
  });

  it("존재하지 않는 섹션을 대상으로 한 모든 action은 명시적 에러", () => {
    const doc = createSampleDocument();
    const targets: ApplicableAction[] = [
      { type: "removeSection", sectionId: "ghost" },
      { type: "duplicateSection", sourceSectionId: "ghost" },
      { type: "toggleSectionVisibility", sectionId: "ghost" },
      { type: "updateSectionContent", sectionId: "ghost", patch: {} },
      { type: "updateSectionSettings", sectionId: "ghost", patch: { paddingY: "sm" } },
      { type: "setSectionVariant", sectionId: "ghost", variant: "default" },
      { type: "assignAsset", sectionId: "ghost", assetId: "a", slot: { kind: "heroPhoto" } },
      { type: "removeAssetReference", sectionId: "ghost", slot: { kind: "heroPhoto" } },
    ];
    for (const action of targets) {
      expect(() => applyAction(doc, action), action.type).toThrow(/섹션을 찾을 수 없습니다/);
    }
  });
});

describe("addSection", () => {
  it("기본 content의 섹션을 지정 위치에 추가하고, 주입된 id 생성기를 쓴다", () => {
    const doc = createSampleDocument();
    const result = applied(
      applyAction(
        doc,
        { type: "addSection", sectionType: "greeting", index: 2 },
        { generateId: idSequence("new-greeting") },
      ),
    );
    expect(result.doc.sections).toHaveLength(doc.sections.length + 1);
    const added = result.doc.sections[2];
    expect(added.id).toBe("new-greeting");
    expect(added.type).toBe("greeting");
    // undo 왕복
    expect(applyPatches(result.doc, result.inversePatches)).toEqual(doc);
  });

  it("index 0(hero 자리)과 범위 밖 index는 거부한다", () => {
    const doc = createSampleDocument();
    expect(() => applyAction(doc, { type: "addSection", sectionType: "venue", index: 0 })).toThrow(
      InvalidActionError,
    );
    expect(() => applyAction(doc, { type: "addSection", sectionType: "venue", index: 99 })).toThrow(
      /범위를 벗어났습니다/,
    );
  });

  it("명시한 sectionId가 이미 존재하면 거부한다", () => {
    const doc = createSampleDocument();
    const existing = sectionIdOf(doc, "greeting");
    expect(() =>
      applyAction(doc, { type: "addSection", sectionType: "venue", index: 1, sectionId: existing }),
    ).toThrow(/이미 존재합니다/);
  });
});

describe("removeSection", () => {
  it("섹션을 제거한다 (hero는 불가)", () => {
    const doc = createSampleDocument();
    const venueId = sectionIdOf(doc, "venue");
    const result = applied(applyAction(doc, { type: "removeSection", sectionId: venueId }));
    expect(result.doc.sections.some((s) => s.id === venueId)).toBe(false);

    const heroId = sectionIdOf(doc, "hero");
    expect(() => applyAction(doc, { type: "removeSection", sectionId: heroId })).toThrow(
      /삭제할 수 없습니다/,
    );
  });
});

describe("duplicateSection", () => {
  it("원본 바로 뒤에 동일 content·다른 id로 복제한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const result = applied(
      applyAction(
        doc,
        { type: "duplicateSection", sourceSectionId: galleryId },
        { generateId: idSequence("gallery-copy") },
      ),
    );
    const sourceIndex = result.doc.sections.findIndex((s) => s.id === galleryId);
    const copy = result.doc.sections[sourceIndex + 1];
    expect(copy.id).toBe("gallery-copy");
    expect(copy.content).toEqual(result.doc.sections[sourceIndex].content);
    expect(copy.content).not.toBe(result.doc.sections[sourceIndex].content); // 참조 비공유
  });

  it("사본 편집이 원본에 새지 않는다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const dup = applied(
      applyAction(
        doc,
        { type: "duplicateSection", sourceSectionId: galleryId },
        { generateId: idSequence("copy-1") },
      ),
    );
    const edited = applied(
      applyAction(dup.doc, {
        type: "updateSectionContent",
        sectionId: "copy-1",
        patch: { title: "다른 제목" },
      }),
    );
    const original = edited.doc.sections.find((s) => s.id === galleryId);
    expect(original?.type === "gallery" && original.content.title).toBe("우리의 순간들");
  });

  it("id 생성기가 충돌 id를 반환하면 재시도해 고유 id를 얻는다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const result = applied(
      applyAction(
        doc,
        { type: "duplicateSection", sourceSectionId: galleryId },
        { generateId: idSequence(galleryId, sectionIdOf(doc, "hero"), "unique-id") },
      ),
    );
    const ids = result.doc.sections.map((s) => s.id);
    expect(ids).toContain("unique-id");
    expect(new Set(ids).size).toBe(ids.length); // 모든 id 충돌 방지
  });

  it("명시한 newSectionId 충돌과 hero 복제는 거부한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    expect(() =>
      applyAction(doc, {
        type: "duplicateSection",
        sourceSectionId: galleryId,
        newSectionId: sectionIdOf(doc, "venue"),
      }),
    ).toThrow(/이미 존재합니다/);
    expect(() =>
      applyAction(doc, { type: "duplicateSection", sourceSectionId: sectionIdOf(doc, "hero") }),
    ).toThrow(/복제할 수 없습니다/);
  });
});

describe("reorderSections", () => {
  it("순열대로 재배열하고 undo/redo 왕복이 성립한다", () => {
    const doc = createSampleDocument();
    const ids = doc.sections.map((s) => s.id);
    const order = [ids[0], ids[2], ids[1], ...ids.slice(3)];
    const result = applied(applyAction(doc, { type: "reorderSections", order }));
    expect(result.doc.sections.map((s) => s.id)).toEqual(order);
    expect(applyPatches(result.doc, result.inversePatches)).toEqual(doc);
    expect(applyPatches(doc, result.patches)).toEqual(result.doc);
  });

  it("순열이 아니거나 hero가 첫번째가 아니면 거부한다", () => {
    const doc = createSampleDocument();
    const ids = doc.sections.map((s) => s.id);
    expect(() => applyAction(doc, { type: "reorderSections", order: ids.slice(1) })).toThrow(
      /순열/,
    );
    expect(() =>
      applyAction(doc, { type: "reorderSections", order: [ids[1], ids[0], ...ids.slice(2)] }),
    ).toThrow(/최상단/);
    expect(() =>
      applyAction(doc, {
        type: "reorderSections",
        order: [ids[0], ids[1], ids[1], ...ids.slice(3)],
      }),
    ).toThrow(/순열/);
  });

  it("동일 순서는 no-op", () => {
    const doc = createSampleDocument();
    const result = applyAction(doc, {
      type: "reorderSections",
      order: doc.sections.map((s) => s.id),
    });
    expect(result.outcome).toBe("noop");
  });
});

describe("toggleSectionVisibility", () => {
  it("미지정 시 반전, 지정 시 해당 값으로 설정한다", () => {
    const doc = createSampleDocument();
    const venueId = sectionIdOf(doc, "venue");
    const hidden = applied(
      applyAction(doc, { type: "toggleSectionVisibility", sectionId: venueId }),
    );
    expect(hidden.doc.sections.find((s) => s.id === venueId)?.visible).toBe(false);

    const explicit = applied(
      applyAction(hidden.doc, {
        type: "toggleSectionVisibility",
        sectionId: venueId,
        visible: true,
      }),
    );
    expect(explicit.doc.sections.find((s) => s.id === venueId)?.visible).toBe(true);
  });

  it("이미 같은 값이면 no-op, hero는 숨길 수 없다", () => {
    const doc = createSampleDocument();
    const venueId = sectionIdOf(doc, "venue");
    expect(
      applyAction(doc, { type: "toggleSectionVisibility", sectionId: venueId, visible: true })
        .outcome,
    ).toBe("noop");
    expect(() =>
      applyAction(doc, { type: "toggleSectionVisibility", sectionId: sectionIdOf(doc, "hero") }),
    ).toThrow(/숨길 수 없습니다/);
  });
});

describe("updateSectionContent / updateSectionSettings", () => {
  it("content를 수정하고, 동일 값 patch는 no-op", () => {
    const doc = createSampleDocument();
    const greetingId = sectionIdOf(doc, "greeting");
    const result = applied(
      applyAction(doc, {
        type: "updateSectionContent",
        sectionId: greetingId,
        patch: { body: "새 본문" },
      }),
    );
    const greeting = result.doc.sections.find((s) => s.id === greetingId);
    expect(greeting?.type === "greeting" && greeting.content.body).toBe("새 본문");

    const greetingBefore = doc.sections.find((s) => s.id === greetingId);
    const sameValue = greetingBefore?.type === "greeting" ? greetingBefore.content.body : "";
    expect(
      applyAction(doc, {
        type: "updateSectionContent",
        sectionId: greetingId,
        patch: { body: sameValue },
      }).outcome,
    ).toBe("noop");
  });

  it("타입에 맞지 않는 content 값은 거부한다", () => {
    const doc = createSampleDocument();
    expect(() =>
      applyAction(doc, {
        type: "updateSectionContent",
        sectionId: sectionIdOf(doc, "greeting"),
        patch: { body: 123 },
      }),
    ).toThrow(/content 검증 실패/);
  });

  it("settings(여백·애니메이션)를 수정하고, 잘못된 값은 스키마가 거부한다", () => {
    const doc = createSampleDocument();
    const venueId = sectionIdOf(doc, "venue");
    const result = applied(
      applyAction(doc, {
        type: "updateSectionSettings",
        sectionId: venueId,
        patch: { paddingY: "sm", animation: "rise" },
      }),
    );
    const venue = result.doc.sections.find((s) => s.id === venueId);
    expect(venue?.style.paddingY).toBe("sm");
    expect(venue?.style.animation).toBe("rise");

    expect(() =>
      applyAction(doc, {
        type: "updateSectionSettings",
        sectionId: venueId,
        patch: { paddingY: "xl" },
      } as unknown as ApplicableAction),
    ).toThrow(InvalidActionError);
  });
});

describe("setSectionVariant", () => {
  it("variant만 바뀌고 content와 asset 참조는 보존된다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const before = doc.sections.find((s) => s.id === galleryId);
    const result = applied(
      applyAction(doc, { type: "setSectionVariant", sectionId: galleryId, variant: "slider" }),
    );
    const after = result.doc.sections.find((s) => s.id === galleryId);
    expect(after?.layout.variant).toBe("slider");
    expect(after?.content).toEqual(before?.content); // 사진 asset 참조 포함 전부 보존

    const closingId = sectionIdOf(doc, "closing");
    const closingResult = applied(
      applyAction(doc, { type: "setSectionVariant", sectionId: closingId, variant: "simple" }),
    );
    const closing = closingResult.doc.sections.find((s) => s.id === closingId);
    expect(closing?.type === "closing" && closing.content.photoAssetId).toBe("gallery-06"); // 사진 참조 유지
  });

  it("타입이 허용하지 않는 variant는 거부한다", () => {
    const doc = createSampleDocument();
    expect(() =>
      applyAction(doc, {
        type: "setSectionVariant",
        sectionId: sectionIdOf(doc, "greeting"),
        variant: "grid2",
      }),
    ).toThrow(/사용할 수 없는 variant/);
  });
});

describe("setTheme", () => {
  it("테마만 바뀌고 콘텐츠는 보존, 동일 테마는 no-op", () => {
    const doc = createSampleDocument();
    const result = applied(applyAction(doc, { type: "setTheme", themeId: "film-diary" }));
    expect(result.doc.theme.id).toBe("film-diary");
    expect(result.doc.sections).toEqual(doc.sections);

    expect(applyAction(doc, { type: "setTheme", themeId: doc.theme.id }).outcome).toBe("noop");
  });
});

describe("assignAsset / removeAssetReference", () => {
  it("hero 사진을 할당·제거한다", () => {
    const doc = createSampleDocument();
    const heroId = sectionIdOf(doc, "hero");
    const assigned = applied(
      applyAction(doc, {
        type: "assignAsset",
        sectionId: heroId,
        assetId: "new-photo",
        slot: { kind: "heroPhoto" },
      }),
    );
    const hero = assigned.doc.sections[0];
    expect(hero.type === "hero" && hero.content.photoAssetId).toBe("new-photo");

    const removed = applied(
      applyAction(assigned.doc, {
        type: "removeAssetReference",
        sectionId: heroId,
        slot: { kind: "heroPhoto" },
      }),
    );
    const heroAfter = removed.doc.sections[0];
    expect(heroAfter.type === "hero" && heroAfter.content.photoAssetId).toBeNull();
  });

  it("갤러리에 추가(append)·교체(alt 보존)·제거한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const galleryOf = (d: InvitationDocument) => {
      const g = d.sections.find((s) => s.id === galleryId);
      if (g?.type !== "gallery") throw new Error("gallery가 아닙니다");
      return g;
    };
    const count = galleryOf(doc).content.photos.length;

    const appended = applied(
      applyAction(doc, {
        type: "assignAsset",
        sectionId: galleryId,
        assetId: "extra-photo",
        slot: { kind: "galleryItem" },
      }),
    );
    expect(galleryOf(appended.doc).content.photos).toHaveLength(count + 1);
    expect(galleryOf(appended.doc).content.photos.at(-1)?.assetId).toBe("extra-photo");

    const replaced = applied(
      applyAction(appended.doc, {
        type: "assignAsset",
        sectionId: galleryId,
        assetId: "swapped",
        slot: { kind: "galleryItem", index: 0 },
      }),
    );
    const first = galleryOf(replaced.doc).content.photos[0];
    expect(first.assetId).toBe("swapped");
    expect(first.alt).toBe(galleryOf(doc).content.photos[0].alt); // alt 보존

    const removed = applied(
      applyAction(replaced.doc, {
        type: "removeAssetReference",
        sectionId: galleryId,
        slot: { kind: "galleryItem", index: 0 },
      }),
    );
    expect(galleryOf(removed.doc).content.photos).toHaveLength(count);
  });

  it("갤러리 30장 제한과 index 범위, 섹션 타입 불일치를 거부한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const gallery = doc.sections.find((s) => s.id === galleryId);
    if (gallery?.type !== "gallery") throw new Error("gallery가 아닙니다");
    gallery.content.photos = Array.from({ length: 30 }, (_, i) => ({ assetId: `p${i}` }));

    expect(() =>
      applyAction(doc, {
        type: "assignAsset",
        sectionId: galleryId,
        assetId: "one-more",
        slot: { kind: "galleryItem" },
      }),
    ).toThrow(/최대 30장/);
    expect(() =>
      applyAction(doc, {
        type: "assignAsset",
        sectionId: galleryId,
        assetId: "x",
        slot: { kind: "galleryItem", index: 99 },
      }),
    ).toThrow(/범위를 벗어났습니다/);
    expect(() =>
      applyAction(doc, {
        type: "assignAsset",
        sectionId: sectionIdOf(doc, "greeting"),
        assetId: "x",
        slot: { kind: "heroPhoto" },
      }),
    ).toThrow(/hero 섹션에만/);
  });

  it("이미 비어 있는 hero 사진 제거는 no-op", () => {
    const doc = createSampleDocument();
    const heroId = sectionIdOf(doc, "hero");
    const cleared = applied(
      applyAction(doc, {
        type: "removeAssetReference",
        sectionId: heroId,
        slot: { kind: "heroPhoto" },
      }),
    );
    expect(
      applyAction(cleared.doc, {
        type: "removeAssetReference",
        sectionId: heroId,
        slot: { kind: "heroPhoto" },
      }).outcome,
    ).toBe("noop");
  });
});

describe("photo frame (crop) 불변 조건", () => {
  const galleryOf = (d: InvitationDocument, galleryId: string) => {
    const g = d.sections.find((s) => s.id === galleryId);
    if (g?.type !== "gallery") throw new Error("gallery가 아닙니다");
    return g;
  };

  it("갤러리 사진 교체 시 frame은 초기화되고 alt·caption은 보존된다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const gallery = doc.sections.find((s) => s.id === galleryId);
    if (gallery?.type !== "gallery") throw new Error("gallery가 아닙니다");
    gallery.content.photos[0].frame = { zoom: 2, focalX: 0.2, focalY: 0.8 };

    const replaced = applied(
      applyAction(doc, {
        type: "assignAsset",
        sectionId: galleryId,
        assetId: "swapped",
        slot: { kind: "galleryItem", index: 0 },
      }),
    );
    const first = galleryOf(replaced.doc, galleryId).content.photos[0];
    expect(first.assetId).toBe("swapped");
    expect(first.frame).toBeUndefined(); // crop은 이전 이미지에 종속 — 초기화
    expect(first.alt).toBe(gallery.content.photos[0].alt);
    expect(first.caption).toBe(gallery.content.photos[0].caption);
  });

  it("hero 사진 교체·제거 시 photoFrame이 초기화된다", () => {
    const doc = createSampleDocument();
    const heroId = sectionIdOf(doc, "hero");
    const hero = doc.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 아닙니다");
    hero.content.photoFrame = { zoom: 1.5, focalX: 0.5, focalY: 0.1 };

    const replaced = applied(
      applyAction(doc, {
        type: "assignAsset",
        sectionId: heroId,
        assetId: "new-photo",
        slot: { kind: "heroPhoto" },
      }),
    );
    const heroAfter = replaced.doc.sections[0];
    expect(heroAfter.type === "hero" && heroAfter.content.photoFrame).toBeUndefined();

    hero.content.photoAssetId = "hero-main"; // 원본 유지 상태에서 제거 경로도 확인
    const removed = applied(
      applyAction(doc, {
        type: "removeAssetReference",
        sectionId: heroId,
        slot: { kind: "heroPhoto" },
      }),
    );
    const heroRemoved = removed.doc.sections[0];
    expect(heroRemoved.type === "hero" && heroRemoved.content.photoAssetId).toBeNull();
    expect(heroRemoved.type === "hero" && heroRemoved.content.photoFrame).toBeUndefined();
  });

  it("updateSectionContent로 photos 순서를 바꿔도 각 사진의 metadata가 함께 이동한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const photos = galleryOf(doc, galleryId).content.photos;
    const reordered = [...photos.slice(1), photos[0]];

    const result = applied(
      applyAction(doc, {
        type: "updateSectionContent",
        sectionId: galleryId,
        patch: { photos: reordered },
      }),
    );
    const after = galleryOf(result.doc, galleryId).content.photos;
    expect(after.map((p) => p.assetId)).toEqual(reordered.map((p) => p.assetId));
    expect(after.at(-1)?.caption).toBe(photos[0].caption); // caption이 사진을 따라간다
  });

  it("moveGalleryPhoto: metadata가 사진을 따라 이동하고, 동일 위치·범위 밖을 안전 처리한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const before = galleryOf(doc, galleryId).content.photos;

    const moved = applied(
      applyAction(doc, { type: "moveGalleryPhoto", sectionId: galleryId, from: 0, to: 2 }),
    );
    const after = galleryOf(moved.doc, galleryId).content.photos;
    expect(after.map((p) => p.assetId)).toEqual([
      before[1].assetId,
      before[2].assetId,
      before[0].assetId,
      ...before.slice(3).map((p) => p.assetId),
    ]);
    expect(after[2].caption).toBe(before[0].caption); // caption·alt가 함께 이동

    // 동일 위치는 no-op, 범위 밖은 거부
    expect(
      applyAction(doc, { type: "moveGalleryPhoto", sectionId: galleryId, from: 1, to: 1 }).outcome,
    ).toBe("noop");
    expect(() =>
      applyAction(doc, { type: "moveGalleryPhoto", sectionId: galleryId, from: 0, to: 99 }),
    ).toThrow(/범위를 벗어났습니다/);
    expect(() =>
      applyAction(doc, {
        type: "moveGalleryPhoto",
        sectionId: sectionIdOf(doc, "greeting"),
        from: 0,
        to: 1,
      }),
    ).toThrow(/gallery 섹션에만/);
  });

  it("updateGalleryPhoto: caption·alt·frame을 수정하고 frame:null은 crop을 제거한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");

    const withFrame = applied(
      applyAction(doc, {
        type: "updateGalleryPhoto",
        sectionId: galleryId,
        index: 0,
        patch: { caption: "새 캡션", frame: { zoom: 1.5, focalX: 0.4, focalY: 0.6 } },
      }),
    );
    const photo = galleryOf(withFrame.doc, galleryId).content.photos[0];
    expect(photo.caption).toBe("새 캡션");
    expect(photo.frame).toEqual({ zoom: 1.5, focalX: 0.4, focalY: 0.6 });
    expect(photo.assetId).toBe(galleryOf(doc, galleryId).content.photos[0].assetId);

    const cleared = applied(
      applyAction(withFrame.doc, {
        type: "updateGalleryPhoto",
        sectionId: galleryId,
        index: 0,
        patch: { frame: null },
      }),
    );
    expect(galleryOf(cleared.doc, galleryId).content.photos[0].frame).toBeUndefined();
    expect(galleryOf(cleared.doc, galleryId).content.photos[0].caption).toBe("새 캡션");

    expect(() =>
      applyAction(doc, {
        type: "updateGalleryPhoto",
        sectionId: galleryId,
        index: 99,
        patch: { caption: "x" },
      }),
    ).toThrow(/범위를 벗어났습니다/);
  });

  it("범위를 벗어난 frame은 content 스키마가 거부한다", () => {
    const doc = createSampleDocument();
    const galleryId = sectionIdOf(doc, "gallery");
    const photos = galleryOf(doc, galleryId).content.photos;
    expect(() =>
      applyAction(doc, {
        type: "updateSectionContent",
        sectionId: galleryId,
        patch: {
          photos: photos.map((p, i) =>
            i === 0 ? { ...p, frame: { zoom: 99, focalX: 0.5, focalY: 0.5 } } : p,
          ),
        },
      }),
    ).toThrow(/content 검증 실패/);
  });
});

describe("batch", () => {
  it("여러 action을 원자적으로 적용하고 inverse 한 번으로 전체 undo된다", () => {
    const doc = createSampleDocument();
    const venueId = sectionIdOf(doc, "venue");
    const result = applied(
      applyAction(doc, {
        type: "batch",
        label: "섹션 추가+작성+숨김",
        actions: [
          { type: "addSection", sectionType: "greeting", index: 2, sectionId: "batch-new" },
          { type: "updateSectionContent", sectionId: "batch-new", patch: { body: "배치 본문" } },
          { type: "toggleSectionVisibility", sectionId: venueId, visible: false },
        ],
      }),
    );
    const added = result.doc.sections.find((s) => s.id === "batch-new");
    expect(added?.type === "greeting" && added.content.body).toBe("배치 본문");
    expect(result.doc.sections.find((s) => s.id === venueId)?.visible).toBe(false);

    // 전체 undo — 한 번의 inversePatches 적용으로 원본 복원
    expect(applyPatches(result.doc, result.inversePatches)).toEqual(doc);
    // redo — patches 재적용으로 동일 결과 (id 안정성 포함)
    expect(applyPatches(doc, result.patches)).toEqual(result.doc);
  });

  it("중간 action이 invalid면 전체가 거부되고 문서는 불변이다 (원자성)", () => {
    const doc = createSampleDocument();
    const snapshot = structuredClone(doc);
    expect(() =>
      applyAction(doc, {
        type: "batch",
        actions: [
          { type: "setTheme", themeId: "film-diary" },
          { type: "removeSection", sectionId: "없는섹션" },
        ],
      }),
    ).toThrow(/섹션을 찾을 수 없습니다/);
    expect(doc).toEqual(snapshot);
  });

  it("모든 하위 action이 no-op이면 batch도 no-op", () => {
    const doc = createSampleDocument();
    const venueId = sectionIdOf(doc, "venue");
    const result = applyAction(doc, {
      type: "batch",
      actions: [
        { type: "setTheme", themeId: doc.theme.id },
        { type: "toggleSectionVisibility", sectionId: venueId, visible: true },
      ],
    });
    expect(result.outcome).toBe("noop");
  });

  it("중첩 batch와 selectSection은 batch 안에서 허용하지 않는다", () => {
    const doc = createSampleDocument();
    expect(() =>
      applyAction(doc, {
        type: "batch",
        actions: [{ type: "batch", actions: [] }],
      } as unknown as ApplicableAction),
    ).toThrow(InvalidActionError);
    expect(() =>
      applyAction(doc, {
        type: "batch",
        actions: [{ type: "selectSection", sectionId: "x" }],
      } as unknown as ApplicableAction),
    ).toThrow(InvalidActionError);
  });
});

describe("결정성: action 시퀀스의 undo 왕복", () => {
  it("여러 action 적용 후 inverse를 역순 적용하면 원본으로 돌아간다", () => {
    const doc = createSampleDocument();
    const greetingId = sectionIdOf(doc, "greeting");
    const galleryId = sectionIdOf(doc, "gallery");
    const ids = doc.sections.map((s) => s.id);
    const actions: ApplicableAction[] = [
      { type: "updateSectionContent", sectionId: greetingId, patch: { title: "모십니다" } },
      { type: "updateWedding", patch: { datetime: "2027-03-01T11:00:00+09:00" } },
      { type: "reorderSections", order: [ids[0], ids[2], ids[1], ...ids.slice(3)] },
      { type: "setTheme", themeId: "modern-monochrome" },
      { type: "duplicateSection", sourceSectionId: galleryId, newSectionId: "dup-1" },
      { type: "assignAsset", sectionId: "dup-1", assetId: "x1", slot: { kind: "galleryItem" } },
      { type: "removeSection", sectionId: "dup-1" },
    ];

    let current = doc;
    const inverses: ReturnType<typeof applied>["inversePatches"][] = [];
    for (const action of actions) {
      const result = applied(applyAction(current, action));
      inverses.push(result.inversePatches);
      current = result.doc;
    }
    expect(current).not.toEqual(doc);

    for (const inverse of inverses.reverse()) {
      current = applyPatches(current, inverse);
    }
    expect(current).toEqual(doc);
  });
});
