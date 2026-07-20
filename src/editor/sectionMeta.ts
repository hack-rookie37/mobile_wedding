import type { SectionType } from "@/invitation/schema/document";

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "메인",
  greeting: "인사말",
  coupleProfile: "신랑·신부 소개",
  calendar: "예식 캘린더",
  gallery: "갤러리",
  venue: "오시는 길",
  video: "동영상",
  transportation: "교통 안내",
  contacts: "연락처",
  giftAccount: "마음 전하실 곳",
  rsvp: "참석 여부 (RSVP)",
  closing: "맺음말",
  share: "공유하기",
};

// 인스펙터 '레이아웃' 탭 — 타입별 layout.variant 선택지 (스키마 enum과 값 동일)
export const SECTION_VARIANT_OPTIONS: Record<SectionType, { value: string; label: string }[]> = {
  hero: [], // 전면 사진 단일 레이아웃 — '레이아웃' 탭은 사진 효과를 다룬다

  greeting: [],
  coupleProfile: [
    { value: "sideBySide", label: "나란히" },
    { value: "stacked", label: "세로" },
  ],
  calendar: [
    { value: "grid", label: "달력형" },
    { value: "simple", label: "심플" },
  ],
  gallery: [
    { value: "strip", label: "대형 스트립" },
    { value: "grid2", label: "2열" },
    { value: "grid3", label: "3열" },
    { value: "slider", label: "슬라이더" },
    { value: "collage", label: "콜라주" },
  ],
  venue: [],
  video: [
    { value: "facade", label: "탭하여 재생" },
    { value: "embed", label: "즉시 임베드" },
  ],
  transportation: [
    { value: "list", label: "리스트" },
    { value: "cards", label: "카드 격자" },
    { value: "accordion", label: "접이식" },
  ],
  contacts: [
    { value: "inline", label: "펼침" },
    { value: "accordion", label: "접이식" },
  ],
  giftAccount: [
    { value: "accordion", label: "접이식" },
    { value: "open", label: "펼침" },
  ],
  rsvp: [
    { value: "sheet", label: "바텀시트" },
    { value: "inline", label: "인라인 폼" },
  ],
  closing: [
    { value: "simple", label: "텍스트" },
    { value: "photo", label: "전면 사진" },
  ],
  share: [
    { value: "default", label: "기본" },
    { value: "dark", label: "어둡게" },
  ],
};
