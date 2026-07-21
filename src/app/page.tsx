import type { Metadata } from "next";
import { publicPageMeta } from "@/invitation/publicPayload";
import { proxyManifest } from "@/server/supabase/assetProxy";
import { InvitationNotFound } from "./_shared/InvitationNotFound";
import { loadPublishedRoot, publishedMetadata } from "./_shared/published";
import { PublicInvitationView } from "./_shared/PublicInvitationView";

// 발행 스냅샷을 ISR로 캐시한다 (ADR-040) — 하객마다 RPC를 때리지 않는다.
// 발행/재발행/중단 때 revalidatePath로 즉시 새로고침한다(revalidatePublished).
export const revalidate = 300;

// 도메인 루트 = 하객이 받는 청첩장. 편집 도구는 /edit 아래에 있다.
// 공개 주소(slug)를 따로 두지 않고 발행하면 여기에 올라간다 (ADR-029).

export async function generateMetadata(): Promise<Metadata> {
  return publishedMetadata(await loadPublishedRoot());
}

export default async function RootInvitationPage() {
  const payload = await loadPublishedRoot();
  if (payload === null) return <InvitationNotFound />;

  return (
    <PublicInvitationView
      doc={payload.doc}
      manifest={proxyManifest(payload.assets)}
      shareTitle={publicPageMeta(payload).title}
      rsvpTarget={{ slug: null }}
      calendarIcsUrl="/wedding.ics"
    />
  );
}
