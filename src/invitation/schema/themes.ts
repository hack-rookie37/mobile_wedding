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
  hero: SectionVariantId;
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
      hero: "editorial",
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
      hero: "mono",
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
      hero: "film",
      greeting: "film",
      gallery: "film",
      venue: "film",
      sectionDivider: false,
      photoTreatment: "polaroid",
    },
  },
};
