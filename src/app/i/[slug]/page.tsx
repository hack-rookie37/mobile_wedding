import type { Metadata } from "next";
import { publicPageMeta } from "@/invitation/publicPayload";
import { proxyManifest } from "@/server/supabase/assetProxy";
import { InvitationNotFound } from "../../_shared/InvitationNotFound";
import { loadPublished, publishedMetadata } from "../../_shared/published";
import { PublicInvitationView } from "../../_shared/PublicInvitationView";

// 발행 스냅샷을 ISR로 캐시 (ADR-040) — 슬러그별 온디맨드 생성 후 revalidatePath로 새로고침.
export const revalidate = 300;

// slug로 지정한 발행본 — 인증 없이 접근, 서버 렌더(초기 콘텐츠 HTML 포함).
// 도메인 루트(/)도 같은 로더로 이 중 하나를 가리킨다.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return publishedMetadata(await loadPublished(slug));
}

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const payload = await loadPublished(slug);
  if (payload === null) return <InvitationNotFound />;

  return (
    <PublicInvitationView
      doc={payload.doc}
      manifest={proxyManifest(payload.assets)}
      shareTitle={publicPageMeta(payload).title}
      rsvpTarget={{ slug }}
      calendarIcsUrl={`/i/${encodeURIComponent(slug)}/wedding.ics`}
    />
  );
}
