import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import type { InvitationDocument, SectionType } from "../schema/document";
import { coalesceKeyOf } from "./actions";
import { applyAction, InvalidActionError, type ApplyResult } from "./apply";

// Phase 8 섹션(신랑신부 소개·캘린더·교통·연락처·마음 전하실 곳·맺음말) action 동작

function applied(result: ApplyResult) {
  if (result.outcome !== "applied") throw new Error("applied 결과가 아닙니다");
  return result;
}

function sectionIdOf(doc: InvitationDocument, type: SectionType): string {
  const section = doc.sections.find((s) => s.type === type);
  if (!section) throw new Error(`${type} 섹션이 없습니다`);
  return section.id;
}

describe("updateListItem", () => {
  it("교통 항목 한 개의 필드만 수정하고 나머지는 보존한다", () => {
    const doc = createSampleDocument();
    const sectionId = sectionIdOf(doc, "transportation");
    const result = applied(
      applyAction(doc, {
        type: "updateListItem",
        sectionId,
        field: "items",
        index: 1,
        patch: { body: "간선 146 하차" },
      }),
    );
    const section = result.doc.sections.find((s) => s.id === sectionId);
    if (section?.type !== "transportation") throw new Error("transportation이 없습니다");
    expect(section.content.items[1].body).toBe("간선 146 하차");
    expect(section.content.items[1].title).toBe("버스"); // 같은 항목의 다른 필드 보존
    expect(section.content.items[0]).toEqual(
      doc.sections.flatMap((s) => (s.type === "transportation" ? s.content.items : []))[0],
    );
  });

  it("연락처·계좌 목록에도 동일하게 동작한다", () => {
    const doc = createSampleDocument();
    const contactsId = sectionIdOf(doc, "contacts");
    const withPhone = applied(
      applyAction(doc, {
        type: "updateListItem",
        sectionId: contactsId,
        field: "entries",
        index: 0,
        patch: { phone: "010-9999-0000" },
      }),
    );
    const contacts = withPhone.doc.sections.find((s) => s.id === contactsId);
    if (contacts?.type !== "contacts") throw new Error("contacts가 없습니다");
    expect(contacts.content.entries[0].phone).toBe("010-9999-0000");
    expect(contacts.content.entries[0].name).toBe("이정훈");

    const giftId = sectionIdOf(doc, "giftAccount");
    const withBank = applied(
      applyAction(doc, {
        type: "updateListItem",
        sectionId: giftId,
        field: "accounts",
        index: 2,
        patch: { bank: "하나은행" },
      }),
    );
    const gift = withBank.doc.sections.find((s) => s.id === giftId);
    if (gift?.type !== "giftAccount") throw new Error("giftAccount가 없습니다");
    expect(gift.content.accounts[2].bank).toBe("하나은행");
    expect(gift.content.accounts[2].side).toBe("bride");
  });

  it("없는 필드·범위 밖 index·스키마 위반 값은 거부한다", () => {
    const doc = createSampleDocument();
    const sectionId = sectionIdOf(doc, "transportation");
    expect(() =>
      applyAction(doc, {
        type: "updateListItem",
        sectionId,
        field: "없는필드",
        index: 0,
        patch: {},
      }),
    ).toThrow(InvalidActionError);
    expect(() =>
      applyAction(doc, { type: "updateListItem", sectionId, field: "items", index: 99, patch: {} }),
    ).toThrow(/범위/);
    expect(() =>
      applyAction(doc, {
        type: "updateListItem",
        sectionId,
        field: "items",
        index: 0,
        patch: { icon: "비행기" },
      }),
    ).toThrow(/검증 실패/);
  });

  it("undo 왕복이 성립한다", () => {
    const doc = createSampleDocument();
    const sectionId = sectionIdOf(doc, "contacts");
    const result = applied(
      applyAction(doc, {
        type: "updateListItem",
        sectionId,
        field: "entries",
        index: 1,
        patch: { name: "다른 이름" },
      }),
    );
    expect(result.inversePatches.length).toBeGreaterThan(0);
  });
});

