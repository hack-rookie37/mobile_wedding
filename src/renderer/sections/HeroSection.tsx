"use client";

import type { CSSProperties } from "react";
import type {
  HeroOverlay,
  HeroSection as HeroSectionData,
  Wedding,
} from "@/invitation/schema/document";
import { fontCssOf } from "@/invitation/schema/themes";
import { formatWeddingDate } from "../format";
import { FullBleedPhoto } from "../primitives/FullBleedPhoto";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

const OVERLAY_ALIGN: Record<HeroOverlay["position"], CSSProperties["alignItems"]> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

// 사진 위 문구 — 사진 밖으로 흘러넘치지 않게 사진과 같은 칸에 겹쳐 놓는다.
// 밝기·투명도(effects)를 먹은 사진 위에 그리되 글자는 그 필터를 받지 않는다:
// 사진을 어둡게 깔고 글자는 또렷하게 두는 것이 이 문구를 쓰는 이유다.
function PhotoOverlay({ overlay }: { overlay: HeroOverlay }) {
  return (
    <div
      data-hero-overlay
      className="pointer-events-none absolute inset-0 flex justify-center px-8 py-10"
      style={{ alignItems: OVERLAY_ALIGN[overlay.position] }}
    >
      <p
        className="text-center leading-[1.45] break-keep whitespace-pre-line"
        style={{
          // pt를 그대로 쓴다 — 캔버스의 pt 환산(96/72)과 결과가 같고, 사진 위 크기는
          // 전역 글자 크기를 따라 흔들리지 않아야 한다
          fontSize: `${overlay.sizePt}pt`,
          fontFamily: fontCssOf(overlay.font) ?? "var(--canvas-font-heading)",
          color: overlay.color,
          textShadow: "0 1px 10px rgba(0,0,0,0.4)", // 밝은 사진 위에서도 읽히도록
        }}
      >
        {overlay.text}
      </p>
    </div>
  );
}

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
      <div className="relative">
        <FullBleedPhoto
          asset={content.photoAssetId !== null ? resolveAsset(content.photoAssetId) : null}
          alt="대표 사진"
          aspect={content.photoAspect}
          effects={content.effects}
          frame={content.photoFrame}
          fadeColor={section.style.background ?? "var(--canvas-paper)"}
          eager
        />
        {content.overlay.text !== "" && <PhotoOverlay overlay={content.overlay} />}
      </div>
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
