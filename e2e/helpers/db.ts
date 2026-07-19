import type { TestUser } from "./auth";
import { anonClient } from "./env";

// e2e에서 서버에 실제로 저장된 문서 JSON을 검증하기 위한 접근 (사용자 세션, RLS 통과)

export async function fetchStoredDoc(user: TestUser, projectId: string): Promise<unknown> {
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword(user);
  if (signIn.error) throw new Error(`문서 확인용 로그인 실패: ${signIn.error.message}`);
  const { data, error } = await client
    .from("invitation_documents")
    .select("doc")
    .eq("project_id", projectId)
    .single();
  if (error) throw new Error(`저장 문서 조회 실패: ${error.message}`);
  return data.doc;
}

// 서버에 실제로 저장된 RSVP 응답 행 확인 (소유자 세션, RLS 통과) — 허니팟 미저장 검증 등
export async function fetchRsvpRows(
  user: TestUser,
  projectId: string,
): Promise<{ guest_name: string }[]> {
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword(user);
  if (signIn.error) throw new Error(`응답 확인용 로그인 실패: ${signIn.error.message}`);
  const { data, error } = await client
    .from("rsvp_responses")
    .select("guest_name")
    .eq("project_id", projectId);
  if (error) throw new Error(`응답 조회 실패: ${error.message}`);
  return data ?? [];
}
