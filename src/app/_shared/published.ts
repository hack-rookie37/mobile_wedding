import type { Metadata } from "next";
import { cache } from "react";
import { weddingIcsResponse } from "@/invitation/lib/ics";
import {
  buildPublicPayload,
  publicPageMeta,
  type PublicInvitationPayload,
} from "@/invitation/publicPayload";
import { getServerSupabase } from "@/server/supabase/serverClient";

// 게스트 읽기 경로는 slug 단건 definer RPC(get_published_by_slug) 하나뿐이다 — 테이블 직접
// SELECT는 anon에게 없으므로 발행 목록 열거·숨긴 섹션 노출이 불가능하다 (ADR-023).
// RPC가 숨긴 섹션을 제거하고, buildPublicPayload가 같은 projection을 한 번 더 적용한다.
//
// cache(): 한 요청 안에서 generateMetadata와 page가 각각 불러도 RPC는 한 번만 나간다.
export const loadPublished = cache(
  async (slug: string): Promise<PublicInvitationPayload | null> => {
    const supabase = await getServerSupabase();
    const { data, error } = await supabase.rpc("get_published_by_slug", { p_slug: slug });
    if (error !== null || data === null) return null;
    const raw = data as { doc: unknown; assets: unknown };
    return buildPublicPayload(raw.doc, raw.assets);
  },
);

// 예식 일정(.ics) — 페이지와 같은 slug 단건 RPC만 쓴다 (ADR-023).
export async function publishedIcsResponse(slug: string): Promise<Response> {
  const payload = await loadPublished(slug);
  if (payload === null) {
    return new Response("청첩장을 찾을 수 없습니다", { status: 404 });
  }
  return weddingIcsResponse(payload.doc.wedding);
}

// 하객 전용 페이지 — 루트든 /i/[slug]든 검색 엔진에는 올리지 않는다.
const ROBOTS = { index: false, follow: false };

export function publishedMetadata(payload: PublicInvitationPayload | null): Metadata {
  if (payload === null) {
    return { title: "청첩장을 찾을 수 없습니다", robots: ROBOTS };
  }
  const meta = publicPageMeta(payload);
  return {
    title: meta.title,
    description: meta.description,
    robots: ROBOTS,
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
