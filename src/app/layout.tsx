import type { Metadata } from "next";
import {
  Gowun_Batang,
  Gowun_Dodum,
  Nanum_Myeongjo,
  Nanum_Pen_Script,
  Noto_Serif_KR,
} from "next/font/google";
import "./globals.css";

// 청첩장 canvas 테마용 서체. 본문 sans는 시스템 스택(globals.css).
// TODO(VS6): Pretendard 서브셋 self-host로 전환 (DESIGN_SYSTEM.md §4)
const notoSerifKr = Noto_Serif_KR({
  weight: ["400", "600"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-noto-serif-kr",
});

// 사용자 선택 폰트 (문서 typography — FONT_CHOICES와 1:1)
const nanumMyeongjo = Nanum_Myeongjo({
  weight: ["400", "700"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-nanum-myeongjo",
});

const gowunBatang = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-gowun-batang",
});

const gowunDodum = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-gowun-dodum",
});

// film-diary 테마의 손글씨 강조 전용 (작은 라벨·캡션에만 사용 — 과용 금지)
const nanumPen = Nanum_Pen_Script({
  weight: "400",
  subsets: ["latin"],
  preload: false,
  display: "swap",
  variable: "--font-nanum-pen",
});

export const metadata: Metadata = {
  title: "청첩장 스튜디오",
  description: "모바일 청첩장을 직접 만들고 다듬는 편집 도구",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${notoSerifKr.variable} ${nanumPen.variable} ${nanumMyeongjo.variable} ${gowunBatang.variable} ${gowunDodum.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
