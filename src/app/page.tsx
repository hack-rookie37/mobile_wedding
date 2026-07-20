import type { Metadata } from "next";
import { rootSlugFromEnv } from "@/invitation/lib/site";
import { publicPageMeta } from "@/invitation/publicPayload";
import { InvitationNotFound } from "./_shared/InvitationNotFound";
import { loadPublished, publishedMetadata } from "./_shared/published";
import { PublicInvitationView } from "./_shared/PublicInvitationView";

// 도메인 루트 = 하객이 받는 청첩장. 편집 도구는 /edit 아래에 있다.
// 어느 청첩장을 여기 걸지는 NEXT_PUBLIC_INVITATION_SLUG가 정한다 (src/invitation/lib/site.ts).

// 설정이 없으면 조용히 빈 화면을 주는 대신 즉시 실패한다 — 하객에게 보여줄 게 없다는 건
// 배포 설정이 빠졌다는 뜻이고, 그 사실이 드러나야 고칠 수 있다.
function rootSlug(): string {
  const slug = rootSlugFromEnv();
  if (slug === null) {
    throw new Error(
      "NEXT_PUBLIC_INVITATION_SLUG가 없습니다 — 도메인 루트에 걸 청첩장의 공개 주소를 설정하세요 (.env.example 참고)",
    );
  }
  return slug;
}

export async function generateMetadata(): Promise<Metadata> {
  return publishedMetadata(await loadPublished(rootSlug()));
}

export default async function RootInvitationPage() {
  const slug = rootSlug();
  const payload = await loadPublished(slug);
  if (payload === null) return <InvitationNotFound />;

  return (
    <PublicInvitationView
      doc={payload.doc}
      manifest={payload.assets}
      shareTitle={publicPageMeta(payload).title}
      rsvpSlug={slug}
      calendarIcsUrl="/wedding.ics"
    />
  );
}
