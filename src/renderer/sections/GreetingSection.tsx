"use client";

import clsx from "clsx";
import type { GreetingSection as GreetingSectionData, Wedding } from "@/invitation/schema/document";
import { parentsLineOf } from "../format";
import { BodyText } from "../primitives/BodyText";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

// 눈썹 라벨 위 장식 이미지 — 사용자가 올린 리본·문양 등을 인사말 머리에 얹는다.
// 크기는 높이 하나로 고른다: 폭은 원본 비율을 따라오고, 캔버스를 넘치면 max-width가
// 잡는다 — 그때는 object-contain이 비율을 지킨 채 상자 안에 들어간다(찌그러짐 없음).
// 높이를 지정하므로 이미지가 도착하기 전에도 칸이 잡혀 아래 글이 밀리지 않는다.
function GreetingOrnament({
  assetId,
  heightPx,
  className,
}: {
  assetId: string | null;
  heightPx: number;
  className?: string;
}) {
  const { resolveAsset } = useRenderer();
  if (assetId === null) return null;
  const asset = resolveAsset(assetId);
  if (asset === null) return null;
  return (
    <img
      src={asset.src}
      alt=""
      width={asset.width}
      height={asset.height}
      style={{ height: `${heightPx}px` }}
      className={clsx("block w-auto max-w-full object-contain", className)}
    />
  );
}

function ParentsLine({ person, className }: { person: Wedding["groom"]; className?: string }) {
  const line = parentsLineOf(person);
  if (!line) return null;
  return (
    <p
      className={clsx(
        "text-[length:calc(15px*var(--canvas-fs))] leading-[1.9] text-(--canvas-ink)",
        className,
      )}
    >
      {line.parents}
      <span className="mr-1.5 text-[length:calc(14px*var(--canvas-fs))] text-(--canvas-ink-soft)">
        의
      </span>
      {line.relation !== "" && (
        <span className="mr-1.5 text-[length:calc(13px*var(--canvas-fs))] text-(--canvas-ink-soft)">
          {line.relation}
        </span>
      )}
      <span className="font-medium">{line.name}</span>
    </p>
  );
}

export function GreetingSection({
  section,
  wedding,
  index,
}: {
  section: GreetingSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { theme } = useRenderer();
  const { content } = section;
  const variant = theme.variants.greeting;

  if (variant === "mono") {
    return (
      <SectionShell section={section} index={index}>
        <GreetingOrnament
          assetId={content.ornamentAssetId}
          heightPx={content.ornamentHeightPx}
          className="mb-5"
        />
        <SectionHeader label={content.label} title={content.title} index={index} />
        <div className="mt-7">
          <BodyText text={content.body} align={content.align} />
        </div>
        {content.showParents && (
          <div className="mt-9" style={{ borderBottom: "1px solid var(--canvas-line)" }}>
            {(
              [
                ["신랑측", wedding.groom],
                ["신부측", wedding.bride],
              ] as const
            ).map(([label, person]) => (
              <div
                key={label}
                className="flex items-baseline gap-5 py-3"
                style={{ borderTop: "1px solid var(--canvas-line)" }}
              >
                <span className="w-12 shrink-0 text-[length:calc(10px*var(--canvas-fs))] font-medium tracking-[0.14em] text-(--canvas-ink-soft)">
                  {label}
                </span>
                <ParentsLine
                  person={person}
                  className="text-[length:calc(14px*var(--canvas-fs))]"
                />
              </div>
            ))}
          </div>
        )}
      </SectionShell>
    );
  }

  if (variant === "film") {
    return (
      <SectionShell section={section} index={index}>
        <GreetingOrnament
          assetId={content.ornamentAssetId}
          heightPx={content.ornamentHeightPx}
          className="mb-5"
        />
        <SectionHeader label={content.label} title={content.title} index={index} />
        <div className="mt-6">
          <BodyText text={content.body} align={content.align} />
        </div>
        {content.showParents && (
          <>
            <div
              aria-hidden
              className="mt-9 border-t border-dashed"
              style={{ borderColor: "var(--canvas-line)" }}
            />
            <div className="mt-7 space-y-1 text-center">
              <ParentsLine person={wedding.groom} />
              <ParentsLine person={wedding.bride} />
            </div>
          </>
        )}
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} index={index}>
      <div className="flex flex-col items-center">
        <GreetingOrnament
          assetId={content.ornamentAssetId}
          heightPx={content.ornamentHeightPx}
          className="mb-5"
        />
        <SectionHeader label={content.label} title={content.title} index={index} />
        <div className="mt-8 w-full">
          <BodyText text={content.body} align={content.align} />
        </div>
        {content.showParents && (
          <>
            <div aria-hidden className="mt-10 h-px w-6 bg-(--canvas-line)" />
            <div className="mt-8 text-center">
              <ParentsLine person={wedding.groom} />
              <ParentsLine person={wedding.bride} />
            </div>
          </>
        )}
      </div>
    </SectionShell>
  );
}
