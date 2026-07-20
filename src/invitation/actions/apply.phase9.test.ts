import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { redactForAi } from "../sensitive";
import { applyAction, InvalidActionError } from "./apply";

// Phase 9 — RSVP 섹션의 단일 인스턴스 규칙(A-06)과 AI projection 경계

describe("rsvp 단일 인스턴스 (A-06)", () => {
  it("이미 rsvp가 있는 문서에는 추가할 수 없다", () => {
    const doc = createSampleDocument();
    expect(() =>
      applyAction(doc, { type: "addSection", sectionType: "rsvp", index: doc.sections.length }),
    ).toThrow(InvalidActionError);
  });

  it("rsvp가 없는 문서에는 추가할 수 있다", () => {
    const doc = createSampleDocument();
    const withoutRsvp = {
      ...doc,
      sections: doc.sections.filter((s) => s.type !== "rsvp"),
    };
    const result = applyAction(withoutRsvp, {
      type: "addSection",
      sectionType: "rsvp",
      index: withoutRsvp.sections.length,
    });
    if (result.outcome !== "applied") throw new Error("applied가 아닙니다");
    expect(result.doc.sections.filter((s) => s.type === "rsvp")).toHaveLength(1);
  });

  it("rsvp 섹션은 복제할 수 없다", () => {
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (!rsvp) throw new Error("rsvp가 없습니다");
    expect(() => applyAction(doc, { type: "duplicateSection", sourceSectionId: rsvp.id })).toThrow(
      /복제할 수 없습니다/,
    );
  });

  it("rsvp 섹션은 숨기고 삭제할 수 있다 (creator가 끌 수 있어야 한다)", () => {
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (!rsvp) throw new Error("rsvp가 없습니다");

    const hidden = applyAction(doc, {
      type: "toggleSectionVisibility",
      sectionId: rsvp.id,
      visible: false,
    });
    if (hidden.outcome !== "applied") throw new Error("applied가 아닙니다");
    expect(hidden.doc.sections.find((s) => s.id === rsvp.id)?.visible).toBe(false);

    const removed = applyAction(doc, { type: "removeSection", sectionId: rsvp.id });
    if (removed.outcome !== "applied") throw new Error("applied가 아닙니다");
    expect(removed.doc.sections.some((s) => s.type === "rsvp")).toBe(false);
  });

  it("collect 토글·마감일은 updateSectionContent로 편집된다", () => {
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    const result = applyAction(doc, {
      type: "updateSectionContent",
      sectionId: rsvp.id,
      patch: {
        deadline: "2026-11-01T23:59:00+09:00",
        collect: { ...rsvp.content.collect, phone: false },
      },
    });
    if (result.outcome !== "applied") throw new Error("applied가 아닙니다");
    const updated = result.doc.sections.find((s) => s.id === rsvp.id);
    if (updated?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    expect(updated.content.deadline).toBe("2026-11-01T23:59:00+09:00");
    expect(updated.content.collect.phone).toBe(false);
    expect(updated.content.title).toBe(rsvp.content.title); // 나머지 보존
  });
});

describe("AI projection 경계 (RSVP raw data 미전달)", () => {
  it("redactForAi의 입력·출력은 문서뿐이므로 RSVP 응답이 구조적으로 실릴 수 없다", () => {
    const doc = createSampleDocument();
    const redacted = redactForAi(doc);
    const rsvp = redacted.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    // rsvp content는 폼 구성만 그대로 통과한다 — 응답 필드 자체가 없다
    expect(Object.keys(rsvp.content).sort()).toEqual([
      "body",
      "collect",
      "deadline",
      "label",
      "title",
    ]);
    const original = doc.sections.find((s) => s.id === rsvp.id);
    expect(rsvp).toEqual(original);
  });
});
