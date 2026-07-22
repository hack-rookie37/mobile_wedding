"use client";

import { withEmojiPresentation } from "@/invitation/lib/emoji";
import type {
  TransportationSection as TransportationSectionData,
  TransportIcon,
  TransportItem,
} from "@/invitation/schema/document";
import { Collapsible } from "../primitives/Collapsible";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";
import { roleStyle } from "../textRoles";

export const TRANSPORT_ICON_LABELS: Record<TransportIcon, string> = {
  subway: "지하철",
  bus: "버스",
  car: "자가용",
  parking: "주차",
  shuttle: "셔틀",
  etc: "기타",
};

export const TRANSPORT_ICON_GLYPHS: Record<TransportIcon, string> = {
  subway: "🚇",
  bus: "🚌",
  car: "🚗",
  parking: "🅿️",
  shuttle: "🚐",
  etc: "📍",
};

// 항목이 스스로 정한 그림이 있으면 그것을, 없으면 고른 수단의 기본 그림을 쓴다.
// 직접 넣은 그림은 표시 지정자를 정규화한다 — ☎처럼 지정자 없이 들어온 옛 기호가
// 작은 흑백 활자로 그려져 다른 그림과 크기가 어긋나는 것을 막는다.
export function transportGlyph(item: TransportItem): string {
  return item.emoji !== "" ? withEmojiPresentation(item.emoji) : TRANSPORT_ICON_GLYPHS[item.icon];
}

function transportTitle(item: TransportItem): string {
  return item.title !== "" ? item.title : TRANSPORT_ICON_LABELS[item.icon];
}

function Body({ text }: { text: string }) {
  return (
    <p className="text-[length:calc(13px*var(--canvas-fs))] leading-[1.8] break-keep whitespace-pre-line text-(--canvas-ink-soft)">
      {text}
    </p>
  );
}

function Title({ text }: { text: string }) {
  return (
    <p
      className="break-keep"
      style={roleStyle("itemTitle", {
        size: "calc(13.5px * var(--canvas-fs-item))",
        weight: "600",
        leading: "1.5",
      })}
    >
      {text}
    </p>
  );
}

export function TransportationSection({
  section,
  index,
}: {
  section: TransportationSectionData;
  index: number;
}) {
  const { mode } = useRenderer();
  const { content, layout } = section;

  const empty = content.items.length === 0 && mode === "editor-edit" && (
    <p className="mt-6 text-center text-[length:calc(12px*var(--canvas-fs))] text-(--canvas-ink-soft)">
      오른쪽 패널에서 교통 안내 항목을 추가하세요.
    </p>
  );

  const header = (
    <>
      <SectionHeader label={content.label} title={content.title} index={index} />
      {empty}
    </>
  );

  // 접이식 — 수단 줄만 늘어놓고, 누른 항목의 안내만 아래로 펼친다.
  // 항목이 많아도 화면이 길어지지 않는다 (연락처·마음 전하실 곳과 같은 동작).
  if (layout.variant === "accordion") {
    return (
      <SectionShell section={section} index={index}>
        {header}
        <div className="mt-8 space-y-2">
          {content.items.map((item, itemIndex) => (
            <div key={itemIndex} data-transport-item>
              <Collapsible
                summary={
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden>{transportGlyph(item)}</span>
                    {transportTitle(item)}
                  </span>
                }
              >
                <div className="px-4 py-3.5">
                  <Body text={item.body} />
                </div>
              </Collapsible>
            </div>
          ))}
        </div>
      </SectionShell>
    );
  }

  // 카드 격자 — 열 수는 섹션 설정을 따른다. 리스트는 언제나 한 줄에 하나다.
  const cards = layout.variant === "cards";

  return (
    <SectionShell section={section} index={index}>
      {header}
      <ul
        className={cards ? "mt-8 grid gap-3" : "mt-8 space-y-6"}
        style={
          cards ? { gridTemplateColumns: `repeat(${content.columns}, minmax(0, 1fr))` } : undefined
        }
      >
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
                  ? "block text-[length:calc(18px*var(--canvas-fs))] leading-none"
                  : "flex size-9 shrink-0 items-center justify-center rounded-full text-[length:calc(15px*var(--canvas-fs))]"
              }
              style={cards ? undefined : { backgroundColor: "var(--canvas-line)" }}
            >
              {transportGlyph(item)}
            </span>
            <div className={cards ? "mt-2.5 min-w-0" : "min-w-0 flex-1 pt-1"}>
              <Title text={transportTitle(item)} />
              <div className="mt-1">
                <Body text={item.body} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
