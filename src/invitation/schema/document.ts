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
  familyRole: z.string().optional(), // "아들", "딸" 등 (자유 입력)
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

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "색은 #rrggbb 형식이어야 합니다");

// 채워진 버튼의 색 — 비우면 테마 강조색을 따른다.
// 버튼 위 글자·심볼 색은 이 색의 밝기에서 자동으로 정해진다(renderer/colors.ts).
// 카카오 공유·캘린더 저장·참석 여부 전달이 같은 규칙을 쓴다 — 한 청첩장에서 버튼은 한 색이다.
export const buttonColorSchema = hexColorSchema.optional();

// 테마 색 override — 고른 테마 위에 개별 색만 덮어쓴다. 비어 있으면 테마 토큰 그대로.
// ink-soft·line은 여기 없다: ink와 paper를 섞어 자동으로 만든다 (themes.ts) —
// 다섯 색을 따로 맞추게 하면 서로 안 어울리는 조합이 나오기 쉽다.
export const paletteSchema = z.object({
  paper: hexColorSchema.optional(), // 배경색
  ink: hexColorSchema.optional(), // 글자색
  accent: hexColorSchema.optional(), // 강조색 (라벨·구분선)
});

export const themeSchema = z.object({
  id: themeIdSchema,
  palette: paletteSchema,
});

// ── 섹션 공통

// ── 폰트 — id 목록만 스키마가 안다. CSS 스택 해석은 themes.ts(FONT_CHOICES)가 담당.
// "theme"은 테마 기본값을 그대로 쓴다는 뜻이다.

export const builtinFontIdSchema = z.enum([
  "theme",
  "noto-serif",
  "nanum-myeongjo",
  "gowun-batang",
  "gowun-dodum",
  "sans",
]);

// 업로드한 폰트는 "custom:<assetId>" — 파일은 asset 저장소가 갖고 문서는 참조만 한다 (ADR-016)
export const fontIdSchema = z.union([
  builtinFontIdSchema,
  z.templateLiteral(["custom:", z.string().min(1)]),
]);

// 글자 크기(pt). 렌더러의 px 크기가 이 값에 비례해 곱해진다 — themes.ts가 환산한다.
// 제목과 본문은 기준선이 달라서(20px·15px) 각각의 pt가 실제 렌더 크기와 맞아떨어진다.
export const fontSizePtSchema = z.number().min(7).max(28);

// ── 글자 역할 (v12, ADR-035)
//
// 청첩장의 글자는 네 무리로 나뉜다. 한 무리 안에서도 요소마다 크기가 다르므로
// (제목 h2는 20px, 메인의 이름은 26px) 크기는 절대값이 아니라 배율로 적용된다 —
// 키워도 무리 안의 위계가 유지된다.
export const textRoleSchema = z.enum(["label", "heading", "itemTitle", "body"]);

// 자간은 em(글자 크기 대비), 행간은 배수. 둘 다 크기를 따라 움직여야 하는 값이라
// px로 두지 않는다 — 글자를 키웠는데 줄 간격만 그대로면 답답해진다.
export const LETTER_SPACING_MIN = -0.05;
export const LETTER_SPACING_MAX = 0.4;
export const LINE_HEIGHT_MIN = 1;
export const LINE_HEIGHT_MAX = 2.4;

// 글꼴·크기를 뺀 나머지. 전역·섹션 어느 층에서도 "미지정 = 아래가 원래 하던 대로"다 —
// bold를 false로 두는 것과 아예 정하지 않는 것은 다르다: 전자는 굵기를 400으로 못박고,
// 후자는 요소가 원래 갖고 있던 굵기(항목 제목의 semibold 등)를 그대로 둔다.
export const textAccentsSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: hexColorSchema.optional(),
  letterSpacing: z.number().min(LETTER_SPACING_MIN).max(LETTER_SPACING_MAX).optional(),
  lineHeight: z.number().min(LINE_HEIGHT_MIN).max(LINE_HEIGHT_MAX).optional(),
});

