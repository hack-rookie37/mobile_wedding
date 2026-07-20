import type { InvitationDocument } from "../schema/document";
import { customFontAssetIdOf } from "../schema/themes";

// 문서가 쓰는 업로드 폰트 — 전역 typography와 섹션별 override 양쪽에서 모은다.
// 렌더러의 @font-face 주입과 asset 삭제 보호가 이 목록 하나를 공유한다.
export function customFontAssetIds(doc: InvitationDocument): Set<string> {
  const ids = new Set<string>();
  const add = (fontId: string | undefined) => {
    if (fontId === undefined) return;
    const assetId = customFontAssetIdOf(fontId as never);
    if (assetId !== null) ids.add(assetId);
  };
  add(doc.typography.headingFont);
  add(doc.typography.bodyFont);
  for (const section of doc.sections) add(section.style.fontFamily);
  return ids;
}

// 문서가 참조하는 모든 asset id — 편집기의 삭제 경고와
// 발행본 보호(발행 중 사진 삭제 차단)가 같은 지식을 공유한다.
export function referencedAssetIds(doc: InvitationDocument): Set<string> {
  const ids = new Set<string>();
  const add = (assetId: string | null) => {
    if (assetId !== null) ids.add(assetId);
  };
  add(doc.music.assetId); // 배경음악
  for (const fontAssetId of customFontAssetIds(doc)) ids.add(fontAssetId);
  for (const section of doc.sections) {
    if (section.type === "hero" || section.type === "closing") {
      add(section.content.photoAssetId);
    }
    if (section.type === "coupleProfile") {
      add(section.content.groom.photoAssetId);
      add(section.content.bride.photoAssetId);
    }
    if (section.type === "gallery") {
      for (const photo of section.content.photos) ids.add(photo.assetId);
    }
    if (section.type === "venue") {
      add(section.content.mapImageAssetId);
    }
  }
  return ids;
}
