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
      {effects.petals && (
        <Petals
          color={effects.petalColor}
          count={effects.petalCount}
          opacity={effects.petalOpacity}
        />
      )}
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

// 꽃잎의 자리와 박자는 전부 고정값이다 (별과 같은 이유 — 난수는 서버·클라이언트 렌더를
// 어긋나게 한다). '불규칙함'은 자리마다 낙하·표류·펄럭임의 주기와 지연을 서로 어긋나게
// 짜서 만든다 — 세 주기가 약수 관계가 아니라 같은 궤적이 다시 나타나지 않는다.
// delay는 음수로 두어 처음부터 하늘에 흩어져 있게 한다 — 0부터 시작하면 첫 몇 초 동안
// 꽃잎이 하나도 없다가 우르르 떨어진다.
//
// 자리 순서는 가로로 흩뿌려 두었다: '꽃잎 양'이 앞에서부터 N개를 쓰므로,
// 왼쪽부터 차례로 늘어놓으면 양을 줄였을 때 꽃잎이 한쪽에 몰린다.
// drift: 좌우 표류 폭(px), rot0→rot1: 펄럭이며 도는 각도, mix: 흰색을 섞는 비율(%),
// shape: 꽃잎 모양(아래 PETAL_SHAPES), alpha: 장마다 조금씩 다른 기본 투명도.
const PETAL_SLOTS = [
  {
    left: "50%",
    size: 15,
    fall: 12.5,
    dy: -4.2,
    drift: 30,
    dr: 5.1,
    rot0: -24,
    rot1: 42,
    fl: 2.3,
    shape: 0,
    mix: 0,
    alpha: 0.95,
  },
  {
    left: "12%",
    size: 12,
    fall: 15.0,
    dy: -9.6,
    drift: 22,
    dr: 4.2,
    rot0: 18,
    rot1: -35,
    fl: 2.9,
    shape: 1,
    mix: 35,
    alpha: 0.85,
  },
  {
    left: "82%",
    size: 17,
    fall: 10.0,
    dy: -2.8,
    drift: 38,
    dr: 6.3,
    rot0: -10,
    rot1: 55,
    fl: 1.9,
    shape: 2,
    mix: 60,
    alpha: 0.9,
  },
  {
    left: "30%",
    size: 13,
    fall: 13.5,
    dy: -11.4,
    drift: 26,
    dr: 3.6,
    rot0: 40,
    rot1: -18,
    fl: 2.6,
    shape: 1,
    mix: 0,
    alpha: 0.8,
  },
  {
    left: "65%",
    size: 11,
    fall: 16.0,
    dy: -6.1,
    drift: 18,
    dr: 4.8,
    rot0: -32,
    rot1: 20,
    fl: 3.2,
    shape: 0,
    mix: 60,
    alpha: 0.9,
  },
  {
    left: "5%",
    size: 16,
    fall: 9.5,
    dy: -1.3,
    drift: 34,
    dr: 5.7,
    rot0: 8,
    rot1: 62,
    fl: 2.1,
    shape: 2,
    mix: 35,
    alpha: 1,
  },
  {
    left: "92%",
    size: 12,
    fall: 14.0,
    dy: -7.9,
    drift: 24,
    dr: 3.9,
    rot0: -45,
    rot1: 12,
    fl: 2.7,
    shape: 0,
    mix: 0,
    alpha: 0.85,
  },
  {
    left: "42%",
    size: 18,
    fall: 11.0,
    dy: -3.4,
    drift: 42,
    dr: 6.9,
    rot0: 25,
    rot1: -30,
    fl: 1.8,
    shape: 1,
    mix: 60,
    alpha: 0.9,
  },
  {
    left: "73%",
    size: 13,
    fall: 12.0,
    dy: -10.2,
    drift: 28,
    dr: 4.5,
    rot0: -15,
    rot1: 48,
    fl: 2.4,
    shape: 2,
    mix: 0,
    alpha: 0.95,
  },
  {
    left: "20%",
    size: 14,
    fall: 15.5,
    dy: -5.5,
    drift: 20,
    dr: 5.4,
    rot0: 33,
    rot1: -22,
    fl: 3.0,
    shape: 0,
    mix: 35,
    alpha: 0.8,
  },
  {
    left: "58%",
    size: 11,
    fall: 10.5,
    dy: -0.7,
    drift: 32,
    dr: 4.0,
    rot0: -28,
    rot1: 38,
    fl: 2.2,
    shape: 2,
    mix: 35,
    alpha: 0.9,
  },
  {
    left: "35%",
    size: 16,
    fall: 13.0,
    dy: -8.8,
    drift: 25,
    dr: 6.1,
    rot0: 14,
    rot1: -42,
    fl: 2.8,
    shape: 1,
    mix: 0,
    alpha: 1,
  },
  {
    left: "87%",
    size: 12,
    fall: 16.5,
    dy: -12.3,
    drift: 36,
    dr: 3.4,
    rot0: -38,
    rot1: 25,
    fl: 2.0,
    shape: 0,
    mix: 60,
    alpha: 0.85,
  },
  {
    left: "8%",
    size: 15,
    fall: 11.5,
    dy: -4.9,
    drift: 21,
    dr: 5.9,
    rot0: 48,
    rot1: -12,
    fl: 2.5,
    shape: 2,
    mix: 0,
    alpha: 0.9,
  },
  {
    left: "47%",
    size: 12,
    fall: 14.5,
    dy: -2.1,
    drift: 40,
    dr: 4.4,
    rot0: -20,
    rot1: 58,
    fl: 3.1,
    shape: 1,
    mix: 35,
    alpha: 0.8,
  },
  {
    left: "68%",
    size: 17,
    fall: 9.8,
    dy: -6.7,
    drift: 27,
    dr: 6.6,
    rot0: 30,
    rot1: -25,
    fl: 1.7,
    shape: 0,
    mix: 0,
    alpha: 0.95,
  },
  {
    left: "25%",
    size: 11,
    fall: 12.8,
    dy: -11.9,
    drift: 19,
    dr: 3.8,
    rot0: -12,
    rot1: 44,
    fl: 2.6,
    shape: 2,
    mix: 60,
    alpha: 0.9,
  },
  {
    left: "95%",
    size: 14,
    fall: 15.2,
    dy: -3.9,
    drift: 33,
    dr: 5.2,
    rot0: 22,
    rot1: -48,
    fl: 2.3,
    shape: 1,
    mix: 35,
    alpha: 0.85,
  },
  {
    left: "15%",
    size: 13,
    fall: 10.8,
    dy: -8.1,
    drift: 29,
    dr: 4.7,
    rot0: -35,
    rot1: 15,
    fl: 2.9,
    shape: 0,
    mix: 60,
    alpha: 0.9,
  },
  {
    left: "60%",
    size: 16,
    fall: 13.8,
    dy: -5.0,
    drift: 23,
    dr: 6.0,
    rot0: 10,
    rot1: -55,
    fl: 2.1,
    shape: 2,
    mix: 0,
    alpha: 1,
  },
];

