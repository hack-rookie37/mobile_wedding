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
      {effects.petals && <Petals />}
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

// 별빛의 자리와 박자는 고정값이다 — 난수를 쓰면 서버와 클라이언트 렌더가 어긋난다.
// 서로 다른 주기·지연을 주어 규칙적으로 깜빡이지 않게 흩어 놓았다.
const STARS = [
  { top: "9%", left: "16%", size: 15, delay: "0s", duration: "3.6s" },
  { top: "21%", left: "73%", size: 22, delay: "0.9s", duration: "4.4s" },
  { top: "36%", left: "31%", size: 11, delay: "2.2s", duration: "3.1s" },
  { top: "46%", left: "87%", size: 14, delay: "1.4s", duration: "4.9s" },
  { top: "60%", left: "9%", size: 18, delay: "2.9s", duration: "4.1s" },
  { top: "69%", left: "57%", size: 12, delay: "0.4s", duration: "3.8s" },
  { top: "83%", left: "79%", size: 16, delay: "3.4s", duration: "4.6s" },
  { top: "90%", left: "38%", size: 10, delay: "1.8s", duration: "3.4s" },
];

// 4각 별의 윤곽 — 각 변이 안으로 휘어 끝이 뾰족하다 (24×24 기준)
const STAR_PATH =
  "M12 0c0 6.6 5.4 12 12 12-6.6 0-12 5.4-12 12 0-6.6-5.4-12-12-12 6.6 0 12-5.4 12-12z";

// 꽃잎의 자리와 박자도 고정값이다 (별과 같은 이유 — 난수는 서버·클라이언트 렌더를 어긋나게 한다).
// left는 가로 자리, delay는 음수로 두어 처음부터 하늘에 흩어져 있게 한다 — 0부터 시작하면
// 첫 몇 초 동안 꽃잎이 하나도 없다가 우르르 떨어진다.
const PETALS = [
  { left: "6%", size: 13, fall: "13s", delay: "-4s", sway: 9, swayMs: "2.6s", tilt: -18, tone: 0 },
  { left: "17%", size: 17, fall: "10s", delay: "-9s", sway: 12, swayMs: "3.1s", tilt: 24, tone: 1 },
  { left: "29%", size: 11, fall: "15s", delay: "-1s", sway: 8, swayMs: "2.2s", tilt: 8, tone: 2 },
  {
    left: "41%",
    size: 15,
    fall: "11s",
    delay: "-6s",
    sway: 11,
    swayMs: "2.9s",
    tilt: -30,
    tone: 0,
  },
  { left: "54%", size: 12, fall: "14s", delay: "-11s", sway: 9, swayMs: "2.4s", tilt: 40, tone: 1 },
  { left: "63%", size: 18, fall: "9s", delay: "-3s", sway: 13, swayMs: "3.4s", tilt: -8, tone: 2 },
  { left: "74%", size: 13, fall: "12s", delay: "-8s", sway: 10, swayMs: "2.7s", tilt: 16, tone: 0 },
  {
    left: "84%",
    size: 15,
    fall: "10.5s",
    delay: "-5s",
    sway: 11,
    swayMs: "3.2s",
    tilt: -24,
    tone: 1,
  },
  {
    left: "93%",
    size: 12,
    fall: "13.5s",
    delay: "-12s",
    sway: 8,
    swayMs: "2.5s",
    tilt: 32,
    tone: 2,
  },
];

// 벚꽃 빛깔 세 톤 — 사진 위에서 하양~분홍이 가장 자연스럽게 읽힌다
const PETAL_TONES = ["rgba(255,214,224,0.9)", "rgba(255,240,243,0.88)", "rgba(255,189,203,0.85)"];

// 꽃잎 한 장 — 끝이 뾰족한 물방울꼴 (24×24 기준)
const PETAL_PATH = "M12 2c5.5 3.5 7.5 10 0 20C4.5 12 6.5 5.5 12 2z";

// 꽃잎 날림 — 사진 위로 꽃잎이 잔잔히 떨어진다.
// 세로 낙하는 사진 높이만큼의 보이지 않는 기둥(inset-y-0)을 translateY(-100% → 100%)로
// 움직여 그린다: 사진 높이가 비율마다 달라도 %가 그 높이를 그대로 따라가고, top을 직접
// 움직일 때와 달리 합성기(compositor)만으로 굴러간다. 흔들림·회전은 안쪽 상자가 맡는다.
// prefers-reduced-motion에서는 아예 그리지 않는다 — 공중에 멈춘 꽃잎은 별과 달리 얼룩처럼 보인다.
function Petals() {
  return (
    <div data-petals aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes canvas-petal-fall {
          from { transform: translateY(-100%); }
          to   { transform: translateY(100%); }
        }
        @keyframes canvas-petal-sway {
          from { transform: translateX(calc(-1 * var(--petal-sway))) rotate(var(--petal-tilt)); }
          to   { transform: translateX(var(--petal-sway)) rotate(calc(var(--petal-tilt) + 50deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-petals] { display: none; }
        }
      `}</style>
      {PETALS.map((petal, i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{
            left: petal.left,
            animation: `canvas-petal-fall ${petal.fall} linear ${petal.delay} infinite`,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            style={
              {
                width: petal.size,
                height: petal.size,
                fill: PETAL_TONES[petal.tone],
                "--petal-sway": `${petal.sway}px`,
                "--petal-tilt": `${petal.tilt}deg`,
                animation: `canvas-petal-sway ${petal.swayMs} ease-in-out ${petal.delay} infinite alternate`,
              } as CSSProperties
            }
          >
            <path d={PETAL_PATH} />
          </svg>
        </div>
      ))}
    </div>
  );
}

// 반짝임 — 사진 위에서 별빛이 잔잔하게 깜빡인다. prefers-reduced-motion에서는 멈춘 채 은은하게 남는다
// (renderer의 미디어 쿼리 금지는 뷰포트 폭 대응 규칙이므로 모션 접근성 쿼리는 예외다).
function Sparkle() {
  return (
    <div data-sparkle aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes canvas-twinkle {
          0%, 100% { opacity: 0; transform: scale(0.3); }
          40%      { opacity: 0.95; transform: scale(1); }
          64%      { opacity: 0.3; transform: scale(0.72); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-star] { animation: none; opacity: 0.65; }
        }
      `}</style>
      {STARS.map((star) => (
        <svg
          key={`${star.top}-${star.left}`}
          data-star
          viewBox="0 0 24 24"
          className="absolute"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            marginTop: -star.size / 2, // 좌표를 별의 중심으로 삼는다
            marginLeft: -star.size / 2,
            fill: "rgba(255,255,255,0.92)",
            filter: "drop-shadow(0 0 4px rgba(255,255,255,0.55))",
            animation: `canvas-twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
          }}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}
