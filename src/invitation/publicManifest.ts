import type { ResolveAsset } from "./assets/assetTypes";
import type { InvitationDocument } from "./schema/document";

// 게스트(하객) 화면이 쓰는 가벼운 asset 해석 유틸 — 여기엔 zod·마이그레이션을 들이지 않는다.
// 이유(ADR-040 성능): PublicInvitationView는 "use client"라, 이 파일이 publicPayload.ts에
// 얹혀 있으면 zod + 전체 스키마·마이그레이션 체인이 게스트 번들로 딸려 온다. 순수 함수만
// 떼어 두면 하객이 내려받는 JS가 그만큼 얇아진다. 서버측 projection은 publicPayload.ts가 맡는다.
// (타입 import는 컴파일 시 지워지므로 InvitationDocument를 참조해도 런타임 의존은 생기지 않는다.)

export interface PublicAssetEntry {
  id: string;
  kind: "image" | "audio" | "font";
  url: string;
  thumbUrl: string | null;
  width: number | null; // 오디오·폰트는 null
  height: number | null;
}

export interface PublicInvitationPayload {
  doc: InvitationDocument;
  assets: PublicAssetEntry[];
}

// manifest → renderer용 동기 해석기 (기본 제공 샘플은 fallback 해석기가 처리)
export function manifestResolver(
  manifest: PublicAssetEntry[],
  fallback: ResolveAsset,
): ResolveAsset {
  const byId = new Map(manifest.map((entry) => [entry.id, entry]));
  return (assetId) => {
    const entry = byId.get(assetId);
    // 오디오는 <img> 해석 대상이 아니다 — 이미지 슬롯에 잘못 참조돼도 placeholder로 표시
    if (!entry || entry.kind !== "image" || entry.width === null || entry.height === null) {
      return fallback(assetId);
    }
    return {
      src: entry.url,
      srcSet:
        entry.thumbUrl !== null
          ? `${entry.thumbUrl} 640w, ${entry.url} ${entry.width}w`
          : undefined,
      width: entry.width,
      height: entry.height,
    };
  };
}

// 업로드 폰트 URL — 문서가 참조하는 id를 manifest에서 찾는다 (폰트 entry만 인정)
export function fontUrlOf(payload: PublicInvitationPayload, assetId: string): string | null {
  return payload.assets.find((a) => a.id === assetId && a.kind === "font")?.url ?? null;
}

// 배경음악 URL — 문서의 music.assetId를 manifest에서 찾는다 (오디오 entry만 인정)
export function musicUrlOf(payload: PublicInvitationPayload): string | null {
  const assetId = payload.doc.music.assetId;
  if (assetId === null) return null;
  const entry = payload.assets.find((a) => a.id === assetId && a.kind === "audio");
  return entry?.url ?? null;
}
