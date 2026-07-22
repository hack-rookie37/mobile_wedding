"use client";

import { useEffect, useRef, useState } from "react";
import { useRenderer } from "./RendererContext";

// 자동재생이 막혔을 때 다시 시도할 계기 — 게스트의 첫 동작이면 무엇이든 좋다.
const FIRST_GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll", "wheel"] as const;

// 배경음악 토글 — 캔버스 우상단 플로팅 버튼.
// 자동재생은 "켜기를 시도한다"는 뜻이지 보장이 아니다: 브라우저는 소리 있는 자동재생을
// 대부분 막으므로, 막히면 게스트의 첫 동작(스크롤·터치)까지 기다렸다가 한 번 더 시도한다.
export function MusicToggle({
  url,
  volume,
  speed,
  autoplay,
}: {
  url: string;
  volume: number;
  speed: number;
  autoplay: boolean;
}) {
  const { mode } = useRenderer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // 편집 중에 음악이 저절로 울리면 방해가 된다 — 게스트가 보는 화면에서만 스스로 켠다
  // (편집기의 '미리보기'도 게스트 화면이므로 여기 포함된다).
  const autoStart = autoplay && mode === "published";

  // 볼륨·속도는 렌더 결과가 아니라 audio 엘리먼트의 상태다 — 값이 바뀔 때마다 직접 얹는다.
  // 세제곱: audio.volume은 선형 진폭인데 사람 귀는 로그라, 선형으로는 70%와 100%가
  // 거의 같게 들린다(-3dB). 세제곱이면 70%≈-9dB·50%≈-18dB·30%는 희미 — 슬라이더 눈금마다
  // 차이가 실제로 들린다 (ADR-047). 문서에는 슬라이더 값(0~1)이 그대로 저장된다.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume ** 3;
    audio.playbackRate = speed;
  }, [volume, speed]);

  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    let removeListeners: (() => void) | null = null;

    const start = async () => {
      try {
        await audio.play();
        if (!cancelled) setPlaying(true);
        return true;
      } catch {
        return false; // 자동재생 차단·로드 실패 — 꺼진 상태를 유지한다
      }
    };

    void start().then((started) => {
      if (started || cancelled) return;
      const retry = () => {
        removeListeners?.();
        void start();
      };
      removeListeners = () => {
        for (const event of FIRST_GESTURE_EVENTS) window.removeEventListener(event, retry);
        removeListeners = null;
      };
      for (const event of FIRST_GESTURE_EVENTS) {
        window.addEventListener(event, retry, { once: true, passive: true });
      }
    });

    return () => {
      cancelled = true;
      removeListeners?.();
    };
  }, [autoStart]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false)); // 재생 거부(정책·로드 실패) — 꺼진 상태 유지
  };

  return (
    <div className="pointer-events-none sticky top-3 z-20 -mb-11 flex justify-end px-3">
      <button
        type="button"
        data-music-toggle
        aria-label={playing ? "음악 끄기" : "음악 켜기"}
        aria-pressed={playing}
        onClick={toggle}
        className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-black/40 text-[length:calc(13px*var(--canvas-fs))] text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] backdrop-blur transition-colors hover:bg-black/55"
      >
        {playing ? (
          // 재생 중 — 음표
          <span aria-hidden>♪</span>
        ) : (
          // 꺼짐 — 빗금 친 음표
          <span aria-hidden className="relative">
            ♪
            <span className="absolute inset-x-[-2px] top-1/2 h-px -rotate-45 bg-white" />
          </span>
        )}
      </button>
      {/* 자동 시작을 시도할 때만 미리 받아 둔다 — 그 외에는 누를 때까지 내려받지 않는다 */}
      <audio ref={audioRef} src={url} loop preload={autoStart ? "auto" : "none"} />
    </div>
  );
}
