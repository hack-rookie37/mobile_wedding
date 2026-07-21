import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 보호 경로(대시보드·편집기·소유자 미리보기)는 세션 필수 — 없으면 /login.
// 공개 경로: 도메인 루트 청첩장(/ 과 /wedding.ics — 하객이 받는 주소다), /login,
// 발행된 청첩장(/i/*), 토큰 미리보기(/p/* — 토큰 검증은 RPC가 수행),
// 게스트 RSVP 제출(/api/rsvp — 검증·제한은 route와 DB RPC가 수행), 테마 검증용 dev 라우트.
// 루트는 반드시 /^\/$/ 로 고정한다 — /^\// 로 쓰면 모든 경로가 공개가 된다.
const PUBLIC_PATTERNS = [
  /^\/$/,
  /^\/wedding\.ics$/,
  /^\/login$/,
  /^\/i\//,
  /^\/p\//,
  // 업로드 asset 프록시 (ADR-040) — 하객이 받는다. 확장자 exempt는 이미지·폰트만 덮어서
  // .mp3/.m4a 배경음악이 로그인 리다이렉트로 깨지던 것을 여기서 공개로 연다(모든 확장자).
  /^\/a\//,
  /^\/api\/rsvp$/,
  /^\/fixture\//,
  /^\/themes$/,
];

// 로그인한 사람이 돌아갈 곳 — 루트는 하객 청첩장이므로 편집 목록으로 보낸다.
const DASHBOARD_PATH = "/edit";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase 환경 변수가 없습니다 — .env.local을 확인하세요 (fail fast)");
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(): 토큰 서명을 서버에서 검증 + 만료 세션 갱신 (getSession은 검증하지 않는다)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATTERNS.some((pattern) => pattern.test(path));

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }
  if (user && path === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = DASHBOARD_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }
  return response;
}

export const config = {
  // 정적 파일은 미들웨어를 거치지 않는다. public/ 폴더 이름을 하나씩 적던 방식은
  // 새 폴더가 생길 때마다 조용히 깨졌다 — map-apps/를 추가하고 이 목록을 잊자
  // 하객에게 지도 앱 아이콘이 로그인 리다이렉트로 돌아가 깨진 이미지로 보였다.
  // 그래서 폴더가 아니라 '브라우저가 하위 자원으로 받아가는 확장자'로 거른다.
  //
  // 지켜야 할 조건: 보호가 필요한 라우트의 경로가 이 확장자로 끝나면 안 된다.
  // (.ics는 일부러 뺐다 — /preview/<id>/wedding.ics는 소유자 전용이라 검사를 거쳐야 한다.)
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$).*)",
  ],
};
