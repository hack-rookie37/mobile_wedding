"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { getBrowserSupabase } from "@/server/supabase/browserClient";
import {
  createSampleProject,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
  setProjectStatus,
  type ProjectListItem,
} from "@/server/supabase/projectsApi";
import { Button } from "@/ui/buttons";
import { useDeferredLoad } from "@/ui/useDeferredLoad";

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function RowAction({
  label,
  danger = false,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "text-[13px] text-tool-danger hover:underline"
          : "text-[13px] text-tool-ink-soft hover:text-tool-ink"
      }
    >
      {label}
    </button>
  );
}

function ProjectRow({
  project,
  busy,
  onRename,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: {
  project: ProjectListItem;
  busy: boolean;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(project.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const archived = project.status === "archived";

  return (
    <li data-project-row className="flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        {renaming ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draftTitle.trim() === "") return;
              onRename(draftTitle.trim());
              setRenaming(false);
            }}
          >
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              aria-label="프로젝트 이름"
              className="h-8 w-full max-w-[280px] rounded-md border border-tool-border px-2.5 text-[13px] focus:border-tool-accent focus:outline-none"
            />
            <button type="submit" className="text-[12px] font-medium text-tool-accent">
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setDraftTitle(project.title);
              }}
              className="text-[12px] text-tool-ink-soft"
            >
              취소
            </button>
          </form>
        ) : (
          <p className="truncate text-[14px] font-medium">
            {project.title}
            {archived && (
              <span className="ml-2 rounded border border-tool-border px-1 py-px align-middle text-[10px] text-tool-ink-faint">
                보관됨
              </span>
            )}
          </p>
        )}
        <p className="mt-0.5 text-[12px] text-tool-ink-faint">
          {formatUpdatedAt(project.updatedAt)} 수정
        </p>
      </div>

      {confirmingDelete ? (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-tool-ink-soft">사진·기록까지 모두 삭제됩니다.</span>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="h-7 rounded-md border border-tool-border px-2.5 text-[12px]"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="h-7 rounded-md bg-tool-danger px-2.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            영구 삭제
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <RowAction label="이름 변경" onClick={() => setRenaming(true)} />
          <RowAction label="복제" onClick={onDuplicate} />
          <RowAction label={archived ? "보관 해제" : "보관"} onClick={onToggleArchive} />
          <RowAction label="삭제" danger onClick={() => setConfirmingDelete(true)} />
          {!archived && (
            <>
              <a
                href={`/preview/${project.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-tool-ink-soft hover:text-tool-ink"
              >
                미리보기
              </a>
              <a
                href={`/editor/${project.id}`}
                className="text-[13px] font-medium text-tool-accent hover:underline"
              >
                편집
              </a>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    void reloadKey; // 목록 갱신 트리거
    return listProjects(getBrowserSupabase());
  }, [reloadKey]);
  const state = useDeferredLoad(load);

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    work()
      .then(() => setReloadKey((k) => k + 1))
      .catch((e: unknown) => setActionError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const handleCreate = () => {
    setBusy(true);
    setActionError(null);
    createSampleProject(getBrowserSupabase())
      .then((projectId) => router.push(`/editor/${projectId}`))
      .catch((e: unknown) => {
        setActionError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      });
  };

  const handleSignOut = () => {
    void getBrowserSupabase()
      .auth.signOut()
      .then(() => {
        router.replace("/login");
        router.refresh();
      });
  };

  const active = state.status === "ready" ? state.value.filter((p) => p.status === "draft") : [];
  const archived =
    state.status === "ready" ? state.value.filter((p) => p.status === "archived") : [];

  const renderRow = (project: ProjectListItem) => (
    <ProjectRow
      key={project.id}
      project={project}
      busy={busy}
      onRename={(title) => run(() => renameProject(getBrowserSupabase(), project.id, title))}
      onDuplicate={() =>
        run(() => duplicateProject(getBrowserSupabase(), project.id).then(() => {}))
      }
      onToggleArchive={() =>
        run(() =>
          setProjectStatus(
            getBrowserSupabase(),
            project.id,
            project.status === "archived" ? "draft" : "archived",
          ),
        )
      }
      onDelete={() => run(() => deleteProject(getBrowserSupabase(), project.id))}
    />
  );

  return (
    <div className="min-h-dvh bg-tool-bg text-tool-ink">
      <header className="flex h-14 items-center border-b border-tool-border bg-tool-surface px-6">
        <p className="text-[14px] font-semibold">청첩장 스튜디오</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="ml-auto text-[13px] text-tool-ink-soft hover:text-tool-ink"
        >
          로그아웃
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-[18px] font-semibold">내 청첩장</h1>
          {state.status === "ready" && state.value.length > 0 && (
            <Button variant="primary" onClick={handleCreate} disabled={busy}>
              새 청첩장
            </Button>
          )}
        </div>

        {actionError !== null && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-tool-danger/40 bg-white px-4 py-3 text-[13px] text-tool-danger"
          >
            {actionError}
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-lg border border-tool-danger/40 bg-white px-4 py-3 text-[13px] text-tool-danger">
            프로젝트 목록을 읽지 못했습니다: {state.message}
          </div>
        )}

        {state.status === "ready" && state.value.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-tool-border bg-tool-surface px-6 py-16">
            <div className="text-center">
              <p className="text-[15px] font-medium">아직 만든 청첩장이 없습니다</p>
              <p className="mt-1 text-[13px] text-tool-ink-soft">
                샘플 데이터로 시작해 내용을 직접 바꿔보세요.
              </p>
            </div>
            <Button variant="primary" onClick={handleCreate} disabled={busy}>
              샘플 청첩장 만들기
            </Button>
          </div>
        )}

        {active.length > 0 && (
          <ul className="divide-y divide-tool-border overflow-hidden rounded-lg border border-tool-border bg-tool-surface">
            {active.map(renderRow)}
          </ul>
        )}

        {archived.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-[13px] font-semibold text-tool-ink-soft">보관함</h2>
            <ul className="divide-y divide-tool-border overflow-hidden rounded-lg border border-tool-border bg-tool-surface opacity-80">
              {archived.map(renderRow)}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
