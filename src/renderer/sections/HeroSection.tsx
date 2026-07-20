"use client";

import type { HeroSection as HeroSectionData, Wedding } from "@/invitation/schema/document";
import { formatWeddingDate } from "../format";
import { FullBleedPhoto } from "../primitives/FullBleedPhoto";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

// 메인은 전면 사진 단일 레이아웃이다 — 사진이 캔버스 가로를 꽉 채우고 맨 위에 붙는다.
// 테마 차이는 canvas 토큰(폰트·색·여백)으로만 나타나고, 연출은 content.effects가 정한다.
export function HeroSection({
  section,
  wedding,
  index,
}: {
  section: HeroSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { resolveAsset } = useRenderer();
  const { content } = section;
  const venueLine = [wedding.venue.name, wedding.venue.hall].filter(Boolean).join(" ");

  return (
    <SectionShell section={section} index={index} flushTop>
      <FullBleedPhoto
        asset={content.photoAssetId !== null ? resolveAsset(content.photoAssetId) : null}
        alt="대표 사진"
        aspect={content.photoAspect}
        effects={content.effects}
        frame={content.photoFrame}
        fadeColor={section.style.background ?? "var(--canvas-paper)"}
        eager
      />
      <div className="flex flex-col items-center px-6 text-center">
        {content.tagline !== "" && (
          <p className="mt-7 text-[length:calc(11px*var(--canvas-fs))] font-medium tracking-[0.24em] text-(--canvas-accent)">
            {content.tagline}
          </p>
        )}
        <h1
          className={`${content.tagline !== "" ? "mt-4" : "mt-7"} font-(family-name:--canvas-font-heading) text-[length:calc(26px*var(--canvas-fs-heading))] leading-[1.4] font-semibold tracking-[-0.01em] text-(--canvas-ink)`}
        >
          {wedding.groom.name}
          <span className="mx-2.5 text-[length:calc(20px*var(--canvas-fs))] font-normal text-(--canvas-accent)">
            ·
          </span>
          {wedding.bride.name}
        </h1>
        {(content.showDate || content.showVenue) && (
          <div className="mt-5 space-y-1">
            {content.showDate && (
              <p className="text-[length:calc(15px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink-soft)">
                {formatWeddingDate(wedding.datetime)}
              </p>
            )}
            {content.showVenue && (
              <p className="text-[length:calc(15px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink-soft)">
                {venueLine}
              </p>
            )}
          </div>
        )}
      </div>
    </SectionShell>
  );
}
