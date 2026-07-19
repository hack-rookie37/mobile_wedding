import type { InvitationDocument, ProfileEntry, Section } from "../schema/document";

// 프로젝트 복제 시 asset은 새 id로 복사된다 — 문서 안의 참조를 함께 바꿔준다.
// 매핑에 없는 id(기본 제공 샘플 등)는 그대로 둔다.
export function remapAssetIds(
  doc: InvitationDocument,
  idMap: ReadonlyMap<string, string>,
): InvitationDocument {
  const mapId = (assetId: string | null): string | null =>
    assetId !== null && idMap.has(assetId) ? idMap.get(assetId)! : assetId;

  const mapProfile = (entry: ProfileEntry): ProfileEntry => ({
    ...entry,
    photoAssetId: mapId(entry.photoAssetId),
  });

  const mapSection = (section: Section): Section => {
    switch (section.type) {
      case "hero":
        return {
          ...section,
          content: { ...section.content, photoAssetId: mapId(section.content.photoAssetId) },
        };
      case "closing":
        return {
          ...section,
          content: { ...section.content, photoAssetId: mapId(section.content.photoAssetId) },
        };
      case "venue":
        return {
          ...section,
          content: { ...section.content, mapImageAssetId: mapId(section.content.mapImageAssetId) },
        };
      case "gallery":
        return {
          ...section,
          content: {
            ...section.content,
            photos: section.content.photos.map((photo) =>
              idMap.has(photo.assetId) ? { ...photo, assetId: idMap.get(photo.assetId)! } : photo,
            ),
          },
        };
      case "coupleProfile":
        return {
          ...section,
          content: {
            ...section.content,
            groom: mapProfile(section.content.groom),
            bride: mapProfile(section.content.bride),
          },
        };
      default:
        return section;
    }
  };

  return { ...doc, sections: doc.sections.map(mapSection) };
}
