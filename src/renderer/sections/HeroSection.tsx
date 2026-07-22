"use client";

import type { HeroSection as HeroSectionData, Wedding } from "@/invitation/schema/document";
import type { HeroOverlay } from "@/invitation/schema/document";
import { fontCssOf } from "@/invitation/schema/themes";
import { formatWeddingDate } from "../format";
import { FullBleedPhoto } from "../primitives/FullBleedPhoto";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";
import { roleStyle } from "../textRoles";

// 사진 위 문구 — 사진 밖으로 흘러넘치지 않게 사진과 같은 칸에 겹쳐 놓는다.
// 밝기·투명도(effects)를 먹은 사진 위에 그리되 글자는 그 필터를 받지 않는다:
// 사진을 어둡게 깔고 글자는 또렷하게 두는 것이 이 문구를 쓰는 이유다.
// 세기 하나가 진하기와 번짐을 함께 움직인다 — 40이 v12까지 못박혀 있던 '검정 40% · 10px'다.
// 색에 알파를 8자리 hex로 붙인다: rgb로 풀어 쓰지 않아도 되고 사용자가 고른 색이 그대로 남는다.
function textShadowOf(overlay: HeroOverlay): string | undefined {
  if (!overlay.shadow) return undefined;
  const alpha = Math.round((overlay.shadowStrength / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `0 1px ${overlay.shadowStrength / 4}px ${overlay.shadowColor}${alpha}`;
}

// 발광 — 글자를 두 층 더 그려 블러로 번지게 한다("블러 효과처럼"). 한 층만 크게 흐리면
// 빛이 넓게 퍼지며 묽어져 세기를 올려도 뚜렷해지지 않았다 — 글자에 붙는 촘촘한 심과
// 넓게 퍼지는 무리를 겹쳐야 세기가 올라간 만큼 실제로 환해진다.
// 세기 하나가 두 층의 번짐과 진하기를 함께 움직인다(그림자 세기와 같은 규칙).
// 숨쉬는 깜빡임은 바깥 상자의 opacity 애니메이션(canvas-glow-breathe)이 맡는다:
// 안쪽 층들의 고정 불투명도와 곱해지므로 세기를 유지한 채 은은하게 오르내린다.
const GLOW_LAYERS = [
  // 심 — 글자 가장자리에 붙어 빛나는 촘촘한 층
  {
    blurPx: (s: number) => 1.5 + s * 0.09, // 5 → 2px, 100 → 10.5px
    opacity: (s: number) => Math.min(1, 0.55 + s / 120), // 55부터는 완전 불투명
  },
  // 무리 — 주변으로 넓게 번지는 층
  {
    blurPx: (s: number) => 4 + s * 0.26, // 5 → 5.3px, 100 → 30px
    opacity: (s: number) => 0.35 + s / 160, // 5 → 0.38, 100 → 0.98
  },
];

// 등장 효과는 전부 CSS 애니메이션의 지연만으로 그린다 — JS 타이머가 없으므로 서버 렌더
// 결과에 글자가 전부 들어 있고, 스크립트가 죽어도 문구는 그대로 읽힌다.
// 모든 시간(재생·글자 간 지연)을 등장 속도 배율로 나눈다 — 0.5배는 두 배 느리게.

// 문단 통째로 움직이는 효과
const BLOCK_KEYFRAMES: Record<string, string> = {
  fade: "canvas-fade-in",
  rise: "canvas-rise-in",
};
const BLOCK_MS = 900;

// 글자마다 시작 시각을 미는 효과. 타자기는 지연이 끝나면 1ms 만에 나타나 '찍히는' 것처럼,
// 스르륵은 천천히 겹쳐 떠오르는 것처럼 보인다 — 같은 keyframe에 시간만 다르다.
const CHAR_EFFECTS: Record<string, { stepMs: number; durationMs: number; ease: string }> = {
  typing: { stepMs: 70, durationMs: 1, ease: "linear" },
  letterFade: { stepMs: 45, durationMs: 420, ease: "ease-out" },
};

const WRITE_MS_PER_CHAR = 60; // 한 글자 폭을 쓸고 지나가는 시간 (÷ 등장 속도 배율)

// 손으로 쓰는 효과 — 줄마다 왼쪽에서 오른쪽으로 잉크가 드러난다.
// 획을 따라가는 진짜 필기는 글리프마다 SVG 경로가 있어야 해서 임의의 글자로는 만들 수 없다.
// 줄 단위로 쓸어 주는 것이 글꼴을 가리지 않고 '쓰는 중'으로 읽히는 가장 가까운 모양이다.
//
// 줄을 직접 나누는 이유: clip-path는 요소 상자를 기준으로 자르는데, 가운데 정렬된 문단은
// 상자가 캔버스 폭 전체라 왼쪽 빈 여백부터 쓸고 지나간다. 줄마다 inline-block으로 감싸면
// 상자가 글자에 딱 붙어서 잉크가 나오는 순간과 쓸리는 속도가 맞는다.
function WrittenText({ text, speed }: { text: string; speed: number }) {
  const lines = text.split("\n");
  const durations = lines.map(
    (line) => (Math.max([...line].length, 1) * WRITE_MS_PER_CHAR) / speed,
  );
  // 각 줄은 앞 줄을 다 쓴 뒤에 시작한다
  const delayOf = (index: number) => durations.slice(0, index).reduce((sum, ms) => sum + ms, 0);

  return (
    <>
      {lines.map((line, i) => (
        <span key={i} className="block">
          <span
            data-canvas-anim
            className="inline-block"
            style={{
              animation: `canvas-write-in ${durations[i]}ms linear ${delayOf(i)}ms backwards`,
            }}
          >
            {line === "" ? " " : line /* 빈 줄도 높이를 가져야 줄이 밀린다 */}
          </span>
        </span>
      ))}
    </>
  );
}

// 코드포인트 단위로 쪼갠다 — split("")은 이모지를 반쪽씩 잘라 깨뜨린다.
// 줄바꿈(\n)도 한 글자로 취급되며, 부모의 whitespace-pre-line이 그대로 줄을 넘긴다.
function OverlayText({ overlay }: { overlay: HeroOverlay }) {
  const speed = overlay.animationSpeed;
  if (overlay.animation === "writing") return <WrittenText text={overlay.text} speed={speed} />;

  const effect = CHAR_EFFECTS[overlay.animation];
  if (effect === undefined) return <>{overlay.text}</>;
  return (
    <>
      {[...overlay.text].map((char, i) => (
        <span
          key={i}
          data-canvas-anim
          style={{
            animation: `canvas-fade-in ${effect.durationMs / speed}ms ${effect.ease} ${(i * effect.stepMs) / speed}ms backwards`,
          }}
        >
          {char}
        </span>
      ))}
    </>
  );
}

function PhotoOverlay({ overlay }: { overlay: HeroOverlay }) {
  // top과 translateY에 같은 %를 주면 0%는 위쪽 끝, 100%는 아래쪽 끝에 딱 맞는다 —
  // top만 쓰면 100%에서 글자가 사진 밖으로 절반 넘어간다.
  const pct = overlay.positionPct;
  const blockKeyframes = BLOCK_KEYFRAMES[overlay.animation];
  return (
    <div data-hero-overlay className="pointer-events-none absolute inset-0 px-8 py-10">
      <div className="relative h-full">
        <p
          className="absolute inset-x-0 text-center break-keep whitespace-pre-line"
          style={{
            top: `${pct}%`,
            transform: `translateY(-${pct}%)`,
            // pt를 그대로 쓴다 — 캔버스의 pt 환산(96/72)과 결과가 같고, 사진 위 크기는
            // 전역 글자 크기를 따라 흔들리지 않아야 한다
            fontSize: `${overlay.sizePt}pt`,
            fontFamily: fontCssOf(overlay.font) ?? "var(--canvas-font-heading)",
            color: overlay.color,
            letterSpacing: `${overlay.letterSpacing}em`,
            lineHeight: overlay.lineHeight,
            // 밝은 사진 위에서 읽히게 해 주지만, 어두운 사진에서는 없는 편이 깔끔하다
            textShadow: textShadowOf(overlay),
          }}
        >
          {/* 문단 통째로 움직이는 효과는 여기 안쪽 상자에 건다 — <p>의 transform은
              세로 위치를 잡는 데 이미 쓰이고 있어서 애니메이션이 덮으면 자리가 틀어진다 */}
          <span
            className="relative block"
            style={
              blockKeyframes === undefined
                ? undefined
                : {
                    animation: `${blockKeyframes} ${BLOCK_MS / overlay.animationSpeed}ms ease-out both`,
                  }
            }
          >
            {/* 발광 층 — 같은 글자를 블러로 두 번 더 그려 뒤에 깐다. 글꼴·자간·등장 효과를
                전부 물려받아 본문과 겹쳐 움직이고, 숨쉬는 밝기만 바깥 상자에서 오르내린다.
                모션 최소화 설정에서는 숨쉬기가 꺼져 일정한 밝기로 남는다 (globals.css). */}
            {overlay.glow && (
              <span
                aria-hidden
                className="absolute inset-0 block"
                style={{ animation: "canvas-glow-breathe 4s ease-in-out infinite" }}
              >
                {GLOW_LAYERS.map((layer, i) => (
                  <span
                    key={i}
                    className="absolute inset-0 block"
                    style={{
                      filter: `blur(${layer.blurPx(overlay.glowStrength)}px)`,
                      opacity: layer.opacity(overlay.glowStrength),
                      // 그림자는 상속된다 — 끊지 않으면 어두운 그림자까지 블러에 섞여 후광이 탁해진다
                      textShadow: "none",
                    }}
                  >
                    <OverlayText overlay={overlay} />
                  </span>
                ))}
              </span>
            )}
            <span
              className="relative block"
              style={
                overlay.edgeBlurPx === 0 ? undefined : { filter: `blur(${overlay.edgeBlurPx}px)` }
              }
            >
              <OverlayText overlay={overlay} />
            </span>
          </span>
        </p>
      </div>
    </div>
  );
}

// 메인은 전면 사진 단일 레이아웃이다 — 사진이 캔버스 가로를 꽉 채우고 맨 위에 붙는다.
// 테마 차이는 canvas 토큰(폰트·색·여백)으로만 나타나고, 연출은 content.effects가 정한다.
export function HeroSection({
  section,
  wedding,
  index,
}: {
  section: HeroSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { resolveAsset } = useRenderer();
  const { content } = section;
  const venueLine = [wedding.venue.name, wedding.venue.hall].filter(Boolean).join(" ");

  return (
    <SectionShell section={section} index={index} flushTop>
      <div className="relative">
        <FullBleedPhoto
          asset={content.photoAssetId !== null ? resolveAsset(content.photoAssetId) : null}
          alt="대표 사진"
          aspect={content.photoAspect}
          effects={content.effects}
          frame={content.photoFrame}
          fadeColor={section.style.background ?? "var(--canvas-paper)"}
          eager
        />
        {content.overlay.text !== "" && <PhotoOverlay overlay={content.overlay} />}
      </div>
      {/* 사진 아래 글을 더 내린다 — 파노라마 사진과 짝을 이뤄 첫 화면을 사진만으로 채운다.
          flex 컨테이너라 이 여백이 자식의 mt-7과 합쳐지지 않고 그대로 더해진다. */}
      <div
        className="flex flex-col items-center px-6 text-center"
        style={{ marginTop: `${content.contentOffsetPx}px` }}
      >
        {content.tagline !== "" && (
          <p
            className="mt-7"
            style={roleStyle("label", {
              size: "calc(11px * var(--canvas-fs-label))",
              weight: "500",
              tracking: "0.24em",
              color: "var(--canvas-accent)",
            })}
          >
            {content.tagline}
          </p>
        )}
        <h1
          className={content.tagline !== "" ? "mt-4" : "mt-7"}
          style={roleStyle("heading", {
            size: "calc(26px * var(--canvas-fs-heading))",
            font: "var(--canvas-font-heading)",
            weight: "600",
            tracking: "-0.01em",
            leading: "1.4",
          })}
        >
          {wedding.groom.name}
          <span className="mx-2.5 text-[length:calc(20px*var(--canvas-fs))] font-normal text-(--canvas-accent)">
            ·
          </span>
          {wedding.bride.name}
        </h1>
        {(content.showDate || content.showVenue) && (
          <div className="mt-5 space-y-1">
            {content.showDate && (
              <p className="text-[length:calc(15px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink-soft)">
                {formatWeddingDate(wedding.datetime)}
              </p>
            )}
            {content.showVenue && (
              <p className="text-[length:calc(15px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink-soft)">
                {venueLine}
              </p>
            )}
          </div>
        )}
      </div>
    </SectionShell>
  );
}