// 전역은 글꼴과 크기를 반드시 갖는다 — 모든 글자가 결국 어떤 글꼴·배율로든 그려져야 한다.
// font의 "theme"은 테마 기본 글꼴을 쓴다는 뜻이다 (v12 전의 headingFont·bodyFont와 같다).
export const globalTextStyleSchema = textAccentsSchema.extend({
  font: fontIdSchema,
  sizePt: fontSizePtSchema,
});
// 섹션은 전부 선택 — 비우면 전역을 따른다.
export const sectionTextStyleSchema = textAccentsSchema.extend({
  font: fontIdSchema.optional(),
  sizePt: fontSizePtSchema.optional(),
});

const rolesOf = <T extends z.ZodTypeAny>(style: T) =>
  z.object({ label: style, heading: style, itemTitle: style, body: style });

export const typographySchema = z.object({
  roles: rolesOf(globalTextStyleSchema),
});

export const sectionTextRolesSchema = rolesOf(sectionTextStyleSchema);

// 아무것도 덮어쓰지 않는 섹션 글자 설정 — 전부 전역을 따른다.
export const EMPTY_SECTION_TEXT = {
  label: {},
  heading: {},
  itemTitle: {},
  body: {},
} as const;

// 좌우 여백(px). 0이면 콘텐츠가 캔버스 가로를 꽉 채운다 — v10 전까지 전면 사진과
// 대형 스트립만 누리던 모습이고, 나머지는 24px로 고정이었다.
export const SECTION_PAD_X_MIN = 0;
export const SECTION_PAD_X_MAX = 48;
export const DEFAULT_SECTION_PAD_X = 24;

