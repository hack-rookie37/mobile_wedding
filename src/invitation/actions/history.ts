import { applyPatches, enablePatches, type Patch } from "immer";
import type { InvitationDocument } from "../schema/document";

enablePatches();

// undo/redo 히스토리의 순수 코어 (ADR-015).
// zustand 등 상태 컨테이너를 모른다 — 편집기 store와 (향후) AI 세션이 공유한다.

export const HISTORY_LIMIT = 100; // A-11: 초과 시 가장 오래된 스텝부터 폐기
export const COALESCE_WINDOW_MS = 1000;

export interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
  coalesceKey: string | undefined;
  at: number;
}

export interface EditHistory {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

export function emptyHistory(): EditHistory {
  return { undoStack: [], redoStack: [] };
}

// 새 엔트리 기록 — 같은 coalesceKey의 연속 입력은 1스텝으로 병합,
// 기록 시점에 redo 브랜치는 항상 폐기된다 (핵심 불변 조건)
export function recordEntry(history: EditHistory, entry: HistoryEntry): EditHistory {
  const last = history.undoStack[history.undoStack.length - 1];
  if (
    entry.coalesceKey !== undefined &&
    last !== undefined &&
    last.coalesceKey === entry.coalesceKey &&
    entry.at - last.at < COALESCE_WINDOW_MS
  ) {
    return {
      undoStack: [
        ...history.undoStack.slice(0, -1),
        {
          coalesceKey: entry.coalesceKey,
          at: entry.at,
          patches: [...last.patches, ...entry.patches],
          inversePatches: [...entry.inversePatches, ...last.inversePatches],
        },
      ],
      redoStack: [],
    };
  }
  return {
    undoStack: [...history.undoStack, entry].slice(-HISTORY_LIMIT),
    redoStack: [],
  };
}

export interface HistoryStepResult {
  doc: InvitationDocument;
  history: EditHistory;
}

export function undoOnce(doc: InvitationDocument, history: EditHistory): HistoryStepResult | null {
  const entry = history.undoStack[history.undoStack.length - 1];
  if (!entry) return null;
  return {
    doc: applyPatches(doc, entry.inversePatches),
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, entry],
    },
  };
}

export function redoOnce(doc: InvitationDocument, history: EditHistory): HistoryStepResult | null {
  const entry = history.redoStack[history.redoStack.length - 1];
  if (!entry) return null;
  return {
    doc: applyPatches(doc, entry.patches),
    history: {
      undoStack: [...history.undoStack, entry],
      redoStack: history.redoStack.slice(0, -1),
    },
  };
}
