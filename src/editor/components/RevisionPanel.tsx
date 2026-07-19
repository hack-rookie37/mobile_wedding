"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ProjectPersistence,
  RestoreOutcome,
  RevisionKind,
  RevisionSummary,
} from "@/invitation/persistence/port";

const KIND_LABELS: Record<RevisionKind, string> = {
  origin: "처음",
  checkpoint: "체크포인트",
  restore: "복원",
};

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 편집 기록: checkpoint 생성·조회·복원. 복원은 파괴적이지 않다 —
// 서버가 복원 결과를 새 revision으로 남기고, 이 패널은 그 결과 문서를 돌려준다.
export function RevisionPanel({
  persistence,
  projectId,
  onRestored,
  onClose,
}: {
  persistence: ProjectPersistence;
  projectId: string;
  onRestored: (outcome: RestoreOutcome) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const refresh = useCallback(async () => {
    try {
      setRevisions(await persistence.listRevisions(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [persistence, projectId]);

  useEffect(() => {
    // 마이크로태스크로 미뤄 effect 내 동기 setState를 피한다 (useDeferredLoad와 같은 패턴)
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="편집 기록"
      onClose={onClose}
      className="m-auto w-[480px] rounded-lg bg-white p-0 shadow-[0_12px_48px_rgba(0,0,0,0.18)] backdrop:bg-black/40"
    >
      <div className="flex h-11 items-center border-b border-tool-border px-4">
        <h2 className="text-[13px] font-semibold text-tool-ink">편집 기록</h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="ml-auto rounded px-2 py-1 text-[12px] text-tool-ink-soft hover:bg-tool-bg hover:text-tool-ink"
        >
          닫기
        </button>
      </div>

      <div className="border-b border-tool-border px-4 py-3">
        <p className="mb-2 text-[12px] text-tool-ink-soft">
          지금 상태를 체크포인트로 남겨두면 언제든 되돌릴 수 있습니다.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = label.trim();
            if (trimmed === "") return;
            void run(async () => {
              await persistence.createCheckpoint(projectId, trimmed);
              setLabel("");
              await refresh();
            });
          }}
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 문구 확정본"
            aria-label="체크포인트 이름"
            className="h-8 min-w-0 flex-1 rounded-md border border-tool-border px-2.5 text-[13px] text-tool-ink placeholder:text-tool-ink-faint focus:border-tool-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || label.trim() === ""}
            className="h-8 shrink-0 rounded-md bg-tool-ink px-3 text-[12px] font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            체크포인트 만들기
          </button>
        </form>
      </div>

      <div className="max-h-[50dvh] overflow-y-auto px-4 py-3">
        {error !== null && (
          <p role="alert" className="mb-2 text-[12px] text-tool-danger">
            {error}
          </p>
        )}
        {revisions === null && (
          <p className="py-6 text-center text-[12px] text-tool-ink-soft">불러오는 중…</p>
        )}
        {revisions !== null && revisions.length === 0 && (
          <p className="py-6 text-center text-[12px] text-tool-ink-soft">기록이 없습니다.</p>
        )}
        <ul className="space-y-1">
          {(revisions ?? []).map((revision) => (
            <li
              key={revision.id}
              data-revision-row
              className="flex items-center gap-2 rounded-md border border-tool-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-tool-ink">{revision.label}</p>
                <p className="text-[11px] text-tool-ink-faint">
                  <span className="mr-1.5 rounded bg-tool-bg-deep px-1 py-px">
                    {KIND_LABELS[revision.kind]}
                  </span>
                  rev {revision.rev} · {formatAt(revision.createdAt)}
                </p>
              </div>
              {confirmingId === revision.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11px] text-tool-ink-soft">이 상태로 되돌릴까요?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="h-7 rounded-md border border-tool-border px-2 text-[12px] text-tool-ink"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const outcome = await persistence.restoreRevision(projectId, revision.id);
                        setConfirmingId(null);
                        onRestored(outcome);
                        await refresh(); // 복원 자체가 새 revision으로 나타난다
                      })
                    }
                    className="h-7 rounded-md bg-tool-accent px-2 text-[12px] font-medium text-white disabled:opacity-40"
                  >
                    복원
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmingId(revision.id)}
                  className="h-7 shrink-0 rounded-md border border-tool-border px-2.5 text-[12px] text-tool-ink hover:border-tool-border-strong disabled:opacity-40"
                >
                  복원
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
