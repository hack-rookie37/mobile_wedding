"use client";

import { useRenderer } from "../RendererContext";

// 테마 variant에 따라 세 가지 얼굴을 갖는 섹션 헤더.
// editorial: 중앙 정렬 + 세리프 / mono: 좌측 번호 라벨 + hairline / film: 손글씨 라벨
export function SectionHeader({
  label,
  title,
  index,
}: {
  label: string;
  title: string;
  index?: number;
}) {
  const { theme } = useRenderer();
  const variant = theme.variants.header;

  if (variant === "mono") {
    return (
      <header>
        <div className="flex items-center gap-3">
          {index !== undefined && (
            <span className="text-[length:calc(10px*var(--canvas-fs))] font-semibold tracking-[0.08em] text-(--canvas-ink) tabular-nums">
              {String(index).padStart(2, "0")}
            </span>
          )}
          <span className="text-[length:calc(10px*var(--canvas-fs))] font-medium tracking-[0.22em] text-(--canvas-ink-soft) uppercase">
            {label}
          </span>
          <span aria-hidden className="h-px flex-1 bg-(--canvas-line)" />
        </div>
        <h2 className="mt-4 font-(family-name:--canvas-font-heading) text-[length:calc(17px*var(--canvas-fs))] leading-[1.4] font-bold tracking-[-0.01em] text-(--canvas-ink)">
          {title}
        </h2>
      </header>
    );
  }

  if (variant === "film") {
    return (
      <header>
        <p className="font-(family-name:--canvas-font-hand) text-[length:calc(22px*var(--canvas-fs))] leading-none text-(--canvas-accent) lowercase">
          {label.toLowerCase()}
        </p>
        <h2 className="mt-2 font-(family-name:--canvas-font-heading) text-[length:calc(19px*var(--canvas-fs))] leading-[1.45] font-semibold text-(--canvas-ink)">
          {title}
        </h2>
      </header>
    );
  }

  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <p className="text-[length:calc(11px*var(--canvas-fs))] font-medium tracking-[0.18em] text-(--canvas-accent)">
        {label}
      </p>
      <h2 className="font-(family-name:--canvas-font-heading) text-[length:calc(20px*var(--canvas-fs))] leading-[1.45] font-semibold text-(--canvas-ink)">
        {title}
      </h2>
    </header>
  );
}
