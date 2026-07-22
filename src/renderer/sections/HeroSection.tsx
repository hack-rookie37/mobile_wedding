"use client";

import { Fragment, type ReactNode } from "react";
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

// 발광 — 글자를 두 층 더 그려 번지게 한다. 한 층만 크게 번지면 빛이 퍼지며 묽어져
// 세기를 올려도 뚜렷해지지 않았다 — 글자에 붙는 촘촘한 심과 넓게 퍼지는 무리를 겹쳐야
// 세기가 올라간 만큼 실제로 환해진다. 세기 하나가 두 층의 번짐과 진하기를 함께 움직인다.
// 숨쉬는 깜빡임은 바깥 상자의 opacity 애니메이션(canvas-glow-breathe)이 맡는다:
// 안쪽 층들의 고정 불투명도와 곱해지므로 세기를 유지한 채 은은하게 오르내린다.
//
// filter: blur()가 아니라 글자색 투명 + text-shadow로 번지게 한다 (ADR-052) — 모양은 같은
// 가우시안인데 비용이 다르다: iOS는 합성 레이어의 filter를 화면을 그릴 때마다 다시 계산해,
// 쓰기 효과·꽃잎이 움직이는 내내 큰 블러 두 장이 매 프레임 GPU를 태웠다(글자 끝이 뚝뚝
// 끊기며 뒤늦게 그려지던 남은 원인). text-shadow는 래스터 때 한 번 구워지는 정지 픽셀이다.
// 반지름은 blur px의 2배 — filter blur(l)은 표준편차 l, shadow 반지름 r은 표준편차 r/2.
const GLOW_LAYERS = [
  // 심 — 글자 가장자리에 붙어 빛나는 촘촘한 층
  {
    radiusPx: (s: number) => 3 + s * 0.18, // 5 → 4px, 100 → 21px
    opacity: (s: number) => Math.min(1, 0.55 + s / 120), // 55부터는 완전 불투명
  },
  // 무리 — 주변으로 넓게 번지는 층
  {
    radiusPx: (s: number) => 8 + s * 0.52, // 5 → 10.6px, 100 → 60px
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

// 그림자·발광이 잘리지 않도록 잘라내는 창을 글자 상자보다 사방 40px 열어 둔다
// (옛 clip-path 구현의 inset -40px과 같은 몫 — 그림자 번짐 최대 25px + 발광 무리 30px 언저리).
const WRITE_CLIP_ROOM = 40;

// 외곽 흐림은 애니메이션되는 요소가 아니라 그 '안'의 정지 요소에 건다 (ADR-052).
// 애니메이션이 걸린 요소는 합성 레이어로 승격되는데, iOS는 합성 레이어의 filter를
// 화면을 그릴 때마다 다시 계산한다 — 등장 효과 내내 매 프레임 블러가 돌았다.
// 안쪽 정지 요소의 filter는 부모 레이어를 래스터할 때 한 번만 구워진다.
// (blur 걸린 '조상' 안에서 글자가 움직이는 것은 여전히 금물 — 매 프레임 재블러, ADR-045.)
function EdgeBlurred({ filter, children }: { filter?: string; children: ReactNode }) {
  if (filter === undefined) return <>{children}</>;
  return <span style={{ filter }}>{children}</span>;
}

// 손으로 쓰는 효과 — 줄마다 왼쪽에서 오른쪽으로 잉크가 드러난다.
// 획을 따라가는 진짜 필기는 글리프마다 SVG 경로가 있어야 해서 임의의 글자로는 만들 수 없다.
// 줄 단위로 쓸어 주는 것이 글꼴을 가리지 않고 '쓰는 중'으로 읽히는 가장 가까운 모양이다.
//
// 창(overflow hidden)이 왼쪽에서 오고 잉크가 오른쪽에서 와서 상쇄된다 — 글자는 제자리에
// 있고 보이는 창만 왼쪽부터 넓어진다. clip-path 애니메이션이 아닌 이유는 globals.css의
// keyframe 주석 참고(모바일 메인 스레드 끊김). 두 상자의 패딩·마진이 같아야 %(상자 폭 기준)
// 이동이 정확히 상쇄되어 글자가 흐르지 않는다.
//
// 줄을 직접 나누는 이유: 가운데 정렬된 문단은 상자가 캔버스 폭 전체라 왼쪽 빈 여백부터
// 쓸고 지나간다. 줄마다 inline-block으로 감싸면 상자가 글자에 딱 붙어서 잉크가 나오는
// 순간과 쓸리는 속도가 맞는다. vertical-align: top — overflow가 있는 inline-block은
// 기준선이 글자가 아니라 상자 아래 모서리가 되어 줄이 위로 들리는 것을 막는다.
function WrittenText({
  text,
  speed,
  edgeFilter,
}: {
  text: string;
  speed: number;
  edgeFilter?: string;
}) {
  const lines = text.split("\n");
  const durations = lines.map(
    (line) => (Math.max([...line].length, 1) * WRITE_MS_PER_CHAR) / speed,
  );
  // 각 줄은 앞 줄을 다 쓴 뒤에 시작한다
  const delayOf = (index: number) => durations.slice(0, index).reduce((sum, ms) => sum + ms, 0);
  const room = { padding: WRITE_CLIP_ROOM, margin: -WRITE_CLIP_ROOM } as const;

  return (
    <>
      {lines.map((line, i) => (
        <span key={i} className="block">
          <span
            data-canvas-anim
            className="inline-block overflow-hidden align-top"
            style={{
              ...room,
              willChange: "transform", // 줄이 시작되는 순간의 레이어 승격 래스터를 미리 치른다
              animation: `canvas-write-window ${durations[i]}ms linear ${delayOf(i)}ms backwards`,
            }}
          >
            <span
              data-canvas-anim
              className="inline-block"
              style={{
                ...room,
                willChange: "transform",
                animation: `canvas-write-ink ${durations[i]}ms linear ${delayOf(i)}ms backwards`,
              }}
            >
              <EdgeBlurred filter={edgeFilter}>
                {line === "" ? " " : line /* 빈 줄도 높이를 가져야 줄이 밀린다 */}
              </EdgeBlurred>
            </span>
          </span>
        </span>
      ))}
    </>
  );
}

// 등장 효과가 다 나타나기까지 걸리는 시간(ms) — 발광 층이 이 시간에 맞춰 차오른다.
function totalEntranceMs(overlay: HeroOverlay): number {
  const speed = overlay.animationSpeed;
  if (overlay.animation === "fade" || overlay.animation === "rise") return BLOCK_MS / speed;
  if (overlay.animation === "writing") {
    return overlay.text
      .split("\n")
      .reduce((sum, line) => sum + (Math.max([...line].length, 1) * WRITE_MS_PER_CHAR) / speed, 0);
  }
  const effect = CHAR_EFFECTS[overlay.animation];
  if (effect === undefined) return 0; // "none"
  const count = [...overlay.text].length;
  return (Math.max(count - 1, 0) * effect.stepMs + effect.durationMs) / speed;
}

// 코드포인트 단위로 쪼갠다 — split("")은 이모지를 반쪽씩 잘라 깨뜨린다.
// 줄바꿈(\n)도 한 글자로 취급되며, 부모의 whitespace-pre-line이 그대로 줄을 넘긴다.
// 외곽 흐림은 애니메이션되는 글자 상자가 아니라 그 안의 정지 요소에 건다 — EdgeBlurred 참고.
function OverlayText({ overlay }: { overlay: HeroOverlay }) {
  const speed = overlay.animationSpeed;
  const edgeFilter = overlay.edgeBlurPx === 0 ? undefined : `blur(${overlay.edgeBlurPx}px)`;
  if (overlay.animation === "writing") {
    return <WrittenText text={overlay.text} speed={speed} edgeFilter={edgeFilter} />;
  }

  const effect = CHAR_EFFECTS[overlay.animation];
  // 정지 모드(none·fade·rise)의 외곽 흐림은 PhotoOverlay의 정지 래퍼가 맡는다 — 여기서
  // 또 걸면 이중 블러가 된다
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
          <EdgeBlurred filter={edgeFilter}>{char}</EdgeBlurred>
        </span>
      ))}
    </>
  );
}

