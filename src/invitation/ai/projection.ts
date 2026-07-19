import { z } from "zod";
import type { InvitationDocument } from "../schema/document";
import { redactForAi } from "../sensitive";

// AI에 전달하는 sanitized project projection (PRODUCT_SPEC §9, ADR-022).
//
// 포함: redactForAi를 거친 문서(연락처·계좌는 "<redacted>") + 사진 metadata(id·치수·방향).
// 제외되는 것들의 근거:
//  * 원본 이미지 bytes·storage 경로 — 문서에는 assetId만 있고(ADR-016), asset 메타는
//    아래 aiAssetMetaSchema가 허용한 필드만 통과한다 (파일명·해시·경로가 스키마에 없다)
//  * RSVP 응답·참석자 정보 — 문서 스키마에 자리 자체가 없다 (ADR-021)
//  * 인증 정보·revision metadata — 문서 밖 데이터라 이 계층에 도달하지 않는다

export const aiAssetMetaSchema = z.object({
  id: z.string().min(1),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export type AiAssetMeta = z.infer<typeof aiAssetMetaSchema>;

export type AiAssetOrientation = "landscape" | "portrait" | "square";

export function orientationOf(asset: { width: number; height: number }): AiAssetOrientation {
  if (asset.width === asset.height) return "square";
  return asset.width > asset.height ? "landscape" : "portrait";
}

export interface AiProjectionAsset extends AiAssetMeta {
  orientation: AiAssetOrientation;
}

export interface AiProjection {
  doc: InvitationDocument; // sensitive 필드가 redact된 문서
  assets: AiProjectionAsset[];
}

// 저해상도 미리보기 전달(사용자 승인 기반)은 미구현 — 필요해질 때 명시적 동의 UI와 함께 추가한다 (YAGNI)
export function buildAiProjection(doc: InvitationDocument, assets: AiAssetMeta[]): AiProjection {
  return {
    doc: redactForAi(doc),
    assets: assets.map((asset) => ({
      id: asset.id,
      width: asset.width,
      height: asset.height,
      orientation: orientationOf(asset),
    })),
  };
}