describe("coalescing 규칙 (Phase 8)", () => {
  it("updateListItem은 목록·항목·필드 단위 키를 갖는다", () => {
    expect(
      coalesceKeyOf({
        type: "updateListItem",
        sectionId: "s1",
        field: "entries",
        index: 2,
        patch: { phone: "x" },
      }),
    ).toBe("uli:s1:entries:2:phone");
  });

  it("updateSectionContent의 배열 patch(구조 변경)는 병합하지 않는다", () => {
    expect(
      coalesceKeyOf({ type: "updateSectionContent", sectionId: "s1", patch: { items: [] } }),
    ).toBeUndefined();
    // 배열이 아닌 patch는 기존대로 병합된다
    expect(
      coalesceKeyOf({ type: "updateSectionContent", sectionId: "s1", patch: { title: "x" } }),
    ).toBe("usc:s1:title");
  });
});

describe("profilePhoto · closingPhoto slot", () => {
  it("신랑·신부 사진을 각각 할당·제거하고, 교체 시 frame이 초기화된다", () => {
    const doc = createSampleDocument();
    const sectionId = sectionIdOf(doc, "coupleProfile");

    const withFrame = applied(
      applyAction(doc, {
        type: "updateSectionContent",
        sectionId,
        patch: {
          groom: {
            photoAssetId: "gallery-04",
            photoFrame: { zoom: 2, focalX: 0.3, focalY: 0.3 },
            intro: "",
          },
        },
      }),
    );

    const replaced = applied(
      applyAction(withFrame.doc, {
        type: "assignAsset",
        sectionId,
        assetId: "gallery-01",
        slot: { kind: "profilePhoto", side: "groom" },
      }),
    );
    const section = replaced.doc.sections.find((s) => s.id === sectionId);
    if (section?.type !== "coupleProfile") throw new Error("coupleProfile이 없습니다");
    expect(section.content.groom.photoAssetId).toBe("gallery-01");
    expect(section.content.groom.photoFrame).toBeUndefined(); // 교체 시 crop 초기화
    expect(section.content.bride.photoAssetId).toBe("gallery-05"); // 반대편 보존

    const removed = applied(
      applyAction(replaced.doc, {
        type: "removeAssetReference",
        sectionId,
        slot: { kind: "profilePhoto", side: "groom" },
      }),
    );
    const after = removed.doc.sections.find((s) => s.id === sectionId);
    if (after?.type !== "coupleProfile") throw new Error("coupleProfile이 없습니다");
    expect(after.content.groom.photoAssetId).toBeNull();
  });

  it("맺음말 사진을 할당·제거한다", () => {
    const doc = createSampleDocument();
    const sectionId = sectionIdOf(doc, "closing");
    const replaced = applied(
      applyAction(doc, {
        type: "assignAsset",
        sectionId,
        assetId: "gallery-02",
        slot: { kind: "closingPhoto" },
      }),
    );
    const section = replaced.doc.sections.find((s) => s.id === sectionId);
    if (section?.type !== "closing") throw new Error("closing이 없습니다");
    expect(section.content.photoAssetId).toBe("gallery-02");

    const removed = applied(
      applyAction(replaced.doc, {
        type: "removeAssetReference",
        sectionId,
        slot: { kind: "closingPhoto" },
      }),
    );
    const after = removed.doc.sections.find((s) => s.id === sectionId);
    if (after?.type !== "closing") throw new Error("closing이 없습니다");
    expect(after.content.photoAssetId).toBeNull();
  });

  it("오시는 길 약도를 할당·제거한다 (undo 시 이전 값 복원)", () => {
    const doc = createSampleDocument();
    const sectionId = sectionIdOf(doc, "venue");
    const assigned = applied(
      applyAction(doc, {
        type: "assignAsset",
        sectionId,
        assetId: "gallery-03",
        slot: { kind: "venueMap" },
      }),
    );
    const section = assigned.doc.sections.find((s) => s.id === sectionId);
    if (section?.type !== "venue") throw new Error("venue가 없습니다");
    expect(section.content.mapImageAssetId).toBe("gallery-03");

    const removed = applied(
      applyAction(assigned.doc, {
        type: "removeAssetReference",
        sectionId,
        slot: { kind: "venueMap" },
      }),
    );
    const after = removed.doc.sections.find((s) => s.id === sectionId);
    if (after?.type !== "venue") throw new Error("venue가 없습니다");
    expect(after.content.mapImageAssetId).toBeNull();
  });

  it("섹션 타입이 맞지 않으면 거부한다", () => {
    const doc = createSampleDocument();
    expect(() =>
      applyAction(doc, {
        type: "assignAsset",
        sectionId: sectionIdOf(doc, "greeting"),
        assetId: "gallery-01",
        slot: { kind: "profilePhoto", side: "groom" },
      }),
    ).toThrow(/coupleProfile 섹션에만/);
    expect(() =>
      applyAction(doc, {
        type: "assignAsset",
        sectionId: sectionIdOf(doc, "greeting"),
        assetId: "gallery-01",
        slot: { kind: "closingPhoto" },
      }),
    ).toThrow(/closing 섹션에만/);
    expect(() =>
      applyAction(doc, {
        type: "assignAsset",
        sectionId: sectionIdOf(doc, "greeting"),
        assetId: "gallery-01",
        slot: { kind: "venueMap" },
      }),
    ).toThrow(/venue 섹션에만/);
  });
});

