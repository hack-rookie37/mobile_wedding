import { ASSET_PATH_RE, storageUrlOfPath } from "@/server/supabase/assetProxy";

// 업로드 asset 프록시 (ADR-040) — Supabase에서 한 번 받아 Vercel CDN이 immutable로 캐시한다.
// 경로가 content-hash라 내용이 바뀌면 경로도 바뀐다 → 1년 immutable 캐시가 안전하다.
//
// Range는 전달하지 않고 항상 전체(200)를 돌려준다: CDN 캐시 정합성이 단순해지고(부분 응답이
// 전체 요청에 잘못 재사용되는 오염이 없다), 대상 파일(줄여 저장한 사진·폰트·짧은 배경음악)이
// 작아 전체 전송이 부담되지 않는다. seek가 필요한 큰 미디어가 생기면 그때 206을 붙인다.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const objectPath = path.map(decodeURIComponent).join("/");
  if (!ASSET_PATH_RE.test(objectPath)) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(storageUrlOfPath(objectPath));
  if (!upstream.ok || upstream.body === null) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType !== null) headers.set("content-type", contentType);
  const contentLength = upstream.headers.get("content-length");
  if (contentLength !== null) headers.set("content-length", contentLength);
  // 브라우저·Vercel 엣지 양쪽에 1년 immutable — CDN-Cache-Control이 Vercel 엣지 캐시를 켠다.
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("cdn-cache-control", "public, max-age=31536000, immutable");
  return new Response(upstream.body, { status: 200, headers });
}
