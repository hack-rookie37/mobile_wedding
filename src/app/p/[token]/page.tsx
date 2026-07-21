import type { Metadata } from "next";
import { buildPublicPayload } from "@/invitation/publicPayload";
import { manifestFromPreviewAssets } from "@/server/supabase/assetManifest";
import { proxyManifest } from "@/server/supabase/assetProxy";
import { getServerSupabase } from "@/server/supabase/serverClient";
import { PublicInvitationView } from "../../_shared/PublicInvitationView";

// 비공개 미리보기 — 토큰이 자격증명이다 (ADR-019).
// 서버가 definer RPC로 토큰·만료를 검증하고, 유효하면 현재 draft를
// public projection을 거쳐 렌더한다. 무효·폐기·만료는 구분 없이 거부.

export const metadata: Metadata = {
  title: "비공개 미리보기",
  robots: { index: false, follow: false }, // 검색 엔진 비노출
};

export default async function PreviewByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("get_preview_by_token", { p_token: token });

  if (error !== null || data === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-[#faf7f1] px-6 text-[#221d16]">
        <p className="text-[16px] font-medium">미리보기 링크가 유효하지 않습니다</p>
        <p className="max-w-sm text-center text-[13px] leading-[1.6] opacity-60">
          링크가 폐기되었거나 만료되었을 수 있습니다. 링크를 보낸 분에게 새 링크를 요청해 주세요.
        </p>
      </main>
    );
  }

  const raw = data as { doc: unknown; assets: unknown };
  // storage 내부 경로는 여기(서버)에서 공개 URL로 변환된다 — 클라이언트로 경로가 나가지 않는다
  const manifest = manifestFromPreviewAssets(supabase, raw.assets);
  const payload = buildPublicPayload(raw.doc, manifest);

  return (
    <PublicInvitationView
      doc={payload.doc}
      manifest={proxyManifest(payload.assets)}
      previewBadge
      calendarIcsUrl={`/p/${encodeURIComponent(token)}/wedding.ics`}
    />
  );
}
