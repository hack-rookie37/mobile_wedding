import { weddingIcsResponse } from "@/invitation/lib/ics";
import { buildPublicPayload } from "@/invitation/publicPayload";
import { getServerSupabase } from "@/server/supabase/serverClient";

// 비공개 미리보기의 예식 일정(.ics) — 페이지와 같은 토큰 검증 RPC를 지난다 (ADR-019).
export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("get_preview_by_token", { p_token: token });
  if (error !== null || data === null) {
    return new Response("미리보기 링크가 유효하지 않습니다", { status: 404 });
  }
  const raw = data as { doc: unknown; assets: unknown };
  return weddingIcsResponse(buildPublicPayload(raw.doc, []).doc.wedding);
}
