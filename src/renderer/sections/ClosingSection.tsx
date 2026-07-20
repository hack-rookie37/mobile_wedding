"use client";

import { useEffect, useRef, useState } from "react";
import type { ClosingSection as ClosingSectionData } from "@/invitation/schema/document";
import { BodyText } from "../primitives/BodyText";
import { PhotoFrame } from "../primitives/PhotoFrame";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

const COPIED_FEEDBACK_MS = 2000;

// 마무리 공유 버튼 — Web Share API 우선, 미지원 환경은 링크 복사로 fallback
function ShareButton() {
  const { mode } = useRenderer();
  const interactive = mode === "published";
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, url });
      } catch {
        // 사용자가 공유 시트를 닫음 — 아무것도 하지 않는다
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      disabled={!interactive}
      data-closing-share
      aria-live="polite"
      onClick={() => void share()}
      className="h-10 rounded-full px-5 text-[length:calc(13px*var(--canvas-fs))] font-medium text-(--canvas-ink)"
      style={{ border: "1px solid var(--canvas-line)" }}
    >
      {copied ? "링크가 복사되었습니다" : "청첩장 링크 공유"}
    </button>
  );
}

export function ClosingSection({ section, index }: { section: ClosingSectionData; index: number }) {
  const { resolveAsset, theme } = useRenderer();
  const { content, layout } = section;
  const withPhoto = layout.variant === "photo" && content.photoAssetId !== null;
  const asset =
    withPhoto && content.photoAssetId !== null ? resolveAsset(content.photoAssetId) : null;

  return (
    <SectionShell section={section} index={index}>
      <div className="flex flex-col items-center text-center">
        <SectionHeader label="THANK YOU" title={content.title} index={index} />
        {withPhoto && (
          <PhotoFrame
            asset={asset}
            alt="마무리 사진"
            shape="soft"
            aspectRatio="4 / 3"
            sizes="382px"
            frame={content.photoFrame}
            treatment={theme.variants.photoTreatment}
            className="mt-8 w-full"
          />
        )}
        {content.body !== "" && (
          <div className="mt-8 w-full">
            <BodyText text={content.body} />
          </div>
        )}
        {content.showShare && (
          <div className="mt-8">
            <ShareButton />
          </div>
        )}
      </div>
    </SectionShell>
  );
}
