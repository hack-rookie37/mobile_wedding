import { describe, expect, it } from "vitest";
import { createSampleDocument } from "@/invitation/fixtures/sample";
import { createEditorStore } from "./store";

function setup() {
  const doc = createSampleDocument();
  let time = 1_000_000;
  const clock = { advance: (ms: number) => (time += ms) };
  const store = createEditorStore({ doc, now: () => time });
  const greeting = doc.sections.find((s) => s.type === "greeting");
  if (greeting?.type !== "greeting") throw new Error("fixture에 greeting이 없습니다");
  return { doc, store, clock, greetingId: greeting.id };
}

function greetingBody(store: ReturnType<typeof createEditorStore>): string {
  const section = store.getState().doc.sections.find((s) => s.type === "greeting");
  if (section?.type !== "greeting") throw new Error("greeting 섹션이 없습니다");
  return section.content.body;
}

describe("editor store", () => {
  it("dispatch가 문서를 갱신하고 저장 대기 상태로 만든다", () => {
    const { store, greetingId } = setup();
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { body: "수정된 본문" },
    });
    expect(greetingBody(store)).toBe("수정된 본문");
    expect(store.getState().saveStatus).toBe("saving");
  });

  it("undo/redo가 왕복한다", () => {
    const { store, doc, greetingId, clock } = setup();
    const original = greetingBody(store);
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { body: "첫 수정" },
    });
    clock.advance(2000);
    store.getState().dispatch({
      type: "updateWedding",
      patch: { groom: { ...doc.wedding.groom, name: "김철수" } },
    });

    store.getState().undo();
    expect(store.getState().doc.wedding.groom.name).toBe(doc.wedding.groom.name);
    store.getState().undo();
    expect(greetingBody(store)).toBe(original);
    expect(store.getState().doc).toEqual(doc);

    store.getState().redo();
    store.getState().redo();
    expect(greetingBody(store)).toBe("첫 수정");
    expect(store.getState().doc.wedding.groom.name).toBe("김철수");
  });

  it("같은 필드 연속 입력은 1 undo 스텝으로 병합된다 (coalescing)", () => {
    const { store, greetingId } = setup();
    const original = greetingBody(store);
    for (const body of ["안", "안녕", "안녕하세요"]) {
      store.getState().dispatch({
        type: "updateSectionContent",
        sectionId: greetingId,
        patch: { body },
      });
    }
    expect(store.getState().undoStack).toHaveLength(1);
    store.getState().undo();
    expect(greetingBody(store)).toBe(original);
  });

  it("coalescing 창(1초)이 지나면 별도 스텝이 된다", () => {
    const { store, greetingId, clock } = setup();
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { body: "하나" },
    });
    clock.advance(1500);
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { body: "둘" },
    });
    expect(store.getState().undoStack).toHaveLength(2);
  });

  it("다른 필드 편집은 병합되지 않는다", () => {
    const { store, greetingId } = setup();
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { body: "본문" },
    });
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { title: "제목" },
    });
    expect(store.getState().undoStack).toHaveLength(2);
  });

  it("새 편집이 redo 스택을 비운다", () => {
    const { store, greetingId, clock } = setup();
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { body: "하나" },
    });
    store.getState().undo();
    expect(store.getState().redoStack).toHaveLength(1);
    clock.advance(2000);
    store.getState().dispatch({
      type: "updateSectionContent",
      sectionId: greetingId,
      patch: { body: "다른 편집" },
    });
    expect(store.getState().redoStack).toHaveLength(0);
  });

  it("유효하지 않은 action은 상태를 바꾸지 않고 throw한다", () => {
    const { store } = setup();
    const before = store.getState().doc;
    expect(() =>
      store.getState().dispatch({
        type: "updateSectionContent",
        sectionId: "없는섹션",
        patch: { body: "x" },
      }),
    ).toThrow();
    expect(store.getState().doc).toBe(before);
    expect(store.getState().undoStack).toHaveLength(0);
  });
});

