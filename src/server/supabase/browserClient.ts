"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

// 브라우저(클라이언트 컴포넌트) 전용 Supabase 클라이언트 — anon 키 + 사용자 세션 쿠키.
// 모든 데이터 접근은 RLS를 통과한다. UI 모듈(editor·renderer)은 이 파일을 import하지 않는다 —
// app이 여기서 만든 어댑터(persistence·asset store)를 주입한다.

let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (client === null) {
    client = createBrowserClient(supabaseUrl(), supabaseAnonKey());
  }
  return client;
}
