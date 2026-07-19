import { customAlphabet } from "nanoid";

// 공개 주소 slug 규칙 — DB check 제약(publish_records_slug_format)과 동일해야 한다
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

// 유효하면 null, 아니면 사용자에게 보여줄 이유를 반환
export function slugError(slug: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return `주소는 ${SLUG_MIN}~${SLUG_MAX}자여야 합니다`;
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "주소는 영문 소문자·숫자·하이픈(-)만 쓸 수 있고, 하이픈으로 시작하거나 끝날 수 없습니다";
  }
  if (slug.includes("--")) {
    return "하이픈(-)을 연속으로 쓸 수 없습니다";
  }
  return null;
}

// 추측 어려운 기본 slug 제안 (형식 규칙을 항상 만족)
const slugAlphabet = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);
export function suggestSlug(): string {
  return slugAlphabet();
}
