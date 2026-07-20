"use client";

import { mapSearchLinks, venueMapQuery } from "@/invitation/lib/mapLinks";
import type { VenueSection as VenueSectionData, Wedding } from "@/invitation/schema/document";
import { formatDateStamp, formatWeddingDate } from "../format";
import { MapAppIcon } from "../primitives/MapAppIcon";
import { MetaList, MetaRow } from "../primitives/MetaRow";
import { PhotoFrame } from "../primitives/PhotoFrame";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

// 외부 지도 열기 — MVP는 지도 API 없이 URL·딥링크만 사용 (Phase 8).
// 각 버튼은 해당 앱의 아이콘을 위에 달아 글자 없이도 어디로 열리는지 알아볼 수 있게 한다.
// 3등분 그리드에 70px 높이 — 모바일에서 엄지로 누르기 충분한 크기다.
function MapLinkButtons({ venue }: { venue: Wedding["venue"] }) {
  const { mode } = useRenderer();
  const interactive = mode === "published";
  const buttonClass =
    "flex min-h-[70px] flex-col items-center justify-center gap-[7px] rounded-lg px-1.5 py-2.5 " +
    "text-[length:calc(12px*var(--canvas-fs))] font-semibold text-(--canvas-ink) active:bg-black/5";
  const buttonStyle = { border: "1px solid var(--canvas-line)" } as const;

  return (
    <div data-map-links className="grid grid-cols-3 gap-2.5">
      {mapSearchLinks(venueMapQuery(venue)).map((link) => {
        const inner = (
          <>
            <MapAppIcon id={link.id} />
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
// 제목 바로 아래에 두어 "어디인지"를 글보다 먼저 보여준다.
function VenueMap({ assetId }: { assetId: string | null }) {
  const { resolveAsset } = useRenderer();
  if (assetId === null) return null;
  const asset = resolveAsset(assetId);
  return (
    <div className="mt-7 w-full">
      <PhotoFrame
        asset={asset}
        alt="예식장 약도"
        shape="soft"
        aspectRatio={asset !== null ? `${asset.width} / ${asset.height}` : "3 / 2"}
        sizes="380px"
        className="w-full"
      />
    </div>
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
        <VenueMap assetId={content.mapImageAssetId} />
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
          <p className="mt-6 text-[length:calc(12.5px*var(--canvas-fs))] leading-[1.8] whitespace-pre-line text-(--canvas-ink-soft)">
            {content.note}
          </p>
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
        <VenueMap assetId={content.mapImageAssetId} />
        <div className="mt-7 space-y-1">
          <p className="font-(family-name:--canvas-font-heading) text-[length:calc(18px*var(--canvas-fs-heading))] leading-[1.5] font-semibold text-(--canvas-ink)">
            {venue.name}
          </p>
          {venue.hall && (
            <p className="text-[length:calc(13px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink-soft)">
              {venue.hall}
            </p>
          )}
          <p className="pt-2 text-[length:calc(14px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink)">
            {venue.address}
          </p>
          <p className="text-[length:calc(13px*var(--canvas-fs))] leading-[1.7] tracking-[0.04em] text-(--canvas-ink-soft) tabular-nums">
            {formatDateStamp(wedding.datetime)}
          </p>
          {venue.phone && (
            <p className="text-[length:calc(13px*var(--canvas-fs))] leading-[1.7]">
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
            <p className="mt-6 text-[length:calc(13px*var(--canvas-fs))] leading-[1.9] whitespace-pre-line text-(--canvas-ink-soft)">
              {content.note}
            </p>
          </>
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
        <VenueMap assetId={content.mapImageAssetId} />
        <div className="mt-8">
          <p className="font-(family-name:--canvas-font-heading) text-[length:calc(19px*var(--canvas-fs-heading))] leading-[1.5] font-semibold text-(--canvas-ink)">
            {venue.name}
          </p>
          {venue.hall && (
            <p className="mt-1 text-[length:calc(14px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink-soft)">
              {venue.hall}
            </p>
          )}
        </div>
        <div className="mt-5 space-y-1">
          <p className="text-[length:calc(15px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink)">
            {venue.address}
          </p>
          <p className="text-[length:calc(14px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink-soft)">
            {formatWeddingDate(wedding.datetime)}
          </p>
          {venue.phone && (
            <p className="text-[length:calc(14px*var(--canvas-fs))] leading-[1.7]">
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
            <p className="mt-8 text-[length:calc(13px*var(--canvas-fs))] leading-[1.9] whitespace-pre-line text-(--canvas-ink-soft)">
              {content.note}
            </p>
          </>
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
