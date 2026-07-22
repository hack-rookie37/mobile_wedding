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

  // iOS Safari는 audio.volume 대입을 무시한다(음량은 하드웨어 버튼 전용) — PC에서는 되던
  // 음량 조절이 아이폰에서만 안 먹던 이유다. 소리 경로를 WebAudio GainNode로 돌리면
  // iOS에서도 gain이 적용된다 (ADR-050). 그래프는 첫 재생 시도 때 한 번만 만든다 —
  // 게스트 대부분은 음악을 안 켜므로 그 전에는 AudioContext를 만들지 않는다.
  // MediaElementSource는 교차 출처 오디오면 무음이 되지만, 여기의 소스는 전부
  // 같은 출처다: 게스트는 /a/ 프록시(ADR-040), 편집기·미리보기는 blob URL.
  const graphRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const volumeRef = useRef(volume);

  // 음량 적용 지점은 하나 — 그래프가 있으면 gain, 없으면(생성 전·WebAudio 미지원)
  // element volume. 두 군데에 다 걸면 세제곱이 두 번 먹는다(volume⁶).
  // 세제곱: 진폭은 선형인데 사람 귀는 로그라, 선형으로는 70%와 100%가 거의 같게
  // 들린다(-3dB). 세제곱이면 70%≈-9dB·50%≈-18dB — 슬라이더 눈금마다 차이가 들린다
  // (ADR-047). 문서에는 슬라이더 값(0~1)이 그대로 저장된다.
  const applyVolume = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const gainValue = volumeRef.current ** 3;
    const graph = graphRef.current;
    if (graph !== null) {
      audio.volume = 1;
      graph.gain.gain.value = gainValue;
    } else {
      audio.volume = gainValue;
    }
    // 실제 적용된 감쇠값 — gain은 DOM 밖이라 여기 남겨야 확인(디버깅·e2e)이 가능하다
    audio.dataset.appliedVolume = String(gainValue);
  };

  const ensureGraph = () => {
    const audio = audioRef.current;
    if (audio === null || graphRef.current !== null) return;
    const Ctx =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx === undefined) return; // WebAudio 미지원 — element volume으로 동작한다
    const ctx = new Ctx();
    const gain = ctx.createGain();
    ctx.createMediaElementSource(audio).connect(gain);
    gain.connect(ctx.destination);
    graphRef.current = { ctx, gain };
    applyVolume();
  };

  // 컨텍스트는 사용자 동작 없이는 suspended로 태어날 수 있다 — 재생 경로마다 열어 준다.
  // 기다리지 않는다: 막힌 resume은 거부가 아니라 영영 pending일 수 있어서(크롬),
  // 성공 여부는 start()가 state를 직접 본다. 거부(사파리)는 삼킨다 — 다음 동작에서 다시 연다.
  const resumeGraph = () => {
    const graph = graphRef.current;
    if (graph !== null && graph.ctx.state !== "running") graph.ctx.resume().catch(() => {});
  };

  // 볼륨·속도는 렌더 결과가 아니라 오디오 그래프의 상태다 — 값이 바뀔 때마다 직접 얹는다.
  useEffect(() => {
    volumeRef.current = volume;
    applyVolume();
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [volume, speed]);

  // 언마운트 시 컨텍스트를 닫는다 — 오디오 하드웨어 점유를 남기지 않는다
  useEffect(
    () => () => {
      void graphRef.current?.ctx.close();
    },
    [],
  );

  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    let removeListeners: (() => void) | null = null;

    const start = async () => {
      ensureGraph();
      resumeGraph();
      try {
        await audio.play();
        if (!cancelled) setPlaying(true);
      } catch {
        return false; // 자동재생 차단·로드 실패 — 꺼진 상태를 유지한다
      }
      // 재생은 허용됐는데 컨텍스트가 잠긴 채면(정책이 media와 WebAudio를 달리 볼 때)
      // 소리 없이 도는 상태다 — 실패로 치고 첫 동작에서 다시 연다
      const graph = graphRef.current;
      return graph === null || graph.ctx.state === "running";
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
    ensureGraph();
    resumeGraph(); // 클릭 = 사용자 동작 — 여기서의 resume은 항상 허용된다
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
