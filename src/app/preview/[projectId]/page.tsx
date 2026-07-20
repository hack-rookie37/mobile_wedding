"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";
import { AssetLibraryProvider, useAssetLibrary } from "@/editor/assets/AssetLibraryContext";
import { BUILTIN_ASSETS } from "@/editor/assets/builtinAssets";
import { kakaoJsKeyFromEnv } from "@/invitation/lib/kakaoShare";
import type { InvitationDocument } from "@/invitation/schema/document";
import { InvitationRenderer } from "@/renderer/InvitationRenderer";
import { SupabaseAssetStore } from "@/server/supabase/assetStore";
import { getBrowserSupabase } from "@/server/supabase/browserClient";
import { SupabasePersistence } from "@/server/supabase/persistence";
import { useDeferredLoad } from "@/ui/useDeferredLoad";

// 소유자용 draft 미리보기 (세션 필수 — middleware가 보호).
// 게스트에게 공유하는 공개 페이지는 발행 후 /i/[slug]다 (ADR-012).
function PreviewBody({ doc }: { doc: InvitationDocument }) {
  const { resolveAsset, assets } = useAssetLibrary();
  const musicUrl =
    doc.music.assetId !== null
      ? (assets.find((a) => a.record.id === doc.music.assetId)?.fullUrl ?? null)
      : null;
  return (
    <InvitationRenderer
      doc={doc}
      mode="published"
      resolveAsset={resolveAsset}
      musicUrl={musicUrl}
      kakaoJsKey={kakaoJsKeyFromEnv()}
    />
  );
}

export default function PreviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [deps] = useState(() => {
    const client = getBrowserSupabase();
    return {
      persistence: new SupabasePersistence(client),
      assetStore: new SupabaseAssetStore(client, projectId, BUILTIN_ASSETS),
    };
  });
  const load = useCallback(() => deps.persistence.load(projectId), [deps, projectId]);
  const state = useDeferredLoad(load);

  if (state.status !== "ready" || state.value === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-tool-bg px-6 text-tool-ink">
        {state.status === "loading" && (
          <p className="text-[14px] text-tool-ink-soft">불러오는 중…</p>
        )}
        {state.status === "error" && (
          <>
            <p className="text-[15px] font-medium">청첩장을 불러오지 못했습니다</p>
            <p className="max-w-md text-center text-[13px] text-tool-ink-soft">{state.message}</p>
          </>
        )}
        {state.status === "ready" && state.value === null && (
          <>
            <p className="text-[15px] font-medium">청첩장을 찾을 수 없습니다</p>
            <Link href="/" className="text-[13px] text-tool-accent underline underline-offset-2">
              내 청첩장으로 돌아가기
            </Link>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh justify-center bg-canvas-backdrop">
      <div className="w-full max-w-[430px] shadow-[0_0_28px_rgba(0,0,0,0.07)]">
        <AssetLibraryProvider store={deps.assetStore}>
          <PreviewBody doc={state.value.doc} />
        </AssetLibraryProvider>
      </div>
    </main>
  );
}
