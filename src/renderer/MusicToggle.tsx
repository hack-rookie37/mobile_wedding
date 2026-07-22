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

// 배경음악 토글 — 캔버스 우상단 플로팅 버튼.
// 자동재생은 "켜기를 시도한다"는 뜻이지 보장이 아니다: 브라우저는 소리 있는 자동재생을
// 대부분 막으므로, 막히면 게스트의 다음 동작에서 다시 시도한다(성공할 때까지 재장전).
//
// 소리는 <audio> 엘리먼트가 직접 낸다 — WebAudio(GainNode) 우회는 쓰지 않는다 (ADR-051).
// iOS에서 WebAudio 출력은 무음 스위치(진동 모드)에 묶여, 스위치가 켜진 폰에서는 소리
// 자체가 사라졌다. <audio> 직접 재생은 무음 모드에서도 들린다 — BGM은 예식일에 반드시
// 나와야 하는 기능이라 재생 신뢰성이 iOS 음량 조절보다 먼저다.
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

  // 편집 중에 음악이 저절로 울리면 방해가 된다 — 게스트가 보는 화면에서만 스스로 켠다
  // (편집기의 '미리보기'도 게스트 화면이므로 여기 포함된다).
  const autoStart = autoplay && mode === "published";

  // 볼륨·속도는 렌더 결과가 아니라 audio 엘리먼트의 상태다 — 값이 바뀔 때마다 직접 얹는다.
  // 세제곱: audio.volume은 선형 진폭인데 사람 귀는 로그라, 선형으로는 70%와 100%가
  // 거의 같게 들린다(-3dB). 세제곱이면 70%≈-9dB·50%≈-18dB — 슬라이더 눈금마다 차이가
  // 실제로 들린다 (ADR-047). 문서에는 슬라이더 값(0~1)이 그대로 저장된다.
  // 단, iOS는 volume 지정을 무시한다(음량은 기기 버튼 전용 — 플랫폼 정책, ADR-051).
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
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false)); // 재생 거부(정책·로드 실패) — 꺼진 상태 유지
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
