"use client";

import { customFontFamily } from "@/invitation/schema/themes";

// 업로드 폰트 URL 해석기 — 호스트(편집기·공개 페이지)가 asset 저장소를 보고 채운다.
// 알 수 없는 id는 null: 폰트가 없으면 fallback 스택으로 그려질 뿐 렌더가 깨지지 않는다.
export type ResolveFontUrl = (assetId: string) => string | null;

// assetId는 저장소가 만든 식별자다 — CSS 식별자로 쓰기 전에 형태를 확인한다.
// (문서는 사용자 입력이 아니지만, CSS 문자열을 조립하는 자리이므로 방어적으로 좁힌다)
const SAFE_ASSET_ID = /^[A-Za-z0-9_-]+$/;

export function CustomFontFaces({
  assetIds,
  resolveFontUrl,
}: {
  assetIds: string[];
  resolveFontUrl: ResolveFontUrl | null;
}) {
  if (resolveFontUrl === null) return null;

  const faces = assetIds
    .filter((assetId) => SAFE_ASSET_ID.test(assetId))
    .map((assetId) => ({ assetId, url: resolveFontUrl(assetId) }))
    .filter((entry): entry is { assetId: string; url: string } => entry.url !== null)
    // JSON.stringify로 url을 따옴표 문자열로 만든다 — 따옴표·역슬래시가 이스케이프된다
    .map(
      // font-display block — 내장 폰트와 같은 이유(FOUT가 '깨졌다 로딩되는' 인상, ADR-046)
      ({ assetId, url }) =>
        `@font-face{font-family:"${customFontFamily(assetId)}";src:url(${JSON.stringify(url)});font-display:block;}`,
    );

  if (faces.length === 0) return null;
  return <style>{faces.join("")}</style>;
}
