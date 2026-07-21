import type { Metadata } from "next";
import { cache } from "react";
import { weddingIcsResponse } from "@/invitation/lib/ics";
import {
  buildPublicPayload,
  publicPageMeta,
  type PublicInvitationPayload,
} from "@/invitation/publicPayload";
import { getPublicSupabase } from "@/server/supabase/publicClient";

// 게스트 읽기 경로는 definer RPC 2개뿐이다 — 도메인 루트용(get_published_root)과
// 공개 주소용(get_published_by_slug). 테이블 직접 SELECT는 anon에게 없으므로
// 발행 목록 열거·숨긴 섹션 노출이 불가능하다 (ADR-023).
// RPC가 숨긴 섹션을 제거하고, buildPublicPayload가 같은 projection을 한 번 더 적용한다.
//
// 발행 스냅샷 캐시(ADR-040): 게스트 페이지를 ISR로 캐시해(각 page의 `revalidate`) 하객마다
// RPC를 때리지 않는다. 발행/재발행/중단 때 revalidatePath로 즉시 새로고침한다
// (revalidatePublished). 세션 없는 클라이언트를 쓴다 — 그래야 페이지가 정적으로 캐시된다.
// cache(): 한 요청 안에서 generateMetadata와 page가 각각 불러도 RPC는 한 번만 나간다.
export const PUBLISHED_ROOT_PATH = "/";
export const publishedSlugPath = (slug: string) => `/i/${slug}`;

function payloadOf(data: unknown): PublicInvitationPayload | null {
  if (data === null) return null;
  const raw = data as { doc: unknown; assets: unknown };
  return buildPublicPayload(raw.doc, raw.assets);
}

export const loadPublished = cache(
  async (slug: string): Promise<PublicInvitationPayload | null> => {
    const { data, error } = await getPublicSupabase().rpc("get_published_by_slug", {
      p_slug: slug,
    });
    return error !== null ? null : payloadOf(data);
  },
);

// 도메인 루트에 올라간 발행본 (공개 주소를 따로 두지 않은 것) — ADR-029
export const loadPublishedRoot = cache(async (): Promise<PublicInvitationPayload | null> => {
  const { data, error } = await getPublicSupabase().rpc("get_published_root");
  return error !== null ? null : payloadOf(data);
});

// 예식 일정(.ics) — 페이지와 같은 RPC만 쓴다 (ADR-023).
export function icsResponseOf(payload: PublicInvitationPayload | null): Response {
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
