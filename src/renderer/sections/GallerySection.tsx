"use client";

import clsx from "clsx";
import { useState } from "react";
import type { GallerySection as GallerySectionData } from "@/invitation/schema/document";
import { PHOTO_ASPECT_CSS, PhotoFrame } from "../primitives/PhotoFrame";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";
import { GalleryLightbox } from "./GalleryLightbox";

// film 테마의 폴라로이드 기울기 — 규칙적인 순환이라 반응형 그리드 안에서 안전하다
const FILM_TILTS = ["rotate-[1.4deg]", "-rotate-[1.6deg]", "rotate-[0.7deg]", "-rotate-[0.9deg]"];

// srcset 선택용 표시 폭 힌트 — canvas 최대 폭 430px 기준 고정값 (renderer에서 vw 금지)
const SIZES = {
  single: "300px",
  strip: "380px",
  grid2: "215px",
  grid3: "144px",
  slider: "300px",
  filmstrip: "260px",
  collageFull: "430px",
  collageHalf: "215px",
} as const;

export type GalleryLayoutKind = "single" | GallerySectionData["layout"]["variant"];

// 편집기 crop 미리보기도 실제 표시 비율을 재사용한다 (표시 비율의 단일 소스).
// photoAspect는 strip에서만 쓰인다 — 다른 레이아웃은 고정 비율.
export function galleryItemAspect(
  kind: GalleryLayoutKind,
  index: number,
  photoAspect: GallerySectionData["content"]["photoAspect"],
): string {
  switch (kind) {
    case "strip":
      return PHOTO_ASPECT_CSS[photoAspect];
    case "single":
    case "slider":
      return "4 / 5";
    case "filmstrip":
      return "4 / 3";
    case "collage":
      return index % 3 === 0 ? "3 / 2" : "1 / 1";
    default:
      return "1 / 1";
  }
}

function itemSizes(kind: GalleryLayoutKind, index: number): string {
  if (kind === "collage") return index % 3 === 0 ? SIZES.collageFull : SIZES.collageHalf;
  return SIZES[kind];
}

export function GallerySection({ section, index }: { section: GallerySectionData; index: number }) {
  const { resolveAsset, theme, mode } = useRenderer();
  const { content } = section;
  const flavor = theme.variants.gallery; // editorial | mono | film — 테마의 결
  const photos = content.photos;
  const single = photos.length === 1;
  const kind: GalleryLayoutKind = single ? "single" : section.layout.variant;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const interactive = mode === "published"; // 편집 모드의 클릭은 섹션 선택에 사용된다

  const isGrid = kind === "grid2" || kind === "grid3" || kind === "collage";
  const scroller = kind === "slider" || kind === "filmstrip" || kind === "strip";
  // strip은 풀블리드 대형 스트립 — 장식(폴라로이드·기울기) 없이 사진 자체를 크게 보여준다
  const treatment =
    kind === "filmstrip" || kind === "strip" ? "plain" : theme.variants.photoTreatment;
  const tilt = flavor === "film" && kind !== "filmstrip" && kind !== "single" && kind !== "strip";

  const containerClass = clsx(
    kind === "single" && "flex justify-center",
    scroller && "flex snap-x snap-mandatory overflow-x-auto pb-2",
    kind === "strip" && "gap-0.5",
    kind === "slider" && (flavor === "film" ? "gap-5" : "gap-3"),
    kind === "filmstrip" && "gap-2.5 px-3 py-2.5",
    isGrid && "grid grid-cols-2",
    kind === "grid3" && "grid-cols-3",
    isGrid &&
      (flavor === "mono"
        ? "gap-px"
        : flavor === "film"
          ? "gap-4"
          : kind === "grid3"
            ? "gap-1.5"
            : "gap-2"),
  );

  const items = photos.map((photo, i) => {
    const caption = photo.caption ?? "";
    const showCaption = caption !== "" && kind !== "grid3";
    const photoBox = (
      <PhotoFrame
        asset={resolveAsset(photo.assetId)}
        alt={photo.alt ?? ""}
        shape={flavor === "mono" || kind === "filmstrip" || kind === "strip" ? "rect" : "soft"}
        treatment={treatment}
        aspectRatio={galleryItemAspect(kind, i, content.photoAspect)}
        sizes={itemSizes(kind, i)}
        frame={photo.frame}
      />
    );
    return (
      <figure
        key={`${photo.assetId}-${i}`}
        className={clsx(
          kind === "single" && "w-full max-w-[300px]",
          kind === "strip" && "w-[88%] shrink-0 snap-center",
          kind === "slider" && "w-[70%] shrink-0 snap-center",
          kind === "filmstrip" && "w-[62%] shrink-0 snap-center",
          kind === "collage" && i % 3 === 0 && "col-span-2",
          tilt && FILM_TILTS[i % FILM_TILTS.length],
        )}
      >
        {interactive ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`사진 크게 보기: ${caption || photo.alt || `${i + 1}번째 사진`}`}
            onClick={() => setLightboxIndex(i)}
            className="block w-full cursor-zoom-in text-left"
          >
            {photoBox}
          </button>
        ) : (
          photoBox
        )}
        {showCaption && (
          <figcaption
            className={clsx(
              "mt-2 leading-tight",
              kind !== "collage" && "text-center",
              kind === "filmstrip"
                ? "text-[11px] tracking-[0.02em] text-[#D8D2C4]"
                : flavor === "film"
                  ? "font-(family-name:--canvas-font-hand) text-[16px] text-(--canvas-ink-soft)"
                  : "text-[12px] text-(--canvas-ink-soft)",
            )}
          >
            {caption}
          </figcaption>
        )}
      </figure>
    );
  });

  // filmstrip: 상하 퍼포레이션이 있는 어두운 필름 띠 안에서 가로 스크롤
  const body =
    kind === "filmstrip" ? (
      <div className="rounded-[4px] bg-[#17150F] px-2 py-2">
        <FilmPerforation />
        <div className={containerClass}>{items}</div>
        <FilmPerforation />
      </div>
    ) : (
      <div
        className={containerClass}
        style={isGrid && flavor === "mono" ? { backgroundColor: "var(--canvas-line)" } : undefined}
      >
        {items}
      </div>
    );

  // strip은 풀블리드 — 섹션 패딩을 해제하고 헤더·캡션만 자체 패딩을 준다
  const bleed = kind === "strip";
  return (
    <SectionShell section={section} index={index} bleed={bleed}>
      <div className={bleed ? "px-6" : undefined}>
        <SectionHeader label="GALLERY" title={content.title} index={index} />
      </div>
      <div className="mt-8">{body}</div>
      {lightboxIndex !== null && (
        <GalleryLightbox
          photos={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </SectionShell>
  );
}

function FilmPerforation() {
  return (
    <div
      aria-hidden
      className="h-[7px] rounded-[1px]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, transparent 0 5px, rgba(250,247,240,0.85) 5px 13px, transparent 13px 18px)",
      }}
    />
  );
}
