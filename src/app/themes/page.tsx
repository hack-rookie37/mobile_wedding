"use client";

import Link from "next/link";
import { createSampleDocument } from "@/invitation/fixtures/sample";
import { THEME_ORDER, THEMES } from "@/invitation/schema/themes";
import { InvitationRenderer } from "@/renderer/InvitationRenderer";
import { resolveBuiltinAsset } from "@/editor/assets/builtinAssets";
import { useDeferredLoad } from "@/ui/useDeferredLoad";

// 동일한 문서 하나를 세 테마로 나란히 렌더하는 비교 페이지.
// 테마가 토큰·variant만 바꾸고 콘텐츠를 보존한다는 것을 눈으로 검증하는 용도.
export default function ThemeComparePage() {
  const state = useDeferredLoad(createSampleDocument);

  return (
    <div className="flex h-dvh flex-col bg-tool-bg text-tool-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-tool-border bg-tool-surface px-6">
        <Link href="/" className="text-[13px] text-tool-ink-soft hover:text-tool-ink">
          ← 내 청첩장
        </Link>
        <div aria-hidden className="h-4 w-px bg-tool-border" />
        <h1 className="text-[14px] font-semibold">테마 비교</h1>
        <p className="text-[12px] text-tool-ink-faint">동일한 문서 · 세 가지 디자인</p>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto">
        {state.status === "ready" && (
          <div className="flex h-full min-w-max justify-center gap-8 px-8 py-6">
            {THEME_ORDER.map((id) => {
              const theme = THEMES[id];
              return (
                <section key={id} className="flex h-full w-[390px] flex-col">
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="text-[13px] font-semibold">{theme.label}</h2>
                    <span className="text-[11px] text-tool-ink-faint">{id}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-tool-border bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                    <InvitationRenderer
                      doc={{ ...state.value, theme: { id } }}
                      mode="published"
                      resolveAsset={resolveBuiltinAsset}
                    />
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
