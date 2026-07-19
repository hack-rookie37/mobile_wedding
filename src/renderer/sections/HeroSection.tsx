"use client";

import type { ResolvedAsset } from "@/invitation/assets/assetTypes";
import type { HeroSection as HeroSectionData, Wedding } from "@/invitation/schema/document";
import { formatDateStamp, formatWeddingDate } from "../format";
import { MetaList, MetaRow } from "../primitives/MetaRow";
import { PhotoFrame } from "../primitives/PhotoFrame";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

// 세 variant가 공유하는 데이터 준비 결과 — 표현만 다르고 로직은 하나다
interface HeroData {
  content: HeroSectionData["content"];
  wedding: Wedding;
  photo: ResolvedAsset | null; // 사진 슬롯이 꺼져 있으면(textOnly·미지정) hasPhoto=false
  hasPhoto: boolean;
  venueLine: string;
}

const HERO_SIZES = "430px"; // canvas 최대 폭 기준 표시 폭 힌트

function HeroEditorial({ content, wedding, photo, hasPhoto, venueLine }: HeroData) {
  return (
    <div className="flex flex-col items-center text-center">
      {content.tagline !== "" && (
        <p className="text-[11px] font-medium tracking-[0.24em] text-(--canvas-accent)">
          {content.tagline}
        </p>
      )}
      {hasPhoto && (
        <PhotoFrame
          asset={photo}
          alt="대표 사진"
          shape="arch"
          aspectRatio="4 / 5"
          sizes={HERO_SIZES}
          frame={content.photoFrame}
          eager
          className="mt-9 w-full max-w-[280px]"
        />
      )}
      <h1 className="mt-9 font-(family-name:--canvas-font-heading) text-[26px] leading-[1.4] font-semibold tracking-[-0.01em] text-(--canvas-ink)">
        {wedding.groom.name}
        <span className="mx-2.5 text-[20px] font-normal text-(--canvas-accent)">·</span>
        {wedding.bride.name}
      </h1>
      {(content.showDate || content.showVenue) && (
        <div className="mt-5 space-y-1">
          {content.showDate && (
            <p className="text-[15px] leading-[1.7] text-(--canvas-ink-soft)">
              {formatWeddingDate(wedding.datetime)}
            </p>
          )}
          {content.showVenue && (
            <p className="text-[15px] leading-[1.7] text-(--canvas-ink-soft)">{venueLine}</p>
          )}
        </div>
      )}
    </div>
  );
}

function HeroMono({ content, wedding, photo, hasPhoto, venueLine }: HeroData) {
  return (
    <div>
      {content.tagline !== "" && (
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium tracking-[0.22em] text-(--canvas-ink-soft) uppercase">
            {content.tagline}
          </span>
          <span aria-hidden className="h-px flex-1 bg-(--canvas-line)" />
        </div>
      )}
      <h1 className="mt-9 font-(family-name:--canvas-font-heading) text-[34px] leading-[1.22] font-bold tracking-[-0.02em] text-(--canvas-ink)">
        <span className="block">{wedding.groom.name}</span>
        <span className="block">
          <span className="mr-2 font-normal text-(--canvas-ink-soft)">&</span>
          {wedding.bride.name}
        </span>
      </h1>
      {hasPhoto && (
        <PhotoFrame
          asset={photo}
          alt="대표 사진"
          shape="rect"
          aspectRatio="4 / 5"
          sizes={HERO_SIZES}
          frame={content.photoFrame}
          eager
          className="mt-9 w-full"
        />
      )}
      {(content.showDate || content.showVenue) && (
        <div className="mt-9">
          <MetaList>
            {content.showDate && (
              <MetaRow label="일시">{formatWeddingDate(wedding.datetime)}</MetaRow>
            )}
            {content.showVenue && <MetaRow label="장소">{venueLine}</MetaRow>}
          </MetaList>
        </div>
      )}
    </div>
  );
}

function HeroFilm({ content, wedding, photo, hasPhoto, venueLine }: HeroData) {
  return (
    <div className="flex flex-col items-center text-center">
      {hasPhoto && (
        <PhotoFrame
          asset={photo}
          alt="대표 사진"
          shape="rect"
          aspectRatio="4 / 5"
          sizes={HERO_SIZES}
          frame={content.photoFrame}
          eager
          treatment="polaroid"
          className="w-full max-w-[280px] -rotate-2"
        />
      )}
      {content.tagline !== "" && (
        <p className="mt-8 font-(family-name:--canvas-font-hand) text-[24px] leading-none text-(--canvas-accent) lowercase">
          {content.tagline.toLowerCase()}
        </p>
      )}
      <h1 className="mt-4 font-(family-name:--canvas-font-heading) text-[23px] leading-[1.5] font-semibold tracking-[-0.01em] text-(--canvas-ink)">
        {wedding.groom.name}
        <span className="mx-2 text-[16px] font-normal text-(--canvas-ink-soft)">그리고</span>
        {wedding.bride.name}
      </h1>
      {(content.showDate || content.showVenue) && (
        <div className="mt-4 space-y-1">
          {content.showDate && (
            <p className="text-[13px] leading-[1.7] tracking-[0.04em] text-(--canvas-ink-soft) tabular-nums">
              {formatDateStamp(wedding.datetime)}
            </p>
          )}
          {content.showVenue && (
            <p className="text-[13px] leading-[1.7] text-(--canvas-ink-soft)">{venueLine}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function HeroSection({
  section,
  wedding,
  index,
}: {
  section: HeroSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { resolveAsset, theme } = useRenderer();
  const { content, layout } = section;
  const hasPhoto = layout.variant !== "textOnly" && content.photoAssetId !== null;
  const data: HeroData = {
    content,
    wedding,
    hasPhoto,
    // 지정됐지만 누락된 asset은 null — PhotoFrame이 placeholder를 그린다
    photo: hasPhoto && content.photoAssetId !== null ? resolveAsset(content.photoAssetId) : null,
    venueLine: [wedding.venue.name, wedding.venue.hall].filter(Boolean).join(" "),
  };
  const variant = theme.variants.hero;

  return (
    <SectionShell section={section} index={index}>
      {variant === "mono" ? (
        <HeroMono {...data} />
      ) : variant === "film" ? (
        <HeroFilm {...data} />
      ) : (
        <HeroEditorial {...data} />
      )}
    </SectionShell>
  );
}
