import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { TestUser } from "./auth";

// e2e에서 서버에 실제로 저장된 문서 JSON을 검증하기 위한 접근 (사용자 세션, RLS 통과)

function readEnvLocal(): Record<string, string> {
  // Playwright는 CJS로 트랜스파일하므로 import.meta 대신 프로젝트 루트 기준 경로 사용
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

export async function fetchStoredDoc(user: TestUser, projectId: string): Promise<unknown> {
  const env = readEnvLocal();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  const env = readEnvLocal();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await client.auth.signInWithPassword(user);
  if (signIn.error) throw new Error(`응답 확인용 로그인 실패: ${signIn.error.message}`);
  const { data, error } = await client
    .from("rsvp_responses")
    .select("guest_name")
    .eq("project_id", projectId);
  if (error) throw new Error(`응답 조회 실패: ${error.message}`);
  return data ?? [];
}
