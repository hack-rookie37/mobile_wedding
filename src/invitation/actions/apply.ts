import { enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import { nanoid } from "nanoid";
import { deepEquals } from "../lib/deepEquals";
import {
  documentSchema,
  SECTION_CONTENT_SCHEMAS,
  SECTION_LAYOUT_SCHEMAS,
  type InvitationDocument,
  type Section,
} from "../schema/document";
import { CURRENT_SCHEMA_VERSION } from "../schema/migrate";
import { createDefaultSection } from "../schema/sectionDefaults";
import {
  applicableActionSchema,
  type ApplicableAction,
  type BatchAction,
  type DocumentAction,
} from "./actions";

enablePatches();

export class InvalidActionError extends Error {}

export interface ApplyDeps {
  generateId?: () => string; // 테스트·재현성을 위한 주입점 (기본 nanoid)
}

// action 적용 결과 — invalid는 throw하므로 문서가 변경되지 않는 것이 자명하다
export type ApplyResult =
  | { outcome: "applied"; doc: InvitationDocument; patches: Patch[]; inversePatches: Patch[] }
  | { outcome: "noop"; doc: InvitationDocument };

// 순수 함수 — React·store를 모른다. 어떤 경로(GUI/AI)의 action이든 같은 검증을 지난다.
export function applyAction(
  doc: InvitationDocument,
  rawAction: ApplicableAction,
  deps: ApplyDeps = {},
): ApplyResult {
  const parsed = applicableActionSchema.safeParse(rawAction);
  if (!parsed.success) {
    throw new InvalidActionError(`유효하지 않은 action: ${parsed.error.message}`);
  }
  // 버전 경계: action은 항상 현재 스키마 버전 문서에만 적용한다 (구버전은 로드 시 migrate)
  if (doc.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new InvalidActionError(
      `문서 버전 v${doc.schemaVersion}에는 action을 적용할 수 없습니다 — migrateDocument로 v${CURRENT_SCHEMA_VERSION}에 승격한 뒤 적용하세요`,
    );
  }
  const generateId = deps.generateId ?? nanoid;
  const action = parsed.data;

  if (action.type === "batch") {
    return applyBatch(doc, action, generateId);
  }
  return applySingle(doc, action, generateId);
}

// batch: 순차 적용 + 원자성(하나라도 실패하면 전체 거부) + 히스토리 1스텝(패치 연결)
function applyBatch(
  doc: InvitationDocument,
  action: BatchAction,
  generateId: () => string,
): ApplyResult {
  let current = doc;
  const patches: Patch[] = [];
  const inversePatches: Patch[] = [];
  for (const sub of action.actions) {
    const result = applySingle(current, sub, generateId); // throw 시 원본 doc 그대로 — 원자성
    if (result.outcome === "noop") continue;
    current = result.doc;
    patches.push(...result.patches);
    inversePatches.unshift(...result.inversePatches); // 역순 적용
  }
  if (patches.length === 0) return { outcome: "noop", doc };
  return { outcome: "applied", doc: current, patches, inversePatches };
}

function applySingle(
  doc: InvitationDocument,
  action: DocumentAction,
  generateId: () => string,
): ApplyResult {
  const [next, patches, inversePatches] = produceWithPatches(doc, (draft) => {
    mutate(draft, action, doc, generateId);
  });

  // no-op 감지: 패치가 없거나, 패치가 있어도 결과가 구조적으로 동일하면 히스토리 대상이 아니다
  if (patches.length === 0 || deepEquals(next, doc)) {
    return { outcome: "noop", doc };
  }

  // 최종 문서 불변식 검증 (fail fast) — 어떤 action도 유효하지 않은 문서를 만들 수 없다
  const validated = documentSchema.safeParse(next);
  if (!validated.success) {
    throw new InvalidActionError(
      `action 적용 결과가 유효하지 않습니다: ${validated.error.message}`,
    );
  }

  return { outcome: "applied", doc: next, patches, inversePatches };
}

// ── 핸들러 공용 헬퍼

function requireSection(draft: Draft<InvitationDocument>, sectionId: string): Draft<Section> {
  const section = draft.sections.find((s) => s.id === sectionId);
  if (!section) {
    throw new InvalidActionError(`섹션을 찾을 수 없습니다: ${sectionId}`);
  }
  return section;
}

const ID_GENERATION_ATTEMPTS = 5;

function resolveNewSectionId(
  draft: Draft<InvitationDocument>,
  explicitId: string | undefined,
  generateId: () => string,
): string {
  const exists = (id: string) => draft.sections.some((s) => s.id === id);
  if (explicitId !== undefined) {
    if (exists(explicitId)) {
      throw new InvalidActionError(`섹션 id가 이미 존재합니다: ${explicitId}`);
    }
    return explicitId;
  }
  for (let i = 0; i < ID_GENERATION_ATTEMPTS; i++) {
    const id = generateId();
    if (!exists(id)) return id;
  }
  throw new InvalidActionError("고유한 섹션 id를 생성하지 못했습니다");
}

// ── action별 draft 변형 (Immer draft만 수정 — 호출부는 항상 불변)

function mutate(
  draft: Draft<InvitationDocument>,
  action: DocumentAction,
  original: InvitationDocument,
  generateId: () => string,
): void {
  switch (action.type) {
    case "addSection": {
      if (action.index > draft.sections.length) {
        throw new InvalidActionError(`추가 위치가 범위를 벗어났습니다: ${action.index}`);
      }
      // RSVP는 최대 1개 (A-06) — 문서 불변식이 잡기 전에 명확한 이유로 거부한다
      if (action.sectionType === "rsvp" && draft.sections.some((s) => s.type === "rsvp")) {
        throw new InvalidActionError("RSVP 섹션은 하나만 둘 수 있습니다");
      }
      const id = resolveNewSectionId(draft, action.sectionId, generateId);
      draft.sections.splice(action.index, 0, createDefaultSection(action.sectionType, id));
      break;
    }

    case "removeSection": {
      const section = requireSection(draft, action.sectionId);
      if (section.type === "hero") {
        throw new InvalidActionError("메인(hero) 섹션은 삭제할 수 없습니다");
      }
      draft.sections.splice(
        draft.sections.findIndex((s) => s.id === action.sectionId),
        1,
      );
      break;
    }

    case "duplicateSection": {
      const source = requireSection(draft, action.sourceSectionId);
      if (source.type === "hero") {
        throw new InvalidActionError("메인(hero) 섹션은 복제할 수 없습니다");
      }
      if (source.type === "rsvp") {
        throw new InvalidActionError("RSVP 섹션은 복제할 수 없습니다 — 하나만 둘 수 있습니다");
      }
      const newId = resolveNewSectionId(draft, action.newSectionId, generateId);
      // 원본(불변 문서)에서 깊은 복사 — draft 프록시 복제로 인한 참조 공유를 차단해
      // 사본 편집이 원본에 새지 않게 한다 (id 충돌은 resolveNewSectionId가 방지)
      const sourceSnapshot = original.sections.find((s) => s.id === action.sourceSectionId);
      if (!sourceSnapshot) {
        throw new InvalidActionError(`섹션을 찾을 수 없습니다: ${action.sourceSectionId}`);
      }
      const copy: Section = { ...structuredClone(sourceSnapshot), id: newId };
      const sourceIndex = draft.sections.findIndex((s) => s.id === action.sourceSectionId);
      draft.sections.splice(sourceIndex + 1, 0, copy);
      break;
    }

    case "reorderSections": {
      const currentIds = draft.sections.map((s) => s.id);
      if (
        action.order.length !== currentIds.length ||
        new Set(action.order).size !== action.order.length ||
        !currentIds.every((id) => action.order.includes(id))
      ) {
        throw new InvalidActionError("order는 현재 섹션 id 전체의 순열이어야 합니다");
      }
      const heroId = draft.sections.find((s) => s.type === "hero")?.id;
      if (action.order[0] !== heroId) {
        throw new InvalidActionError("메인(hero) 섹션은 항상 최상단이어야 합니다");
      }
      if (action.order.every((id, i) => id === currentIds[i])) {
        break; // 동일 순서 — no-op
      }
      const byId = new Map(draft.sections.map((s) => [s.id, s]));
      draft.sections = action.order.map((id) => byId.get(id)!);
      break;
    }

    case "toggleSectionVisibility": {
      const section = requireSection(draft, action.sectionId);
      if (section.type === "hero") {
        throw new InvalidActionError("메인(hero) 섹션은 숨길 수 없습니다");
      }
      section.visible = action.visible ?? !section.visible;
      break;
    }

    case "updateSectionContent": {
      const section = requireSection(draft, action.sectionId);
      const merged = { ...section.content, ...action.patch };
      const result = SECTION_CONTENT_SCHEMAS[section.type].safeParse(merged);
      if (!result.success) {
        throw new InvalidActionError(`${section.type} content 검증 실패: ${result.error.message}`);
      }
      section.content = result.data;
      break;
    }

    case "updateSectionSettings": {
      const section = requireSection(draft, action.sectionId);
      section.style = { ...section.style, ...action.patch };
      break;
    }

    case "setSectionVariant": {
      const section = requireSection(draft, action.sectionId);
      const result = SECTION_LAYOUT_SCHEMAS[section.type].safeParse({ variant: action.variant });
      if (!result.success) {
        throw new InvalidActionError(
          `'${action.variant}'은(는) ${section.type} 섹션에서 사용할 수 없는 variant입니다`,
        );
      }
      // layout.variant만 변경 — content·asset 참조는 보존된다 (핵심 불변 조건)
      section.layout.variant = action.variant as never;
      break;
    }

    case "setTheme": {
      draft.theme.id = action.themeId;
      break;
    }

    case "updatePalette": {
      // undefined는 "테마 기본값으로 되돌리기" — 병합이 아니라 키 삭제로 표현한다
      for (const [key, value] of Object.entries(action.patch)) {
        if (value === undefined)
          delete draft.theme.palette[key as keyof typeof draft.theme.palette];
        else draft.theme.palette[key as keyof typeof draft.theme.palette] = value;
      }
      break;
    }

    case "setMusic": {
      draft.music.assetId = action.assetId;
      break;
    }

    case "updateMusic": {
      draft.music = { ...draft.music, ...action.patch };
      break;
    }

    case "updateTypography": {
      draft.typography = { ...draft.typography, ...action.patch };
      break;
    }

    case "updateWedding": {
      Object.assign(draft.wedding, action.patch);
      break;
    }

    case "assignAsset": {
      const section = requireSection(draft, action.sectionId);
      if (action.slot.kind === "heroPhoto") {
        if (section.type !== "hero") {
          throw new InvalidActionError("heroPhoto slot은 hero 섹션에만 사용할 수 있습니다");
        }
        if (section.content.photoAssetId !== action.assetId) {
          delete section.content.photoFrame; // crop은 특정 이미지에 종속 — 교체 시 초기화
        }
        section.content.photoAssetId = action.assetId;
        break;
      }
      if (action.slot.kind === "profilePhoto") {
        if (section.type !== "coupleProfile") {
          throw new InvalidActionError(
            "profilePhoto slot은 coupleProfile 섹션에만 사용할 수 있습니다",
          );
        }
        const entry = section.content[action.slot.side];
        if (entry.photoAssetId !== action.assetId) {
          delete entry.photoFrame;
        }
        entry.photoAssetId = action.assetId;
        break;
      }
      if (action.slot.kind === "closingPhoto") {
        if (section.type !== "closing") {
          throw new InvalidActionError("closingPhoto slot은 closing 섹션에만 사용할 수 있습니다");
        }
        if (section.content.photoAssetId !== action.assetId) {
          delete section.content.photoFrame;
        }
        section.content.photoAssetId = action.assetId;
        break;
      }
      if (action.slot.kind === "venueMap") {
        if (section.type !== "venue") {
          throw new InvalidActionError("venueMap slot은 venue 섹션에만 사용할 수 있습니다");
        }
        // 약도는 crop 없이 원본 비율 그대로 표시하므로 frame 초기화가 없다
        section.content.mapImageAssetId = action.assetId;
        break;
      }
      if (action.slot.kind === "greetingOrnament") {
        if (section.type !== "greeting") {
          throw new InvalidActionError(
            "greetingOrnament slot은 greeting 섹션에만 사용할 수 있습니다",
          );
        }
        // 장식도 crop 없이 원본 비율 그대로 — frame이 없다 (venueMap과 같은 결)
        section.content.ornamentAssetId = action.assetId;
        break;
      }
      // galleryItem
      if (section.type !== "gallery") {
        throw new InvalidActionError("galleryItem slot은 gallery 섹션에만 사용할 수 있습니다");
      }
      const photos = section.content.photos;
      if (action.slot.index !== undefined) {
        if (action.slot.index >= photos.length) {
          throw new InvalidActionError(`갤러리 index가 범위를 벗어났습니다: ${action.slot.index}`);
        }
        const target = photos[action.slot.index];
        if (target.assetId !== action.assetId) {
          delete target.frame; // crop은 특정 이미지에 종속 — 교체 시 초기화 (alt·caption은 보존)
        }
        target.assetId = action.assetId;
      } else {
        if (photos.length >= 30) {
          throw new InvalidActionError("갤러리 사진은 최대 30장입니다");
        }
        photos.push({ assetId: action.assetId });
      }
      break;
    }

    case "moveGalleryPhoto": {
      const section = requireSection(draft, action.sectionId);
      if (section.type !== "gallery") {
        throw new InvalidActionError("moveGalleryPhoto는 gallery 섹션에만 사용할 수 있습니다");
      }
      const photos = section.content.photos;
      if (action.from >= photos.length || action.to >= photos.length) {
        throw new InvalidActionError(
          `갤러리 index가 범위를 벗어났습니다: ${action.from} → ${action.to}`,
        );
      }
      if (action.from === action.to) break; // no-op
      const [moved] = photos.splice(action.from, 1);
      photos.splice(action.to, 0, moved);
      break;
    }

    case "updateGalleryPhoto": {
      const section = requireSection(draft, action.sectionId);
      if (section.type !== "gallery") {
        throw new InvalidActionError("updateGalleryPhoto는 gallery 섹션에만 사용할 수 있습니다");
      }
      const photos = section.content.photos;
      if (action.index >= photos.length) {
        throw new InvalidActionError(`갤러리 index가 범위를 벗어났습니다: ${action.index}`);
      }
      const photo = photos[action.index];
      const { frame, ...textPatch } = action.patch;
      Object.assign(photo, textPatch);
      if (frame === null) {
        delete photo.frame; // crop 제거
      } else if (frame !== undefined) {
        photo.frame = frame;
      }
      break;
    }

    case "updateListItem": {
      const section = requireSection(draft, action.sectionId);
      const list = (section.content as Record<string, unknown>)[action.field];
      if (!Array.isArray(list)) {
        throw new InvalidActionError(
          `${section.type} content에 '${action.field}' 목록 필드가 없습니다`,
        );
      }
      if (action.index >= list.length) {
        throw new InvalidActionError(`목록 index가 범위를 벗어났습니다: ${action.index}`);
      }
      const merged = {
        ...section.content,
        [action.field]: list.map((item, i) =>
          i === action.index ? { ...(item as object), ...action.patch } : item,
        ),
      };
      const result = SECTION_CONTENT_SCHEMAS[section.type].safeParse(merged);
      if (!result.success) {
        throw new InvalidActionError(`${section.type} content 검증 실패: ${result.error.message}`);
      }
      section.content = result.data;
      break;
    }

    case "removeAssetReference": {
      const section = requireSection(draft, action.sectionId);
      if (action.slot.kind === "heroPhoto") {
        if (section.type !== "hero") {
          throw new InvalidActionError("heroPhoto slot은 hero 섹션에만 사용할 수 있습니다");
        }
        section.content.photoAssetId = null;
        delete section.content.photoFrame;
        break;
      }
      if (action.slot.kind === "profilePhoto") {
        if (section.type !== "coupleProfile") {
          throw new InvalidActionError(
            "profilePhoto slot은 coupleProfile 섹션에만 사용할 수 있습니다",
          );
        }
        const entry = section.content[action.slot.side];
        entry.photoAssetId = null;
        delete entry.photoFrame;
        break;
      }
      if (action.slot.kind === "closingPhoto") {
        if (section.type !== "closing") {
          throw new InvalidActionError("closingPhoto slot은 closing 섹션에만 사용할 수 있습니다");
        }
        section.content.photoAssetId = null;
        delete section.content.photoFrame;
        break;
      }
      if (action.slot.kind === "venueMap") {
        if (section.type !== "venue") {
          throw new InvalidActionError("venueMap slot은 venue 섹션에만 사용할 수 있습니다");
        }
        section.content.mapImageAssetId = null;
        break;
      }
      if (action.slot.kind === "greetingOrnament") {
        if (section.type !== "greeting") {
          throw new InvalidActionError(
            "greetingOrnament slot은 greeting 섹션에만 사용할 수 있습니다",
          );
        }
        section.content.ornamentAssetId = null;
        break;
      }
      if (section.type !== "gallery") {
        throw new InvalidActionError("galleryItem slot은 gallery 섹션에만 사용할 수 있습니다");
      }
      if (action.slot.index >= section.content.photos.length) {
        throw new InvalidActionError(`갤러리 index가 범위를 벗어났습니다: ${action.slot.index}`);
      }
      section.content.photos.splice(action.slot.index, 1);
      break;
    }
  }
}
