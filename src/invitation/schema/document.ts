import { z } from "zod";

// ── 전역 wedding 데이터 (PRODUCT_SPEC §4 — 섹션 간 중복 저장 금지)

export const parentSchema = z.object({
  name: z.string().min(1),
  deceased: z.boolean(),
});

// 이름·주소의 필수 여부는 draft가 아닌 발행 검증에서 강제한다 (PRODUCT_SPEC §7)
// — 편집 중 "지우고 다시 입력"하는 정상 흐름을 막지 않기 위해 빈 문자열을 허용
export const personSchema = z.object({
  name: z.string(),
  familyRole: z.string().optional(), // "장남", "차녀" 등
  father: parentSchema.optional(),
  mother: parentSchema.optional(),
});

export const venueSchema = z.object({
  name: z.string(),
  hall: z.string().optional(),
  address: z.string(),
  phone: z.string().optional(),
});

export const weddingSchema = z.object({
  groom: personSchema,
  bride: personSchema,
  datetime: z.iso.datetime({ offset: true }), // Asia/Seoul(+09:00) 기준 저장
  venue: venueSchema,
});

// ── theme (토큰·variant 값은 themes.ts 정의 테이블에서 해석 — 문서에는 선택만 저장)

export const themeIdSchema = z.enum(["warm-editorial", "modern-monochrome", "film-diary"]);

export const themeSchema = z.object({
  id: themeIdSchema,
});

// ── 섹션 공통

export const sectionStyleSchema = z.object({
  paddingY: z.enum(["sm", "md", "lg"]),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "background는 #rrggbb 형식이어야 합니다")
    .optional(),
  animation: z.enum(["none", "fade", "rise"]),
});

const sectionBase = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  style: sectionStyleSchema,
});

// ── 사진 표시 프레임 (crop) — asset 원본은 불변, 표시 방법만 문서에 저장한다
// zoom: 확대 배율, focalX/Y: 초점(0~1, 좌상단 기준). 미지정이면 중앙 기준 cover.

export const photoFrameSchema = z.object({
  zoom: z.number().min(1).max(3),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
});

// ── 섹션별 content / layout

// photoFull(전면 사진) 세로 비율 — 값은 CSS aspect-ratio의 가로/세로. 아래로 갈수록 길다.
export const heroPhotoAspectSchema = z.enum(["1/1", "4/5", "3/4", "9/16"]);

export const heroContentSchema = z.object({
  tagline: z.string(),
  photoAssetId: z.string().nullable(),
  photoFrame: photoFrameSchema.optional(),
  // photoFull 전용 표시 옵션 — 다른 variant(아치·텍스트만)에서는 무시된다
  photoAspect: heroPhotoAspectSchema,
  fadeBottom: z.boolean(), // 사진 하단을 배경색으로 페이드아웃
  showDate: z.boolean(),
  showVenue: z.boolean(),
});

export const heroSectionSchema = sectionBase.extend({
  type: z.literal("hero"),
  layout: z.object({ variant: z.enum(["photoFull", "photoArch", "textOnly"]) }),
  content: heroContentSchema,
});

export const greetingContentSchema = z.object({
  title: z.string(),
  body: z.string(),
  showParents: z.boolean(),
  align: z.enum(["center", "left"]),
});

export const greetingSectionSchema = sectionBase.extend({
  type: z.literal("greeting"),
  layout: z.object({ variant: z.enum(["default"]) }),
  content: greetingContentSchema,
});

// 문서에는 assetId와 표시용 metadata(alt·caption·frame)만 저장한다 — 원본·base64 금지 (ADR-016)
export const galleryPhotoSchema = z.object({
  assetId: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
  frame: photoFrameSchema.optional(),
});

export const galleryContentSchema = z.object({
  title: z.string(),
  photos: z.array(galleryPhotoSchema).max(30, "갤러리 사진은 최대 30장입니다"),
});

export const gallerySectionSchema = sectionBase.extend({
  type: z.literal("gallery"),
  layout: z.object({ variant: z.enum(["grid2", "grid3", "slider", "filmstrip", "collage"]) }),
  content: galleryContentSchema,
});

export const venueContentSchema = z.object({
  title: z.string(),
  note: z.string(), // 주차·안내 등 자유 문구 (빈 문자열 허용)
  // 외부 지도 앱으로 열기 버튼 (네이버 지도·카카오맵·티맵) — 별도 지도 API 없이 URL·딥링크만 사용
  showMapButtons: z.boolean(),
});

export const venueSectionSchema = sectionBase.extend({
  type: z.literal("venue"),
  layout: z.object({ variant: z.enum(["default"]) }),
  content: venueContentSchema,
});

// MVP 동영상: YouTube·Vimeo 외부 URL만 저장한다 — 직접 업로드·트랜스코딩 없음 (ADR-017)
export const videoContentSchema = z.object({
  title: z.string(),
  url: z.string(), // 빈 문자열 허용(작성 중) — 임베드 가능 여부는 videoEmbed.ts가 판별
});

