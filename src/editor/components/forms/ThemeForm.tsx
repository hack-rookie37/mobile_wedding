"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import {
  ALLOWED_AUDIO_TYPES,
  formatBytes,
  validateAudioFile,
} from "@/invitation/assets/uploadPolicy";
import { FONT_CHOICES, THEME_ORDER, THEMES } from "@/invitation/schema/themes";
import { FieldLabel, SegmentedField, SelectField } from "@/ui/fields";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor } from "../../EditorStoreContext";

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
          {busy ? "업로드 중…" : "음악 파일 업로드 (MP3·M4A, 최대 10MB)"}
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

  const fontOptions = [
    { value: "theme", label: "테마 기본" },
    ...Object.entries(FONT_CHOICES).map(([value, font]) => ({ value, label: font.label })),
  ];

  return (
    <div className="mt-6 space-y-4">
      <FieldLabel>폰트</FieldLabel>
      <SelectField
        label="제목·이름 폰트"
        value={typography.headingFont}
        options={fontOptions}
        onChange={(headingFont) => patch({ headingFont })}
      />
      <SelectField
        label="본문 폰트"
        value={typography.bodyFont}
        options={fontOptions}
        onChange={(bodyFont) => patch({ bodyFont })}
      />
      <SegmentedField
        label="전체 글자 크기"
        value={typography.scale}
        options={[
          { value: "sm", label: "작게" },
          { value: "md", label: "보통" },
          { value: "lg", label: "크게" },
        ]}
        onChange={(scale) => patch({ scale })}
      />
      <p className="text-[11px] leading-[1.5] text-tool-ink-faint">
        섹션 하나만 다르게 하려면 해당 섹션의 ‘스타일’ 탭에서 바꿀 수 있습니다.
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
      <TypographyFields />
      <MusicField />
    </div>
  );
}
