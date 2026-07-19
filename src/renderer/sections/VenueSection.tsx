"use client";

import { mapSearchLinks, venueMapQuery } from "@/invitation/lib/mapLinks";
import type { VenueSection as VenueSectionData, Wedding } from "@/invitation/schema/document";
import { formatDateStamp, formatWeddingDate } from "../format";
import { MetaList, MetaRow } from "../primitives/MetaRow";
import { PhotoFrame } from "../primitives/PhotoFrame";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

// 외부 지도 열기 — MVP는 지도 API 없이 URL·딥링크만 사용 (Phase 8).
// 각 서비스는 로고 이미지 대신 브랜드색 점으로 식별한다 (상표 리소스 미포함).
function MapLinkButtons({ venue }: { venue: Wedding["venue"] }) {
  const { mode } = useRenderer();
  const interactive = mode === "published";
  const buttonClass =
    "flex h-9 items-center gap-2 rounded-full px-4 text-[12.5px] font-medium text-(--canvas-ink)";
  const buttonStyle = { border: "1px solid var(--canvas-line)" } as const;

  return (
    <div data-map-links className="flex flex-wrap justify-center gap-2">
      {mapSearchLinks(venueMapQuery(venue)).map((link) => {
        const inner = (
          <>
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: link.brandColor }}
            />
            {link.label}
          </>
        );
        return interactive ? (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className={buttonClass}
            style={buttonStyle}
          >
            {inner}
          </a>
        ) : (
          <span key={link.id} className={buttonClass} style={buttonStyle}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}

// 약도 이미지 — crop 없이 원본 비율 그대로. asset 해상도를 알면 그 비율로 자리를 예약한다.
function VenueMapImage({ assetId }: { assetId: string }) {
  const { resolveAsset } = useRenderer();
  const asset = resolveAsset(assetId);
  return (
    <PhotoFrame
      asset={asset}
      alt="예식장 약도"
      shape="soft"
      aspectRatio={asset !== null ? `${asset.width} / ${asset.height}` : "3 / 2"}
      sizes="380px"
      className="w-full"
    />
  );
}

export function VenueSection({
  section,
  wedding,
  index,
}: {
  section: VenueSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { theme } = useRenderer();
  const { content } = section;
  const { venue } = wedding;
  const variant = theme.variants.venue;

  if (variant === "mono") {
    return (
      <SectionShell section={section} index={index}>
        <SectionHeader label="LOCATION" title={content.title} index={index} />
        <div className="mt-7">
          <MetaList>
            <MetaRow label="장소">
              {venue.name}
              {venue.hall && <span className="text-(--canvas-ink-soft)"> {venue.hall}</span>}
            </MetaRow>
            <MetaRow label="주소">{venue.address}</MetaRow>
            <MetaRow label="일시">{formatWeddingDate(wedding.datetime)}</MetaRow>
            {venue.phone && (
              <MetaRow label="연락처">
                <a href={`tel:${venue.phone}`} className="underline underline-offset-4">
                  {venue.phone}
                </a>
              </MetaRow>
            )}
          </MetaList>
        </div>
        {content.note !== "" && (
          <p className="mt-6 text-[12.5px] leading-[1.8] whitespace-pre-line text-(--canvas-ink-soft)">
            {content.note}
          </p>
        )}
        {content.mapImageAssetId !== null && (
          <div className="mt-7">
            <VenueMapImage assetId={content.mapImageAssetId} />
          </div>
        )}
        {content.showMapButtons && (
          <div className="mt-7">
            <MapLinkButtons venue={venue} />
          </div>
        )}
      </SectionShell>
    );
  }

  if (variant === "film") {
    return (
      <SectionShell section={section} index={index}>
        <SectionHeader label="LOCATION" title={content.title} index={index} />
        <div className="mt-7 space-y-1">
          <p className="font-(family-name:--canvas-font-heading) text-[18px] leading-[1.5] font-semibold text-(--canvas-ink)">
            {venue.name}
          </p>
          {venue.hall && (
            <p className="text-[13px] leading-[1.7] text-(--canvas-ink-soft)">{venue.hall}</p>
          )}
          <p className="pt-2 text-[14px] leading-[1.7] text-(--canvas-ink)">{venue.address}</p>
          <p className="text-[13px] leading-[1.7] tracking-[0.04em] text-(--canvas-ink-soft) tabular-nums">
            {formatDateStamp(wedding.datetime)}
          </p>
          {venue.phone && (
            <p className="text-[13px] leading-[1.7]">
              <a
                href={`tel:${venue.phone}`}
                className="text-(--canvas-ink-soft) underline underline-offset-4"
              >
                {venue.phone}
              </a>
            </p>
          )}
        </div>
        {content.note !== "" && (
          <>
            <div
              aria-hidden
              className="mt-8 border-t border-dashed"
              style={{ borderColor: "var(--canvas-line)" }}
            />
            <p className="mt-6 text-[13px] leading-[1.9] whitespace-pre-line text-(--canvas-ink-soft)">
              {content.note}
            </p>
          </>
        )}
        {content.mapImageAssetId !== null && (
          <div className="mt-7">
            <VenueMapImage assetId={content.mapImageAssetId} />
          </div>
        )}
        {content.showMapButtons && (
          <div className="mt-7">
            <MapLinkButtons venue={venue} />
          </div>
        )}
      </SectionShell>
    );
  }

  return (
    <SectionShell section={section} index={index}>
      <div className="flex flex-col items-center text-center">
        <SectionHeader label="LOCATION" title={content.title} index={index} />
        <div className="mt-8">
          <p className="font-(family-name:--canvas-font-heading) text-[19px] leading-[1.5] font-semibold text-(--canvas-ink)">
            {venue.name}
          </p>
          {venue.hall && (
            <p className="mt-1 text-[14px] leading-[1.7] text-(--canvas-ink-soft)">{venue.hall}</p>
          )}
        </div>
        <div className="mt-5 space-y-1">
          <p className="text-[15px] leading-[1.7] text-(--canvas-ink)">{venue.address}</p>
          <p className="text-[14px] leading-[1.7] text-(--canvas-ink-soft)">
            {formatWeddingDate(wedding.datetime)}
          </p>
          {venue.phone && (
            <p className="text-[14px] leading-[1.7]">
              <a
                href={`tel:${venue.phone}`}
                className="text-(--canvas-ink-soft) underline underline-offset-4"
              >
                {venue.phone}
              </a>
            </p>
          )}
        </div>
        {content.note !== "" && (
          <>
            <div aria-hidden className="mt-9 h-px w-6 bg-(--canvas-line)" />
            <p className="mt-8 text-[13px] leading-[1.9] whitespace-pre-line text-(--canvas-ink-soft)">
              {content.note}
            </p>
          </>
        )}
        {content.mapImageAssetId !== null && (
          <div className="mt-8 w-full">
            <VenueMapImage assetId={content.mapImageAssetId} />
          </div>
        )}
        {content.showMapButtons && (
          <div className="mt-8 w-full">
            <MapLinkButtons venue={venue} />
          </div>
        )}
      </div>
    </SectionShell>
  );
}
