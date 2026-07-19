"use client";

import clsx from "clsx";
import { useState, type CSSProperties } from "react";
import type { ResolvedAsset } from "@/invitation/assets/assetTypes";
import type { PhotoAspect, PhotoFrame as PhotoFrameValue } from "@/invitation/schema/document";

type FrameShape = "rect" | "soft" | "arch";
type FrameTreatment = "plain" | "polaroid";

// photoAspect enum → CSS aspect-ratio (hero photoFull·gallery strip, 편집기 crop 미리보기 공용)
export const PHOTO_ASPECT_CSS: Record<PhotoAspect, string> = {
  "1/1": "1 / 1",
  "4/5": "4 / 5",
  "3/4": "3 / 4",
  "9/16": "9 / 16",
};

// frame(crop) → CSS: 초점을 object-position과 transform-origin에 동시에 두면
// 확대(zoom) 시에도 초점이 프레임 안에 고정된다. 원본 asset은 절대 수정하지 않는다.
function frameImageStyle(frame: PhotoFrameValue | undefined): CSSProperties | undefined {
  if (!frame) return undefined;
  const focal = `${frame.focalX * 100}% ${frame.focalY * 100}%`;
  return { objectPosition: focal, transform: `scale(${frame.zoom})`, transformOrigin: focal };
}

// CLS 방지를 위해 항상 aspect-ratio로 자리를 예약하고,
// asset 누락(null)·이미지 로드 실패 모두 broken 아이콘 대신 차분한 placeholder로 대체한다.
export function PhotoFrame({
  asset,
  alt,
  shape,
  aspectRatio,
  sizes,
  frame,
  eager = false,
  treatment = "plain",
  className,
}: {
  asset: ResolvedAsset | null;
  alt: string;
  shape: FrameShape;
  aspectRatio: string; // 예: "4 / 5"
  sizes?: string; // srcSet이 있을 때의 표시 폭 힌트 (canvas 최대 폭 기준 px — vw 금지)
  frame?: PhotoFrameValue;
  eager?: boolean;
  treatment?: FrameTreatment;
  className?: string;
}) {
  // 교체(src 변경) 시 실패 상태가 자동으로 풀리도록 실패한 src를 기억한다
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const missing = asset === null || failedSrc === asset.src;

  const imageBox = (
    <div
      className={clsx("overflow-hidden", shape === "arch" && "rounded-t-full")}
      style={{
        aspectRatio,
        borderRadius: shape === "soft" ? "var(--canvas-radius-photo)" : undefined,
      }}
    >
      {missing ? (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundColor: "var(--canvas-line)" }}
        >
          <span className="text-[11px] tracking-[0.08em] text-(--canvas-ink-soft)">
            이미지 없음
          </span>
        </div>
      ) : (
        <img
          src={asset.src}
          srcSet={asset.srcSet}
          sizes={asset.srcSet !== undefined ? sizes : undefined}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSrc(asset.src)}
          className="h-full w-full object-cover"
          style={frameImageStyle(frame)}
        />
      )}
    </div>
  );

  if (treatment === "polaroid") {
    return (
      <div
        className={clsx("bg-white p-2 pb-3.5 shadow-[0_3px_14px_rgba(70,60,40,0.16)]", className)}
      >
        {imageBox}
      </div>
    );
  }

  return <div className={className}>{imageBox}</div>;
}
