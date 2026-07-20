import type { KakaoSharePayload } from "@/invitation/lib/kakaoShare";

// 카카오 JS SDK는 클릭할 때 처음 불러온다 — 공유를 안 쓰는 게스트에게 85KB를 지우지 않는다.
// 버전을 고정하고 SRI 해시를 박아 둔다: CDN이 바뀐 파일을 주면 브라우저가 실행을 거부한다.
const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js";
const SDK_INTEGRITY = "sha384-dok87au0gKqJdxs7msEdBPNnKSRT+/mhTVzq+qOhcL464zXwvcrpjeWvyj1kCdq6";

interface KakaoGlobal {
  init(key: string): void;
  isInitialized(): boolean;
  Share: { sendDefault(payload: KakaoSharePayload): void };
}

function kakaoOf(): KakaoGlobal | undefined {
  return (window as unknown as { Kakao?: KakaoGlobal }).Kakao;
}

let loading: Promise<KakaoGlobal> | null = null;

function loadSdk(): Promise<KakaoGlobal> {
  const existing = kakaoOf();
  if (existing !== undefined) return Promise.resolve(existing);
  if (loading !== null) return loading;

  loading = new Promise<KakaoGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = () => {
      const kakao = kakaoOf();
      if (kakao === undefined) {
        reject(new Error("카카오 SDK를 불러왔지만 초기화할 수 없습니다"));
        return;
      }
      resolve(kakao);
    };
    script.onerror = () => {
      loading = null; // 다음 클릭에서 다시 시도할 수 있게 한다
      reject(new Error("카카오 SDK를 불러오지 못했습니다"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export async function shareToKakao(jsKey: string, payload: KakaoSharePayload): Promise<void> {
  const kakao = await loadSdk();
  if (!kakao.isInitialized()) kakao.init(jsKey);
  kakao.Share.sendDefault(payload);
}
