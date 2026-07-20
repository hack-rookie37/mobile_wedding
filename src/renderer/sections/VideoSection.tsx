"use client";

import { useState } from "react";
import type { VideoSection as VideoSectionData } from "@/invitation/schema/document";
import { parseVideoUrl, type VideoEmbed } from "@/invitation/lib/videoEmbed";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

// MVP 동영상: YouTube·Vimeo 임베드만 (ADR-017).
// facade variant: 썸네일을 먼저 보여주고 탭하면 재생 — 자동재생 금지·모바일 데이터 보호.
// embed variant: 즉시 임베드(iframe lazy 로드).
// 16:9 자리를 항상 예약해 로드 전후 레이아웃 이동(CLS)을 막는다.

function FallbackBox({ message }: { message: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--canvas-line)" }}
    >
      <span className="text-[length:calc(12px*var(--canvas-fs))] leading-[1.6] text-(--canvas-ink-soft)">
        {message}
      </span>
    </div>
  );
}

function PlayGlyph() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-black/60 pl-1 text-[length:calc(18px*var(--canvas-fs))] text-white"
    >
      ▶
    </span>
  );
}

function VideoFacade({ embed, title }: { embed: VideoEmbed; title: string }) {
  const { mode } = useRenderer();
  const interactive = mode === "published";
  const [playing, setPlaying] = useState(false);
  // 썸네일 로드 실패 시에도 재생 버튼은 그대로 동작한다 (재생 실패 fallback)
  const [thumbFailed, setThumbFailed] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`${embed.embedUrl}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full border-0"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={!interactive}
      data-video-facade
      aria-label={`${title} 재생`}
      onClick={() => setPlaying(true)}
      className="relative block h-full w-full"
      style={{ backgroundColor: "var(--canvas-ink)" }}
    >
      {embed.thumbnailUrl !== null && !thumbFailed && (
        <img
          src={embed.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setThumbFailed(true)}
          className="h-full w-full object-cover opacity-90"
        />
      )}
      <PlayGlyph />
    </button>
  );
}

export function VideoSection({ section, index }: { section: VideoSectionData; index: number }) {
  const { content, layout } = section;
  const embed = parseVideoUrl(content.url);
  const title = content.title !== "" ? content.title : "예식 영상";

  return (
    <SectionShell section={section} index={index}>
      <SectionHeader label={content.label} title={content.title} index={index} />
      <div
        className="mt-8 overflow-hidden"
        style={{ aspectRatio: "16 / 9", borderRadius: "var(--canvas-radius-photo)" }}
      >
        {embed === null ? (
          <FallbackBox
            message={
              content.url === ""
                ? "동영상 주소를 입력하면 여기에 표시됩니다"
                : "지원하지 않는 동영상 주소입니다 (YouTube·Vimeo만 지원)"
            }
          />
        ) : layout.variant === "facade" ? (
          <VideoFacade embed={embed} title={title} />
        ) : (
          <iframe
            src={embed.embedUrl}
            title={title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-0"
          />
        )}
      </div>
    </SectionShell>
  );
}
