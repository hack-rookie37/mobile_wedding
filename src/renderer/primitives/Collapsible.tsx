"use client";

import { useId, useState, type ReactNode } from "react";
import { useRenderer } from "../RendererContext";
import { roleStyle } from "../textRoles";

// 접기/펼치기 그룹 (연락처·마음 전하실 곳 공용).
// 편집 모드에서는 항상 펼쳐서 제작자가 내용을 바로 확인하게 하고,
// published 모드에서만 버튼으로 동작한다 — 키보드는 native button이 보장한다.
export function Collapsible({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { mode } = useRenderer();
  const interactive = mode === "published";
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const expanded = !interactive || open;

  return (
    <div className="overflow-hidden rounded-md" style={{ border: "1px solid var(--canvas-line)" }}>
      <button
        type="button"
        disabled={!interactive}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between px-4 text-left"
      >
        <span
          style={roleStyle("itemTitle", {
            size: "calc(13px * var(--canvas-fs-item))",
            weight: "500",
            tracking: "0.02em",
          })}
        >
          {summary}
        </span>
        {interactive && (
          <span
            aria-hidden
            className="text-[length:calc(11px*var(--canvas-fs))] text-(--canvas-ink-soft) transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          >
            ▾
          </span>
        )}
      </button>
      {expanded && (
        <div id={panelId} style={{ borderTop: "1px solid var(--canvas-line)" }}>
          {children}
        </div>
      )}
    </div>
  );
}
