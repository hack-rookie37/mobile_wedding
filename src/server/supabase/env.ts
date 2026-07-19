// 필수 환경 변수 — 없으면 즉시 에러 (fail fast, 기본값·폴백 금지).
// service role 키는 어디에서도 사용하지 않는다 (ADR-006) — 이 모듈에 추가하지 말 것.

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("환경 변수 NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다 (.env.local 확인)");
  }
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error(
      "환경 변수 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다 (.env.local 확인)",
    );
  }
  return value;
}
