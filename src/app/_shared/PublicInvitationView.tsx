"use client";

import { useMemo } from "react";
import { resolveBuiltinAsset } from "@/editor/assets/builtinAssets";
// publicManifest에서 직접 가져온다 — publicPayload를 거치면 zod·마이그레이션이 게스트 번들에
// 딸려 온다 ("use client"라 트리셰이킹이 안 걷어낸다, ADR-040).
import {
  fontUrlOf,
  manifestResolver,
  musicUrlOf,
  type PublicAssetEntry,
} from "@/invitation/publicManifest";
import { kakaoJsKeyFromEnv } from "@/invitation/lib/kakaoShare";
import type { InvitationDocument } from "@/invitation/schema/document";
import { InvitationRenderer } from "@/renderer/InvitationRenderer";
import type { RsvpTarget } from "@/renderer/RendererContext";

// 공개(/i/[slug])·비공개 미리보기(/p/[token])가 공유하는 게스트 화면.
// 편집기 미리보기와 동일한 InvitationRenderer를 사용한다 (단일 renderer 원칙, ADR-004).
// mobile-first: 컨텐츠 폭은 최대 430px, 데스크톱에서는 중앙 정렬.
export function PublicInvitationView({
  doc,
  manifest,
  previewBadge = false,
  rsvpTarget,
  calendarIcsUrl,
}: {
  doc: InvitationDocument;
  manifest: PublicAssetEntry[];
  previewBadge?: boolean;
  rsvpTarget?: RsvpTarget; // 발행된 공개 페이지만 전달 — 비공개 미리보기의 RSVP 폼은 제출 불가
  calendarIcsUrl?: string; // 예식 일정(.ics) 주소 — 각 화면이 자기 경로로 만들어 넘긴다
}) {
  const resolveAsset = useMemo(() => manifestResolver(manifest, resolveBuiltinAsset), [manifest]);
  const musicUrl = useMemo(() => musicUrlOf({ doc, assets: manifest }), [doc, manifest]);
  const resolveFontUrl = useMemo(
    () => (assetId: string) => fontUrlOf({ doc, assets: manifest }, assetId),
    [doc, manifest],
  );

  return (
    <main className="flex min-h-dvh justify-center bg-canvas-backdrop">
      <div className="relative w-full max-w-[430px] shadow-[0_0_28px_rgba(0,0,0,0.07)]">
        {previewBadge && (
          <div className="sticky top-0 z-10 bg-[#26262a] px-4 py-2 text-center text-[12px] text-white/90">
            비공개 미리보기 — 이 링크가 있는 사람만 볼 수 있습니다
          </div>
        )}
        <InvitationRenderer
          doc={doc}
          mode="published"
          resolveAsset={resolveAsset}
          rsvpTarget={rsvpTarget}
          musicUrl={musicUrl}
          resolveFontUrl={resolveFontUrl}
          kakaoJsKey={kakaoJsKeyFromEnv()}
          calendarIcsUrl={calendarIcsUrl ?? null}
        />
        {/* 공유 버튼은 렌더러 안의 FloatingShare가 그린다 — 편집기 미리보기와 같은 모습 (ADR-042) */}
      </div>
    </main>
  );
}
