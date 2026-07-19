import type { InvitationDocument } from "../schema/document";

// 문서가 참조하는 모든 asset id — 편집기의 삭제 경고와
// 발행본 보호(발행 중 사진 삭제 차단)가 같은 지식을 공유한다.
export function referencedAssetIds(doc: InvitationDocument): Set<string> {
  const ids = new Set<string>();
  const add = (assetId: string | null) => {
    if (assetId !== null) ids.add(assetId);
  };
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
  }
  return ids;
}
