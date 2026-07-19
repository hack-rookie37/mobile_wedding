import { createStore } from "zustand/vanilla";
import { coalesceKeyOf, type EditorAction } from "@/invitation/actions/actions";
import { applyAction, InvalidActionError } from "@/invitation/actions/apply";
import { recordEntry, redoOnce, undoOnce, type HistoryEntry } from "@/invitation/actions/history";
import type { InvitationDocument } from "@/invitation/schema/document";

export type EditorSelection =
  { kind: "wedding" } | { kind: "theme" } | { kind: "section"; sectionId: string };

// conflict: 다른 탭이 먼저 저장 — 이 탭의 저장은 차단되고 새로고침이 필요하다 (ADR-018)
export type SaveStatus = "saved" | "saving" | "error" | "conflict";

export type PreviewWidth = 360 | 390 | 430;
export type PreviewMode = "edit" | "interact";

export interface EditorState {
  doc: InvitationDocument;
  selected: EditorSelection;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  saveStatus: SaveStatus;
  // 미리보기 UI 상태 — 문서·히스토리와 무관한 세션 상태
  previewWidth: PreviewWidth;
  previewMode: PreviewMode;
  dispatch: (action: EditorAction) => void;
  undo: () => void;
  redo: () => void;
  select: (selection: EditorSelection) => void;
  setSaveStatus: (status: SaveStatus) => void;
  // revision 복원 등 서버가 이미 저장한 문서로 통째 교체 — 새 기준선이므로 히스토리를 비운다
  replaceDocument: (doc: InvitationDocument) => void;
  setPreviewWidth: (width: PreviewWidth) => void;
  setPreviewMode: (mode: PreviewMode) => void;
}

export interface CreateEditorStoreOptions {
  doc: InvitationDocument;
  now?: () => number; // 테스트에서 coalescing 창을 제어하기 위한 주입점
}

export type EditorStore = ReturnType<typeof createEditorStore>;

// 선택된 섹션이 (삭제·undo 등으로) 사라지면 hero로 되돌린다 — dangling selection 방지
function normalizeSelection(selected: EditorSelection, doc: InvitationDocument): EditorSelection {
  if (selected.kind !== "section") return selected;
  if (doc.sections.some((s) => s.id === selected.sectionId)) return selected;
  return { kind: "section", sectionId: doc.sections[0].id };
}

export function createEditorStore({ doc, now = Date.now }: CreateEditorStoreOptions) {
  return createStore<EditorState>()((set, get) => ({
    doc,
    selected: { kind: "section", sectionId: doc.sections[0].id },
    undoStack: [],
    redoStack: [],
    saveStatus: "saved",
    previewWidth: 390,
    previewMode: "edit",

    // 문서 변경의 유일한 진입점 — 검증·적용·no-op 판정은 전부 도메인 엔진(applyAction) 소관
    dispatch: (action) => {
      const state = get();

      if (action.type === "selectSection") {
        // 세션 action: 문서를 바꾸지 않고 히스토리에도 남지 않는다
        if (!state.doc.sections.some((s) => s.id === action.sectionId)) {
          throw new InvalidActionError(`섹션을 찾을 수 없습니다: ${action.sectionId}`);
        }
        set({ selected: { kind: "section", sectionId: action.sectionId } });
        return;
      }

      const result = applyAction(state.doc, action);
      if (result.outcome === "noop") return; // no-op은 히스토리에 추가하지 않는다

      const history = recordEntry(
        { undoStack: state.undoStack, redoStack: state.redoStack },
        {
          patches: result.patches,
          inversePatches: result.inversePatches,
          coalesceKey: coalesceKeyOf(action),
          at: now(),
        },
      );
      set({
        doc: result.doc,
        undoStack: history.undoStack,
        redoStack: history.redoStack,
        selected: normalizeSelection(state.selected, result.doc),
        saveStatus: state.saveStatus === "conflict" ? "conflict" : "saving",
      });
    },

    undo: () => {
      const state = get();
      const result = undoOnce(state.doc, {
        undoStack: state.undoStack,
        redoStack: state.redoStack,
      });
      if (!result) return;
      set({
        doc: result.doc,
        undoStack: result.history.undoStack,
        redoStack: result.history.redoStack,
        selected: normalizeSelection(state.selected, result.doc),
        saveStatus: state.saveStatus === "conflict" ? "conflict" : "saving",
      });
    },

    redo: () => {
      const state = get();
      const result = redoOnce(state.doc, {
        undoStack: state.undoStack,
        redoStack: state.redoStack,
      });
      if (!result) return;
      set({
        doc: result.doc,
        undoStack: result.history.undoStack,
        redoStack: result.history.redoStack,
        selected: normalizeSelection(state.selected, result.doc),
        saveStatus: state.saveStatus === "conflict" ? "conflict" : "saving",
      });
    },

    select: (selected) => set({ selected }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    replaceDocument: (nextDoc) =>
      set((state) => ({
        doc: nextDoc,
        undoStack: [],
        redoStack: [],
        selected: normalizeSelection(state.selected, nextDoc),
        saveStatus: "saved",
      })),
    setPreviewWidth: (previewWidth) => set({ previewWidth }),
    setPreviewMode: (previewMode) => set({ previewMode }),
  }));
}
