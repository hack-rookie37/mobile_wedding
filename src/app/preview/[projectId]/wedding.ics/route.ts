import { weddingIcsResponse } from "@/invitation/lib/ics";
import { migrateDocument } from "@/invitation/schema/migrate";
import { getServerSupabase } from "@/server/supabase/serverClient";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 소유자용 초안 미리보기의 예식 일정(.ics).
// 세션 쿠키로 만든 클라이언트라 RLS가 그대로 적용된다 — 남의 프로젝트는 조회 자체가 되지 않는다.
export async function GET(_request: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const notFound = new Response("청첩장을 찾을 수 없습니다", { status: 404 });
  if (!UUID.test(projectId)) return notFound;

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("invitation_documents")
    .select("doc")
    .eq("project_id", projectId)
    .maybeSingle();
  // RLS는 '없음'과 '권한 없음'을 구분하지 않는다 — 여기서도 구분하지 않는다
  if (error !== null || data === null) return notFound;

  return weddingIcsResponse(migrateDocument(data.doc).wedding);
}
