import { z } from "zod";
import {
  photoFrameSchema,
  sectionStyleSchema,
  themeIdSchema,
  weddingSchema,
} from "../schema/document";
import { ADDABLE_SECTION_TYPES } from "../schema/sectionDefaults";

// ADR-003 · ADR-015 — 문서를 바꾸는 유일한 경로.
// 직접 편집 UI와 (향후) AI assistant가 정확히 같은 action을 dispatch한다.
// 모든 action은 직렬화 가능한 JSON이며 zod 스키마가 단일 진실이다.

const sectionIdSchema = z.string().min(1);

// ── asset slot: 섹션 안에서 asset 참조가 붙는 자리

export const assignAssetSlotSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heroPhoto") }),
  // index 지정 시 해당 사진 교체(alt 보존), 미지정 시 끝에 추가
  z.object({ kind: z.literal("galleryItem"), index: z.number().int().min(0).optional() }),
  z.object({ kind: z.literal("profilePhoto"), side: z.enum(["groom", "bride"]) }),
  z.object({ kind: z.literal("closingPhoto") }),
  z.object({ kind: z.literal("venueMap") }), // 오시는 길 약도 이미지
]);

export const removeAssetSlotSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heroPhoto") }),
  z.object({ kind: z.literal("galleryItem"), index: z.number().int().min(0) }),
  z.object({ kind: z.literal("profilePhoto"), side: z.enum(["groom", "bride"]) }),
  z.object({ kind: z.literal("closingPhoto") }),
  z.object({ kind: z.literal("venueMap") }),
]);

// ── document actions (문서를 변경하며 undo 가능)

export const addSectionActionSchema = z.object({
  type: z.literal("addSection"),
  sectionType: z.enum(ADDABLE_SECTION_TYPES), // hero는 스키마 수준에서 추가 불가
  index: z.number().int().min(1), // index 0은 hero 고정 (A-05)
  sectionId: sectionIdSchema.optional(), // 미지정 시 엔진이 생성 (patches에 고정되어 redo 안정)
});

export const removeSectionActionSchema = z.object({
  type: z.literal("removeSection"),
  sectionId: sectionIdSchema,
});

export const duplicateSectionActionSchema = z.object({
  type: z.literal("duplicateSection"),
  sourceSectionId: sectionIdSchema,
  newSectionId: sectionIdSchema.optional(),
});

export const reorderSectionsActionSchema = z.object({
  type: z.literal("reorderSections"),
  // 전체 순서의 순열 — index 산술이 없어 드래그·AI 양쪽에서 안전하다
  order: z.array(sectionIdSchema).min(1),
});

export const toggleSectionVisibilityActionSchema = z.object({
  type: z.literal("toggleSectionVisibility"),
  sectionId: sectionIdSchema,
  visible: z.boolean().optional(), // 미지정 시 반전
});

export const updateSectionContentActionSchema = z.object({
  type: z.literal("updateSectionContent"),
  sectionId: sectionIdSchema,
  // patch의 필드 검증은 apply 시점에 섹션 타입별 content 스키마로 수행한다
  patch: z.record(z.string(), z.unknown()),
});

export const updateSectionSettingsActionSchema = z.object({
  type: z.literal("updateSectionSettings"),
  sectionId: sectionIdSchema,
  patch: sectionStyleSchema.partial(), // paddingY · background · animation
});

export const setSectionVariantActionSchema = z.object({
  type: z.literal("setSectionVariant"),
  sectionId: sectionIdSchema,
  variant: z.string().min(1), // 타입별 허용값은 apply 시점에 layout 스키마로 검증
});

export const setThemeActionSchema = z.object({
  type: z.literal("setTheme"),
  themeId: themeIdSchema,
});

export const updateWeddingActionSchema = z.object({
  type: z.literal("updateWedding"),
  patch: weddingSchema.partial(),
});

// 배경음악 지정·해제 — AI allowlist에 넣지 않는다 (오디오는 사용자가 직접 고른다)
export const setMusicActionSchema = z.object({
  type: z.literal("setMusic"),
  assetId: z.string().min(1).nullable(),
});

// 갤러리 사진 한 장 이동 — 드래그·키보드·메뉴가 같은 action을 쓴다.
// 연속 이동이 undo 1스텝으로 뭉치지 않도록 coalescing 대상이 아니다.
export const moveGalleryPhotoActionSchema = z.object({
  type: z.literal("moveGalleryPhoto"),
  sectionId: sectionIdSchema,
  from: z.number().int().min(0),
  to: z.number().int().min(0),
});

// 갤러리 사진 한 장의 표시 metadata 수정 (caption·alt·frame).
// frame: null은 crop 제거 — 직렬화 가능한 JSON으로 제거를 표현한다.
export const updateGalleryPhotoActionSchema = z.object({
  type: z.literal("updateGalleryPhoto"),
  sectionId: sectionIdSchema,
  index: z.number().int().min(0),
  patch: z
    .object({
      alt: z.string(),
      caption: z.string(),
      frame: photoFrameSchema.nullable(),
    })
    .partial(),
});

