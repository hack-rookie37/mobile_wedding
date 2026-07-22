"use client";

import { useEffect, useRef, useState } from "react";
import type { Wedding } from "@/invitation/schema/document";
import { readableInk } from "./colors";
import { KakaoIcon } from "./primitives/KakaoIcon";
import { useRenderer } from "./RendererContext";
import { useShareActions } from "./shareActions";

// 스크롤할 때만 떠오르는 공유 버튼 — 항상 떠 있으면 첫 화면(메인 사진)을 가린다.
// 최상단에서는 숨고, 스크롤 동작이 있는 동안 + 잠시 뒤까지 보였다가 스르륵 사라진다.
// 판이 열려 있는 동안은 사라지지 않는다 — 고르는 중에 버튼이 도망가면 안 된다.
// 렌더러 안에 있으므로 편집기 미리보기에도 똑같이 동작한다 (ADR-004) — 발행한 뒤에야
// 처음 만나는 UI를 만들지 않는다. 누르면 위로 작은 판이 열려 링크 복사·카카오톡 공유를 고른다.
//
// sticky + 음수 마진(-mt-11 = 버튼 높이)이라 문서 높이에 아무것도 더하지 않는다 —
// 예전 구현(공개 페이지 전용 sticky 바)은 흐름 안에서 52px를 차지해, 마지막 섹션 아래에
// 청첩장 배경이 아닌 바탕색 띠가 보였다. 판은 absolute라 열려 있어도 높이가 늘지 않는다.

const LINGER_MS = 1800; // 스크롤이 멈춘 뒤 이만큼 있다가 사라진다
const TOP_PX = 8; // 이 안쪽이면 '최상단' — iOS 고무줄 스크롤의 0 근처 떨림을 흡수한다

export function FloatingShare({ wedding }: { wedding: Wedding }) {
  const { accentColor } = useRenderer();
  const { interactive, copied, copyLink, showKakao, shareKakao, error } = useShareActions(wedding);
  const [open, setOpen] = useState(false);
  // 스크롤로 잠깐 떠오른 상태 — 서버 렌더는 숨김으로 시작한다(첫 화면을 가리지 않는다)
  const [raised, setRaised] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: number | null = null;
    const onScroll = (event: Event) => {
      const root = rootRef.current;
      if (root === null) return;
      // scroll은 버블링하지 않아 캡처로 문서 전체를 듣는다 — 발행 화면은 창 스크롤,
      // 편집기 미리보기는 미리보기 칸 스크롤이라 어느 쪽이 움직일지 모른다.
      // 이 버튼을 품지 않은 스크롤(편집기의 다른 패널)은 무시한다.
      const target = event.target;
      const scroller =
        target instanceof Element ? target : (document.scrollingElement ?? undefined);
      if (scroller === undefined) return;
      if (target instanceof Element && !target.contains(root)) return;
      if (timer !== null) window.clearTimeout(timer);
      if (scroller.scrollTop <= TOP_PX) {
        setRaised(false); // 최상단 — 메인 사진을 가리지 않는다
        return;
      }
      setRaised(true);
      timer = window.setTimeout(() => setRaised(false), LINGER_MS);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  const visible = open || raised;
  // 알약 버튼·카카오 버튼 모두 테마 강조색을 입는다 — "한 청첩장에서 버튼은 한 색"
  // (buttonColorSchema의 규칙). 글자·심볼 색은 강조색의 밝기에서 자동으로 정해진다.
  const ink = readableInk(accentColor);

  const actionClass =
    "flex h-11 w-full items-center justify-center gap-2 rounded-xl " +
    "text-[length:calc(13px*var(--canvas-fs))] font-medium disabled:opacity-60";

  return (
    <div
      data-floating-share
      ref={rootRef}
      // visibility를 opacity와 함께 전환한다 — 사라진 뒤에는 탭·포커스가 닿지 않아야 하고
      // (visibility: hidden), 전환 중에는 페이드가 보여야 한다(visibility는 끝나는 순간 바뀐다)
      className={
        "pointer-events-none sticky bottom-4 z-20 -mt-11 flex justify-center " +
        "transition-[opacity,visibility] duration-500 " +
        (visible ? "visible opacity-100" : "invisible opacity-0")
      }
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
                style={{ backgroundColor: accentColor, color: ink }}
              >
                <KakaoIcon color={ink} />
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
          className="pointer-events-auto flex h-11 items-center gap-2 rounded-full px-5 text-[length:calc(13px*var(--canvas-fs))] font-medium shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: accentColor, color: ink }}
        >
          청첩장 공유하기
        </button>
      </div>
    </div>
  );
}
