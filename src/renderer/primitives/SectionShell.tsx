"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Section } from "@/invitation/schema/document";
import { fontCssOf, fontScaleFromPt, headingScaleFromPt } from "@/invitation/schema/themes";
import { useRenderer } from "../RendererContext";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function SectionShell({
  section,
  index,
  children,
  flushTop = false,
  flushBottom = false,
}: {
  section: Section;
  index: number;
  children: ReactNode;
  flushTop?: boolean; // 상단 패딩 해제 — 콘텐츠가 캔버스 맨 위에 붙는다 (전면 사진 히어로)
  flushBottom?: boolean; // 하단 패딩 해제 — 콘텐츠가 캔버스 맨 아래에 붙는다 (전면 사진 맺음말)
}) {
  const { mode, selectedSectionId, onSectionSelect, theme, motionReplay } = useRenderer();
  const editing = mode === "editor-edit";
  const selected = editing && selectedSectionId === section.id;

  // 진입 모션: 테마 토큰(duration)과 섹션 style.animation의 조합.
  // 초기값은 서버·클라이언트가 항상 같아야 한다(SSR hydration 안전) —
  // reduced motion의 즉시 표시는 effect에서 처리한다 (matchMedia는 JS API — 렌더러 CSS 미디어 쿼리 금지 규칙과 무관).
  const skipMotion = section.style.animation === "none" || theme.tokens.motionMs === 0;
  const [revealed, setRevealed] = useState(skipMotion);
  // reduced motion: 즉시 표시할 뿐 아니라 transition 자체를 제거한다 — 남겨 두면
  // 숨김→표시 전환이 여전히 fade/rise로 재생된다
  const [instant, setInstant] = useState(false);

  // 편집기에서 진입 애니메이션을 고르면 그 자리에서 한 번 더 재생한다 —
  // 옵션 이름만 보고 결과를 상상하지 않아도 되게. 다시 숨기면 아래 관찰자가 곧바로 되살린다.
  // (prop 변화에 따른 state 재설정은 렌더 중에 하는 것이 React 권장 방식이다)
  const replayToken = motionReplay?.sectionId === section.id ? motionReplay.token : null;
  const [seenReplayToken, setSeenReplayToken] = useState(replayToken);
  if (replayToken !== seenReplayToken) {
    setSeenReplayToken(replayToken);
    if (replayToken !== null) {
      setInstant(false);
      setRevealed(false);
    }
  }

  const shown = revealed || skipMotion;
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown) return;
    const element = bodyRef.current;
    if (!element) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      // reduced motion·관찰 불가 환경에서는 콘텐츠를 숨긴 채 두지 않는다
      void Promise.resolve().then(() => {
        setInstant(true);
        setRevealed(true);
      });
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);

  const motionStyle: CSSProperties =
    skipMotion || instant
      ? {}
      : {
          opacity: shown ? 1 : 0,
          transform:
            !shown && section.style.animation === "rise"
              ? "translateY(var(--canvas-rise-distance))"
              : "none",
          transition:
            "opacity var(--canvas-motion-duration) var(--canvas-motion-ease), transform var(--canvas-motion-duration) var(--canvas-motion-ease)",
        };

  return (
    <section
      data-section-id={section.id}
      onClick={editing && onSectionSelect ? () => onSectionSelect(section.id) : undefined}
      className={clsx("group relative", editing && "cursor-pointer")}
      style={{
        // 축약형(paddingBlock)과 개별형(paddingTop)을 섞으면 React가 바뀐 속성만 다시 적용할 때
        // 축약형이 나중에 적용돼 flushTop이 풀린다 — 항상 개별 속성으로만 쓴다
        paddingTop: flushTop ? 0 : `var(--canvas-pad-${section.style.paddingY})`,
        paddingBottom: flushBottom ? 0 : `var(--canvas-pad-${section.style.paddingY})`,
        // 좌우 여백은 섹션 설정값 하나로 정해진다. 변수로 내려 두면 구분선과 섹션 내부
        // (갤러리 헤더 등)가 같은 값을 따라간다 — 24px을 여러 곳에 다시 적지 않는다.
        ...({ "--canvas-pad-x": `${section.style.paddingX}px` } as CSSProperties),
        ...(section.style.background ? { backgroundColor: section.style.background } : {}),
        // 섹션별 폰트·크기 override — CSS 변수를 지역 재정의하면 하위 텍스트가 전부 따라온다
        ...(section.style.fontFamily !== undefined && fontCssOf(section.style.fontFamily) !== null
          ? ({
              "--canvas-font-heading": fontCssOf(section.style.fontFamily),
              "--canvas-font-body": fontCssOf(section.style.fontFamily),
              fontFamily: "var(--canvas-font-body)",
            } as CSSProperties)
          : {}),
        ...(section.style.bodyPt !== undefined
          ? ({ "--canvas-fs": fontScaleFromPt(section.style.bodyPt) } as CSSProperties)
          : {}),
        ...(section.style.headingPt !== undefined
          ? ({
              "--canvas-fs-heading": headingScaleFromPt(section.style.headingPt),
            } as CSSProperties)
          : {}),
        // 섹션 글자색 — ink에서 파생되는 soft·line까지 같이 옮겨야 색이 따로 놀지 않는다
        ...(section.style.color !== undefined
          ? ({
              "--canvas-ink": section.style.color,
              "--canvas-ink-soft": `color-mix(in srgb, ${section.style.color} 68%, transparent)`,
              "--canvas-line": `color-mix(in srgb, ${section.style.color} 22%, transparent)`,
              color: "var(--canvas-ink)",
            } as CSSProperties)
          : {}),
      }}
    >
      {theme.variants.sectionDivider && index > 0 && (
        <div
          aria-hidden
          className="absolute top-0 h-px"
          style={{
            insetInline: "var(--canvas-pad-x)",
            backgroundColor: "var(--canvas-line)",
          }}
        />
      )}
      <div
        ref={bodyRef}
        data-section-body
        style={{ paddingInline: "var(--canvas-pad-x)", ...motionStyle }}
      >
        {children}
      </div>
      {editing && (
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-0",
            selected
              ? "shadow-[inset_0_0_0_2px_var(--color-tool-accent)]"
              : "group-hover:opacity-60 group-hover:shadow-[inset_0_0_0_1px_var(--color-tool-accent)]",
          )}
        />
      )}
    </section>
  );
}
