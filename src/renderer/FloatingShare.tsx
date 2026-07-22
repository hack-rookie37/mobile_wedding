"use client";

import { useState } from "react";
import type { Wedding } from "@/invitation/schema/document";
import { readableInk } from "./colors";
import { KakaoIcon } from "./primitives/KakaoIcon";
import { useRenderer } from "./RendererContext";
import { useShareActions } from "./shareActions";

// 항상 떠 있는 공유 버튼 — 게스트가 어디까지 스크롤했든 청첩장을 바로 건넬 수 있다.
// 렌더러 안에 있으므로 편집기 미리보기에도 똑같이 보인다 (ADR-004) — 발행한 뒤에야
// 처음 만나는 UI를 만들지 않는다. 누르면 위로 작은 판이 열려 링크 복사·카카오톡 공유를 고른다.
//
// sticky + 음수 마진(-mt-11 = 버튼 높이)이라 문서 높이에 아무것도 더하지 않는다 —
// 예전 구현(공개 페이지 전용 sticky 바)은 흐름 안에서 52px를 차지해, 마지막 섹션 아래에
// 청첩장 배경이 아닌 바탕색 띠가 보였다. 판은 absolute라 열려 있어도 높이가 늘지 않는다.
export function FloatingShare({ wedding }: { wedding: Wedding }) {
  const { accentColor } = useRenderer();
  const { interactive, copied, copyLink, showKakao, shareKakao, error } = useShareActions(wedding);
  const [open, setOpen] = useState(false);
  const kakaoInk = readableInk(accentColor);

  const actionClass =
    "flex h-11 w-full items-center justify-center gap-2 rounded-xl " +
    "text-[length:calc(13px*var(--canvas-fs))] font-medium disabled:opacity-60";

  return (
    <div
      data-floating-share
      className="pointer-events-none sticky bottom-4 z-20 -mt-11 flex justify-center"
    >
      <div className="relative">
        {open && (
          // 판은 편집기 캔버스·게스트 화면 어느 배경 위에도 뜨므로 캔버스 색 변수 대신
          // 고정 흰 판을 쓴다 — 어두운 테마에서 --canvas-ink(밝은 색)를 쓰면 글자가 사라진다.
          <div className="pointer-events-auto absolute bottom-full left-1/2 mb-2.5 w-60 -translate-x-1/2 space-y-2 rounded-2xl bg-white p-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.22)]">
            <button
              type="button"
              disabled={!interactive}
              aria-live="polite"
              onClick={() => void copyLink()}
              className={`${actionClass} border border-black/10 text-[#26262a]`}
            >
              {copied ? "복사되었습니다" : "링크 복사"}
            </button>
            {showKakao && (
              <button
                type="button"
                disabled={!interactive}
                onClick={() => void shareKakao()}
                className={actionClass}
                style={{ backgroundColor: accentColor, color: kakaoInk }}
              >
                <KakaoIcon color={kakaoInk} />
                카카오톡 공유
              </button>
            )}
            {error !== null && (
              <p
                role="alert"
                className="px-1 text-[length:calc(11px*var(--canvas-fs))] text-red-600"
              >
                {error}
              </p>
            )}
          </div>
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-full bg-black/75 px-5 text-[length:calc(13px*var(--canvas-fs))] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur transition-colors hover:bg-black/85"
        >
          청첩장 공유하기
        </button>
      </div>
    </div>
  );
}
