"use client";

import { useEffect, useRef, useState } from "react";
import { absoluteImageUrl, kakaoSharePayload } from "@/invitation/lib/kakaoShare";
import type { ShareSection as ShareSectionData, Wedding } from "@/invitation/schema/document";
import { DEFAULT_TONE_COLOR, readableInk } from "../colors";
import { shareToKakao } from "../kakaoSdk";
import { BodyText } from "../primitives/BodyText";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";

const COPIED_FEEDBACK_MS = 2000;

const buttonClass =
  "flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 " +
  "text-[length:calc(13.5px*var(--canvas-fs))] font-medium disabled:opacity-60";

// 카카오 심볼 — 말풍선. 버튼 색에서 정해진 글자색을 그대로 쓴다.
function KakaoIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0" fill={color}>
      <path d="M12 3.6c-4.7 0-8.5 2.96-8.5 6.6 0 2.33 1.56 4.38 3.9 5.55l-.86 3.2a.35.35 0 0 0 .53.38l3.83-2.53c.36.03.73.05 1.1.05 4.7 0 8.5-2.96 8.5-6.65S16.7 3.6 12 3.6z" />
    </svg>
  );
}

// 공유하기 — 맺음말 아래의 마지막 영역. 링크 복사는 어디서나 되고,
// 카카오톡 공유는 호스트가 카카오 JS 키를 넘겨준 공개 페이지에서만 나타난다.
export function ShareSection({
  section,
  wedding,
  index,
}: {
  section: ShareSectionData;
  wedding: Wedding;
  index: number;
}) {
  const { mode, kakaoJsKey, shareImageUrl, accentColor } = useRenderer();
  const interactive = mode === "published";
  const { content, layout } = section;
  // 카카오 브랜드 노랑을 기본으로 쓰지 않는다 — 청첩장 한 장에서 혼자 튀는 색이라
  // 테마 강조색을 따르게 하고, 브랜드 색을 원하면 직접 고르게 한다 (#FEE500).
  const kakaoColor = content.kakaoButtonColor ?? accentColor;
  const kakaoInk = readableInk(kakaoColor);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  const shareKakao = async () => {
    if (kakaoJsKey === null) return;
    setError(null);
    try {
      const url = window.location.href;
      const image = absoluteImageUrl(shareImageUrl, window.location.origin);
      await shareToKakao(kakaoJsKey, kakaoSharePayload(wedding, url, image));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 카카오 버튼은 키가 있을 때만 나온다 — 편집기 미리보기가 게스트 화면과 달라지면 안 된다.
  // 키가 없어서 안 보인다는 사실은 편집 폼('공유하기' 내용 탭)이 알려 준다.
  const showKakao = kakaoJsKey !== null;

  return (
    <SectionShell
      section={section}
      index={index}
      tone={layout.variant === "dark" ? (content.darkColor ?? DEFAULT_TONE_COLOR) : undefined}
    >
      <div className="flex flex-col items-center text-center">
        <SectionHeader label={content.label} title={content.title} index={index} />
        {content.body !== "" && (
          <div className="mt-6 w-full">
            <BodyText text={content.body} />
          </div>
        )}
        <div data-share-buttons className="mt-8 flex w-full gap-2.5">
          <button
            type="button"
            disabled={!interactive}
            aria-live="polite"
            onClick={() => void copyLink()}
            className={`${buttonClass} text-(--canvas-ink)`}
            style={{ border: "1px solid var(--canvas-line)" }}
          >
            {copied ? "복사되었습니다" : "링크 복사"}
          </button>
          {showKakao && (
            <button
              type="button"
              disabled={!interactive}
              onClick={() => void shareKakao()}
              className={buttonClass}
              style={{ backgroundColor: kakaoColor, color: kakaoInk }}
            >
              <KakaoIcon color={kakaoInk} />
              카카오톡 공유
            </button>
          )}
        </div>
        {error !== null && (
          <p role="alert" className="mt-3 text-[length:calc(12px*var(--canvas-fs))] text-red-600">
            {error}
          </p>
        )}
      </div>
    </SectionShell>
  );
}
