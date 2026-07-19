// RSVP server log 정책 (ADR-021): 게스트 입력값(이름·연락처·메시지)은 어떤 로그에도 싣지 않는다.
// /api/rsvp는 이 헬퍼로만 로그 라인을 만들며, 통과할 수 있는 것은 고정 이벤트 이름과
// SQLSTATE 형식의 에러 코드뿐이다 — error.message·details·hint는 제약 위반 시
// 게스트 입력값이 포함될 수 있으므로 통째로 버린다.

const DB_CODE_PATTERN = /^[0-9A-Z]{1,10}$/i;

export function rsvpLogLine(event: string, error?: unknown): string {
  let code: string | undefined;
  if (typeof error === "object" && error !== null && "code" in error) {
    const raw = (error as { code: unknown }).code;
    if (typeof raw === "string" && DB_CODE_PATTERN.test(raw)) {
      code = raw;
    }
  }
  return JSON.stringify({ scope: "rsvp", event, ...(code !== undefined ? { code } : {}) });
}
