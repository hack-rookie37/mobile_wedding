"use client";

import type {
  TransportationSection as TransportationSectionData,
  TransportIcon,
} from "@/invitation/schema/document";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

export const TRANSPORT_ICON_LABELS: Record<TransportIcon, string> = {
  subway: "지하철",
  bus: "버스",
  car: "자가용",
  parking: "주차",
  shuttle: "셔틀",
  etc: "기타",
};

const TRANSPORT_ICON_GLYPHS: Record<TransportIcon, string> = {
  subway: "🚇",
  bus: "🚌",
  car: "🚗",
  parking: "🅿️",
  shuttle: "🚐",
  etc: "📍",
};

export function TransportationSection({
  section,
  index,
}: {
  section: TransportationSectionData;
  index: number;
}) {
  const { mode } = useRenderer();
  const { content, layout } = section;
  const cards = layout.variant === "cards";

  return (
    <SectionShell section={section} index={index}>
      <SectionHeader label="TRANSPORT" title={content.title} index={index} />
      {content.items.length === 0 && mode === "editor-edit" && (
        <p className="mt-6 text-center text-[12px] text-(--canvas-ink-soft)">
          오른쪽 패널에서 교통 안내 항목을 추가하세요.
        </p>
      )}
      <ul className={cards ? "mt-8 grid grid-cols-2 gap-3" : "mt-8 space-y-6"}>
        {content.items.map((item, itemIndex) => (
          <li
            key={itemIndex}
            data-transport-item
            className={cards ? "min-w-0 rounded-md p-4" : "flex min-w-0 gap-3.5"}
            style={cards ? { border: "1px solid var(--canvas-line)" } : undefined}
          >
            <span
              aria-hidden
              className={
                cards
                  ? "block text-[18px] leading-none"
                  : "flex size-9 shrink-0 items-center justify-center rounded-full text-[15px]"
              }
              style={cards ? undefined : { backgroundColor: "var(--canvas-line)" }}
            >
              {TRANSPORT_ICON_GLYPHS[item.icon]}
            </span>
            <div className={cards ? "mt-2.5 min-w-0" : "min-w-0 flex-1 pt-1"}>
              <p className="text-[13.5px] leading-[1.5] font-semibold break-keep text-(--canvas-ink)">
                {item.title !== "" ? item.title : TRANSPORT_ICON_LABELS[item.icon]}
              </p>
              <p className="mt-1 text-[13px] leading-[1.8] break-keep whitespace-pre-line text-(--canvas-ink-soft)">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
