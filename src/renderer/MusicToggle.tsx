"use client";

import { useEffect, useRef, useState } from "react";
import { useRenderer } from "./RendererContext";

// 자동재생이 막혔을 때 다시 시도할 계기가 되는 게스트의 동작들.
// touchend·click·pointerup·keydown이 핵심이다 — 브라우저가 '사용자 동작'으로 인정해
// 재생 허가를 주는 이벤트는 누름이 아니라 '뗌' 계열이다(iOS는 특히 touchend).
// scroll·wheel·pointerdown은 허가를 못 받을 수 있지만 데스크톱 일부에서는 통해서 남겨 둔다.
const FIRST_GESTURE_EVENTS = [
  "touchend",
  "click",
  "pointerup",
  "keydown",
  "pointerdown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

// AudioSession API — Safari 전용(16.4+), 실험 단계라 lib.dom에 아직 없다.
type SessionNavigator = Navigator & { audioSession?: { type: string } };

// 배경음악 토글 — 캔버스 우상단 플로팅 버튼.
// 자동재생은 "켜기를 시도한다"는 뜻이지 보장이 아니다: 브라우저는 소리 있는 자동재생을
// 대부분 막으므로, 막히면 게스트의 다음 동작에서 다시 시도한다(성공할 때까지 재장전).
//
// 음량은 두 경로다 (ADR-061):
//  * 기본: <audio>.volume — PC·안드로이드가 따른다.
//  * Safari(audioSession 존재): iOS는 element volume 대입을 무시하므로 WebAudio GainNode로
//    소프트웨어 감쇠를 얹는다. WebAudio는 원래 무음 스위치(진동 모드)에 묶여 소리째
//    사라졌지만(ADR-050 폐기 사유), navigator.audioSession.type = "playback"이 이 결합을
//    끊는다 — <audio>가 원래 속하던 '미디어 재생' 범주를 WebAudio에도 여는 공식 API다.
//    감쇠는 하객의 기기 음량에 곱해진다: 기기가 50%든 이어폰이든, 그 대비 크기가 된다.
// 그래프 생성이 실패하면 조용히 element 경로로 남는다 — BGM은 예식일에 반드시 나와야
// 하는 기능이라 재생 신뢰성이 음량 조절보다 먼저다 (ADR-051의 우선순위 유지).
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  // WebAudio 감쇠 그래프 — createMediaElementSource는 되돌릴 수 없으므로(엘리먼트 출력이
  // 영구히 그래프를 지난다) '실행 중' 컨텍스트를 확보한 뒤에만 만든다. suspended 그래프에
  // 물리면 play()가 성공해도 무음이다 — ADR-050이 겪은 사고 계열.
  const graphRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  // start()는 마운트 시점 클로저에서 불린다 — 편집기에서 음량을 고친 뒤 재생해도
  // 최신 값이 적용되도록 ref로 읽는다.
  const volumeRef = useRef(volume);

  // 편집 중에 음악이 저절로 울리면 방해가 된다 — 게스트가 보는 화면에서만 스스로 켠다
  // (편집기의 '미리보기'도 게스트 화면이므로 여기 포함된다).
  const autoStart = autoplay && mode === "published";

  // 세제곱: 선형 진폭은 귀에 로그라 70%와 100%가 거의 같게 들린다(-3dB). 세제곱이면
  // 70%≈-9dB·50%≈-18dB — 눈금마다 차이가 실제로 들린다 (ADR-047). 문서에는 슬라이더
  // 값(0~1)이 그대로 저장된다. 그래프가 있으면 감쇠는 gain이 맡고 element는 1로 둔다 —
  // 두 군데 다 얹으면 세제곱이 두 번(volume⁶) 걸린다.
  const applyVolume = (audio: HTMLAudioElement) => {
    const graph = graphRef.current;
    if (graph !== null) {
      graph.gain.gain.value = volumeRef.current ** 3;
      audio.volume = 1;
    } else {
      audio.volume = volumeRef.current ** 3;
    }
  };

  // Safari에서 GainNode 경로를 준비한다 — 재생 직전마다 부른다(첫 호출은 그래프 생성,
  // 이후는 resume). 제스처 밖(자동재생)에서는 컨텍스트가 열리지 않을 수 있는데, 그때는
  // 그래프를 만들지 않고 물러난다 — iOS에서 첫 재생은 어차피 제스처 안에서 성사되므로
  // 실제로 소리가 나는 첫 순간에는 감쇠가 걸려 있다.
  const ensureGain = async (audio: HTMLAudioElement) => {
    const nav = navigator as SessionNavigator;
    if (nav.audioSession === undefined) return; // 미지원 — element volume 경로
    try {
      nav.audioSession.type = "playback"; // WebAudio를 무음 스위치에서 분리 (미디어 재생 범주)
      const existing = graphRef.current;
      if (existing !== null) {
        await existing.ctx.resume(); // 중단(전화·백그라운드) 후 복귀
        return;
      }
      const ctx = new AudioContext();
      await ctx.resume();
      if ((ctx.state as string) !== "running") {
        void ctx.close(); // 제스처 밖 — 엘리먼트를 그래프에 물리지 않고 다음 기회를 기다린다
        return;
      }
      const gain = ctx.createGain();
      ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
      graphRef.current = { ctx, gain };
    } catch {
      // 그래프 실패 — 소리가 우선이다. element 직접 재생으로 남는다(음량만 못 잡는다).
    }
  };

  // 볼륨·속도는 렌더 결과가 아니라 audio·gain의 상태다 — 값이 바뀔 때마다 직접 얹는다.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    volumeRef.current = volume;
    applyVolume(audio);
    audio.playbackRate = speed;
  }, [volume, speed]);

  // 전화·Siri 등으로 중단된 컨텍스트는 화면 복귀 때 다시 연다 — suspended 그래프에
  // 물린 엘리먼트는 재생 중이어도 무음이 되기 때문이다.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void graphRef.current?.ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      const graph = graphRef.current;
      graphRef.current = null;
      if (graph !== null) void graph.ctx.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;
    let removeListeners: (() => void) | null = null;

    const start = async () => {
      try {
        // 재생 직전마다 gain 경로를 준비한다 — 제스처 재시도(touchend 등)에서 불리면
        // 그 제스처 덕에 컨텍스트가 열려, 소리가 나는 첫 순간부터 감쇠가 걸린다.
        await ensureGain(audio);
        applyVolume(audio);
        await audio.play();
        // play()는 비동기라, 대기 중에 정리(cancelled)됐을 수 있다 — 그 경우 되돌린다.
        // cancelled가 setPlaying만 막고 재생을 안 막으면 버튼은 '켜기'인데 소리만 나는
        // 불일치가 생긴다(에디터 미리보기에서 재생 대기 중 자동재생을 끌 때). 언마운트는
        // 브라우저가 DOM 제거 시 알아서 멈추지만, 마운트 유지 상태 전환은 여기서 막는다.
        if (cancelled) {
          audio.pause();
          return true;
        }
        setPlaying(true);
        return true;
      } catch {
        return false; // 자동재생 차단·로드 실패 — 꺼진 상태를 유지한다
      }
    };

    // 실패하면 다음 동작을 다시 기다린다(재장전) — 스크롤처럼 허가를 못 받는 동작에서
    // 한 번 실패했다고 끝내면, 정작 허가가 되는 탭(touchend)이 와도 켤 수 없다.
    const arm = () => {
      const retry = (event: Event) => {
        // 음악 버튼을 누른 제스처면 retry는 물러난다 — 버튼 onClick(toggle)이 직접 재생을
        // 처리하므로, 여기서 또 start()하면 retry가 켠 뒤 곧이어 오는 click이 toggle→pause로
        // 꺼 버리는 경쟁이 생긴다. 물러날 때도 리스너는 정리한다: 사용자가 버튼으로 직접
        // 제어를 잡았으니 자동 재시도는 끝내야 한다(안 그러면 일시정지 후 스크롤이 재시작한다).
        const target = event.target;
        if (target instanceof Node && buttonRef.current?.contains(target)) {
          removeListeners?.();
          return;
        }
        removeListeners?.();
        void start().then((started) => {
          if (!started && !cancelled) arm();
        });
      };
      // once:true를 쓰지 않는다 — 버튼 제스처로 물러날 때는 start()를 안 하므로, 자동 제거에
      // 맡기면 나머지 리스너가 남는다. removeListeners로 항상 8종을 함께 건다·뗀다.
      removeListeners = () => {
        for (const event of FIRST_GESTURE_EVENTS) window.removeEventListener(event, retry);
        removeListeners = null;
      };
      for (const event of FIRST_GESTURE_EVENTS) {
        window.addEventListener(event, retry, { passive: true });
      }
    };

    void start().then((started) => {
      if (!started && !cancelled) arm();
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
    void (async () => {
      await ensureGain(audio); // 버튼 탭 = 제스처 — 컨텍스트가 여기서 열린다
      applyVolume(audio);
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false)); // 재생 거부(정책·로드 실패) — 꺼진 상태 유지
    })();
  };

  return (
    <div className="pointer-events-none sticky top-3 z-20 -mb-11 flex justify-end px-3">
      {/* backdrop-blur를 쓰지 않는다 — iOS는 backdrop-filter를 매 프레임 다시 계산해,
          버튼이 작아도 아래에서 꽃잎·쓰기 효과가 움직이는 내내 GPU를 잡아먹는다 (ADR-052).
          대신 배경을 조금 더 진하게 깔아 사진 위에서의 가독을 유지한다. */}
      <button
        ref={buttonRef}
        type="button"
        data-music-toggle
        aria-label={playing ? "음악 끄기" : "음악 켜기"}
        aria-pressed={playing}
        onClick={toggle}
        className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-black/45 text-[length:calc(13px*var(--canvas-fs))] text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-colors hover:bg-black/60"
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
