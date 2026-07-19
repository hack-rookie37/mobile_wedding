import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// e2e에서 브라우저를 거치지 않고 서버 상태를 다루기 위한 Supabase 접근 (anon 키, RLS 적용)

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

export function anonClient(): SupabaseClient {
  const env = readEnvLocal();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(".env.local에 Supabase 접속 정보가 없습니다 — `supabase start` 후 설정하세요");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
