"use client";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type {
  GalleryPhoto,
  GallerySection as GallerySectionData,
  InvitationDocument,
  PhotoFrame,
} from "@/invitation/schema/document";
import { galleryItemAspect } from "@/renderer/sections/GallerySection";
import { FieldLabel, SegmentedField, TextField } from "@/ui/fields";
import { DragHandleIcon } from "@/ui/icons";
import { useAssetLibrary } from "../../assets/AssetLibraryContext";
import { useEditor, useEditorStoreHandle } from "../../EditorStoreContext";
import { FrameEditor } from "../media/FrameEditor";
import { MediaLibraryDialog, type MediaPickMode } from "../media/MediaLibraryDialog";

const MAX_PHOTOS = 30; // 스키마 상한과 동일
const DND_SOURCE = "gallery-photo";

// 갤러리 편집기 — 모든 변경은 action(dispatch) 경유:
// 순서는 moveGalleryPhoto, caption·alt·frame은 updateGalleryPhoto,
// 추가·교체는 assignAsset, 삭제는 removeAssetReference.
export function GalleryForm({ section }: { section: GallerySectionData }) {
  const dispatch = useEditor((s) => s.dispatch);
  const store = useEditorStoreHandle();
  const [picker, setPicker] = useState<MediaPickMode | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const photos = section.content.photos;
  const sectionId = section.id;

  const patchContent = (patch: Record<string, unknown>) =>
    dispatch({ type: "updateSectionContent", sectionId, patch });

  const movePhoto = (from: number, to: number) => {
    const current = currentPhotos(store.getState().doc, sectionId);
    if (!current || to < 0 || to >= current.length || from === to) return;
    dispatch({ type: "moveGalleryPhoto", sectionId, from, to });
    setExpandedIndex((expanded) => (expanded === from ? to : null));
  };

  // 드래그 reorder: 드롭 시점의 실제 photos 기준으로 이동을 계산 (섹션 목록과 같은 패턴)
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) =>
          source.data.source === DND_SOURCE && source.data.sectionId === sectionId,
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0];
          if (!target) return;
          const current = currentPhotos(store.getState().doc, sectionId);
          if (!current) return;
          const from = source.data.index as number;
          const targetIndex = target.data.index as number;
          const edge = extractClosestEdge(target.data);
          let to = edge === "bottom" ? targetIndex + 1 : targetIndex;
          if (from < to) to -= 1;
          if (from === to || from >= current.length || to >= current.length) return;
          dispatch({ type: "moveGalleryPhoto", sectionId, from, to });
          setExpandedIndex(null);
        },
      }),
    [store, dispatch, sectionId],
  );

  return (
    <div className="space-y-4">
      <TextField
        label="제목"
        value={section.content.title}
        onChange={(title) => patchContent({ title })}
      />

      {section.layout.variant === "strip" && (
        <SegmentedField
          label="사진 세로 길이"
          value={section.content.photoAspect}
          options={[
            { value: "1/1", label: "1:1" },
            { value: "4/5", label: "4:5" },
            { value: "3/4", label: "3:4" },
            { value: "9/16", label: "9:16" },
          ]}
          onChange={(photoAspect) => patchContent({ photoAspect })}
        />
      )}

      <div>
        <FieldLabel>
          사진 {photos.length} / {MAX_PHOTOS}
        </FieldLabel>
        {photos.length === 0 && (
          <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
            아직 사진이 없습니다. 아래에서 사진을 추가하세요.
          </p>
        )}
        <ul className="space-y-1" aria-label="갤러리 사진 목록">
          {photos.map((photo, index) => (
            <PhotoRow
              key={`${photo.assetId}-${index}`}
              photo={photo}
              index={index}
              count={photos.length}
              sectionId={sectionId}
              variant={section.layout.variant}
              photoAspect={section.content.photoAspect}
              expanded={expandedIndex === index}
              onToggleExpand={() =>
                setExpandedIndex((current) => (current === index ? null : index))
              }
              onMove={(delta) => movePhoto(index, index + delta)}
              onReplace={() => setPicker({ kind: "gallery-replace", sectionId, index })}
              onDelete={() => {
                setExpandedIndex(null);
                dispatch({
                  type: "removeAssetReference",
                  sectionId,
                  slot: { kind: "galleryItem", index },
                });
              }}
              onPatchPhoto={(patch) =>
                dispatch({ type: "updateGalleryPhoto", sectionId, index, patch })
              }
            />
          ))}
        </ul>
        <button
          type="button"
          disabled={photos.length >= MAX_PHOTOS}
          onClick={() =>
            setPicker({
              kind: "gallery-add",
              sectionId,
              remainingSlots: MAX_PHOTOS - photos.length,
            })
          }
          className="mt-2 h-8 w-full rounded-md border border-dashed border-tool-border-strong text-[13px] text-tool-ink-soft transition-colors hover:border-tool-accent hover:text-tool-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          + 사진 추가
        </button>
      </div>

      {picker !== null && <MediaLibraryDialog mode={picker} onClose={() => setPicker(null)} />}
    </div>
  );
}

