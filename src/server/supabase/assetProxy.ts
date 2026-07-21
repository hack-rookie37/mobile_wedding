import type { PublicAssetEntry } from "@/invitation/publicPayload";
import { PHOTOS_BUCKET } from "./assetManifest";
import { supabaseUrl } from "./env";

// 업로드 asset을 Vercel CDN 뒤로 숨기는 프록시 (ADR-040).
//
// Supabase 공개 URL을 그대로 <img>/<audio>/@font-face에 내보내면 하객마다 Supabase에서
// 직접 받는다 — egress가 하객 수에 비례한다. `/a/<path>`로 바꾸면 첫 요청만 Supabase에
// 닿고, 나머지는 Vercel CDN이 immutable 캐시로 감당한다(Hobby 100GB). 경로가 content-hash라
// 내용이 바뀌면 경로도 바뀌므로 1년 immutable 캐시가 안전하다.

export const ASSET_PROXY_PREFIX = "/a/";

// 프록시로 바꿀 대상 — Supabase 공개 URL의 접두사. 이걸로 시작하는 URL만 손댄다.
function storagePublicPrefix(): string {
  return `${supabaseUrl()}/storage/v1/object/public/${PHOTOS_BUCKET}/`;
}

// Supabase 공개 URL → 프록시 경로. 우리 URL이 아니면(빌트인 샘플·data URI 등) 그대로 둔다.
export function toProxiedUrl(url: string): string {
  const prefix = storagePublicPrefix();
  return url.startsWith(prefix) ? ASSET_PROXY_PREFIX + url.slice(prefix.length) : url;
}

// 프록시 경로 안의 object 경로 → Supabase 공개 URL. 라우트가 upstream을 만들 때 쓴다(대칭).
export function storageUrlOfPath(objectPath: string): string {
  return storagePublicPrefix() + objectPath;
}

// 경로 형태 검증 — photos 버킷의 업로드 asset만 프록시한다(임의 경로 중계·상위 경로 탈출 차단).
// 규약: projects/{uuid}/{hash}[.thumb].{ext} (assetStore의 저장 경로와 동일)
export const ASSET_PATH_RE = /^projects\/[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]+$/;

// 게스트 payload의 asset URL을 전부 프록시 경로로 바꾼다 — 렌더러에 넘기기 직전에 적용한다.
export function proxyManifest(assets: PublicAssetEntry[]): PublicAssetEntry[] {
  return assets.map((entry) => ({
    ...entry,
    url: toProxiedUrl(entry.url),
    thumbUrl: entry.thumbUrl === null ? null : toProxiedUrl(entry.thumbUrl),
  }));
}
