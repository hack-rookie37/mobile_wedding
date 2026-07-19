"use client";

import { use, useCallback } from "react";
import {
  createCaseDocument,
  FIXTURE_CASES,
  isFixtureCase,
  type FixtureCase,
} from "@/invitation/fixtures/cases";
import type { ThemeId } from "@/invitation/schema/document";
import { THEME_ORDER } from "@/invitation/schema/themes";
import { InvitationRenderer } from "@/renderer/InvitationRenderer";
import { resolveBuiltinAsset } from "@/editor/assets/builtinAssets";
import { useDeferredLoad } from "@/ui/useDeferredLoad";

// 테마 × 엣지 케이스 스크린샷·수동 검증용 라우트.
// 예: /fixture/film-diary/ten-photos
export default function FixturePage({
  params,
}: {
  params: Promise<{ theme: string; caseId: string }>;
}) {
  const { theme, caseId } = use(params);
  const valid = (THEME_ORDER as string[]).includes(theme) && isFixtureCase(caseId);

  const load = useCallback(() => {
    if (!valid) return null;
    return { ...createCaseDocument(caseId as FixtureCase), theme: { id: theme as ThemeId } };
  }, [theme, caseId, valid]);
  const state = useDeferredLoad(load);

  if (!valid) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-tool-bg px-6 text-tool-ink">
        <p className="text-[15px] font-medium">잘못된 fixture 경로입니다</p>
        <p className="text-[13px] text-tool-ink-soft">
          테마: {THEME_ORDER.join(", ")} / 케이스: {FIXTURE_CASES.join(", ")}
        </p>
      </main>
    );
  }

  if (state.status !== "ready" || state.value === null) {
    return <main className="min-h-dvh bg-tool-bg" aria-busy />;
  }

  return (
    <main className="mx-auto w-full max-w-[430px]">
      <InvitationRenderer doc={state.value} mode="published" resolveAsset={resolveBuiltinAsset} />
    </main>
  );
}
