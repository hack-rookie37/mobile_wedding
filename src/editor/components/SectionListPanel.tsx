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
import { nanoid } from "nanoid";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Section } from "@/invitation/schema/document";
import { ADDABLE_SECTION_TYPES } from "@/invitation/schema/sectionDefaults";
import { DotsIcon, DragHandleIcon, EyeIcon, EyeOffIcon } from "@/ui/icons";
import { useEditor, useEditorStoreHandle } from "../EditorStoreContext";
import { SECTION_LABELS } from "../sectionMeta";
import type { EditorStore } from "../store";

const DND_SOURCE = "section-row";

function rowDragData(sectionId: string): Record<string | symbol, unknown> {
  return { source: DND_SOURCE, sectionId };
}

// 현재 문서 순서 기준으로 섹션을 delta만큼 이동 (키보드·메뉴 reorder 공용)
function moveSectionBy(store: EditorStore, sectionId: string, delta: -1 | 1): void {
  const ids = store.getState().doc.sections.map((s) => s.id);
  const from = ids.indexOf(sectionId);
  const to = from + delta;
  if (from <= 0 || to < 1 || to >= ids.length) return; // hero(0) 위·범위 밖 불가
  const order = [...ids];
  order.splice(from, 1);
  order.splice(to, 0, sectionId);
  store.getState().dispatch({ type: "reorderSections", order });
}

function MenuItem({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex h-8 w-full items-center px-3 text-left text-[13px] transition-colors",
        danger ? "text-tool-danger" : "text-tool-ink",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-tool-bg",
      )}
    >
      {children}
    </button>
  );
}

function RowIconButton({
  label,
  onClick,
  alwaysVisible = false,
  children,
}: {
  label: string;
  onClick: () => void;
  alwaysVisible?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={clsx(
        "flex size-6 shrink-0 items-center justify-center rounded text-tool-ink-faint transition-opacity hover:bg-black/5 hover:text-tool-ink focus-visible:opacity-100",
        alwaysVisible ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
      )}
    >
      {children}
    </button>
  );
}

function SectionRow({
  section,
  index,
  count,
  selected,
}: {
  section: Section;
  index: number;
  count: number;
  selected: boolean;
}) {
  const store = useEditorStoreHandle();
  const rowRef = useRef<HTMLDivElement>(null);
  const isHero = section.type === "hero";
  const [dragging, setDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const label = SECTION_LABELS[section.type];

  useEffect(() => {
    const element = rowRef.current;
    if (!element || isHero) return;
    const data = rowDragData(section.id);
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
          source.data.source === DND_SOURCE && source.data.sectionId !== section.id,
        getData: ({ input, element: el }) =>
          attachClosestEdge(data, { input, element: el, allowedEdges: ["top", "bottom"] }),
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [section.id, isHero]);

  const closeMenu = () => {
    setMenuOpen(false);
    setConfirmingDelete(false);
  };

  const handleDuplicate = () => {
    const newSectionId = nanoid();
    store
      .getState()
      .dispatch({ type: "duplicateSection", sourceSectionId: section.id, newSectionId });
    store.getState().dispatch({ type: "selectSection", sectionId: newSectionId });
    closeMenu();
  };

  return (
    <div
      ref={rowRef}
      data-section-row
      className={clsx(
        "group/row relative flex h-9 items-center gap-1 pr-2 pl-4 transition-colors",
        selected ? "bg-tool-accent-soft" : "hover:bg-tool-bg",
        dragging && "opacity-40",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "flex w-3.5 shrink-0 justify-center",
          isHero ? "text-transparent" : "cursor-grab text-tool-ink-faint",
        )}
      >
        {!isHero && <DragHandleIcon />}
      </span>

      <button
        type="button"
        data-row-select
        onClick={() => store.getState().dispatch({ type: "selectSection", sectionId: section.id })}
        onKeyDown={(e) => {
          if (isHero || !e.altKey) return;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            moveSectionBy(store, section.id, -1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            moveSectionBy(store, section.id, 1);
          }
        }}
        title={isHero ? undefined : "Alt+↑ / Alt+↓ 로 순서 변경"}
        className={clsx(
          "h-full min-w-0 flex-1 truncate text-left text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-tool-accent",
          selected ? "font-medium text-tool-accent" : "text-tool-ink",
          !section.visible && "text-tool-ink-faint",
        )}
      >
        {label}
      </button>

      {isHero ? (
        <span className="rounded border border-tool-border px-1 py-px text-[10px] leading-[1.4] text-tool-ink-faint">
          고정
        </span>
      ) : (
        <>
          <RowIconButton
            label={section.visible ? `${label} 숨기기` : `${label} 표시`}
            alwaysVisible={!section.visible}
            onClick={() =>
              store.getState().dispatch({ type: "toggleSectionVisibility", sectionId: section.id })
            }
          >
            {section.visible ? <EyeIcon /> : <EyeOffIcon />}
          </RowIconButton>
          <RowIconButton label={`${label} 섹션 메뉴`} onClick={() => setMenuOpen((v) => !v)}>
            <DotsIcon />
          </RowIconButton>
        </>
      )}

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeMenu} aria-hidden />
          <div
            role="menu"
            className="absolute top-full right-2 z-20 w-44 rounded-md border border-tool-border bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
            onKeyDown={(e) => e.key === "Escape" && closeMenu()}
          >
            {confirmingDelete ? (
              <div className="px-3 py-2">
                <p className="text-[12px] leading-[1.5] text-tool-ink">
                  ‘{label}’ 섹션을 삭제할까요?
                </p>
                <p className="mt-0.5 text-[11px] text-tool-ink-faint">
                  실행 취소로 되돌릴 수 있습니다.
                </p>
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="h-7 rounded-md border border-tool-border px-2.5 text-[12px] text-tool-ink hover:border-tool-border-strong"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      store.getState().dispatch({ type: "removeSection", sectionId: section.id });
                    }}
                    className="h-7 rounded-md bg-tool-danger px-2.5 text-[12px] font-medium text-white hover:opacity-90"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* rsvp는 최대 1개 (A-06) — 복제 불가 */}
                <MenuItem disabled={section.type === "rsvp"} onClick={handleDuplicate}>
                  복제
                </MenuItem>
                <MenuItem
                  disabled={index <= 1}
                  onClick={() => {
                    moveSectionBy(store, section.id, -1);
                    closeMenu();
                  }}
                >
                  위로 이동
                </MenuItem>
                <MenuItem
                  disabled={index >= count - 1}
                  onClick={() => {
                    moveSectionBy(store, section.id, 1);
                    closeMenu();
                  }}
                >
                  아래로 이동
                </MenuItem>
                <div aria-hidden className="my-1 h-px bg-tool-border" />
                <MenuItem danger onClick={() => setConfirmingDelete(true)}>
                  삭제
                </MenuItem>
              </>
            )}
          </div>
        </>
      )}

      {closestEdge && (
        <span
          aria-hidden
          className={clsx(
            "absolute inset-x-3 h-0.5 rounded-full bg-tool-accent",
            closestEdge === "top" ? "-top-px" : "-bottom-px",
          )}
        />
      )}
    </div>
  );
}