function currentPhotos(doc: InvitationDocument, sectionId: string): GalleryPhoto[] | null {
  const section = doc.sections.find((s) => s.id === sectionId);
  return section?.type === "gallery" ? section.content.photos : null;
}

function PhotoRow({
  photo,
  index,
  count,
  sectionId,
  variant,
  photoAspect,
  expanded,
  onToggleExpand,
  onMove,
  onReplace,
  onDelete,
  onPatchPhoto,
}: {
  photo: GalleryPhoto;
  index: number;
  count: number;
  sectionId: string;
  variant: GallerySectionData["layout"]["variant"];
  photoAspect: GallerySectionData["content"]["photoAspect"];
  expanded: boolean;
  onToggleExpand: () => void;
  onMove: (delta: -1 | 1) => void;
  onReplace: () => void;
  onDelete: () => void;
  onPatchPhoto: (patch: { alt?: string; caption?: string; frame?: PhotoFrame | null }) => void;
}) {
  const { resolveAsset } = useAssetLibrary();
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const asset = resolveAsset(photo.assetId);
  const label = photo.caption || photo.alt || `사진 ${index + 1}`;

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;
    const data: Record<string | symbol, unknown> = { source: DND_SOURCE, sectionId, index };
    return combine(
      draggable({
        element,
        getInitialData: () => data,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) =>
          source.data.source === DND_SOURCE &&
          source.data.sectionId === sectionId &&
          source.data.index !== index,
        getData: ({ input, element: el }) =>
          attachClosestEdge(data, { input, element: el, allowedEdges: ["top", "bottom"] }),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [sectionId, index]);

  return (
    <li className="rounded-md border border-tool-border">
      <div
        ref={rowRef}
        data-photo-row
        className={clsx(
          "relative flex h-11 items-center gap-1.5 rounded-md pr-1.5 pl-2",
          expanded ? "bg-tool-accent-soft" : "hover:bg-tool-bg",
          dragging && "opacity-40",
        )}
      >
        <span
          aria-hidden
          className="flex w-3.5 shrink-0 cursor-grab justify-center text-tool-ink-faint"
        >
          <DragHandleIcon />
        </span>
        {asset !== null ? (
          <img
            src={asset.src}
            alt=""
            className="size-7 shrink-0 rounded border border-tool-border object-cover"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded border border-tool-border bg-tool-bg-deep text-[8px] leading-[1.2] text-tool-ink-faint">
            없음
          </span>
        )}
        <button
          type="button"
          data-photo-select
          onClick={onToggleExpand}
          onKeyDown={(e) => {
            if (!e.altKey) return;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              onMove(-1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              onMove(1);
            }
          }}
          title="Alt+↑ / Alt+↓ 로 순서 변경"
          aria-expanded={expanded}
          className="h-full min-w-0 flex-1 truncate text-left text-[12px] text-tool-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tool-accent"
        >
          {label}
        </button>
        <button
          type="button"
          aria-label={`${index + 1}번째 사진 교체`}
          onClick={onReplace}
          className="min-h-6 shrink-0 rounded px-1.5 py-1 text-[11px] text-tool-ink-soft hover:bg-black/5 hover:text-tool-ink"
        >
          교체
        </button>
        <button
          type="button"
          aria-label={`${index + 1}번째 사진 삭제`}
          title="삭제 (실행 취소 가능)"
          onClick={onDelete}
          className="min-h-6 shrink-0 rounded px-1.5 py-1 text-[11px] text-tool-danger hover:bg-tool-danger/8"
        >
          삭제
        </button>
        {closestEdge && (
          <span
            aria-hidden
            className={clsx(
              "absolute inset-x-2 h-0.5 rounded-full bg-tool-accent",
              closestEdge === "top" ? "-top-px" : "-bottom-px",
            )}
          />
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-tool-border px-2.5 py-3">
          <TextField
            label="캡션 (사진 아래 표시)"
            value={photo.caption ?? ""}
            onChange={(caption) => onPatchPhoto({ caption })}
          />
          <TextField
            label="대체 텍스트 (스크린리더용)"
            value={photo.alt ?? ""}
            onChange={(alt) => onPatchPhoto({ alt })}
          />
          <FrameEditor
            asset={asset}
            frame={photo.frame}
            aspectRatio={galleryItemAspect(count === 1 ? "single" : variant, index, photoAspect)}
            onChange={(frame) => onPatchPhoto({ frame: frame ?? null })}
          />
        </div>
      )}
    </li>
  );
}
