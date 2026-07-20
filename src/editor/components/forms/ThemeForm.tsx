"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import {
  ALLOWED_AUDIO_TYPES,
  MAX_UPLOAD_BYTES,
  formatBytes,
  validateAudioFile,
} from "@/invitation/assets/uploadPolicy";
import { PT_MAX, PT_MIN, THEME_ORDER, THEMES } from "@/invitation/schema/themes";
import { FieldLabel, NumberField } from "@/ui/fields";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";
import { CustomFontUpload, useFontOptions } from "./FontFields";
import { FontPicker } from "./FontPicker";

// 배경음악 — 파일 업로드(오디오) 후 setMusic action으로 문서에 참조를 기록한다.
// 게스트 화면에는 우상단 음악 켜기/끄기 버튼이 뜬다 (자동재생 없음).
function MusicField() {
  const musicAssetId = useEditor((s) => s.doc.music.assetId);
  const dispatch = useEditor((s) => s.dispatch);
  const { assets, upload } = useAssetLibrary();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current =
    musicAssetId !== null ? (assets.find((a) => a.record.id === musicAssetId) ?? null) : null;

  const onPick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      validateAudioFile(file); // 음악 전용 검증 — 이미지 등은 음악 문구로 거부
      const outcome = await upload(file);
      dispatch({ type: "setMusic", assetId: outcome.asset.record.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <FieldLabel>배경음악</FieldLabel>
      {current !== null ? (
        <div className="flex items-center gap-2 rounded-md border border-tool-border px-3 py-2.5">
          <span aria-hidden className="text-[13px]">
            ♪
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-tool-ink">
            {current.record.filename}
            <span className="ml-1.5 text-tool-ink-faint tabular-nums">
              {formatBytes(current.record.size)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: "setMusic", assetId: null })}
            className="shrink-0 text-[12px] text-tool-danger hover:underline"
          >
            없애기
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="h-9 w-full rounded-md border border-dashed border-tool-border text-[12px] text-tool-ink-soft hover:border-tool-border-strong hover:text-tool-ink disabled:opacity-40"
        >
          {busy
            ? "업로드 중…"
            : `음악 파일 업로드 (${Object.values(ALLOWED_AUDIO_TYPES).join("·")}, 최대 ${formatBytes(MAX_UPLOAD_BYTES)})`}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(ALLOWED_AUDIO_TYPES).join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // 같은 파일 재선택 허용
          if (file) void onPick(file);
        }}
      />
      {error !== null && (
        <p role="alert" className="mt-2 text-[12px] text-tool-danger">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-[1.5] text-tool-ink-faint">
        게스트 화면 우상단에 음악 켜기 버튼이 표시됩니다. 자동재생은 하지 않습니다 — 모바일
        브라우저가 차단합니다.
      </p>
    </div>
  );
}

// 전역 폰트·글자 크기 — updateTypography action (undo 가능, 섹션별 override는 스타일 탭)
function TypographyFields() {
  const typography = useEditor((s) => s.doc.typography);
  const dispatch = useEditor((s) => s.dispatch);
  const patch = (p: Record<string, unknown>) => dispatch({ type: "updateTypography", patch: p });
  const fontOptions = useFontOptions("테마 기본", "theme");

  return (
    <div className="mt-6 space-y-4">
      <FieldLabel>폰트</FieldLabel>
      <FontPicker
        label="제목·이름 폰트"
        value={typography.headingFont}
        options={fontOptions}
        onChange={(headingFont) => patch({ headingFont })}
      />
      <FontPicker
        label="본문 폰트"
        value={typography.bodyFont}
        options={fontOptions}
        onChange={(bodyFont) => patch({ bodyFont })}
      />
      <NumberField
        label="제목 글자 크기"
        value={typography.headingPt}
        min={PT_MIN}
        max={PT_MAX}
        step={0.5}
        unit="pt"
        onChange={(headingPt) => patch({ headingPt })}
      />
      <NumberField
        label="본문 글자 크기"
        value={typography.bodyPt}
        min={PT_MIN}
        max={PT_MAX}
        step={0.5}
        unit="pt"
        onChange={(bodyPt) => patch({ bodyPt })}
      />
      <p className="text-[11px] leading-[1.5] text-tool-ink-faint">
        제목 크기는 섹션 제목·이름·날짜처럼 제목 글꼴을 쓰는 글자에, 본문 크기는 나머지에
        적용됩니다. 섹션 하나만 다르게 하려면 그 섹션의 ‘스타일’ 탭에서 바꿀 수 있습니다.
      </p>
      <CustomFontUpload />
    </div>
  );
}

// 테마 색 덮어쓰기 — 고른 테마 위에 색만 바꾼다.
// ink-soft·구분선은 글자색과 배경색에서 자동으로 만들어지므로 여기서 고르지 않는다.
const PALETTE_FIELDS = [
  { key: "paper", label: "배경색" },
  { key: "ink", label: "글자색" },
  { key: "accent", label: "강조색" },
] as const;

function PaletteFields() {
  const themeId = useEditor((s) => s.doc.theme.id);
  const palette = useEditor((s) => s.doc.theme.palette);
  const dispatch = useEditor((s) => s.dispatch);
  const tokens = THEMES[themeId].tokens;
  const patch = (p: Record<string, string | undefined>) =>
    dispatch({ type: "updatePalette", patch: p });

  return (
    <div className="mt-6">
      <FieldLabel>색 직접 고르기</FieldLabel>
      <div className="space-y-2">
        {PALETTE_FIELDS.map((field) => {
          const overridden = palette[field.key] !== undefined;
          return (
            <div key={field.key} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={field.label}
                value={palette[field.key] ?? tokens[field.key]}
                onChange={(e) => patch({ [field.key]: e.target.value })}
                className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-tool-border bg-white p-0.5"
              />
              <span className="flex-1 text-[12px] text-tool-ink">{field.label}</span>
              <button
                type="button"
                disabled={!overridden}
                onClick={() => patch({ [field.key]: undefined })}
                className="text-[12px] text-tool-ink-soft underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
              >
                테마 기본값
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-[1.5] text-tool-ink-faint">
        흐린 글자색과 구분선은 글자색·배경색을 섞어 자동으로 맞춰집니다. 섹션 하나만 다르게 하려면
        그 섹션의 ‘스타일’ 탭에서 바꿀 수 있습니다.
      </p>
    </div>
  );
}

export function ThemeForm() {
  const current = useEditor((s) => s.doc.theme.id);
  const dispatch = useEditor((s) => s.dispatch);

  return (
    <div className="space-y-2">
      {THEME_ORDER.map((id) => {
        const theme = THEMES[id];
        const active = id === current;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => dispatch({ type: "setTheme", themeId: id })}
            className={clsx(
              "w-full rounded-md border p-3 text-left transition-colors",
              active
                ? "border-tool-accent ring-[3px] ring-tool-accent/15"
                : "border-tool-border hover:border-tool-border-strong",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-tool-ink">{theme.label}</span>
              <span className="flex gap-1">
                {[theme.tokens.paper, theme.tokens.accent, theme.tokens.ink].map((color, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="size-3 rounded-full border border-black/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            </span>
            <span className="mt-1 block text-[12px] leading-[1.5] text-tool-ink-soft">
              {theme.description}
            </span>
          </button>
        );
      })}
      <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
        테마는 디자인 토큰과 섹션 표현만 바꿉니다. 문구·사진·섹션 순서는 그대로 유지됩니다.
      </p>
      <PaletteFields />
      <TypographyFields />
      <MusicField />
    </div>
  );
}
