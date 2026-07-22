"use client";

import type { ShareSection as ShareSectionData, Wedding } from "@/invitation/schema/document";
import { DEFAULT_TONE_COLOR, readableInk } from "../colors";
import { BodyText } from "../primitives/BodyText";
import { KakaoIcon } from "../primitives/KakaoIcon";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";
import { useShareActions } from "../shareActions";

const buttonClass =
  "flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-5 " +
  "text-[length:calc(13.5px*var(--canvas-fs))] font-medium disabled:opacity-60";

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
  const { accentColor } = useRenderer();
  const { content, layout } = section;
  // 카카오 브랜드 노랑을 기본으로 쓰지 않는다 — 청첩장 한 장에서 혼자 튀는 색이라
  // 테마 강조색을 따르게 하고, 브랜드 색을 원하면 직접 고르게 한다 (#FEE500).
  const kakaoColor = content.kakaoButtonColor ?? accentColor;
  const kakaoInk = readableInk(kakaoColor);
  // 카카오 버튼은 키가 있을 때만 나온다 — 편집기 미리보기가 게스트 화면과 달라지면 안 된다.
  // 키가 없어서 안 보인다는 사실은 편집 폼('공유하기' 내용 탭)이 알려 준다.
  const { interactive, copied, copyLink, showKakao, shareKakao, error } = useShareActions(wedding);

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