export const sectionStyleSchema = z.object({
  paddingY: z.enum(["sm", "md", "lg"]),
  paddingX: z.number().int().min(SECTION_PAD_X_MIN).max(SECTION_PAD_X_MAX),
  background: hexColorSchema.optional(), // 섹션 배경색
  animation: z.enum(["none", "fade", "rise"]),
  // 이 섹션만의 글자 설정 — 비운 값은 전역(typography.roles)을 따른다.
  // v12 전의 fontFamily·headingPt·bodyPt·color가 전부 여기로 들어왔다 (ADR-035).
  text: sectionTextRolesSchema,
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

// 대형 사진 세로 비율 (hero photoFull·gallery strip 공용) —
// 값은 CSS aspect-ratio의 가로/세로. 아래로 갈수록 길다.
// 9/20·9/24는 '파노라마' — 폰 첫 화면을 사진만으로 채우려고 넣었다.
// 430px 캔버스에서 9/20이면 956px라 세로 844px짜리 화면을 넘긴다.
export const photoAspectSchema = z.enum(["1/1", "4/5", "3/4", "9/16", "9/20", "9/24"]);

// 꽃잎 양·투명도의 허용 범위. 개수는 '심어 둔 자리' 수의 상한이다 — 화면에는 낙하 주기에
// 따라 평균 절반쯤이 동시에 보인다.
export const PETAL_COUNT_MIN = 1;
export const PETAL_COUNT_MAX = 20;
export const PETAL_OPACITY_MIN = 0.2;

// 전면 사진(메인·맺음말)이 공유하는 표시 효과. 레이아웃이 아니라 사진 자체의 연출이다.
export const photoEffectsSchema = z.object({
  fadeBottom: z.boolean(), // 사진 하단을 배경색으로 녹인다
  sparkle: z.boolean(), // 은은한 반짝임 오버레이
  petals: z.boolean(), // 꽃잎이 흩날리며 떨어지는 오버레이
  // 꽃잎의 바탕색 — 장마다 흰색을 섞은 밝은 변주가 자동으로 만들어진다 (색 하나로 세 톤).
  petalColor: hexColorSchema,
  petalCount: z.number().int().min(PETAL_COUNT_MIN).max(PETAL_COUNT_MAX),
  petalOpacity: z.number().min(PETAL_OPACITY_MIN).max(1),
  brightness: z.number().min(0.3).max(1.5), // 1 = 원본
  opacity: z.number().min(0.2).max(1), // 1 = 불투명
});

// 메인 사진 위에 얹는 한 줄 ("we're getting married" 같은 문구).
// 사진 아래 tagline과 달리 사진 위에 겹치므로 크기·글꼴·색을 따로 고른다 —
// 전역 typography를 따르게 하면 사진마다 달라지는 균형을 맞출 수 없다.
// 사진 위 문구는 역할 글자(최대 28pt)와 달리 훨씬 크게 쓴다 — 사진 한 장을 덮는 한 줄이라
// 28pt로는 작다. 역할 pt는 배율로 환산되지만 이 값은 절대 크기라 따로 열어도 안전하다.
// 200pt까지 연다(v18) — 글자 몇 자로 사진을 통째로 덮는 연출용. 넘치는 부분은 사진에서 잘린다.
export const OVERLAY_PT_MAX = 200;
export const overlayFontSizePtSchema = z.number().min(7).max(OVERLAY_PT_MAX);

// 그림자 세기 — 진하기(알파)와 번짐(blur)을 한 숫자로 함께 움직인다.
// 둘을 따로 고르게 하면 어울리는 조합을 사용자가 직접 찾아야 한다.
// 0을 허용하지 않는 이유: 그건 '그림자 끄기'와 같은 말이고, 그 스위치는 이미 있다.
export const SHADOW_STRENGTH_MIN = 5;
export const SHADOW_STRENGTH_MAX = 100;

// 발광 세기 — 그림자 세기와 같은 규칙(진하기·번짐을 한 숫자로). 빛 색은 글자색을 따른다:
// 글자와 다른 색으로 빛나는 글자는 후광이 아니라 번진 인쇄처럼 보인다.
export const GLOW_STRENGTH_MIN = 5;
export const GLOW_STRENGTH_MAX = 100;

// 등장 효과 재생 속도 배율. 1에서 멀어질수록 원래 리듬에서 벗어난다 —
// 0.5는 두 배 느리게, 2는 두 배 빠르게. 그 밖은 효과가 아니라 오류처럼 보인다.
export const OVERLAY_SPEED_MIN = 0.5;
export const OVERLAY_SPEED_MAX = 2;

// 사진 위 문구 전용 자간·행간 하한 — 역할 글자(최소 -0.05em·1.0)보다 훨씬 깊은 마이너스를
// 허용한다. 필기체를 포개는 연출("글자가 겹쳐도 좋으니")은 여기서만 말이 되고,
// 본문 역할에 이 하한을 열면 청첩장 본문이 읽을 수 없게 겹치는 사고 손잡이가 된다.
export const OVERLAY_LETTER_SPACING_MIN = -0.5;
export const OVERLAY_LINE_HEIGHT_MIN = 0.3;

// 기울기(도). 시계 방향이 +다. ±90이면 세로쓰기까지 닿는다 — 그 너머는 뒤집힌 글자다.
export const OVERLAY_ROTATE_MAX = 90;

// 글자 외곽 흐림(px). 0 = 또렷(끄기)이라 별도 스위치를 두지 않는다.
// 6을 넘기면 부드러운 가장자리가 아니라 초점 나간 글자가 된다.
export const EDGE_BLUR_MAX = 6;

export const heroOverlaySchema = z.object({
  text: z.string(), // 빈 문자열이면 아무것도 얹지 않는다
  // 사진 안에서의 세로 위치(%). 0이면 위쪽 끝, 100이면 아래쪽 끝에 붙는다 (가로는 항상 가운데).
  // 3단 고르기에서 숫자로 바꿨다 — 사진마다 얼굴·여백 자리가 달라 세 칸으로는 안 맞았다.
  positionPct: z.number().min(0).max(100),
  font: fontIdSchema, // "theme" = 제목 글꼴
  sizePt: overlayFontSizePtSchema,
  color: hexColorSchema,
  // 자간(em)·행간(배수) — 단위는 역할 글자(ADR-035)와 같지만 하한은 따로다:
  // 겹침을 허용하는 깊은 마이너스까지 연다 (OVERLAY_*_MIN 주석 참고, v18).
  letterSpacing: z.number().min(OVERLAY_LETTER_SPACING_MIN).max(LETTER_SPACING_MAX),
  lineHeight: z.number().min(OVERLAY_LINE_HEIGHT_MIN).max(LINE_HEIGHT_MAX),
  // 문구 전체의 기울기(도, 시계 방향 +). 사진의 대각선을 따라 얹는 연출용 (v18).
  rotateDeg: z.number().min(-OVERLAY_ROTATE_MAX).max(OVERLAY_ROTATE_MAX),
  // 글자 자체의 외곽을 부드럽게 번지게 한다 — 발광(뒤에 깔리는 후광)과 별개의 효과다.
  edgeBlurPx: z.number().min(0).max(EDGE_BLUR_MAX),
  // 글자 주변이 은은하게 빛나는 후광 — 세기 하나가 번짐과 진하기를 함께 움직이고,
  // 켜져 있는 동안 천천히 숨쉬듯 밝아졌다 어두워진다. 빛 색은 글자색을 따른다.
  glow: z.boolean(),
  glowStrength: z.number().min(GLOW_STRENGTH_MIN).max(GLOW_STRENGTH_MAX),
  // 문구가 나타나는 방식. CSS 애니메이션 지연만으로 그리므로 JS가 없어도 글자는 다 보인다.
  //  fade/rise:          문단 통째로 (떠오르기 / 아래에서 올라오기)
  //  typing/letterFade:  글자마다 (타자기처럼 찍히기 / 스르륵 나타나기)
  //  writing:            줄마다 왼쪽에서 오른쪽으로 쓸려 나온다 — 손으로 쓰는 것에 가장 가깝다.
  //    획을 따라 그리는 진짜 필기는 글리프마다 SVG 경로가 있어야 해서 임의의 글자로는 못 만든다.
  animation: z.enum(["none", "fade", "rise", "typing", "letterFade", "writing"]),
  animationSpeed: z.number().min(OVERLAY_SPEED_MIN).max(OVERLAY_SPEED_MAX), // 1 = 원래 속도
  shadow: z.boolean(), // 사진 위 가독성용 그림자 — 어두운 사진에서는 없는 편이 깔끔하다
  // 검정 그림자가 늘 답은 아니다: 밝은 글자에는 사진의 어두운 색, 어두운 글자에는
  // 흰 그림자(테두리처럼 보인다)가 더 읽힌다.
  shadowColor: hexColorSchema,
  shadowStrength: z.number().min(SHADOW_STRENGTH_MIN).max(SHADOW_STRENGTH_MAX),
});

// 빈 문구 = 얹지 않음. 흰색은 사진 위에서 가장 자주 읽히는 색이다 (렌더러가 그림자를 함께 깐다).
// 그림자 검정 40%는 v12까지 렌더러에 못박혀 있던 값이다 — 기본값이 그대로라 모습이 변하지 않는다.
export const DEFAULT_HERO_OVERLAY = {
  text: "",
  positionPct: 50,
  font: "theme",
  sizePt: 14,
  color: "#ffffff",
  // 자간 0 · 행간 1.45는 v15까지 렌더러에 못박혀 있던 값 — 기본값이 그대로라 모습이 변하지 않는다
  letterSpacing: 0,
  lineHeight: 1.45,
  rotateDeg: 0,
  edgeBlurPx: 0,
  glow: false,
  glowStrength: 40,
  animation: "none",
  animationSpeed: 1,
  shadow: true,
  shadowColor: "#000000",
  shadowStrength: 40,
} as const;

// 사진 아래 글(태그라인·이름·일시·장소)을 얼마나 더 내릴지(px).
// 파노라마 사진과 짝을 이룬다: 사진으로 첫 화면을 채우고 나머지는 스크롤해야 보이게 한다.
export const HERO_OFFSET_MAX = 320;

// 섹션 제목과 그 위의 눈썹 라벨. 12개 섹션이 공유한다 — 같은 지식을 열두 번 적지 않는다.
// label은 빈 문자열이면 눈썹 없이 제목만 나온다 (맺음말의 기본값이 그렇다).
export const SECTION_LABEL_MAX = 24;

export const titledContentSchema = z.object({
  title: z.string(),
  label: z.string().max(SECTION_LABEL_MAX, `눈썹 라벨은 최대 ${SECTION_LABEL_MAX}자입니다`),
});

export const heroContentSchema = z.object({
  tagline: z.string(),
  overlay: heroOverlaySchema,
  contentOffsetPx: z.number().min(0).max(HERO_OFFSET_MAX),
  photoAssetId: z.string().nullable(),
  photoFrame: photoFrameSchema.optional(),
  photoAspect: photoAspectSchema,
  effects: photoEffectsSchema,
  showDate: z.boolean(),
  showVenue: z.boolean(),
});

// 메인은 전면 사진 단일 레이아웃이다 — 표현 선택은 layout이 아니라 content.effects가 담당한다
export const heroSectionSchema = sectionBase.extend({
  type: z.literal("hero"),
  layout: z.object({ variant: z.enum(["photoFull"]) }),
  content: heroContentSchema,
});

// 장식 이미지 높이(px) — 작은 문양(16)부터 캔버스 폭을 넉넉히 쓰는 배너(240)까지.
// 크기는 이 한 손잡이뿐이다: 원본 비율을 따라 폭이 정해지고, 캔버스를 넘치면
// 폭에 맞춰 줄어든다 (crop이 없어 frame도 없다 — venueMap과 같은 결).
export const ORNAMENT_HEIGHT_MIN = 16;
export const ORNAMENT_HEIGHT_MAX = 240;
export const DEFAULT_ORNAMENT_HEIGHT = 56;

export const greetingContentSchema = titledContentSchema.extend({
  body: z.string(),
  showParents: z.boolean(),
  align: z.enum(["center", "left"]),
  // 눈썹 라벨 위에 얹는 장식 이미지(리본 등) — null = 없음
  ornamentAssetId: z.string().nullable(),
  ornamentHeightPx: z.number().int().min(ORNAMENT_HEIGHT_MIN).max(ORNAMENT_HEIGHT_MAX),
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

// 사진 모서리 모양. v9 전까지는 테마의 결(mono만 각짐)과 레이아웃(strip만 각짐)이
// 정하던 값이라 사용자가 손댈 수 없었다 — 갤러리 섹션의 선택지로 뺐다.
export const photoCornerSchema = z.enum(["sharp", "rounded"]);

// 사진 사이 간격(px). 0이면 사진끼리 맞붙는다.
export const GALLERY_GAP_MIN = 0;
export const GALLERY_GAP_MAX = 24;
export const DEFAULT_GALLERY_GAP_PX = 6;

export const galleryContentSchema = titledContentSchema.extend({
  photos: z.array(galleryPhotoSchema).max(30, "갤러리 사진은 최대 30장입니다"),
  // 한 장씩 크게 보여주는 레이아웃(strip·slider)의 세로 비율 — 격자형은 고정 비율을 쓴다
  photoAspect: photoAspectSchema,
  photoCorner: photoCornerSchema,
  photoGapPx: z.number().int().min(GALLERY_GAP_MIN).max(GALLERY_GAP_MAX),
});

export const gallerySectionSchema = sectionBase.extend({
  type: z.literal("gallery"),
  // strip: 캔버스 가로를 꽉 채우는 대형 가로 스냅 스트립 (벤치마크 스타일)
  layout: z.object({
    variant: z.enum(["strip", "grid2", "grid3", "slider", "collage"]),
  }),
  content: galleryContentSchema,
});

export const venueContentSchema = titledContentSchema.extend({
  note: z.string(), // 주차·안내 등 자유 문구 (빈 문자열 허용)
  // 약도 이미지 (예식장 안내도 캡처 등) — 원본 비율 그대로 표시, crop 없음
  mapImageAssetId: z.string().nullable(),
  // 외부 지도 앱으로 열기 버튼 (네이버·카카오맵·티맵) — 별도 지도 API 없이 URL·딥링크만 사용
  showMapButtons: z.boolean(),
});

export const venueSectionSchema = sectionBase.extend({
  type: z.literal("venue"),
  layout: z.object({ variant: z.enum(["default"]) }),
  content: venueContentSchema,
});

// MVP 동영상: YouTube·Vimeo 외부 URL만 저장한다 — 직접 업로드·트랜스코딩 없음 (ADR-017)
export const videoContentSchema = titledContentSchema.extend({
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

export const coupleProfileContentSchema = titledContentSchema.extend({
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
export const calendarContentSchema = titledContentSchema.extend({
  showDday: z.boolean(),
  // badge: "D-N" 텍스트 / countdown: 일:시:분:초 실시간 (showDday가 켜져 있을 때만 의미)
  ddayStyle: z.enum(["badge", "countdown"]),
  buttonColor: buttonColorSchema, // '캘린더에 일정 저장'
});

export const calendarSectionSchema = sectionBase.extend({
  type: z.literal("calendar"),
  layout: z.object({ variant: z.enum(["grid", "simple"]) }),
  content: calendarContentSchema,
});

// 교통 안내 — 수단별 항목의 반복 그룹
export const transportIconSchema = z.enum([
  "subway",
  "bus",
  "car",
  "parking",
  "shuttle",
  "phone", // 예식장 전화 안내 — 이모지 대신 수단으로 고르면 다른 그림과 크기가 맞는다 (ADR-043)
  "etc",
]);

// 항목 앞에 붙는 그림. 여러 글자를 붙인 이모지(🅿️·👨‍👩‍👧)도 있어서 한 글자로 자르지 않는다.
export const TRANSPORT_EMOJI_MAX = 8;

export const transportItemSchema = z.object({
  icon: transportIconSchema,
  emoji: z.string().max(TRANSPORT_EMOJI_MAX, `그림은 최대 ${TRANSPORT_EMOJI_MAX}자입니다`), // 빈 문자열 = 수단의 기본 그림
  title: z.string(),
  body: z.string(), // 멀티라인 안내 (개행 보존)
});

// 카드 격자의 열 수. 리스트·접이식에서는 쓰이지 않는다 (한 줄에 하나씩이라 나눌 것이 없다).
export const TRANSPORT_COLUMNS_MIN = 1;
export const TRANSPORT_COLUMNS_MAX = 3;
export const DEFAULT_TRANSPORT_COLUMNS = 2;

export const transportationContentSchema = titledContentSchema.extend({
  items: z.array(transportItemSchema).max(10, "교통 안내는 최대 10개입니다"),
  columns: z.number().int().min(TRANSPORT_COLUMNS_MIN).max(TRANSPORT_COLUMNS_MAX),
});

export const transportationSectionSchema = sectionBase.extend({
  type: z.literal("transportation"),
  // accordion: 수단만 늘어놓고, 누른 항목의 안내만 아래로 펼친다
  layout: z.object({ variant: z.enum(["list", "cards", "accordion"]) }),
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

export const contactsContentSchema = titledContentSchema.extend({
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

export const giftAccountContentSchema = titledContentSchema.extend({
  body: z.string(), // 안내 문구 (빈 문자열 = 표시 없음)
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

export const rsvpContentSchema = titledContentSchema.extend({
  body: z.string(), // 안내 문구
  deadline: z.iso.datetime({ offset: true }).nullable(), // null = 마감 없음
  collect: rsvpCollectSchema, // 성명·참석 여부·개인정보 동의는 항상 수집한다 (A-16)
  buttonColor: buttonColorSchema, // '참석 여부 전달하기'와 시트 안 제출 버튼
});

export const rsvpSectionSchema = sectionBase.extend({
  type: z.literal("rsvp"),
  // sheet: 안내 + '참석 여부 전달하기' 버튼 → 아래에서 올라오는 시트에서 작성 (벤치마크 스타일)
  // inline: 폼을 섹션 안에 바로 펼침
  layout: z.object({ variant: z.enum(["sheet", "inline"]) }),
  content: rsvpContentSchema,
});

// 맺음말 — 마무리 문구 + 선택 사진 + 링크 공유 버튼
export const closingContentSchema = titledContentSchema.extend({
  body: z.string(),
  photoAssetId: z.string().nullable(),
  photoFrame: photoFrameSchema.optional(),
  // 메인과 같은 전면 사진 연출 — photo variant에서만 쓰인다
  photoAspect: photoAspectSchema,
  effects: photoEffectsSchema,
});

export const closingSectionSchema = sectionBase.extend({
  type: z.literal("closing"),
  layout: z.object({ variant: z.enum(["simple", "photo"]) }),
  content: closingContentSchema,
});

// 공유하기 — 맺음말 아래에 따로 두는 마지막 영역.
// 링크 복사는 어디서나 되고, 카카오톡 공유는 호스트가 카카오 JS 키를 넘겨줄 때만 나타난다.
export const shareContentSchema = titledContentSchema.extend({
  body: z.string(),
  kakaoButtonColor: buttonColorSchema,
  // 어두운 판의 색. dark variant일 때만 쓰이고, 비우면 기본 먹색(#1A1A1A)이다.
  // 글자·구분선 색은 이 색의 밝기에서 자동으로 만들어진다 — 밝은 색을 골라도 글자가 살아남는다.
  darkColor: hexColorSchema.optional(),
});

export const shareSectionSchema = sectionBase.extend({
  type: z.literal("share"),
  // dark: 맺음말 전면 사진처럼 어두운 판 위에 밝은 글자로 뒤집는다
  layout: z.object({ variant: z.enum(["default", "dark"]) }),
  content: shareContentSchema,
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
  shareSectionSchema,
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
  share: shareContentSchema,
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
  share: shareSectionSchema.shape.layout,
} as const;

// ── 배경음악 — 문서에는 asset 참조와 재생 설정만 (파일은 asset 저장소, ADR-016).

// 재생 속도. 1에서 멀어질수록 음이 함께 높아지거나 낮아진다 — 넓힐수록 노래가 아니게 된다.
export const MUSIC_SPEED_MIN = 0.5;
export const MUSIC_SPEED_MAX = 1.5;

export const musicSchema = z.object({
  assetId: z.string().nullable(), // null = 배경음악 없음
  volume: z.number().min(0).max(1), // 1 = 파일 원본 크기
  speed: z.number().min(MUSIC_SPEED_MIN).max(MUSIC_SPEED_MAX), // 1 = 원래 속도
  // 게스트가 누르지 않아도 켜기를 시도한다. 브라우저는 소리 있는 자동재생을 대부분 막으므로
  // 막히면 첫 스크롤·터치까지 기다렸다 다시 시도한다 — "반드시 켜진다"는 보장은 없다.
  autoplay: z.boolean(),
});

// ── 문서

export const documentSchema = z
  .object({
    schemaVersion: z.literal(21),
    wedding: weddingSchema,
    theme: themeSchema,
    music: musicSchema,
    typography: typographySchema,
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
export type Palette = z.infer<typeof paletteSchema>;
export type Music = z.infer<typeof musicSchema>;
export type FontId = z.infer<typeof fontIdSchema>;
export type BuiltinFontId = z.infer<typeof builtinFontIdSchema>;
export type Typography = z.infer<typeof typographySchema>;
export type TextRole = z.infer<typeof textRoleSchema>;
export type TextAccents = z.infer<typeof textAccentsSchema>;
export type GlobalTextStyle = z.infer<typeof globalTextStyleSchema>;
export type SectionTextStyle = z.infer<typeof sectionTextStyleSchema>;
export type SectionTextRoles = z.infer<typeof sectionTextRolesSchema>;
export type SectionStyle = z.infer<typeof sectionStyleSchema>;
export type PhotoFrame = z.infer<typeof photoFrameSchema>;
export type PhotoAspect = z.infer<typeof photoAspectSchema>;
export type PhotoEffects = z.infer<typeof photoEffectsSchema>;
export type HeroOverlay = z.infer<typeof heroOverlaySchema>;
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
export type ShareSection = z.infer<typeof shareSectionSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
// 제목과 눈썹 라벨을 가진 섹션 — 메인만 빠진다 (전면 사진이라 제목 자리가 없다)
export type TitledSection = Exclude<Section, HeroSection>;
export type InvitationDocument = z.infer<typeof documentSchema>;
