// 최근 고른 글꼴 — 문서가 아니라 이 브라우저의 취향이라 localStorage에 둔다.
// 문서에 넣으면 발행본에 실리고, 함께 쓰는 사람마다 목록이 달라져야 하는 값이 하나로 묶인다.

const STORAGE_KEY = "marriage:recent-fonts";
export const RECENT_FONT_LIMIT = 15;

// "테마 기본"·"전역 설정 따름"은 글꼴이 아니라 '고르지 않음'이다 — 최근 목록에 남기지 않는다.
const SENTINELS = new Set(["theme", "inherit"]);

export function readRecentFonts(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(0, RECENT_FONT_LIMIT);
  } catch {
    return []; // 손상된 값은 없는 것으로 친다 — 취향 목록 때문에 편집기가 멈추면 안 된다
  }
}

// 고른 글꼴을 맨 앞으로. 이미 있으면 자리를 옮길 뿐 중복으로 쌓이지 않는다.
export function rememberFont(fontId: string): string[] {
  if (SENTINELS.has(fontId)) return readRecentFonts();
  const next = [fontId, ...readRecentFonts().filter((id) => id !== fontId)].slice(
    0,
    RECENT_FONT_LIMIT,
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장 공간이 없거나 막혀 있어도 고르는 동작 자체는 계속돼야 한다
    }
  }
  return next;
}
