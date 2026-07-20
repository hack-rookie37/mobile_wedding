import type { Section } from "./document";

// addSection이 사용하는 타입별 기본 섹션.
// hero는 항상 정확히 1개 존재해야 하므로(A-05) 추가 대상이 아니다 —
// addSection action 스키마가 이 목록만 허용해 hero 추가를 스키마 수준에서 차단한다.
// rsvp는 추가 가능하되 최대 1개다(A-06) — 중복 추가는 apply가 거부한다.
export const ADDABLE_SECTION_TYPES = [
  "greeting",
  "coupleProfile",
  "calendar",
  "gallery",
  "video",
  "venue",
  "transportation",
  "contacts",
  "giftAccount",
  "rsvp",
  "closing",
] as const;

export type AddableSectionType = (typeof ADDABLE_SECTION_TYPES)[number];

export function createDefaultSection(type: AddableSectionType, id: string): Section {
  const base = {
    id,
    visible: true,
    style: { paddingY: "md", animation: "none" },
  } as const;

  switch (type) {
    case "greeting":
      return {
        ...base,
        type,
        layout: { variant: "default" },
        content: {
          title: "소중한 분들을 초대합니다",
          body: "",
          showParents: true,
          align: "center",
        },
      };
    case "coupleProfile":
      return {
        ...base,
        type,
        layout: { variant: "sideBySide" },
        content: {
          title: "신랑과 신부를 소개합니다",
          groom: { photoAssetId: null, intro: "" },
          bride: { photoAssetId: null, intro: "" },
          showParents: false,
        },
      };
    case "calendar":
      return {
        ...base,
        type,
        layout: { variant: "grid" },
        content: { title: "예식 일정", showDday: true, ddayStyle: "countdown" },
      };
    case "gallery":
      return {
        ...base,
        type,
        layout: { variant: "grid3" },
        content: { title: "우리의 순간들", photos: [], photoAspect: "3/4" },
      };
    case "video":
      return {
        ...base,
        type,
        layout: { variant: "facade" },
        content: { title: "우리의 영상", url: "" },
      };
    case "venue":
      return {
        ...base,
        type,
        layout: { variant: "default" },
        content: { title: "오시는 길", note: "", mapImageAssetId: null, showMapButtons: true },
      };
    case "transportation":
      return {
        ...base,
        type,
        layout: { variant: "list" },
        content: { title: "교통 안내", items: [] },
      };
    case "contacts":
      return {
        ...base,
        type,
        layout: { variant: "inline" },
        content: { title: "연락하기", entries: [] },
      };
    case "giftAccount":
      return {
        ...base,
        type,
        layout: { variant: "accordion" },
        content: {
          title: "마음 전하실 곳",
          groomLabel: "신랑측",
          brideLabel: "신부측",
          accounts: [],
        },
      };
    case "rsvp":
      return {
        ...base,
        type,
        layout: { variant: "sheet" },
        content: {
          title: "참석 의사 전달",
          body: "한 분 한 분 소중히 모실 수 있도록\n참석 의사를 미리 전해 주시면 감사하겠습니다.",
          deadline: null,
          collect: { side: true, companions: true, meal: true, phone: false, message: true },
        },
      };
    case "closing":
      return {
        ...base,
        type,
        layout: { variant: "simple" },
        content: { title: "감사합니다", body: "", photoAssetId: null, showShare: true },
      };
  }
}