export const videoSectionSchema = sectionBase.extend({
  type: z.literal("video"),
  // facade: 썸네일을 먼저 보여주고 탭하면 재생 (자동재생 금지) / embed: 즉시 임베드
  layout: z.object({ variant: z.enum(["facade", "embed"]) }),
  content: videoContentSchema,
});

// ── Phase 8 섹션들 (PRODUCT_SPEC §5.3~5.12)

// 신랑·신부 소개 — 이름·혼주는 wedding 참조, 섹션에는 소개 문구와 사진만 저장한다
export const profileEntrySchema = z.object({
  photoAssetId: z.string().nullable(),
  photoFrame: photoFrameSchema.optional(),
  intro: z.string(),
});

export const coupleProfileContentSchema = z.object({
  title: z.string(),
  groom: profileEntrySchema,
  bride: profileEntrySchema,
  showParents: z.boolean(),
});

export const coupleProfileSectionSchema = sectionBase.extend({
  type: z.literal("coupleProfile"),
  layout: z.object({ variant: z.enum(["sideBySide", "stacked"]) }),
  content: coupleProfileContentSchema,
});

// 예식 캘린더 — 날짜·시간은 wedding.datetime 참조 (양력만, A-15)
export const calendarContentSchema = z.object({
  title: z.string(),
  showDday: z.boolean(),
});

export const calendarSectionSchema = sectionBase.extend({
  type: z.literal("calendar"),
  layout: z.object({ variant: z.enum(["grid", "simple"]) }),
  content: calendarContentSchema,
});

// 교통 안내 — 수단별 항목의 반복 그룹
export const transportIconSchema = z.enum(["subway", "bus", "car", "parking", "shuttle", "etc"]);

export const transportItemSchema = z.object({
  icon: transportIconSchema,
  title: z.string(),
  body: z.string(), // 멀티라인 안내 (개행 보존)
});

export const transportationContentSchema = z.object({
  title: z.string(),
  items: z.array(transportItemSchema).max(10, "교통 안내는 최대 10개입니다"),
});

export const transportationSectionSchema = sectionBase.extend({
  type: z.literal("transportation"),
  layout: z.object({ variant: z.enum(["list", "cards"]) }),
  content: transportationContentSchema,
});

// 연락처 — 신랑측/신부측 grouping은 entry의 side로 파생한다.
// phone은 sensitive: 게스트에게는 보이지만 AI projection에서는 redact된다 (sensitive.ts, PRODUCT_SPEC §9)
export const contactSideSchema = z.enum(["groom", "bride"]);

export const contactEntrySchema = z.object({
  side: contactSideSchema,
  label: z.string(), // "신랑", "아버지" 등 자유 입력
  name: z.string(),
  phone: z.string().meta({ sensitive: true }),
});

export const contactsContentSchema = z.object({
  title: z.string(),
  entries: z.array(contactEntrySchema).max(12, "연락처는 최대 12개입니다"),
});

export const contactsSectionSchema = sectionBase.extend({
  type: z.literal("contacts"),
  layout: z.object({ variant: z.enum(["inline", "accordion"]) }),
  content: contactsContentSchema,
});

// 마음 전하실 곳 — number는 sensitive (contacts.phone과 동일한 규칙)
export const giftAccountSchema = z.object({
  side: contactSideSchema,
  bank: z.string(),
  holder: z.string(), // 예금주
  number: z.string().meta({ sensitive: true }),
});

export const giftAccountContentSchema = z.object({
  title: z.string(),
  groomLabel: z.string(),
  brideLabel: z.string(),
  accounts: z.array(giftAccountSchema).max(8, "계좌는 최대 8개입니다"),
});

export const giftAccountSectionSchema = sectionBase.extend({
  type: z.literal("giftAccount"),
  // accordion: 측별 그룹 접힘 기본 / open: 모두 펼침
  layout: z.object({ variant: z.enum(["accordion", "open"]) }),
  content: giftAccountContentSchema,
});

// 참석 의사 전달 (RSVP) — 문서에는 폼 구성만 저장한다 (PRODUCT_SPEC §5.11·§8).
// 게스트 응답은 별도 저장소(rsvp_responses)에만 존재한다: 이 스키마에 응답을 담을
// 자리가 없으므로 공개 스냅샷·AI projection 어디에도 응답이 실릴 수 없다 (원칙 9).
export const rsvpCollectSchema = z.object({
  side: z.boolean(), // 신랑측/신부측 구분
  companions: z.boolean(), // 동반 인원
  meal: z.boolean(), // 식사 여부
  phone: z.boolean(), // 연락처
  message: z.boolean(), // 전하고 싶은 말
});

export const rsvpContentSchema = z.object({
  title: z.string(),
  body: z.string(), // 안내 문구
  deadline: z.iso.datetime({ offset: true }).nullable(), // null = 마감 없음
  collect: rsvpCollectSchema, // 성명·참석 여부·개인정보 동의는 항상 수집한다 (A-16)
});

export const rsvpSectionSchema = sectionBase.extend({
  type: z.literal("rsvp"),
  layout: z.object({ variant: z.enum(["default"]) }),
  content: rsvpContentSchema,
});

