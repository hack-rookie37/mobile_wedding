import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// .env.local의 로컬 Supabase 접속 정보를 읽는다 — 없으면 즉시 실패 (fail fast)
function readEnvLocal(): Record<string, string> {
  const content = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const env = readEnvLocal();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(".env.local에 Supabase 접속 정보가 없습니다 — `supabase start` 후 설정하세요");
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let userSeq = 0;

// 로컬 스택은 이메일 확인이 꺼져 있어 signUp 즉시 세션을 받는다
export async function signUpUser(): Promise<SupabaseClient> {
  const client = anonClient();
  const email = `it-${Date.now()}-${userSeq++}@example.com`;
  const password = "test-password-123";
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`테스트 사용자 생성 실패: ${error.message}`);
  if (!data.session) {
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`테스트 사용자 로그인 실패: ${signIn.error.message}`);
  }
  return client;
}

// 1×1 PNG — storage 업로드 테스트용 (브라우저 디코딩 불필요)
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
  "base64",
);
