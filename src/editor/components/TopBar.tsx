"use client";

import Link from "next/link";
import { Button, IconButton } from "@/ui/buttons";
import { Segmented } from "@/ui/fields";
import { RedoIcon, UndoIcon } from "@/ui/icons";
import { useEditor } from "../EditorStoreContext";
import type { PreviewWidth } from "../store";

function SaveStatusBadge({ onRetry }: { onRetry: () => void }) {
  const status = useEditor((s) => s.saveStatus);
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-tool-danger">
        저장 실패
        <button type="button" onClick={onRetry} className="underline underline-offset-2">
          재시도
        </button>
      </span>
    );
  }
  if (status === "conflict") {
    return <span className="text-[12px] font-medium text-tool-danger">다른 탭에서 수정됨</span>;
  }
  return (
    <span className="text-[12px] text-tool-ink-faint">
      {status === "saving" ? "저장 중…" : "저장됨"}
    </span>
  );
}

export function TopBar({
  title,
  projectId,
  onRetrySave,
  onOpenRevisions,
  onOpenPublish,
  onOpenAi,
}: {
  title: string;
  projectId: string;
  onRetrySave: () => void;
  onOpenRevisions: () => void;
  onOpenPublish: () => void;
  onOpenAi: () => void;
}) {
  const canUndo = useEditor((s) => s.undoStack.length > 0);
  const canRedo = useEditor((s) => s.redoStack.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const previewWidth = useEditor((s) => s.previewWidth);
  const previewMode = useEditor((s) => s.previewMode);
  const setPreviewWidth = useEditor((s) => s.setPreviewWidth);
  const setPreviewMode = useEditor((s) => s.setPreviewMode);

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-tool-border bg-tool-surface px-4">
      <Link
        href="/edit"
        className="text-[13px] text-tool-ink-soft transition-colors hover:text-tool-ink"
      >
        ← 내 청첩장
      </Link>
      <div aria-hidden className="h-4 w-px bg-tool-border" />
      <h1 className="max-w-[320px] truncate text-[13px] font-medium">{title}</h1>
      <SaveStatusBadge onRetry={onRetrySave} />

      <div className="ml-auto flex items-center gap-1">
        <Segmented
          value={String(previewWidth)}
          options={[
            { value: "360", label: "360" },
            { value: "390", label: "390" },
            { value: "430", label: "430" },
          ]}
          onChange={(v) => setPreviewWidth(Number(v) as PreviewWidth)}
        />
        <div className="ml-1">
          <Segmented
            value={previewMode}
            options={[
              { value: "edit", label: "편집" },
              { value: "interact", label: "인터랙션" },
            ]}
            onChange={setPreviewMode}
          />
        </div>
        <div aria-hidden className="mx-2 h-4 w-px bg-tool-border" />
        <IconButton label="실행 취소" onClick={undo} disabled={!canUndo}>
          <UndoIcon />
        </IconButton>
        <IconButton label="다시 실행" onClick={redo} disabled={!canRedo}>
          <RedoIcon />
        </IconButton>
        <div aria-hidden className="mx-2 h-4 w-px bg-tool-border" />
        <Button onClick={onOpenAi}>AI 도우미</Button>
        <Button onClick={onOpenRevisions}>기록</Button>
        <Link
          href={`/editor/${projectId}/rsvp`}
          className="flex h-8 items-center rounded-md border border-tool-border bg-white px-3.5 text-[13px] font-medium text-tool-ink transition-colors hover:border-tool-border-strong"
        >
          RSVP 응답
        </Link>
        <a
          href={`/preview/${projectId}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-8 items-center rounded-md border border-tool-border bg-white px-3.5 text-[13px] font-medium text-tool-ink transition-colors hover:border-tool-border-strong"
        >
          미리보기
        </a>
        <Button variant="primary" onClick={onOpenPublish}>
          공유·발행
        </Button>
      </div>
    </header>
  );
}