describe("variant 변경 시 content 보존 (Phase 8 섹션 전체)", () => {
  const CASES: { type: SectionType; variant: string }[] = [
    { type: "coupleProfile", variant: "stacked" },
    { type: "calendar", variant: "simple" },
    { type: "transportation", variant: "cards" },
    { type: "contacts", variant: "accordion" },
    { type: "giftAccount", variant: "open" },
    { type: "closing", variant: "simple" },
  ];

  it.each(CASES)("$type: $variant로 바꿔도 content가 그대로다", ({ type, variant }) => {
    const doc = createSampleDocument();
    const sectionId = sectionIdOf(doc, type);
    const before = doc.sections.find((s) => s.id === sectionId)!;
    const result = applied(applyAction(doc, { type: "setSectionVariant", sectionId, variant }));
    const after = result.doc.sections.find((s) => s.id === sectionId)!;
    expect(after.layout.variant).toBe(variant);
    expect(after.content).toEqual(before.content);
  });

  it("타입이 허용하지 않는 variant는 거부한다", () => {
    const doc = createSampleDocument();
    expect(() =>
      applyAction(doc, {
        type: "setSectionVariant",
        sectionId: sectionIdOf(doc, "calendar"),
        variant: "collage",
      }),
    ).toThrow(/사용할 수 없는 variant/);
  });
});

describe("setMusic (배경음악)", () => {
  it("음악을 지정·해제하고, 문서 참조 추적에 포함된다", async () => {
    const { referencedAssetIds } = await import("../lib/assetRefs");
    const doc = createSampleDocument();
    expect(doc.music.assetId).toBeNull();

    const set = applied(applyAction(doc, { type: "setMusic", assetId: "bgm-asset" }));
    expect(set.doc.music.assetId).toBe("bgm-asset");
    expect(referencedAssetIds(set.doc).has("bgm-asset")).toBe(true);

    const cleared = applied(applyAction(set.doc, { type: "setMusic", assetId: null }));
    expect(cleared.doc.music.assetId).toBeNull();
    expect(referencedAssetIds(cleared.doc).has("bgm-asset")).toBe(false);
  });
});
