import { z } from "zod";
import {
  addSectionActionSchema,
  assignAssetActionSchema,
  duplicateSectionActionSchema,
  moveGalleryPhotoActionSchema,
  removeSectionActionSchema,
  reorderSectionsActionSchema,
  setSectionVariantActionSchema,
  setThemeActionSchema,
  toggleSectionVisibilityActionSchema,
  updateGalleryPhotoActionSchema,
  updateSectionContentActionSchema,
  updateSectionSettingsActionSchema,
} from "../actions/actions";

// AI가 제안할 수 있는 action의 allowlist (ADR-022).
// 기존 action 스키마를 그대로 재사용한다 — AI 전용 action은 없다 (수동 편집과 같은 파이프라인).
// 사양의 arrangeGallery = moveGalleryPhoto, setImageFocalPoint = updateGalleryPhoto(frame)에 대응한다.
//
// 의도적으로 제외:
//  * updateWedding — 신랑신부·혼주 실명과 예식 정보는 AI가 바꾸지 않는다
//  * updateListItem — 연락처·계좌 목록(민감 값 담는 반복 그룹)은 수동 편집 전용
//  * removeAssetReference — 허용 목록 밖 (요구되지 않음)
//  * batch — 제안은 평탄한 action 목록이어야 한다 (중첩 없이 개수 제한이 그대로 적용되도록)

const aiActionSchemas = [
  addSectionActionSchema,
  removeSectionActionSchema,
  duplicateSectionActionSchema,
  reorderSectionsActionSchema,
  updateSectionContentActionSchema,
  updateSectionSettingsActionSchema,
  setSectionVariantActionSchema,
  setThemeActionSchema,
  assignAssetActionSchema,
  moveGalleryPhotoActionSchema,
  updateGalleryPhotoActionSchema,
  toggleSectionVisibilityActionSchema,
] as const;

export const aiActionSchema = z.discriminatedUnion("type", [...aiActionSchemas]);

export type AiAction = z.infer<typeof aiActionSchema>;

export const AI_ALLOWED_ACTION_TYPES = aiActionSchemas.map(
  (schema) => schema.shape.type.value,
) as readonly AiAction["type"][];

// 한 번의 제안이 가질 수 있는 최대 action 수 — 검토 화면에서 사람이 훑을 수 있는 규모
export const MAX_AI_ACTIONS = 20;

export const aiProposalSchema = z.object({
  summary: z.string().min(1).max(500), // 사용자에게 보여줄 한국어 요약
  actions: z
    .array(aiActionSchema)
    .max(MAX_AI_ACTIONS, `제안은 최대 ${MAX_AI_ACTIONS}개 action까지입니다`),
});

export type AiProposalPayload = z.infer<typeof aiProposalSchema>;
