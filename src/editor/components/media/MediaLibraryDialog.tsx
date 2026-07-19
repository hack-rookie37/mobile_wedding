"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StoredAsset } from "@/invitation/assets/assetTypes";
import {
  ALLOWED_IMAGE_TYPES,
  formatBytes,
  MAX_UPLOAD_BYTES,
  MIN_RECOMMENDED_WIDTH,
} from "@/invitation/assets/uploadPolicy";
import { referencedAssetIds } from "@/invitation/lib/assetRefs";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";

// 사진 보관함 — 업로드(진행·검증·중복·재시도)와 기존 이미지 선택을 담당한다.
// 선택 결과는 전부 assignAsset action으로 dispatch되어 undo 가능하다.

export type MediaPickMode =
  | { kind: "gallery-add"; sectionId: string; remainingSlots: number }
  | { kind: "gallery-replace"; sectionId: string; index: number }
  | { kind: "hero"; sectionId: string }
  | { kind: "profile"; sectionId: string; side: "groom" | "bride" }
  | { kind: "closing"; sectionId: string };

interface QueueItem {
  key: number;
  file: File;
  status: "working" | "done" | "duplicate" | "error";
  progress: number; // 0~1
  message: string | null;
  warnings: string[];
}

function updateItem(key: number, patch: Partial<QueueItem>) {
  return (queue: QueueItem[]) =>
    queue.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

export function MediaLibraryDialog({
  mode,
  onClose,
}: {
  mode: MediaPickMode;
  onClose: () => void;
}) {
  const { status, errorMessage, assets, upload, remove } = useAssetLibrary();
  const dispatch = useEditor((s) => s.dispatch);
  const doc = useEditor((s) => s.doc);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueKeyRef = useRef(0);
  // 동일 파일 동시 업로드의 중복 감지 경합을 막기 위해 순차 실행한다
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve());

  const multi = mode.kind === "gallery-add";
  const [selected, setSelected] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // 현재 문서가 참조 중인 asset — 삭제 시 '이미지 없음'이 된다는 경고에 사용
  const usedIds = useMemo(() => referencedAssetIds(doc), [doc]);

  const selectAsset = (assetId: string) => {
    setSelected((current) => {
      if (!multi) return [assetId];
      return current.includes(assetId) ? current : [...current, assetId];
    });
  };

  const toggleAsset = (assetId: string) => {
    setSelected((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : multi
          ? [...current, assetId]
          : [assetId],
    );
  };

  const runUpload = async (key: number, file: File) => {
    setQueue(updateItem(key, { status: "working", progress: 0, message: null, warnings: [] }));
    try {
      const outcome = await upload(file, {
        onProgress: (progress) => setQueue(updateItem(key, { progress })),
      });
      setQueue(
        updateItem(key, {
          status: outcome.duplicate ? "duplicate" : "done",
          progress: 1,
          message: outcome.duplicate ? "이미 업로드된 사진입니다 — 기존 사진을 선택했습니다" : null,
          warnings: outcome.warnings,
        }),
      );
      selectAsset(outcome.asset.record.id); // 업로드 완료 즉시 선택 상태로
    } catch (error) {
      setQueue(
        updateItem(key, {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  const enqueueFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = queueKeyRef.current++;
      setQueue((current) => [
        ...current,
        { key, file, status: "working", progress: 0, message: null, warnings: [] },
      ]);
      uploadChainRef.current = uploadChainRef.current.then(() => runUpload(key, file));
    }
  };

  const confirmSelection = () => {
    if (selected.length === 0) return;
    if (mode.kind === "gallery-add") {
      dispatch({
        type: "batch",
        label: "사진 추가",
        actions: selected.slice(0, mode.remainingSlots).map((assetId) => ({
          type: "assignAsset" as const,
          sectionId: mode.sectionId,
          assetId,
          slot: { kind: "galleryItem" as const },
        })),
      });
    } else if (mode.kind === "gallery-replace") {
      dispatch({
        type: "assignAsset",
        sectionId: mode.sectionId,
        assetId: selected[0],
        slot: { kind: "galleryItem", index: mode.index },
      });
    } else {
      const slot =
        mode.kind === "profile"
          ? { kind: "profilePhoto" as const, side: mode.side }
          : mode.kind === "closing"
            ? { kind: "closingPhoto" as const }
            : { kind: "heroPhoto" as const };
      dispatch({
        type: "assignAsset",
        sectionId: mode.sectionId,
        assetId: selected[0],
        slot,
      });
    }
    dialogRef.current?.close();
  };

  const confirmLabel =
    mode.kind === "gallery-add"
      ? `선택한 ${Math.min(selected.length, mode.remainingSlots)}장 추가`
      : mode.kind === "gallery-replace"
        ? "이 사진으로 교체"
        : mode.kind === "hero"
          ? "대표 사진으로 사용"
          : "이 사진으로 사용";

  return (
    <dialog
      ref={dialogRef}
      aria-label="사진 보관함"
      onClose={onClose}
      className="m-auto w-[720px] rounded-lg bg-white p-0 shadow-[0_12px_48px_rgba(0,0,0,0.18)] backdrop:bg-black/40"
    >
      <div className="flex h-11 items-center border-b border-tool-border px-4">
        <h2 className="text-[13px] font-semibold text-tool-ink">사진 보관함</h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="ml-auto rounded px-2 py-1 text-[12px] text-tool-ink-soft hover:bg-tool-bg hover:text-tool-ink"
        >
          닫기
        </button>
      </div>

      <div className="max-h-[60dvh] overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
            className="hidden"
            onChange={(e) => {
              enqueueFiles(e.target.files);
              e.target.value = ""; // 같은 파일 재선택 허용
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 rounded-md bg-tool-ink px-3.5 text-[13px] font-medium text-white hover:bg-black"
          >
            사진 업로드
          </button>
          <p className="text-[12px] text-tool-ink-faint">
            {Object.values(ALLOWED_IMAGE_TYPES).join("·")} · 최대 {formatBytes(MAX_UPLOAD_BYTES)}
            {multi ? ` · 남은 슬롯 ${mode.remainingSlots}장` : ""}
          </p>
        </div>

        {queue.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="업로드 목록">
            {queue.map((item) => (
              <li
                key={item.key}
                data-upload-item
                data-upload-status={item.status}
                className="rounded-md border border-tool-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-tool-ink">
                    {item.file.name}
                  </span>
                  <span
                    className={clsx(
                      "shrink-0 text-[11px]",
                      item.status === "error" ? "text-tool-danger" : "text-tool-ink-faint",
                    )}
                  >
                    {item.status === "working" && `${Math.round(item.progress * 100)}%`}
                    {item.status === "done" && "완료"}
                    {item.status === "duplicate" && "중복"}
                    {item.status === "error" && "실패"}
                  </span>
                  {item.status === "error" && (
                    <button
                      type="button"
                      onClick={() => {
                        uploadChainRef.current = uploadChainRef.current.then(() =>
                          runUpload(item.key, item.file),
                        );
                      }}
                      className="min-h-6 shrink-0 rounded border border-tool-border px-2 py-0.5 text-[11px] text-tool-ink hover:border-tool-border-strong"
                    >
                      재시도
                    </button>
                  )}
                </div>
                {item.status === "working" && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-tool-bg-deep">
                    <div
                      className="h-full rounded-full bg-tool-accent transition-[width]"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                )}
                {item.message !== null && (
                  <p
                    className={clsx(
                      "mt-1 text-[11px] leading-[1.5]",
                      item.status === "error" ? "text-tool-danger" : "text-tool-ink-soft",
                    )}
                  >
                    {item.message}
                  </p>
                )}
                {item.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-[11px] leading-[1.5] text-[#9a6b1f]">
                    ⚠ {warning}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}

        {status === "loading" && (
          <p className="py-10 text-center text-[12px] text-tool-ink-soft">불러오는 중…</p>
        )}
        {status === "error" && (
          <p className="py-10 text-center text-[12px] text-tool-danger">
            사진 보관함을 불러오지 못했습니다: {errorMessage}
          </p>
        )}
        {status === "ready" && (
          <ul className="mt-4 grid grid-cols-4 gap-3" aria-label="보관함 사진 목록">
            {assets.map((asset) => (
              <AssetTile
                key={asset.record.id}
                asset={asset}
                selected={selected.includes(asset.record.id)}
                used={usedIds.has(asset.record.id)}
                confirmingDelete={confirmingDeleteId === asset.record.id}
                onToggle={() => toggleAsset(asset.record.id)}
                onRequestDelete={() => setConfirmingDeleteId(asset.record.id)}
                onCancelDelete={() => setConfirmingDeleteId(null)}
                onConfirmDelete={() => {
                  setConfirmingDeleteId(null);
                  setSelected((current) => current.filter((id) => id !== asset.record.id));
                  void remove(asset.record.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-tool-border px-4 py-3">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="h-8 rounded-md border border-tool-border px-3.5 text-[13px] text-tool-ink hover:border-tool-border-strong"
        >
          취소
        </button>
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={confirmSelection}
          className="h-8 rounded-md bg-tool-accent px-3.5 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

function AssetTile({
  asset,
  selected,
  used,
  confirmingDelete,
  onToggle,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  asset: StoredAsset;
  selected: boolean;
  used: boolean;
  confirmingDelete: boolean;
  onToggle: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const { record } = asset;
  const lowRes = record.width < MIN_RECOMMENDED_WIDTH;

  return (
    <li className="group/tile relative" data-asset-tile data-asset-id={record.id}>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${record.filename} 선택`}
        onClick={onToggle}
        className={clsx(
          "block w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tool-accent",
          selected && "ring-2 ring-tool-accent ring-offset-2",
        )}
      >
        <img
          src={asset.thumbUrl ?? asset.fullUrl}
          alt={record.filename}
          className="aspect-square w-full rounded-md border border-tool-border object-cover"
        />
        <span className="mt-1 block truncate text-[11px] text-tool-ink">{record.filename}</span>
        <span className="block text-[10px] text-tool-ink-faint tabular-nums">
          {record.width}×{record.height}
          {!record.builtin && ` · ${formatBytes(record.size)}`}
        </span>
      </button>

      {selected && (
        <span
          aria-hidden
          className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-tool-accent text-[11px] text-white"
        >
          ✓
        </span>
      )}
      {lowRes && (
        <span className="absolute top-1.5 right-1.5 rounded bg-[#9a6b1f] px-1 py-px text-[9px] font-medium text-white">
          저해상도
        </span>
      )}
      {record.builtin && (
        <span className="absolute bottom-9 left-1.5 rounded bg-black/55 px-1 py-px text-[9px] text-white">
          기본 제공
        </span>
      )}

      {!record.builtin && !confirmingDelete && (
        <button
          type="button"
          aria-label={`${record.filename} 삭제`}
          onClick={onRequestDelete}
          className="absolute right-1.5 bottom-9 min-h-6 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100"
        >
          삭제
        </button>
      )}
      {confirmingDelete && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-md bg-black/70 p-2 text-center">
          <p className="text-[11px] leading-[1.4] text-white">
            삭제할까요?
            {used && (
              <span className="block text-[10px] text-white/75">
                사용 중 — ‘이미지 없음’으로 표시됩니다
              </span>
            )}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onCancelDelete}
              className="min-h-6 rounded bg-white/20 px-2 py-0.5 text-[11px] text-white hover:bg-white/30"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              className="min-h-6 rounded bg-tool-danger px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
