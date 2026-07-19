import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleDocument } from "@/invitation/fixtures/sample";
import type { SaveOutcome } from "@/invitation/persistence/port";
import type { InvitationDocument } from "@/invitation/schema/document";
import { createAutosaveController, type AutosaveState } from "./autosave";

function docWithTagline(tagline: string): InvitationDocument {
  const doc = createSampleDocument();
  const hero = doc.sections[0];
  if (hero.type === "hero") hero.content.tagline = tagline;
  return doc;
}

describe("autosave controller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(save: (doc: InvitationDocument, rev: number) => Promise<SaveOutcome>) {
    const states: AutosaveState[] = [];
    const saveSpy = vi.fn(save);
    const controller = createAutosaveController({
      save: saveSpy,
      initialRev: 1,
      debounceMs: 1500,
      onStateChange: (state) => states.push(state),
    });
    return { controller, states, saveSpy };
  }

  it("디바운스: 연속 변경은 마지막 문서 1번만 저장한다", async () => {
    const { controller, states, saveSpy } = setup(async () => ({ status: "saved", rev: 2 }));

    controller.noteChange(docWithTagline("A"));
    await vi.advanceTimersByTimeAsync(500);
    controller.noteChange(docWithTagline("B"));
    await vi.advanceTimersByTimeAsync(500);
    const last = docWithTagline("C");
    controller.noteChange(last);
    expect(saveSpy).not.toHaveBeenCalled(); // 아직 디바운스 창 안

    await vi.advanceTimersByTimeAsync(1500);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(last, 1); // 마지막 문서 + 현재 rev
    expect(states).toEqual(["saving", "saved"]);
    expect(controller.currentRev()).toBe(2);
    expect(controller.hasUnsavedChanges()).toBe(false);
  });

  it("저장 중 변경이 오면 완료 후 최신 문서를 다시 저장한다", async () => {
    let rev = 1;
    const { controller, saveSpy } = setup(async () => ({ status: "saved", rev: ++rev }));

    controller.noteChange(docWithTagline("A"));
    await vi.advanceTimersByTimeAsync(1500); // 1차 저장 시작·완료 직전
    controller.noteChange(docWithTagline("B")); // in-flight 아님(fake timers상 완료됨) → 재디바운스
    await vi.advanceTimersByTimeAsync(1500);

    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(saveSpy.mock.calls[1][1]).toBe(2); // 2차 저장은 갱신된 rev 사용
    expect(controller.currentRev()).toBe(3);
  });

  it("저장 실패: error 상태 유지 + retry로 재시도해 성공한다", async () => {
    let fail = true;
    const { controller, states, saveSpy } = setup(async () => {
      if (fail) throw new Error("network down");
      return { status: "saved", rev: 2 };
    });

    controller.noteChange(docWithTagline("A"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(states).toEqual(["saving", "error"]);
    expect(controller.hasUnsavedChanges()).toBe(true); // 변경은 사라지지 않는다

    fail = false;
    controller.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe("saved");
    expect(controller.currentRev()).toBe(2);
  });

  it("retry는 error 상태에서만 동작한다", async () => {
    const { controller, saveSpy } = setup(async () => ({ status: "saved", rev: 2 }));
    controller.retry(); // saved 상태 — no-op
    await vi.advanceTimersByTimeAsync(0);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("stale revision 충돌: conflict 상태로 전환하고 이후 자동 저장을 차단한다", async () => {
    const { controller, states, saveSpy } = setup(async () => ({
      status: "conflict",
      currentRev: 9,
    }));

    controller.noteChange(docWithTagline("A"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(states).toEqual(["saving", "conflict"]);
    expect(controller.hasUnsavedChanges()).toBe(true);

    // 충돌 후의 변경은 서버로 나가지 않는다 (덮어쓰기 방지)
    controller.noteChange(docWithTagline("B"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("adoptServerRev: 복원 등 외부 저장을 기준으로 채택하면 saved로 돌아온다", async () => {
    const { controller, states } = setup(async () => ({ status: "conflict", currentRev: 9 }));
    controller.noteChange(docWithTagline("A"));
    await vi.advanceTimersByTimeAsync(1500);
    expect(states.at(-1)).toBe("conflict");

    controller.adoptServerRev(9);
    expect(states.at(-1)).toBe("saved");
    expect(controller.currentRev()).toBe(9);
    expect(controller.hasUnsavedChanges()).toBe(false);
  });

  it("dispose 후에는 어떤 타이머도 저장을 트리거하지 않는다", async () => {
    const { controller, saveSpy } = setup(async () => ({ status: "saved", rev: 2 }));
    controller.noteChange(docWithTagline("A"));
    controller.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
