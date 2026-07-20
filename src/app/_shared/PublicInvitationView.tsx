"use client";

import { useMemo, useState } from "react";
import { resolveBuiltinAsset } from "@/editor/assets/builtinAssets";
import {
  fontUrlOf,
  manifestResolver,
  musicUrlOf,
  type PublicAssetEntry,
} from "@/invitation/publicPayload";
import { kakaoJsKeyFromEnv } from "@/invitation/lib/kakaoShare";
import type { InvitationDocument } from "@/invitation/schema/document";
import { InvitationRenderer } from "@/renderer/InvitationRenderer";

// 공개(/i/[slug])·비공개 미리보기(/p/[token])가 공유하는 게스트 화면.
// 편집기 미리보기와 동일한 InvitationRenderer를 사용한다 (단일 renderer 원칙, ADR-004).
// mobile-first: 컨텐츠 폭은 최대 430px, 데스크톱에서는 중앙 정렬.
export function PublicInvitationView({
  doc,
  manifest,
  previewBadge = false,
  shareTitle,
  rsvpSlug,
}: {
  doc: InvitationDocument;
  manifest: PublicAssetEntry[];
  previewBadge?: boolean;
  shareTitle?: string; // 지정 시 공유 버튼 표시 (Web Share API + 링크 복사 fallback)
  rsvpSlug?: string; // 발행된 공개 페이지만 전달 — 비공개 미리보기의 RSVP 폼은 제출 불가
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
          rsvpSlug={rsvpSlug}
          musicUrl={musicUrl}
          resolveFontUrl={resolveFontUrl}
          kakaoJsKey={kakaoJsKeyFromEnv()}
        />
        {shareTitle !== undefined && <ShareBar title={shareTitle} />}
      </div>
    </main>
  );
}

function ShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    // Web Share API 우선, 미지원 환경(데스크톱 등)은 링크 복사로 fallback
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // 사용자가 공유 시트를 닫음 — 아무것도 하지 않는다
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pointer-events-none sticky bottom-5 z-10 flex justify-center pb-2">
      <button
        type="button"
        onClick={() => void share()}
        className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-black/75 px-5 text-[13px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur transition-colors hover:bg-black/85"
      >
        {copied ? "링크가 복사되었습니다" : "청첩장 공유하기"}
      </button>
    </div>
  );
}