// 반복 그룹(교통 items·연락처 entries·계좌 accounts) 한 항목의 필드 수정.
// 같은 항목·같은 필드의 연속 타이핑만 undo 1스텝으로 병합된다 —
// 항목 추가·삭제는 updateSectionContent의 배열 patch로 하며 병합되지 않는다.
export const updateListItemActionSchema = z.object({
  type: z.literal("updateListItem"),
  sectionId: sectionIdSchema,
  field: z.string().min(1), // content 안의 배열 필드 이름 ("items"·"entries"·"accounts")
  index: z.number().int().min(0),
  patch: z.record(z.string(), z.unknown()), // 병합 결과는 apply 시점에 content 스키마로 검증
});

export const assignAssetActionSchema = z.object({
  type: z.literal("assignAsset"),
  sectionId: sectionIdSchema,
  assetId: z.string().min(1),
  slot: assignAssetSlotSchema,
});

export const removeAssetReferenceActionSchema = z.object({
  type: z.literal("removeAssetReference"),
  sectionId: sectionIdSchema,
  slot: removeAssetSlotSchema,
});

const documentActionSchemas = [
  addSectionActionSchema,
  removeSectionActionSchema,
  duplicateSectionActionSchema,
  reorderSectionsActionSchema,
  toggleSectionVisibilityActionSchema,
  updateSectionContentActionSchema,
  updateSectionSettingsActionSchema,
  setSectionVariantActionSchema,
  setThemeActionSchema,
  setMusicActionSchema,
  updateWeddingActionSchema,
  assignAssetActionSchema,
  removeAssetReferenceActionSchema,
  moveGalleryPhotoActionSchema,
  updateGalleryPhotoActionSchema,
  updateListItemActionSchema,
] as const;

export const documentActionSchema = z.discriminatedUnion("type", [...documentActionSchemas]);

// ── batch: 여러 document action을 원자적으로 적용, undo 1스텝

export const batchActionSchema = z.object({
  type: z.literal("batch"),
  label: z.string().optional(),
  actions: z.array(documentActionSchema).min(1), // 중첩 batch 불가
});

// applyAction이 받는 것: document action + batch
export const applicableActionSchema = z.discriminatedUnion("type", [
  ...documentActionSchemas,
  batchActionSchema,
]);

// ── session action: 문서를 바꾸지 않는 편집기 상태 조작 (undo 비대상)

export const selectSectionActionSchema = z.object({
  type: z.literal("selectSection"),
  sectionId: sectionIdSchema,
});

// 편집기 dispatch가 받는 전체 집합
export const editorActionSchema = z.discriminatedUnion("type", [
  ...documentActionSchemas,
  batchActionSchema,
  selectSectionActionSchema,
]);

export type DocumentAction = z.infer<typeof documentActionSchema>;
export type BatchAction = z.infer<typeof batchActionSchema>;
export type ApplicableAction = z.infer<typeof applicableActionSchema>;
export type SelectSectionAction = z.infer<typeof selectSectionActionSchema>;
export type EditorAction = z.infer<typeof editorActionSchema>;

// 히스토리 coalescing 키 (ADR-003): 같은 대상·같은 필드의 연속 입력을 1 undo 스텝으로 병합
export function coalesceKeyOf(action: EditorAction): string | undefined {
  switch (action.type) {
    case "updateSectionContent": {
      // 배열 값 patch(반복 그룹의 추가·삭제 등 구조 변경)는 병합하지 않는다 —
      // 연속 '항목 추가'가 undo 1스텝으로 뭉치는 것을 막는다 (Phase 5 갤러리 reorder의 교훈)
      if (Object.values(action.patch).some((value) => Array.isArray(value))) return undefined;
      return `usc:${action.sectionId}:${Object.keys(action.patch).sort().join("|")}`;
    }
    case "updateSectionSettings":
      return `uss:${action.sectionId}:${Object.keys(action.patch).sort().join("|")}`;
    case "updateWedding":
      return `uw:${Object.keys(action.patch).sort().join("|")}`;
    case "updateGalleryPhoto":
      // 같은 사진·같은 필드의 연속 입력(캡션 타이핑, crop 슬라이더)만 병합
      return `ugp:${action.sectionId}:${action.index}:${Object.keys(action.patch).sort().join("|")}`;
    case "updateListItem":
      // 같은 목록·같은 항목·같은 필드의 연속 타이핑만 병합
      return `uli:${action.sectionId}:${action.field}:${action.index}:${Object.keys(action.patch).sort().join("|")}`;
    default:
      return undefined;
  }
}
