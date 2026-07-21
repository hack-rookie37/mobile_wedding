import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

// 하객 읽기 전용 클라이언트 — 쿠키를 읽지 않는다 (ADR-040).
// 쿠키 접근은 라우트를 동적으로 만들고 unstable_cache 안에서는 금지된다. 발행 스냅샷을
// 캐시하려면 세션 없는 클라이언트가 필요하다 — 공개 RPC(get_published_*)는 anon에 grant돼
// 있어 세션 없이 호출된다(테이블 직접 접근은 여전히 RLS로 막힌다, ADR-023).
export function getPublicSupabase(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
