"use client";

import { useRef, useState } from "react";

// 배경음악 토글 — 캔버스 우상단 플로팅 버튼.
// 자동재생하지 않는다: 모바일 브라우저는 소리 있는 자동재생을 차단하므로
// 환경에 따라 재생 여부가 갈리는 대신, 게스트가 눌러서 켜는 한 가지 동작만 둔다.
export function MusicToggle({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

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
      <audio ref={audioRef} src={url} loop preload="none" />
    </div>
  );
}
