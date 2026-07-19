import type { SaveOutcome } from "@/invitation/persistence/port";
import type { InvitationDocument } from "@/invitation/schema/document";

// 디바운스 자동 저장 컨트롤러 (ADR-018) — React와 무관한 순수 로직.
// 상태 기계: saved → (변경) saving → [성공 saved | 실패 error(재시도 가능) | 충돌 conflict(차단)]
// conflict는 다른 탭이 먼저 저장한 것 — 이 탭의 자동 저장을 멈추고 사용자가 새로고침해야 한다.

export type AutosaveState = "saved" | "saving" | "error" | "conflict";

export interface AutosaveController {
  noteChange(doc: InvitationDocument): void; // 문서 변경 알림 (디바운스 시작)
  retry(): void; // error 상태에서 즉시 재시도
  adoptServerRev(rev: number): void; // 복원 등 서버에서 이미 저장된 rev를 기준으로 채택
  hasUnsavedChanges(): boolean;
  currentRev(): number;
  dispose(): void;
}

export interface AutosaveOptions {
  save: (doc: InvitationDocument, expectedRev: number) => Promise<SaveOutcome>;
  initialRev: number;
  onStateChange: (state: AutosaveState) => void;
  debounceMs?: number;
  // 테스트 주입점
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export const AUTOSAVE_DEBOUNCE_MS = 1500; // A-12

export function createAutosaveController({
  save,
  initialRev,
  onStateChange,
  debounceMs = AUTOSAVE_DEBOUNCE_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}: AutosaveOptions): AutosaveController {
  let rev = initialRev;
  let state: AutosaveState = "saved";
  let pendingDoc: InvitationDocument | null = null; // 저장되지 않은 최신 문서
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let disposed = false;

  const setState = (next: AutosaveState) => {
    if (state === next) return;
    state = next;
    onStateChange(next);
  };

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clearTimer();
    timer = setTimeoutFn(() => {
      timer = null;
      void runSave();
    }, debounceMs);
  };

  const runSave = async () => {
    if (disposed || inFlight || state === "conflict" || pendingDoc === null) return;
    const doc = pendingDoc;
    inFlight = true;
    setState("saving");
    try {
      const outcome = await save(doc, rev);
      inFlight = false;
      if (disposed) return;
      if (outcome.status === "conflict") {
        // 다른 탭이 rev를 올렸다 — 덮어쓰지 않고 멈춘다
        setState("conflict");
        return;
      }
      rev = outcome.rev;
      if (pendingDoc !== doc) {
        // 저장 중에 또 변경됨 — 최신 문서로 다시 디바운스
        schedule();
        setState("saving");
      } else {
        pendingDoc = null;
        setState("saved");
      }
    } catch {
      inFlight = false;
      if (disposed) return;
      setState("error"); // pendingDoc 유지 — retry로 재시도
    }
  };

  return {
    noteChange(doc) {
      if (disposed || state === "conflict") return;
      pendingDoc = doc;
      setState("saving");
      if (!inFlight) schedule();
    },
    retry() {
      if (disposed || state !== "error") return;
      clearTimer();
      void runSave();
    },
    adoptServerRev(newRev) {
      // 서버에서 이미 저장된 상태(복원 등)를 이 탭의 기준으로 채택 — 문서 교체는 store 소관
      clearTimer();
      rev = newRev;
      pendingDoc = null;
      inFlight = false;
      setState("saved");
    },
    hasUnsavedChanges: () => pendingDoc !== null || state === "error" || state === "conflict",
    currentRev: () => rev,
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}
