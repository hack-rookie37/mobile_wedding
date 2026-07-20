import { z } from "zod";
import type { ResolveAsset } from "./assets/assetTypes";
import { formatWeddingDate } from "./lib/format";
import { migrateDocument } from "./schema/migrate";
import type { InvitationDocument } from "./schema/document";

// ADR-019 — 명시적 public projection.
// 공개·미리보기 응답은 이 계층을 통과한 것만 클라이언트로 나간다:
//  * 문서: zod 화이트리스트 full parse(+마이그레이션) — 스키마 밖 키(편집기 상태·내부 메타)는 제거된다
//  * asset: 공개 URL·치수만 — 내부 storage 경로·해시·파일명은 스키마가 거부한다
// revision 이력·doc_rev·프로젝트 메타는 이 payload에 존재하지 않는다.

export const publicAssetEntrySchema = z
  .strictObject({
    id: z.string().min(1),
    kind: z.enum(["image", "audio", "font"]),
    url: z.string().min(1),
    thumbUrl: z.string().nullable(),
    width: z.number().int().min(1).nullable(), // 오디오는 null
    height: z.number().int().min(1).nullable(),
  })
  .superRefine((entry, ctx) => {
    if (entry.kind === "image" && (entry.width === null || entry.height === null)) {
      ctx.addIssue({ code: "custom", message: "이미지 entry는 width/height가 필수입니다" });
    }
  });

export type PublicAssetEntry = z.infer<typeof publicAssetEntrySchema>;

export interface PublicInvitationPayload {
  doc: InvitationDocument;
  assets: PublicAssetEntry[];
}

export function buildPublicPayload(rawDoc: unknown, rawAssets: unknown): PublicInvitationPayload {
  const doc = migrateDocument(rawDoc);
  return {
    // 숨긴 섹션은 내용째 제거한다 — 렌더에 안 쓰는 데이터(예: 숨긴 계좌·연락처)를
    // 게스트 응답에 실어 보내지 않는다 (hero는 숨길 수 없어 불변식이 유지된다)
    doc: { ...doc, sections: doc.sections.filter((section) => section.visible) },
    // strict: 화이트리스트 밖 키(예: storagePath)가 섞여 있으면 통과가 아니라 실패 (fail fast).
    // kind 도입(BGM) 전 발행 스냅샷의 entry에는 kind가 없다 — 전부 이미지였으므로 보정한다.
    assets: z.array(publicAssetEntrySchema).parse(
      z
        .array(z.looseObject({}))
        .parse(rawAssets)
        .map((entry) => ("kind" in entry ? entry : { ...entry, kind: "image" })),
    ),
  };
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

// social metadata 파생 — 공개 페이지의 <meta> 구성용
export interface PublicPageMeta {
  title: string;
  description: string;
  heroImageUrl: string | null; // 대표 이미지 (업로드 asset이 아닐 때는 null)
}

export function publicPageMeta(payload: PublicInvitationPayload): PublicPageMeta {
  const { wedding, sections } = payload.doc;
  const names = [wedding.groom.name, wedding.bride.name].filter((n) => n !== "");
  const title = names.length === 2 ? `${names[0]} ♥ ${names[1]} 결혼합니다` : "모바일 청첩장";

  const venueLine = [wedding.venue.name, wedding.venue.hall].filter(Boolean).join(" ");
  const description = [formatWeddingDate(wedding.datetime), venueLine]
    .filter((part) => part !== "")
    .join(" · ");

  const hero = sections[0];
  const heroAssetId = hero.type === "hero" ? hero.content.photoAssetId : null;
  const heroImageUrl =
    heroAssetId !== null
      ? (payload.assets.find((asset) => asset.id === heroAssetId)?.url ?? null)
      : null;

  return { title, description, heroImageUrl };
}
