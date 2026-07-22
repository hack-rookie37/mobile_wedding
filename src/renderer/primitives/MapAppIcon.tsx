"use client";

import type { MapAppId } from "@/invitation/lib/mapLinks";
import { readableInk } from "../colors";
import { useRenderer } from "../RendererContext";

// 지도 앱 아이콘 — 테마 강조색 배지 위에 각 앱을 알아볼 만한 단색 심볼을 그린다 (ADR-043).
// 원래는 각 서비스의 공식 앱 아이콘 이미지(제3자 상표)였는데, 브랜드 원색이 청첩장 톤에서
// 혼자 튀었다. 어느 앱인지는 배지 속 심볼과 바로 아래 글자 라벨이 함께 말해 준다.
// 심볼 색은 강조색의 밝기에서 자동으로 정해진다 — 밝은 강조색을 골라도 심볼이 살아남는다.

// 24×24 기준 심볼. 네이버 N·티맵 T는 획으로 긋고, 카카오는 브랜드 심볼인 말풍선을 쓴다
// (공유 버튼의 KakaoIcon과 같은 윤곽).
const SYMBOLS: Record<MapAppId, { d: string; stroke: boolean }> = {
  naver: { d: "M8 17V7l8 10V7", stroke: true },
  kakao: {
    d: "M12 4.4c-4.2 0-7.6 2.6-7.6 5.9 0 2.1 1.4 3.9 3.5 5l-.77 2.86a.31.31 0 0 0 .47.34l3.42-2.26c.32.03.65.05.98.05 4.2 0 7.6-2.65 7.6-5.95S16.2 4.4 12 4.4z",
    stroke: false,
  },
  tmap: { d: "M7.5 7h9M12 7v10", stroke: true },
};

export function MapAppIcon({ id }: { id: MapAppId }) {
  const { accentColor } = useRenderer();
  const ink = readableInk(accentColor);
  const symbol = SYMBOLS[id];
  return (
    <svg viewBox="0 0 34 34" aria-hidden className="size-[34px] shrink-0">
      <rect x="1" y="1" width="32" height="32" rx="9" fill={accentColor} />
      <g transform="translate(5 5)">
        {symbol.stroke ? (
          <path
            d={symbol.d}
            fill="none"
            stroke={ink}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path d={symbol.d} fill={ink} />
        )}
      </g>
    </svg>
  );
}