function globalRowClass(selected: boolean): string {
  return clsx(
    "flex h-9 w-full items-center gap-2 px-4 text-left text-[13px] transition-colors",
    selected
      ? "bg-tool-accent-soft font-medium text-tool-accent"
      : "text-tool-ink hover:bg-tool-bg",
  );
}

export function SectionListPanel() {
  const sections = useEditor((s) => s.doc.sections);
  const selected = useEditor((s) => s.selected);
  const store = useEditorStoreHandle();
  const [addOpen, setAddOpen] = useState(false);

  // 드래그 reorder: 드롭 시점의 실제 문서 순서 기준으로 순열을 계산 (stale index 방지)
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => source.data.source === DND_SOURCE,
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0];
          if (!target) return;
          const ids = store.getState().doc.sections.map((s) => s.id);
          const sourceId = source.data.sectionId as string;
          const targetId = target.data.sectionId as string;
          const from = ids.indexOf(sourceId);
          const targetIndex = ids.indexOf(targetId);
          if (from === -1 || targetIndex === -1) return;
          const edge = extractClosestEdge(target.data);
          let toIndex = edge === "bottom" ? targetIndex + 1 : targetIndex;
          if (from < toIndex) toIndex -= 1;
          toIndex = Math.max(1, toIndex); // hero(0) 위로는 불가 (A-05)
          if (toIndex === from) return;
          const order = [...ids];
          order.splice(from, 1);
          order.splice(toIndex, 0, sourceId);
          store.getState().dispatch({ type: "reorderSections", order });
        },
      }),
    [store],
  );

  const handleAdd = (sectionType: (typeof ADDABLE_SECTION_TYPES)[number]) => {
    const sectionId = nanoid();
    store.getState().dispatch({
      type: "addSection",
      sectionType,
      index: store.getState().doc.sections.length,
      sectionId,
    });
    store.getState().dispatch({ type: "selectSection", sectionId });
    setAddOpen(false);
  };

  return (
    <aside className="flex w-[264px] shrink-0 flex-col border-r border-tool-border bg-tool-surface">
      <div className="border-b border-tool-border py-2">
        <p className="px-4 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-tool-ink-faint uppercase">
          전역 설정
        </p>
        <button
          type="button"
          onClick={() => store.getState().select({ kind: "wedding" })}
          className={globalRowClass(selected.kind === "wedding")}
        >
          <span className="w-3.5" aria-hidden />
          기본 정보
        </button>
        <button
          type="button"
          onClick={() => store.getState().select({ kind: "theme" })}
          className={globalRowClass(selected.kind === "theme")}
        >
          <span className="w-3.5" aria-hidden />
          테마
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <p className="flex items-baseline justify-between px-4 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-tool-ink-faint uppercase">
          섹션 <span className="font-normal">{sections.length}</span>
        </p>
        {sections.map((section, index) => (
          <SectionRow
            key={section.id}
            section={section}
            index={index}
            count={sections.length}
            selected={selected.kind === "section" && selected.sectionId === section.id}
          />
        ))}
      </div>

      <div className="relative border-t border-tool-border p-3">
        {addOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} aria-hidden />
            <div
              role="menu"
              className="absolute inset-x-3 bottom-13 z-20 rounded-md border border-tool-border bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
            >
              {ADDABLE_SECTION_TYPES.map((type) => {
                // rsvp는 최대 1개 (A-06) — 이미 있으면 추가 비활성
                const alreadyAdded =
                  type === "rsvp" && sections.some((section) => section.type === "rsvp");
                return (
                  <MenuItem key={type} disabled={alreadyAdded} onClick={() => handleAdd(type)}>
                    {SECTION_LABELS[type]}
                    {alreadyAdded && " (추가됨)"}
                  </MenuItem>
                );
              })}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="h-8 w-full rounded-md border border-dashed border-tool-border-strong text-[13px] text-tool-ink-soft transition-colors hover:border-tool-accent hover:text-tool-accent"
        >
          + 섹션 추가
        </button>
      </div>
    </aside>
  );
}
