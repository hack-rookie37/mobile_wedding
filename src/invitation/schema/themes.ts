import type { ThemeId } from "./document";

// Phase 3 테마 시스템 (ADR-014)
// 테마는 "토큰 + 섹션 variant 선택"만 제어한다. 문서의 텍스트·사진·순서·표시 여부에는
// 절대 관여하지 않으며, 렌더러 섹션 컴포넌트가 variant 이름으로 표현만 분기한다.

export type SectionVariantId = "editorial" | "mono" | "film";

export interface ThemeTokens {
  paper: string;
  ink: string;
  inkSoft: string;
  accent: string;
  line: string;
  headingFont: string; // CSS font-family 값 (layout.tsx가 주입한 폰트 변수 사용)
  bodyFont: string; // 본문 기본 (문서 typography가 덮어쓸 수 있다)
  handFont: string; // 손글씨 강조용 (film 계열 외에는 headingFont와 동일)
  radiusPhoto: string; // 'soft' 사진 프레임의 radius
  padSm: string; // 섹션 상하 여백 preset — 테마별 vertical rhythm
  padMd: string;
  padLg: string;
  motionMs: number; // 0이면 진입 모션 없음
  motionEase: string;
  riseDistance: string;
}

export interface ThemeVariants {
  header: SectionVariantId;
  // hero는 전면 사진 단일 레이아웃이라 테마 분기가 없다 — 토큰(폰트·색)만 반영된다
  greeting: SectionVariantId;
  gallery: SectionVariantId;
  venue: SectionVariantId;
  sectionDivider: boolean; // 섹션 사이 hairline (구조적 테마용)
  photoTreatment: "plain" | "polaroid";
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  tokens: ThemeTokens;
  variants: ThemeVariants;
}

const SERIF = "var(--font-noto-serif-kr), 'Noto Serif KR', serif";
const SANS = "var(--font-sans)";
const HAND = "var(--font-nanum-pen), 'Nanum Pen Script', cursive";

// 문서 typography의 내장 폰트 선택지 — id 목록은 document.ts(builtinFontIdSchema)가 단일 소스.
// "theme"은 여기 없다: 테마 토큰을 그대로 쓴다는 뜻이라 CSS 해석이 없다.
export const FONT_CHOICES: Record<
  Exclude<import("./document").BuiltinFontId, "theme">,
  { label: string; css: string }
> = {
  "noto-serif": { label: "노토 세리프", css: SERIF },
  "nanum-myeongjo": {
    label: "나눔명조",
    css: "var(--font-nanum-myeongjo), 'Nanum Myeongjo', serif",
  },
  "gowun-batang": { label: "고운바탕", css: "var(--font-gowun-batang), 'Gowun Batang', serif" },
  "gowun-dodum": {
    label: "고운돋움",
    css: "var(--font-gowun-dodum), 'Gowun Dodum', sans-serif",
  },
  sans: { label: "고딕", css: SANS },
};

// 렌더러 텍스트 크기의 기준선(px). 모든 텍스트가 calc(Npx * var(--canvas-fs))로 곱해지므로
// 사용자가 입력한 pt를 이 기준에 대한 배율로 환산하면 전체가 함께 커진다.
export const BASE_BODY_PX = 15;
const PT_TO_PX = 96 / 72;
export const DEFAULT_BASE_PT = 11; // ≈ 14.7px — 기존 '보통' 크기

export function fontScaleFromPt(pt: number): number {
  return (pt * PT_TO_PX) / BASE_BODY_PX;
}

// 업로드 폰트의 CSS family 이름 — @font-face 선언과 사용처가 이 함수 하나를 공유한다
export const CUSTOM_FONT_PREFIX = "custom:";

export function customFontFamily(assetId: string): string {
  return `cf-${assetId}`;
}

export function customFontAssetIdOf(fontId: import("./document").FontId): string | null {
  return fontId.startsWith(CUSTOM_FONT_PREFIX) ? fontId.slice(CUSTOM_FONT_PREFIX.length) : null;
}

// fontId → CSS 스택 ("theme"은 null — 호출자가 테마 토큰으로 대체)
export function fontCssOf(fontId: import("./document").FontId): string | null {
  if (fontId === "theme") return null;
  const customId = customFontAssetIdOf(fontId);
  if (customId !== null) return `"${customFontFamily(customId)}", ${SANS}`;
  const choice = (FONT_CHOICES as Record<string, { css: string }>)[fontId];
  if (!choice) throw new Error(`알 수 없는 폰트 id입니다: ${fontId}`);
  return choice.css;
}

export const THEME_ORDER: ThemeId[] = ["warm-editorial", "modern-monochrome", "film-diary"];

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  "warm-editorial": {
    id: "warm-editorial",
    label: "웜 에디토리얼",
    description: "따뜻한 아이보리 위에 절제된 세리프. 잡지 편집 디자인의 결.",
    tokens: {
      paper: "#FAF7F1",
      ink: "#221D16",
      inkSoft: "#6E6659",
      accent: "#A6795B",
      line: "#E7E0D4",
      headingFont: SERIF,
      bodyFont: SANS,
      handFont: SERIF,
      radiusPhoto: "10px",
      padSm: "56px",
      padMd: "88px",
      padLg: "120px",
      motionMs: 700,
      motionEase: "cubic-bezier(0.22, 1, 0.36, 1)",
      riseDistance: "12px",
    },
    variants: {
      header: "editorial",
      greeting: "editorial",
      gallery: "editorial",
      venue: "editorial",
      sectionDivider: false,
      photoTreatment: "plain",
    },
  },
  "modern-monochrome": {
    id: "modern-monochrome",
    label: "모던 모노크롬",
    description: "백·회·흑과 명확한 그리드. 번호 라벨과 hairline으로 구조를 드러낸다.",
    tokens: {
      paper: "#FFFFFF",
      ink: "#141414",
      inkSoft: "#6E6E6E",
      accent: "#141414",
      line: "#E4E4E4",
      headingFont: SANS,
      bodyFont: SANS,
      handFont: SANS,
      radiusPhoto: "0px",
      padSm: "44px",
      padMd: "68px",
      padLg: "92px",
      motionMs: 0, // 구조적 테마 — 즉시 표시
      motionEase: "linear",
      riseDistance: "0px",
    },
    variants: {
      header: "mono",
      greeting: "mono",
      gallery: "mono",
      venue: "mono",
      sectionDivider: true,
      photoTreatment: "plain",
    },
  },
  "film-diary": {
    id: "film-diary",
    label: "필름 다이어리",
    description: "폴라로이드 프레임과 손글씨 캡션. 개인 필름 앨범을 넘기는 감각.",
    tokens: {
      paper: "#F8F4EA",
      ink: "#3A352C",
      inkSoft: "#7C7466",
      accent: "#8C7A5B",
      line: "#E4DCCB",
      headingFont: SERIF,
      bodyFont: SANS,
      handFont: HAND,
      radiusPhoto: "2px",
      padSm: "52px",
      padMd: "80px",
      padLg: "108px",
      motionMs: 800,
      motionEase: "cubic-bezier(0.22, 1, 0.36, 1)",
      riseDistance: "16px",
    },
    variants: {
      header: "film",
      greeting: "film",
      gallery: "film",
      venue: "film",
      sectionDivider: false,
      photoTreatment: "polaroid",
    },
  },
};
