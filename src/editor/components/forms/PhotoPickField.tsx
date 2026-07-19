"use client";

import { useState, type ReactNode } from "react";
import { FieldLabel } from "@/ui/fields";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { MediaLibraryDialog, type MediaPickMode } from "../media/MediaLibraryDialog";

// 단일 사진 슬롯의 공용 선택 UI (메인·신랑신부 소개·맺음말) — 선택은 사진 보관함 다이얼로그,
// 결과는 부모가 정한 slot의 assignAsset action으로 dispatch된다.
export function PhotoPickField({
  label,
  assetId,
  pickMode,
  onRemove,
  children,
}: {
  label: string;
  assetId: string | null;
  pickMode: MediaPickMode;
  onRemove: () => void;
  children?: ReactNode; // 필드 하단 부가 안내
}) {
  const { resolveAsset } = useAssetLibrary();
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasPhoto = assetId !== null;
  const asset = assetId !== null ? resolveAsset(assetId) : null;

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        {asset !== null ? (
          <img
            src={asset.src}
            alt={`${label} 미리보기`}
            className="size-14 shrink-0 rounded-md border border-tool-border object-cover"
          />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-tool-border bg-tool-bg-deep text-[10px] text-tool-ink-faint">
            없음
          </span>
        )}
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="h-7 rounded-md border border-tool-border bg-white px-2.5 text-[12px] text-tool-ink hover:border-tool-border-strong"
          >
            {hasPhoto ? "사진 교체" : "사진 선택"}
          </button>
          <button
            type="button"
            disabled={!hasPhoto}
            onClick={onRemove}
            className="text-[12px] text-tool-ink-soft underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
          >
            사진 제거
          </button>
        </div>
      </div>
      {children}
      {pickerOpen && <MediaLibraryDialog mode={pickMode} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