// 발광 사본 전용 텍스트 — 컬러 이모지는 color:transparent로 감춰지지 않는다(CSS color의 알파는
// 컬러 글리프의 내장 색에 안 먹는다 — CSS Color 명세). 발광 층은 문구 전체를 정지(animation:"none")로
// 그리므로, 이모지가 섞이면 그 이모지만 후광 없이 선명하게 조기 노출된다(쓰기·타자 효과가 거기
// 도달하기 전에). 예전 filter:blur()는 이모지도 흐려 후광에 녹였지만 text-shadow는 못 한다 (ADR-052).
// 컬러 이모지 코드포인트만 opacity:0으로 감춘다 — advance 폭은 남아 후광 텍스트가 본문과 정렬을
// 유지하고, 일반 글자는 부모의 color:transparent로 감춰진 채 text-shadow 후광만 남는다.
function GlowText({ text }: { text: string }) {
  const chars = [...text];
  const nodes: ReactNode[] = [];
  let run = ""; // 이모지 사이의 일반 글자 묶음 — 부모 color:transparent로 후광만 남긴다
  const flushRun = (key: string) => {
    if (run === "") return;
    nodes.push(<Fragment key={key}>{run}</Fragment>);
    run = "";
  };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const forced = chars[i + 1] === "️"; // 표시 지정자가 컬러 이모지로 강제
    if (/\p{Emoji_Presentation}/u.test(ch) || forced) {
      flushRun(`t${i}`);
      nodes.push(
        <span key={`e${i}`} style={{ opacity: 0 }}>
          {forced ? ch + "️" : ch}
        </span>,
      );
      if (forced) i++; // FE0F를 이모지에 합쳐 소비했으니 건너뛴다
    } else {
      run += ch;
    }
  }
  flushRun("t-last");
  return <>{nodes}</>;
}

