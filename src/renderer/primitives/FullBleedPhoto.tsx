"use client";

import type { CSSProperties } from "react";
import type { ResolvedAsset } from "@/invitation/assets/assetTypes";
import type {
  PhotoAspect,
  PhotoEffects,
  PhotoFrame as PhotoFrameValue,
} from "@/invitation/schema/document";
import { PHOTO_ASPECT_CSS, PhotoFrame } from "./PhotoFrame";

const FADE_HEIGHT = "140px";
const SIZES = "430px"; // canvas 최대 폭 기준 표시 폭 힌트

// 캔버스 가로를 꽉 채우는 전면 사진 — 메인과 맺음말이 같은 연출을 공유한다.
// 효과는 전부 사진 위 오버레이거나 CSS 필터라서 레이아웃(자리·높이)에는 영향을 주지 않는다.
export function FullBleedPhoto({
  asset,
  alt,
  aspect,
  effects,
  frame,
  fadeColor,
  eager = false,
}: {
  asset: ResolvedAsset | null;
  alt: string;
  aspect: PhotoAspect;
  effects: PhotoEffects;
  frame?: PhotoFrameValue;
  fadeColor: string; // 페이드가 녹아드는 섹션 배경색
  eager?: boolean;
}) {
  const filter: CSSProperties =
    effects.brightness === 1 && effects.opacity === 1
      ? {}
      : { filter: `brightness(${effects.brightness})`, opacity: effects.opacity };

  return (
    <div data-photo-stage className="relative" style={filter}>
      <PhotoFrame
        asset={asset}
        alt={alt}
        shape="rect"
        aspectRatio={PHOTO_ASPECT_CSS[aspect]}
        sizes={SIZES}
        frame={frame}
        eager={eager}
        className="w-full"
      />
      {effects.sparkle && <Sparkle />}
      {effects.fadeBottom && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            height: FADE_HEIGHT,
            background: `linear-gradient(to top, ${fadeColor}, color-mix(in srgb, ${fadeColor} 80%, transparent) 20%, color-mix(in srgb, ${fadeColor} 50%, transparent) 50%, transparent)`,
          }}
        />
      )}
    </div>
  );
}

// 반짝임 — 사진 위를 천천히 지나가는 빛줄기. prefers-reduced-motion에서는 멈춘다
// (renderer의 미디어 쿼리 금지는 뷰포트 폭 대응 규칙이므로 모션 접근성 쿼리는 예외다).
function Sparkle() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes canvas-sparkle {
          0% { transform: translateX(-120%) rotate(18deg); }
          100% { transform: translateX(220%) rotate(18deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-sparkle] { animation: none; opacity: 0.25; }
        }
      `}</style>
      <div
        data-sparkle
        className="absolute inset-y-[-30%] w-[45%]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
          animation: "canvas-sparkle 5.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}
