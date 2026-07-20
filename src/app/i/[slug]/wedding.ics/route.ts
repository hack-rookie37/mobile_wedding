import { weddingIcsResponse } from "@/invitation/lib/ics";
import { buildPublicPayload } from "@/invitation/publicPayload";
import { getServerSupabase } from "@/server/supabase/serverClient";

// 발행된 청첩장의 예식 일정(.ics) — 페이지와 같은 slug 단건 RPC만 사용한다 (ADR-023).
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("get_published_by_slug", { p_slug: slug });
  if (error !== null || data === null) {
    return new Response("청첩장을 찾을 수 없습니다", { status: 404 });
  }
  const raw = data as { doc: unknown; assets: unknown };
  return weddingIcsResponse(buildPublicPayload(raw.doc, raw.assets).doc.wedding);
}
