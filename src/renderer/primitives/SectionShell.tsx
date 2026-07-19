"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Section } from "@/invitation/schema/document";
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
  bleed = false,
  flushTop = false,
}: {
  section: Section;
  index: number;
  children: ReactNode;
  bleed?: boolean; // 좌우 패딩 해제 — 콘텐츠가 캔버스 가로를 꽉 채운다 (자체 패딩은 섹션이 관리)
  flushTop?: boolean; // 상단 패딩 해제 — 콘텐츠가 캔버스 맨 위에 붙는다 (전면 사진 히어로)
}) {
  const { mode, selectedSectionId, onSectionSelect, theme } = useRenderer();
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
        paddingBlock: `var(--canvas-pad-${section.style.paddingY})`,
        ...(flushTop ? { paddingTop: 0 } : {}),
        ...(section.style.background ? { backgroundColor: section.style.background } : {}),
      }}
    >
      {theme.variants.sectionDivider && index > 0 && (
        <div
          aria-hidden
          className="absolute inset-x-6 top-0 h-px"
          style={{ backgroundColor: "var(--canvas-line)" }}
        />
      )}
      <div ref={bodyRef} className={bleed ? undefined : "px-6"} style={motionStyle}>
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
