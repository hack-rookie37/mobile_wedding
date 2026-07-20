"use client";

import { useEffect, useRef } from "react";
import { InvitationRenderer } from "@/renderer/InvitationRenderer";
import { useAssetLibrary } from "../assets/AssetLibraryContext";
import { useEditor, useEditorStoreHandle } from "../EditorStoreContext";

export function PreviewCanvas() {
  const { resolveAsset, assets } = useAssetLibrary();
  const doc = useEditor((s) => s.doc);
  const musicAssetId = doc.music.assetId;
  const musicUrl =
    musicAssetId !== null
      ? (assets.find((a) => a.record.id === musicAssetId)?.fullUrl ?? null)
      : null;
  const motionReplay = useEditor((s) => s.motionReplay);
  // 업로드 폰트 파일 URL — 렌더러가 @font-face를 직접 선언한다
  const resolveFontUrl = (assetId: string) => {
    const asset = assets.find((a) => a.record.id === assetId);
    return asset !== undefined && asset.record.kind === "font" ? asset.fullUrl : null;
  };
  const selected = useEditor((s) => s.selected);
  const width = useEditor((s) => s.previewWidth);
  const mode = useEditor((s) => s.previewMode);
  const store = useEditorStoreHandle();
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressScrollRef = useRef(false);

  const selectedSectionId = selected.kind === "section" ? selected.sectionId : null;

  // 선택 변경 → 미리보기를 해당 섹션으로 이동.
  // 미리보기 클릭으로 생긴 선택은 이미 화면에 보이므로 스크롤을 억제한다.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false;
      return;
    }
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    if (selectedSectionId === null) {
      container.scrollTo({ top: 0, behavior });
      return;
    }
    container
      .querySelector(`[data-section-id="${selectedSectionId}"]`)
      ?.scrollIntoView({ behavior, block: "start" });
  }, [selected, selectedSectionId]);

  const editMode = mode === "edit";

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center overflow-hidden bg-tool-bg px-8 py-5">
      <div className="flex min-h-0 w-full flex-1 justify-center">
        <div
          ref={scrollRef}
          data-preview-frame
          style={{ width }}
          className="min-h-0 shrink-0 overflow-y-auto rounded-lg border border-tool-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        >
          <InvitationRenderer
            doc={doc}
            mode={editMode ? "editor-edit" : "published"}
            resolveAsset={resolveAsset}
            musicUrl={musicUrl}
            resolveFontUrl={resolveFontUrl}
            motionReplay={editMode ? motionReplay : null}
            selectedSectionId={editMode ? selectedSectionId : null}
            onSectionSelect={
              editMode
                ? (sectionId) => {
                    suppressScrollRef.current = true;
                    store.getState().dispatch({ type: "selectSection", sectionId });
                  }
                : undefined
            }
          />
        </div>
      </div>
      <p className="pt-3 text-[11px] text-tool-ink-faint">
        모바일 미리보기 · {width}px{editMode ? "" : " · 인터랙션 모드"}
      </p>
    </div>
  );
}
