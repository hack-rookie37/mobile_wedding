import type { SupabaseClient } from "@supabase/supabase-js";
import type { RsvpAdminPort } from "@/invitation/rsvp/port";
import type { RsvpResponse } from "@/invitation/rsvp/responses";
import { PersistenceError } from "./persistence";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RsvpAdminPort의 Supabase 구현 — 사용자 세션(RLS invoker)으로만 동작한다.
// RLS가 소유자 외 접근을 빈 결과로 거르므로, 남의 projectId로는 아무것도 보이지 않는다.
export class SupabaseRsvpAdmin implements RsvpAdminPort {
  constructor(private readonly client: SupabaseClient) {}

  async loadProjectTitle(projectId: string): Promise<string | null> {
    // uuid가 아닌 경로 파라미터는 DB 에러가 아니라 '없음'이다
    if (!UUID_PATTERN.test(projectId)) return null;
    const { data, error } = await this.client
      .from("projects")
      .select("title")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw new PersistenceError(`프로젝트 조회 실패: ${error.message}`);
    if (data === null) return null; // 없는 프로젝트 또는 권한 없음 — RLS는 둘을 구분해주지 않는다
    return data.title;
  }

  async list(projectId: string): Promise<RsvpResponse[]> {
    const { data, error } = await this.client
      .from("rsvp_responses")
      .select(
        "id, guest_name, side, attending, companions, meal, phone, message, created_at, updated_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new PersistenceError(`응답 목록 조회 실패: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      guestName: row.guest_name,
      side: row.side,
      attending: row.attending,
      companions: row.companions,
      meal: row.meal,
      phone: row.phone,
      message: row.message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async remove(projectId: string, responseId: string): Promise<void> {
    const { error } = await this.client
      .from("rsvp_responses")
      .delete()
      .eq("project_id", projectId)
      .eq("id", responseId);
    if (error) throw new PersistenceError(`응답 삭제 실패: ${error.message}`);
  }

  async removeAll(projectId: string): Promise<void> {
    const { error } = await this.client
      .from("rsvp_responses")
      .delete()
      .eq("project_id", projectId);
    if (error) throw new PersistenceError(`응답 전체 삭제 실패: ${error.message}`);
  }
}