function PhotoOverlay({ overlay }: { overlay: HeroOverlay }) {
  // top과 translateY에 같은 %를 주면 0%는 위쪽 끝, 100%는 아래쪽 끝에 딱 맞는다 —
  // top만 쓰면 100%에서 글자가 사진 밖으로 절반 넘어간다.
  const pct = overlay.positionPct;
  const blockKeyframes = BLOCK_KEYFRAMES[overlay.animation];
  return (
    // overflow-hidden: 이 문구는 '사진 위'가 존재 이유다 — 기울이거나(200pt까지) 키워서
    // 사진을 벗어나는 부분은 사진에서 잘리고, 아래 섹션을 덮거나 페이지에 가로
    // 스크롤을 만들지 않는다 (absolute 요소도 조상의 스크롤 넘침을 늘린다).
    <div
      data-hero-overlay
      className="pointer-events-none absolute inset-0 overflow-hidden px-8 py-10"
    >
      <div className="relative h-full">
        <p
          className="absolute inset-x-0 text-center break-keep whitespace-pre-line"
          style={{
            top: `${pct}%`,
            // 기울기는 자리를 잡은 뒤(translate 다음) 상자 가운데를 축으로 돈다 —
            // 등장 효과(rise)가 transform을 애니메이션하는 안쪽 상자에 걸면 재생이 끝나는
            // 순간 기울기가 풀리므로 여기서만 건다.
            transform: `translateY(-${pct}%) rotate(${overlay.rotateDeg}deg)`,
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
            {/* 발광 층 — 같은 글자를 블러로 두 번 더 그려 뒤에 깐다. 글꼴·자간을 물려받는다.
                블러 안의 글자는 '정지 상태'로 그린다(등장 효과 없음): blur 필터는 내용이
                바뀔 때마다 처음부터 다시 계산되는데, 사본 안에서 쓰기·타자 효과가 돌면
                모바일이 매 프레임 재블러하느라 뚝뚝 끊긴다 (ADR-045). 대신 층 전체가 등장
                시간에 맞춰 불투명도로 차오른다 — 글자가 써지는 동안 후광이 함께 번져 온다.
                숨쉬는 밝기는 바깥 상자의 무한 애니메이션이 맡고(차오르기가 도는 동안은 뒤에
                적힌 차오르기가 이긴다), 모션 최소화 설정에서는 둘 다 꺼져 일정한 밝기로 남는다. */}
            {overlay.glow && (
              <span
                aria-hidden
                className="absolute inset-0 block"
                style={{
                  animation:
                    totalEntranceMs(overlay) === 0
                      ? "canvas-glow-breathe 4s ease-in-out infinite"
                      : `canvas-glow-breathe 4s ease-in-out infinite, canvas-fade-in ${totalEntranceMs(overlay)}ms ease-out backwards`,
                }}
              >
                {GLOW_LAYERS.map((layer, i) => (
                  <span
                    key={i}
                    className="absolute inset-0 block"
                    style={{
                      // 글자 몸은 숨기고 번짐(그림자)만 남긴다 — 상속되던 어두운 그림자도
                      // 이 지정이 대체한다(섞이면 후광이 탁해진다). 컬러 이모지는 color로 안
                      // 감춰져 GlowText가 opacity로 따로 감춘다.
                      color: "transparent",
                      textShadow: `0 0 ${layer.radiusPx(overlay.glowStrength)}px ${overlay.color}`,
                      opacity: layer.opacity(overlay.glowStrength),
                    }}
                  >
                    <GlowText text={overlay.text} />
                  </span>
                ))}
              </span>
            )}
            {/* 외곽 흐림: 정지 상태(none·fade·rise — 글자 픽셀이 안 바뀌는 모드)에서만 여기에
                건다. 글자가 안에서 움직이는 모드(타자·쓰기)는 애니메이션되는 상자 '안'의
                정지 요소에 건다 — EdgeBlurred(ADR-052) 참고. */}
            <span
              className="relative block"
              style={
                overlay.edgeBlurPx === 0 ||
                CHAR_EFFECTS[overlay.animation] !== undefined ||
                overlay.animation === "writing"
                  ? undefined
                  : { filter: `blur(${overlay.edgeBlurPx}px)` }
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
