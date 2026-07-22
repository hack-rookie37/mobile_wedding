import {
  EMPTY_SECTION_TEXT,
  DEFAULT_GALLERY_GAP_PX,
  DEFAULT_SECTION_PAD_X,
  DEFAULT_TRANSPORT_COLUMNS,
  type Section,
} from "./document";

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
  "share",
] as const;

export type AddableSectionType = (typeof ADDABLE_SECTION_TYPES)[number];

// 눈썹 라벨(제목 위 작은 글자)의 기본값. v10 전까지 렌더러가 박아 두고 있던 값이라,
// 마이그레이션도 이 표를 그대로 쓴다 — 기본값을 두 곳에 적으면 갈라진다.
// 맺음말은 빈 문자열이다: 사진 위에 제목만 얹는 자리라 눈썹을 두지 않았다 (ADR-028).
// 메인(hero)은 눈썹도 제목도 없는 전면 사진이라 이 표에 없다.
export const DEFAULT_SECTION_LABELS: Record<AddableSectionType, string> = {
  greeting: "INVITATION",
  coupleProfile: "COUPLE",
  calendar: "CALENDAR",
  gallery: "GALLERY",
  video: "VIDEO",
  venue: "LOCATION",
  transportation: "TRANSPORT",
  contacts: "CONTACT",
  giftAccount: "REGISTRY",
  rsvp: "RSVP",
  closing: "",
  share: "SHARE",
};

export function createDefaultSection(type: AddableSectionType, id: string): Section {
  const base = {
    id,
    visible: true,
    style: {
      paddingY: "md",
      paddingX: DEFAULT_SECTION_PAD_X,
      animation: "none",
      text: EMPTY_SECTION_TEXT,
    },
  } as const;

  switch (type) {
    case "greeting":
      return {
        ...base,
        type,
        layout: { variant: "default" },
        content: {
          title: "소중한 분들을 초대합니다",
          label: DEFAULT_SECTION_LABELS[type],
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
          label: DEFAULT_SECTION_LABELS[type],
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
        content: {
          title: "예식 일정",
          label: DEFAULT_SECTION_LABELS[type],
          showDday: true,
          ddayStyle: "countdown",
        },
      };
    case "gallery":
      return {
        ...base,
        type,
        layout: { variant: "grid3" },
        content: {
          title: "우리의 순간들",
          label: DEFAULT_SECTION_LABELS[type],
          photos: [],
          photoAspect: "3/4",
          photoCorner: "rounded",
          photoGapPx: DEFAULT_GALLERY_GAP_PX,
        },
      };
    case "video":
      return {
        ...base,
        type,
        layout: { variant: "facade" },
        content: { title: "우리의 영상", label: DEFAULT_SECTION_LABELS[type], url: "" },
      };
    case "venue":
      return {
        ...base,
        type,
        layout: { variant: "default" },
        content: {
          title: "오시는 길",
          label: DEFAULT_SECTION_LABELS[type],
          note: "",
          mapImageAssetId: null,
          showMapButtons: true,
        },
      };
    case "transportation":
      return {
        ...base,
        type,
        layout: { variant: "list" },
        content: {
          title: "교통 안내",
          label: DEFAULT_SECTION_LABELS[type],
          items: [],
          columns: DEFAULT_TRANSPORT_COLUMNS,
        },
      };
    case "contacts":
      return {
        ...base,
        type,
        layout: { variant: "inline" },
        content: { title: "연락하기", label: DEFAULT_SECTION_LABELS[type], entries: [] },
      };
    case "giftAccount":
      return {
        ...base,
        type,
        layout: { variant: "accordion" },
        content: {
          title: "마음 전하실 곳",
          label: DEFAULT_SECTION_LABELS[type],
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
          label: DEFAULT_SECTION_LABELS[type],
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
        content: {
          title: "감사합니다",
          label: DEFAULT_SECTION_LABELS[type],
          body: "",
          photoAssetId: null,
          photoAspect: "4/5",
          effects: { fadeBottom: true, sparkle: false, petals: false, brightness: 1, opacity: 1 },
        },
      };
    case "share":
      return {
        ...base,
        type,
        layout: { variant: "default" },
        content: {
          title: "청첩장 공유하기",
          label: DEFAULT_SECTION_LABELS[type],
          body: "",
        },
      };
  }
}