// 꽃잎 모양 세 가지 (24×24 기준) — 전부 같은 모양이면 종이 조각처럼 보인다.
// 끝은 전부 둥글게 마감한다 — 뾰족한 꼭짓점은 꽃잎이 아니라 색종이 조각처럼 읽힌다.
//  0: 벚꽃잎 — 위가 얕게 갈라진(노치) 둥근 잎
//  1: 둥근 잎 — 통통한 물방울꼴
//  2: 갸름한 잎 — 길고 홀쭉해 옆으로 도는 순간 얇아 보인다
const PETAL_SHAPES = [
  "M12 21.5c-4.6-1.8-7-6.8-5.6-12C7.2 6.6 8.6 5 10 5c1 0 1.6.9 2 1.8.4-.9 1-1.8 2-1.8 1.4 0 2.8 1.6 3.6 4.5 1.4 5.2-1 10.2-5.6 12z",
  "M12 3c3.6 1 6 5 6 9.5 0 4.8-2.6 8.5-6 8.5s-6-3.7-6-8.5C6 8 8.4 4 12 3z",
  "M12 3c2.2 2.6 3.4 7 3.4 10.5 0 3.9-1.4 7.5-3.4 7.5s-3.4-3.6-3.4-7.5C8.6 10 9.8 5.6 12 3z",
];

// 꽃잎 날림 — 사진 위로 꽃잎이 흩날리며 떨어진다. 세 겹의 움직임을 포갠다:
//  낙하(기둥):  사진 높이만큼의 보이지 않는 기둥(inset-y-0)을 translateY(-100% → 100%)로
//              내린다. 사진 비율이 달라도 %가 높이를 따라가고 합성기만으로 굴러간다.
//  표류(중간):  좌우로 크게 밀렸다 돌아온다 — 낙하와 주기가 어긋나 대각선으로 흘러내린다.
//  펄럭임(svg): 돌면서 옆으로 눕는다(scaleX) — 잎이 뒤집히는 것처럼 보인다.
// 색은 바탕색(petalColor)에 흰색을 장마다 다르게 섞어 세 톤을 만든다.
// prefers-reduced-motion에서는 아예 그리지 않는다 — 공중에 멈춘 꽃잎은 별과 달리 얼룩처럼 보인다.
function Petals({ color, count, opacity }: { color: string; count: number; opacity: number }) {
  return (
    <div
      data-petals
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity }}
    >
      <style>{`
        @keyframes canvas-petal-fall {
          from { transform: translateY(-100%); }
          to   { transform: translateY(100%); }
        }
        @keyframes canvas-petal-drift {
          from { transform: translateX(calc(-1 * var(--petal-drift))); }
          to   { transform: translateX(var(--petal-drift)); }
        }
        @keyframes canvas-petal-flutter {
          from { transform: rotate(var(--petal-rot0)) scaleX(1); }
          to   { transform: rotate(var(--petal-rot1)) scaleX(0.55); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-petals] { display: none; }
        }
      `}</style>
      {PETAL_SLOTS.slice(0, count).map((petal, i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{
            left: petal.left,
            animation: `canvas-petal-fall ${petal.fall}s linear ${petal.dy}s infinite`,
          }}
        >
          <div
            style={
              {
                "--petal-drift": `${petal.drift}px`,
                animation: `canvas-petal-drift ${petal.dr}s ease-in-out ${petal.dy}s infinite alternate`,
              } as CSSProperties
            }
          >
            <svg
              viewBox="0 0 24 24"
              style={
                {
                  display: "block",
                  width: petal.size,
                  height: petal.size,
                  fill:
                    petal.mix === 0
                      ? color
                      : `color-mix(in srgb, ${color} ${100 - petal.mix}%, white)`,
                  fillOpacity: petal.alpha,
                  "--petal-rot0": `${petal.rot0}deg`,
                  "--petal-rot1": `${petal.rot1}deg`,
                  animation: `canvas-petal-flutter ${petal.fl}s ease-in-out ${petal.dy * 0.7}s infinite alternate`,
                } as CSSProperties
              }
            >
              <path d={PETAL_SHAPES[petal.shape]} />
            </svg>
          </div>
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
