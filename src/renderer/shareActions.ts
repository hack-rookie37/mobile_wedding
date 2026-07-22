"use client";

import { useEffect, useRef, useState } from "react";
import { absoluteImageUrl, kakaoSharePayload } from "@/invitation/lib/kakaoShare";
import type { Wedding } from "@/invitation/schema/document";
import { shareToKakao } from "./kakaoSdk";
import { useRenderer } from "./RendererContext";

const COPIED_FEEDBACK_MS = 2000;

// 링크 복사·카카오톡 공유 동작 — 공유하기 섹션과 떠 있는 공유 버튼이 같은 규칙을 쓴다.
// 카카오 버튼은 호스트가 JS 키를 넘겨줄 때만 나타나고(showKakao), 실제 동작은
// 발행된 게스트 화면에서만 산다(interactive) — 편집기 미리보기는 모양만 같다.
export function useShareActions(wedding: Wedding) {
  const { mode, kakaoJsKey, shareImageUrl } = useRenderer();
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

  return {
    interactive: mode === "published",
    copied,
    copyLink,
    showKakao: kakaoJsKey !== null,
    shareKakao,
    error,
  };
}
