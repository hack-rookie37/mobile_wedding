import type { AiAction } from "@/invitation/ai/schema";
import type { InvitationDocument, Section } from "@/invitation/schema/document";
import { THEMES } from "@/invitation/schema/themes";
import { SECTION_LABELS, SECTION_VARIANT_OPTIONS } from "../sectionMeta";

// AI 제안 검토 화면의 사람 읽는 설명 — action을 "무엇이 어떻게 바뀌는가"로 번역한다.
// before/after는 현재 문서 기준이다 (제안이 순차 적용되는 경우도 첫 상태 대비로 보여준다).

export interface AiChangeDescription {
  title: string;
  before?: string;
  after?: string;
  detail?: string;
}

const CONTENT_FIELD_LABELS: Record<string, string> = {
  title: "제목",
  body: "본문",
  tagline: "태그라인",
  note: "안내 문구",
  url: "동영상 주소",
  align: "정렬",
  intro: "소개 문구",
  showParents: "혼주 표기",
  showDate: "예식 일시 표시",
  showVenue: "예식장 표시",
  showDday: "D-day 표시",
  ddayStyle: "D-day 표시 방식",
  showMapButtons: "지도 버튼",
  deadline: "마감일",
  collect: "수집 항목",
  photos: "사진 목록",
  items: "교통 안내 항목",
  entries: "연락처 목록",
  accounts: "계좌 목록",
  groomLabel: "신랑측 그룹 이름",
  brideLabel: "신부측 그룹 이름",
  photoAssetId: "사진",
  mapImageAssetId: "약도 이미지",
  photoFrame: "사진 초점",
  photoAspect: "사진 세로 길이",
  fadeBottom: "사진 하단 페이드아웃",
  groom: "신랑 소개",
  bride: "신부 소개",
};

const STYLE_VALUE_LABELS: Record<string, string> = {
  sm: "좁게",
  md: "보통",
  lg: "넓게",
  none: "없음",
  fade: "페이드",
  rise: "라이즈",
};

function truncate(value: string, max = 42): string {
  const flat = value.replaceAll("\n", " ");
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value === "" ? "(비움)" : truncate(value);
  if (typeof value === "boolean") return value ? "켬" : "끔";
  if (value === null) return "없음";
  if (typeof value === "number") return String(value);
  return "변경";
}

function sectionOf(doc: InvitationDocument, sectionId: string): Section | undefined {
  return doc.sections.find((section) => section.id === sectionId);
}

function sectionLabel(doc: InvitationDocument, sectionId: string): string {
  const section = sectionOf(doc, sectionId);
  return section ? SECTION_LABELS[section.type] : "섹션";
}

function variantLabel(section: Section | undefined, variant: string): string {
  if (!section) return variant;
  const option = SECTION_VARIANT_OPTIONS[section.type].find((o) => o.value === variant);
  return option?.label ?? variant;
}

export function describeAiAction(doc: InvitationDocument, action: AiAction): AiChangeDescription {
  switch (action.type) {
    case "addSection":
      return { title: `‘${SECTION_LABELS[action.sectionType]}’ 섹션 추가` };

    case "removeSection":
      return { title: `‘${sectionLabel(doc, action.sectionId)}’ 섹션 삭제` };

    case "duplicateSection":
      return { title: `‘${sectionLabel(doc, action.sourceSectionId)}’ 섹션 복제` };

    case "reorderSections":
      return {
        title: "섹션 순서 변경",
        detail: action.order.map((id) => sectionLabel(doc, id)).join(" → "),
      };

    case "toggleSectionVisibility": {
      const label = sectionLabel(doc, action.sectionId);
      if (action.visible === undefined) return { title: `‘${label}’ 표시 전환` };
      return { title: `‘${label}’ ${action.visible ? "표시" : "숨기기"}` };
    }

    case "setSectionVariant": {
      const section = sectionOf(doc, action.sectionId);
      return {
        title: `${sectionLabel(doc, action.sectionId)} — 레이아웃 변경`,
        before: section ? variantLabel(section, section.layout.variant) : undefined,
        after: variantLabel(section, action.variant),
      };
    }

    case "setTheme":
      return {
        title: "테마 변경",
        before: THEMES[doc.theme.id].label,
        after: THEMES[action.themeId].label,
      };

    case "updateSectionContent": {
      const section = sectionOf(doc, action.sectionId);
      const label = sectionLabel(doc, action.sectionId);
      const keys = Object.keys(action.patch);
      if (keys.length === 1 && section) {
        const key = keys[0];
        const fieldLabel = CONTENT_FIELD_LABELS[key] ?? key;
        const before = (section.content as Record<string, unknown>)[key];
        return {
          title: `${label} — ${fieldLabel} 수정`,
          before: displayValue(before),
          after: displayValue(action.patch[key]),
        };
      }
      return {
        title: `${label} — 내용 수정`,
        detail: keys.map((key) => CONTENT_FIELD_LABELS[key] ?? key).join(", "),
      };
    }

    case "updateSectionSettings": {
      const section = sectionOf(doc, action.sectionId);
      const label = sectionLabel(doc, action.sectionId);
      const keys = Object.keys(action.patch) as (keyof typeof action.patch)[];
      if (keys.length === 1 && section) {
        const key = keys[0];
        const fieldLabel =
          key === "paddingY"
            ? "상하 여백"
            : key === "animation"
              ? "진입 모션"
              : key === "fontFamily"
                ? "글꼴"
                : key === "bodyPt"
                  ? "본문 크기"
                  : key === "headingPt"
                    ? "제목 크기"
                    : key === "color"
                      ? "글자색"
                      : "배경색";
        const styleValue = (value: unknown) =>
          typeof value === "string" ? (STYLE_VALUE_LABELS[value] ?? value) : displayValue(value);
        return {
          title: `${label} — ${fieldLabel} 변경`,
          before: styleValue(section.style[key]),
          after: styleValue(action.patch[key]),
        };
      }
      return { title: `${label} — 스타일 변경` };
    }

    case "assignAsset": {
      const label = sectionLabel(doc, action.sectionId);
      const slotLabel =
        action.slot.kind === "galleryItem"
          ? action.slot.index === undefined
            ? "갤러리에 사진 추가"
            : `갤러리 ${action.slot.index + 1}번째 사진 교체`
          : action.slot.kind === "venueMap"
            ? "약도 지정"
            : "사진 지정";
      return { title: `${label} — ${slotLabel}`, detail: `사진: ${action.assetId}` };
    }

    case "moveGalleryPhoto":
      return {
        title: `${sectionLabel(doc, action.sectionId)} — 사진 순서 변경`,
        before: `${action.from + 1}번째`,
        after: `${action.to + 1}번째`,
      };

    case "updateGalleryPhoto": {
      const keys = Object.keys(action.patch).map((key) =>
        key === "alt" ? "대체 텍스트" : key === "caption" ? "캡션" : "초점·확대",
      );
      return {
        title: `${sectionLabel(doc, action.sectionId)} — ${action.index + 1}번째 사진 ${keys.join("·")} 수정`,
      };
    }
  }
}
