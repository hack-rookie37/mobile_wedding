import type { CSSProperties } from "react";

// 사용자가 고른 색 위에 무엇을 얹을지 정하는 규칙 한 벌.
// 버튼 색(카카오 공유·캘린더 저장·참석 여부 전달)과 공유 영역의 어두운 판이 같은 규칙을 쓴다 —
// 색을 고르는 자리마다 다른 계산을 두면 같은 색인데 글자 색이 달라진다.

// sRGB 상대 휘도(WCAG) — 배경 위에서 읽히는 글자색을 고른다.
// 0.45는 순수 회색(#777 근처)에서 갈리는 지점이라 노랑처럼 밝은 색에는 검은 글자가 온다.
export function readableInk(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? "#1A1A1A" : "#FFFFFF";
}

// 공유 영역의 어두운 판 기본색. 고르지 않으면 이 먹색이다.
export const DEFAULT_TONE_COLOR = "#1A1A1A";

// 한 섹션의 캔버스 색 변수를 통째로 갈아 끼운다 — 헤더·본문·버튼이 손대지 않고 따라온다.
//
// 테마 색을 뒤집는 대신 고른 배경색에서 만들어 낸다: 모던 모노크롬의 강조색은 #141414라
// 어두운 판 위에서 사라지고, 같은 요소에서 var(--canvas-ink)를 참조하면 순환이 된다.
// 비율(72·88·28%)은 v11의 고정값 rgba(255,255,255,0.x)를 그대로 옮긴 것이다 —
// 검정 판 위 흰 글자에서는 계산 결과가 그때와 정확히 같다.
export function toneVars(background: string): CSSProperties {
  const ink = readableInk(background);
  const mix = (percent: number) => `color-mix(in srgb, ${ink} ${percent}%, ${background})`;
  return {
    backgroundColor: background,
    "--canvas-paper": background,
    "--canvas-ink": ink,
    "--canvas-ink-soft": mix(72),
    "--canvas-accent": mix(88),
    "--canvas-line": mix(28),
  } as CSSProperties;
}