// 맺음말 — 마무리 문구 + 선택 사진 + 링크 공유 버튼
export const closingContentSchema = z.object({
  title: z.string(),
  body: z.string(),
  photoAssetId: z.string().nullable(),
  photoFrame: photoFrameSchema.optional(),
  showShare: z.boolean(),
});

export const closingSectionSchema = sectionBase.extend({
  type: z.literal("closing"),
  layout: z.object({ variant: z.enum(["simple", "photo"]) }),
  content: closingContentSchema,
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  greetingSectionSchema,
  coupleProfileSectionSchema,
  calendarSectionSchema,
  gallerySectionSchema,
  venueSectionSchema,
  videoSectionSchema,
  transportationSectionSchema,
  contactsSectionSchema,
  giftAccountSectionSchema,
  rsvpSectionSchema,
  closingSectionSchema,
]);

export const SECTION_CONTENT_SCHEMAS = {
  hero: heroContentSchema,
  greeting: greetingContentSchema,
  coupleProfile: coupleProfileContentSchema,
  calendar: calendarContentSchema,
  gallery: galleryContentSchema,
  venue: venueContentSchema,
  video: videoContentSchema,
  transportation: transportationContentSchema,
  contacts: contactsContentSchema,
  giftAccount: giftAccountContentSchema,
  rsvp: rsvpContentSchema,
  closing: closingContentSchema,
} as const;

// setSectionVariant가 섹션 타입별 허용 variant를 검증할 때 사용
export const SECTION_LAYOUT_SCHEMAS = {
  hero: heroSectionSchema.shape.layout,
  greeting: greetingSectionSchema.shape.layout,
  coupleProfile: coupleProfileSectionSchema.shape.layout,
  calendar: calendarSectionSchema.shape.layout,
  gallery: gallerySectionSchema.shape.layout,
  venue: venueSectionSchema.shape.layout,
  video: videoSectionSchema.shape.layout,
  transportation: transportationSectionSchema.shape.layout,
  contacts: contactsSectionSchema.shape.layout,
  giftAccount: giftAccountSectionSchema.shape.layout,
  rsvp: rsvpSectionSchema.shape.layout,
  closing: closingSectionSchema.shape.layout,
} as const;

// ── 문서

export const documentSchema = z
  .object({
    schemaVersion: z.literal(6),
    wedding: weddingSchema,
    theme: themeSchema,
    sections: z.array(sectionSchema).min(1),
  })
  .superRefine((doc, ctx) => {
    // 불변식 (PRODUCT_SPEC A-05, A-06): hero는 정확히 1개, 항상 최상단
    const heroCount = doc.sections.filter((s) => s.type === "hero").length;
    if (heroCount !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "hero 섹션은 정확히 1개여야 합니다",
      });
    } else if (doc.sections[0].type !== "hero") {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "hero 섹션은 항상 최상단이어야 합니다",
      });
    }
    // 불변식 (A-06): RSVP 섹션은 최대 1개 — 응답이 어느 폼의 것인지 모호해지는 것을 막는다
    if (doc.sections.filter((s) => s.type === "rsvp").length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "RSVP 섹션은 최대 1개여야 합니다",
      });
    }
  });

export type Parent = z.infer<typeof parentSchema>;
export type Person = z.infer<typeof personSchema>;
export type Wedding = z.infer<typeof weddingSchema>;
export type ThemeId = z.infer<typeof themeIdSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type SectionStyle = z.infer<typeof sectionStyleSchema>;
export type PhotoFrame = z.infer<typeof photoFrameSchema>;
export type HeroPhotoAspect = z.infer<typeof heroPhotoAspectSchema>;
export type GalleryPhoto = z.infer<typeof galleryPhotoSchema>;
export type HeroSection = z.infer<typeof heroSectionSchema>;
export type GreetingSection = z.infer<typeof greetingSectionSchema>;
export type CoupleProfileSection = z.infer<typeof coupleProfileSectionSchema>;
export type ProfileEntry = z.infer<typeof profileEntrySchema>;
export type CalendarSection = z.infer<typeof calendarSectionSchema>;
export type GallerySection = z.infer<typeof gallerySectionSchema>;
export type VenueSection = z.infer<typeof venueSectionSchema>;
export type VideoSection = z.infer<typeof videoSectionSchema>;
export type TransportationSection = z.infer<typeof transportationSectionSchema>;
export type TransportIcon = z.infer<typeof transportIconSchema>;
export type TransportItem = z.infer<typeof transportItemSchema>;
export type ContactsSection = z.infer<typeof contactsSectionSchema>;
export type ContactSide = z.infer<typeof contactSideSchema>;
export type ContactEntry = z.infer<typeof contactEntrySchema>;
export type GiftAccountSection = z.infer<typeof giftAccountSectionSchema>;
export type GiftAccount = z.infer<typeof giftAccountSchema>;
export type RsvpSection = z.infer<typeof rsvpSectionSchema>;
export type RsvpCollect = z.infer<typeof rsvpCollectSchema>;
export type ClosingSection = z.infer<typeof closingSectionSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type InvitationDocument = z.infer<typeof documentSchema>;
