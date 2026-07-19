import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { applyAction } from "./apply";
import {
  COALESCE_WINDOW_MS,
  emptyHistory,
  HISTORY_LIMIT,
  recordEntry,
  redoOnce,
  undoOnce,
  type EditHistory,
  type HistoryEntry,
} from "./history";

function fakeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return { patches: [], inversePatches: [], coalesceKey: undefined, at: 0, ...overrides };
}

describe("recordEntry", () => {
  it("HISTORY_LIMIT을 넘으면 가장 오래된 엔트리부터 폐기한다", () => {
    let history = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      history = recordEntry(history, fakeEntry({ at: i }));
    }
    expect(history.undoStack).toHaveLength(HISTORY_LIMIT);
    expect(history.undoStack[0].at).toBe(5); // 0~4 폐기
  });

  it("같은 coalesceKey + 창 안이면 병합, 창을 넘으면 별도 엔트리", () => {
    let history = emptyHistory();
    history = recordEntry(history, fakeEntry({ coalesceKey: "k", at: 0 }));
    history = recordEntry(history, fakeEntry({ coalesceKey: "k", at: COALESCE_WINDOW_MS - 1 }));
    expect(history.undoStack).toHaveLength(1);

    history = recordEntry(history, fakeEntry({ coalesceKey: "k", at: COALESCE_WINDOW_MS * 3 }));
    expect(history.undoStack).toHaveLength(2);
  });

  it("기록 시 redo 브랜치를 폐기한다", () => {
    const history: EditHistory = { undoStack: [], redoStack: [fakeEntry()] };
    const next = recordEntry(history, fakeEntry());
    expect(next.redoStack).toHaveLength(0);
  });
});

describe("undoOnce / redoOnce", () => {
  it("실제 문서 patch로 왕복한다", () => {
    const doc = createSampleDocument();
    const result = applyAction(doc, { type: "setTheme", themeId: "film-diary" });
    if (result.outcome !== "applied") throw new Error("applied 기대");

    let history = recordEntry(emptyHistory(), {
      patches: result.patches,
      inversePatches: result.inversePatches,
      coalesceKey: undefined,
      at: 0,
    });

    const undone = undoOnce(result.doc, history);
    expect(undone).not.toBeNull();
    expect(undone!.doc).toEqual(doc);
    history = undone!.history;
    expect(history.redoStack).toHaveLength(1);

    const redone = redoOnce(undone!.doc, history);
    expect(redone!.doc).toEqual(result.doc);
    expect(redone!.history.undoStack).toHaveLength(1);
    expect(redone!.history.redoStack).toHaveLength(0);
  });

  it("빈 스택에서는 null을 반환한다", () => {
    const doc = createSampleDocument();
    expect(undoOnce(doc, emptyHistory())).toBeNull();
    expect(redoOnce(doc, emptyHistory())).toBeNull();
  });
});
