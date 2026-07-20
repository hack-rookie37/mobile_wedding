"use client";

import { useRef, useState } from "react";
import {
  ALLOWED_FONT_TYPES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  validateFontFile,
} from "@/invitation/assets/uploadPolicy";
import { customFontAssetIds } from "@/invitation/lib/assetRefs";
import { CUSTOM_FONT_PREFIX, FONT_CHOICES } from "@/invitation/schema/themes";
import { FieldLabel } from "@/ui/fields";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";

// 폰트 선택지 = 내장 폰트 + 업로드한 폰트. 업로드 폰트의 이름은 asset의 파일명에서 온다
// (문서에는 "custom:<assetId>" 참조만 저장한다 — 이름을 중복 저장하지 않는다).
export function useFontOptions(themeLabel: string, themeValue: string) {
  const { assets } = useAssetLibrary();
  const customFonts = assets.filter((asset) => asset.record.kind === "font");
  return [
    { value: themeValue, label: themeLabel },
    ...Object.entries(FONT_CHOICES).map(([value, font]) => ({ value, label: font.label })),
    ...customFonts.map((asset) => ({
      value: `${CUSTOM_FONT_PREFIX}${asset.record.id}`,
      label: asset.record.filename,
    })),
  ];
}

// 폰트 파일 업로드 — 업로드만 하고 적용은 위쪽 선택 메뉴에서 한다.
// 문서가 쓰고 있는 폰트는 지울 수 없다 (참조가 끊긴 청첩장을 만들지 않는다).
export function CustomFontUpload() {
  const doc = useEditor((s) => s.doc);
  const { assets, upload, remove } = useAssetLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const customFonts = assets.filter((asset) => asset.record.kind === "font");
  const inUse = customFontAssetIds(doc);
  const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setErrors([]);
    try {
      await task();
    } catch (e) {
      setErrors([messageOf(e)]);
    } finally {
      setBusy(false);
    }
  };

  // 여러 개를 한 번에 올린다. 하나가 실패해도 나머지는 계속 올린다 —
  // 폰트 묶음에는 형식이 섞여 있기 마련이라 첫 실패로 전부 멈추면 다시 고르게 된다.
  const uploadAll = async (files: File[]) => {
    setBusy(true);
    setErrors([]);
    const failed: string[] = [];
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length });
      try {
        validateFontFile(file); // 폰트 전용 검증 — 이미지 등은 폰트 문구로 거부
        await upload(file);
      } catch (e) {
        failed.push(`${file.name} — ${messageOf(e)}`);
      }
    }
    setProgress(null);
    setErrors(failed);
    setBusy(false);
  };

  return (
    <div>
      <FieldLabel>내 폰트 추가</FieldLabel>
      {customFonts.length > 0 && (
        <ul data-custom-fonts className="mb-2 space-y-1">
          {customFonts.map((asset) => (
            <li
              key={asset.record.id}
              className="flex items-center gap-2 rounded-md border border-tool-border px-3 py-2"
            >
              <span aria-hidden className="text-[13px]">
                Aa
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-tool-ink">
                {asset.record.filename}
                <span className="ml-1.5 text-tool-ink-faint tabular-nums">
                  {formatBytes(asset.record.size)}
                </span>
              </span>
              <button
                type="button"
                disabled={busy || inUse.has(asset.record.id)}
                title={inUse.has(asset.record.id) ? "사용 중인 폰트는 지울 수 없습니다" : undefined}
                onClick={() => void run(() => remove(asset.record.id))}
                className="shrink-0 text-[12px] text-tool-danger hover:underline disabled:cursor-not-allowed disabled:text-tool-ink-faint disabled:no-underline"
              >
                {inUse.has(asset.record.id) ? "사용 중" : "없애기"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="h-9 w-full rounded-md border border-dashed border-tool-border text-[12px] text-tool-ink-soft hover:border-tool-border-strong hover:text-tool-ink disabled:opacity-40"
      >
        {busy
          ? progress !== null
            ? `업로드 중… (${progress.done + 1}/${progress.total})`
            : "업로드 중…"
          : `폰트 파일 업로드 (${Object.values(ALLOWED_FONT_TYPES).join("·")}, 최대 ${formatBytes(MAX_UPLOAD_BYTES)})`}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        data-font-upload
        accept={[...Object.keys(ALLOWED_FONT_TYPES), ".woff2,.woff,.ttf,.otf"].join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // 같은 파일 재선택 허용
          if (files.length === 0) return;
          void uploadAll(files);
        }}
      />
      {errors.length > 0 && (
        <ul data-font-upload-errors role="alert" className="mt-2 space-y-1">
          {errors.map((message) => (
            <li key={message} className="text-[12px] text-tool-danger">
              {message}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-[1.5] text-tool-ink-faint">
        올린 폰트는 위 선택 메뉴와 각 섹션의 ‘스타일’ 탭에 나타납니다. 배포 권한이 있는 폰트만 올려
        주세요.
      </p>
    </div>
  );
}