describe("editor store — 구조 편집 플로우", () => {
  it("add → undo → redo (redo 후에도 섹션 id가 동일하다)", () => {
    const { store, doc } = setup();
    store.getState().dispatch({ type: "addSection", sectionType: "venue", index: 1 });
    const addedId = store.getState().doc.sections[1].id;
    expect(store.getState().doc.sections).toHaveLength(doc.sections.length + 1);

    store.getState().undo();
    expect(store.getState().doc).toEqual(doc);

    store.getState().redo();
    expect(store.getState().doc.sections[1].id).toBe(addedId); // stable id
  });

  it("delete → undo로 복원되고, 삭제 시 dangling selection은 hero로 정규화된다", () => {
    const { store, doc } = setup();
    const venue = doc.sections.find((s) => s.type === "venue")!;
    store.getState().dispatch({ type: "selectSection", sectionId: venue.id });
    store.getState().dispatch({ type: "removeSection", sectionId: venue.id });

    expect(store.getState().doc.sections.some((s) => s.id === venue.id)).toBe(false);
    expect(store.getState().selected).toEqual({
      kind: "section",
      sectionId: doc.sections[0].id, // hero로 폴백
    });

    store.getState().undo();
    expect(store.getState().doc).toEqual(doc);
  });

  it("duplicate → undo", () => {
    const { store, doc, greetingId } = setup();
    store.getState().dispatch({ type: "duplicateSection", sourceSectionId: greetingId });
    expect(store.getState().doc.sections).toHaveLength(doc.sections.length + 1);
    store.getState().undo();
    expect(store.getState().doc).toEqual(doc);
  });

  it("reorder → undo → redo", () => {
    const { store, doc } = setup();
    const ids = doc.sections.map((s) => s.id);
    const order = [ids[0], ids[2], ids[1], ...ids.slice(3)];
    store.getState().dispatch({ type: "reorderSections", order });
    expect(store.getState().doc.sections.map((s) => s.id)).toEqual(order);

    store.getState().undo();
    expect(store.getState().doc.sections.map((s) => s.id)).toEqual(ids);
    store.getState().redo();
    expect(store.getState().doc.sections.map((s) => s.id)).toEqual(order);
  });

  it("hide → undo", () => {
    const { store, doc, greetingId } = setup();
    store.getState().dispatch({ type: "toggleSectionVisibility", sectionId: greetingId });
    expect(store.getState().doc.sections.find((s) => s.id === greetingId)?.visible).toBe(false);
    store.getState().undo();
    expect(store.getState().doc).toEqual(doc);
  });

  it("batch는 히스토리 1스텝이며 undo 한 번으로 전체가 되돌아간다", () => {
    const { store, doc, greetingId } = setup();
    store.getState().dispatch({
      type: "batch",
      actions: [
        { type: "setTheme", themeId: "film-diary" },
        { type: "updateSectionContent", sectionId: greetingId, patch: { title: "배치 제목" } },
        { type: "toggleSectionVisibility", sectionId: greetingId, visible: false },
      ],
    });
    expect(store.getState().undoStack).toHaveLength(1);
    expect(store.getState().doc.theme.id).toBe("film-diary");

    store.getState().undo();
    expect(store.getState().doc).toEqual(doc);
  });

  it("no-op action은 히스토리에 추가되지 않는다", () => {
    const { store, doc, greetingId } = setup();
    store.getState().dispatch({ type: "setTheme", themeId: doc.theme.id });
    store.getState().dispatch({
      type: "toggleSectionVisibility",
      sectionId: greetingId,
      visible: true,
    });
    store.getState().dispatch({
      type: "reorderSections",
      order: doc.sections.map((s) => s.id),
    });
    expect(store.getState().undoStack).toHaveLength(0);
    expect(store.getState().doc).toBe(doc); // 참조 그대로 — 변경 없음
  });

  it("selectSection은 선택만 바꾸고 히스토리·문서에 영향이 없다", () => {
    const { store, doc, greetingId } = setup();
    store.getState().dispatch({ type: "selectSection", sectionId: greetingId });
    expect(store.getState().selected).toEqual({ kind: "section", sectionId: greetingId });
    expect(store.getState().undoStack).toHaveLength(0);
    expect(store.getState().doc).toBe(doc);

    expect(() =>
      store.getState().dispatch({ type: "selectSection", sectionId: "없는섹션" }),
    ).toThrow(/섹션을 찾을 수 없습니다/);
  });
});
