import type { Metadata } from "next";
import { cache } from "react";
import {
  buildPublicPayload,
  publicPageMeta,
  type PublicInvitationPayload,
} from "@/invitation/publicPayload";
import { getServerSupabase } from "@/server/supabase/serverClient";
import { PublicInvitationView } from "../../_shared/PublicInvitationView";

// 게스트용 공개 청첩장 — 인증 없이 접근, 서버 렌더(초기 콘텐츠 HTML 포함).
// 게스트 읽기는 slug 단건 definer RPC(get_published_by_slug)뿐이다 — 테이블 직접
// SELECT는 anon에게 없으므로 발행 목록 열거·숨긴 섹션 노출이 불가능하다 (ADR-023).
// RPC가 숨긴 섹션을 제거하고, 앱의 buildPublicPayload가 같은 projection을 한 번 더 적용한다.

const loadPublished = cache(async (slug: string): Promise<PublicInvitationPayload | null> => {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("get_published_by_slug", { p_slug: slug });
  if (error !== null || data === null) return null;
  const raw = data as { doc: unknown; assets: unknown };
  return buildPublicPayload(raw.doc, raw.assets);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const payload = await loadPublished(slug);
  // 하객 전용 페이지 — 검색 엔진 비노출
  const robots = { index: false, follow: false };
  if (payload === null) {
    return { title: "청첩장을 찾을 수 없습니다", robots };
  }
  const meta = publicPageMeta(payload);
  return {
    title: meta.title,
    description: meta.description,
    robots,
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      ...(meta.heroImageUrl !== null ? { images: [{ url: meta.heroImageUrl }] } : {}),
    },
    twitter: {
      card: meta.heroImageUrl !== null ? "summary_large_image" : "summary",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const payload = await loadPublished(slug);

  if (payload === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-[#faf7f1] px-6 text-[#221d16]">
        <p className="text-[16px] font-medium">청첩장을 찾을 수 없습니다</p>
        <p className="text-[13px] opacity-60">주소를 다시 확인해 주세요.</p>
      </main>
    );
  }

  return (
    <PublicInvitationView
      doc={payload.doc}
      manifest={payload.assets}
      shareTitle={publicPageMeta(payload).title}
      rsvpSlug={slug}
      calendarIcsUrl={`/i/${encodeURIComponent(slug)}/wedding.ics`}
    />
  );
}
