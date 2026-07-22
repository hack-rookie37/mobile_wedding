import { z } from "zod";
import { coupleNames, formatWeddingDate } from "./lib/format";
import { referencedAssetIds } from "./lib/assetRefs";
import { migrateDocument } from "./schema/migrate";
import type { PublicAssetEntry, PublicInvitationPayload } from "./publicManifest";

// 게스트 화면이 쓰는 가벼운 해석 유틸(zod 없는)은 publicManifest.ts에 있다 (ADR-040 번들).
// 편의를 위해 여기서도 그대로 다시 내보낸다 — 서버 코드는 이 파일 하나만 import하면 된다.
// 단, 클라이언트 컴포넌트는 publicManifest.ts에서 직접 가져와야 zod가 딸려오지 않는다.
export type { PublicAssetEntry, PublicInvitationPayload } from "./publicManifest";
export { manifestResolver, fontUrlOf, musicUrlOf } from "./publicManifest";

// ADR-019 — 명시적 public projection.
// 공개·미리보기 응답은 이 계층을 통과한 것만 클라이언트로 나간다:
//  * 문서: zod 화이트리스트 full parse(+마이그레이션) — 스키마 밖 키(편집기 상태·내부 메타)는 제거된다
//  * asset: 공개 URL·치수만 — 내부 storage 경로·해시·파일명은 스키마가 거부한다
//  * asset: 게다가 문서가 실제로 참조하는 것만 — 쓰지 않는 업로드·숨긴 섹션 전용 사진은 뺀다 (ADR-041)
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
// 이 스키마의 z.infer는 publicManifest.ts의 손으로 쓴 PublicAssetEntry와 같은 모양을 유지해야 한다.
// buildPublicPayload의 반환 타입이 '스키마에 필드가 빠진' 쪽 drift는 잡지만 '스키마에만 필드가
// 늘어난' 쪽은 못 잡는다 — 두 정의를 손으로 맞춰 둔다(한쪽을 바꾸면 다른 쪽도 같이).

export function buildPublicPayload(rawDoc: unknown, rawAssets: unknown): PublicInvitationPayload {
  const migrated = migrateDocument(rawDoc);
  // 숨긴 섹션은 내용째 제거한다 — 렌더에 안 쓰는 데이터(예: 숨긴 계좌·연락처)를
  // 게스트 응답에 실어 보내지 않는다 (hero는 숨길 수 없어 불변식이 유지된다)
  const doc = { ...migrated, sections: migrated.sections.filter((section) => section.visible) };

  // strict: 화이트리스트 밖 키(예: storagePath)가 섞여 있으면 통과가 아니라 실패 (fail fast).
  // kind 도입(BGM) 전 발행 스냅샷의 entry에는 kind가 없다 — 전부 이미지였으므로 보정한다.
  const manifest: PublicAssetEntry[] = z.array(publicAssetEntrySchema).parse(
    z
      .array(z.looseObject({}))
      .parse(rawAssets)
      .map((entry) => ("kind" in entry ? entry : { ...entry, kind: "image" })),
  );

  // 문서(보이는 섹션 + 전역 음악·폰트)가 실제로 참조하는 asset만 내보낸다 (ADR-041).
  // 안 그러면 올렸다 뺀 사진·숨긴 섹션 전용 사진까지 공개 URL을 얻어 하객 payload로 샌다.
  // referencedAssetIds는 asset을 가진 모든 섹션 타입을 덮으므로 필요한 것을 떨어뜨리지 않는다.
  const referenced = referencedAssetIds(doc);
  return { doc, assets: manifest.filter((entry) => referenced.has(entry.id)) };
}

// social metadata 파생 — 공개 페이지의 <meta> 구성용
export interface PublicPageMeta {
  title: string;
  description: string;
  heroImageUrl: string | null; // 대표 이미지 (업로드 asset이 아닐 때는 null)
}

export function publicPageMeta(payload: PublicInvitationPayload): PublicPageMeta {
  const { wedding, sections } = payload.doc;
  const couple = coupleNames(wedding);
  const title = couple !== null ? `${couple} 결혼합니다` : "모바일 청첩장";

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
