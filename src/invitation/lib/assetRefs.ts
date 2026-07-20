import type { InvitationDocument } from "../schema/document";
import { customFontAssetIdOf, TEXT_ROLES } from "../schema/themes";

// 문서가 쓰는 업로드 폰트 — 전역 typography와 섹션별 override 양쪽에서 모은다.
// 렌더러의 @font-face 주입과 asset 삭제 보호가 이 목록 하나를 공유한다.
export function customFontAssetIds(doc: InvitationDocument): Set<string> {
  const ids = new Set<string>();
  const add = (fontId: string | undefined) => {
    if (fontId === undefined) return;
    const assetId = customFontAssetIdOf(fontId as never);
    if (assetId !== null) ids.add(assetId);
  };
  // 네 역할이 각각 글꼴을 가질 수 있다 — 전역과 섹션 양쪽에서 모은다 (ADR-035)
  for (const role of TEXT_ROLES) {
    add(doc.typography.roles[role].font);
    for (const section of doc.sections) add(section.style.text[role].font);
  }
  // 메인 사진 위 문구는 역할 밖에서 자기 글꼴을 따로 갖는다 (ADR-034) — 여기서 빠지면
  // @font-face가 주입되지 않아 업로드한 글꼴이 조용히 기본 글꼴로 떨어진다.
  for (const section of doc.sections) {
    if (section.type === "hero") add(section.content.overlay.font);
  }
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
