import type { ReactNode } from "react";

// mono 테마의 스펙시트형 정보 행 (hero 메타 · 오시는 길 공용)
export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-6 py-3" style={{ borderTop: "1px solid var(--canvas-line)" }}>
      <dt className="w-12 shrink-0 pt-0.5 text-[length:calc(10px*var(--canvas-fs))] font-medium tracking-[0.14em] text-(--canvas-ink-soft) uppercase">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[length:calc(13.5px*var(--canvas-fs))] leading-[1.7] text-(--canvas-ink)">
        {children}
      </dd>
    </div>
  );
}

export function MetaList({ children }: { children: ReactNode }) {
  return <dl style={{ borderBottom: "1px solid var(--canvas-line)" }}>{children}</dl>;
}
