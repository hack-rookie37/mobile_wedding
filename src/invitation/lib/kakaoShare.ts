import type { Wedding } from "../schema/document";
import { coupleNames, formatWeddingDate } from "./format";

// 카카오톡 공유 카드에 담을 내용 — 순수 함수라 SDK 없이도 검증할 수 있다.
// 사진이 있으면 feed(큰 이미지 카드), 없으면 text로 보낸다.
// feed는 imageUrl이 필수라서, 사진이 없을 때 feed를 쓰면 카카오가 요청을 거부한다.

export interface KakaoLink {
  mobileWebUrl: string;
  webUrl: string;
}

export type KakaoSharePayload =
  | {
      objectType: "feed";
      content: {
        title: string;
        description: string;
        imageUrl: string;
        link: KakaoLink;
      };
      buttons: { title: string; link: KakaoLink }[];
    }
  | { objectType: "text"; text: string; link: KakaoLink };

export function kakaoShareTitle(wedding: Wedding): string {
  const couple = coupleNames(wedding);
  return couple !== null ? `${couple} 결혼합니다` : "결혼합니다";
}

export function kakaoShareDescription(wedding: Wedding): string {
  const { venue } = wedding;
  const place = [venue.name, venue.hall].filter((v) => v !== undefined && v !== "").join(" ");
  return [formatWeddingDate(wedding.datetime), place].filter((v) => v !== "").join("\n");
}

export function kakaoSharePayload(
  wedding: Wedding,
  pageUrl: string,
  imageUrl: string | null,
): KakaoSharePayload {
  const link: KakaoLink = { mobileWebUrl: pageUrl, webUrl: pageUrl };
  const title = kakaoShareTitle(wedding);
  const description = kakaoShareDescription(wedding);

  if (imageUrl === null) {
    return { objectType: "text", text: `${title}\n${description}`, link };
  }
  return {
    objectType: "feed",
    content: { title, description, imageUrl, link },
    buttons: [{ title: "청첩장 보기", link }],
  };
}

// 카카오는 절대 URL만 받는다 — 상대 경로(로컬 샘플 등)는 공유 카드에 쓸 수 없다
export function absoluteImageUrl(url: string | null, origin: string): string | null {
  if (url === null || url === "") return null;
  try {
    const resolved = new URL(url, origin);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
  } catch {
    return null;
  }
}

// 카카오 JS 앱 키 — NEXT_PUBLIC_이라 빌드 시점에 번들로 박힌다(공개 값이며 실제 방어선은
// 카카오 콘솔의 도메인 등록이다). 화면마다 흩어 읽으면 한 곳만 빠뜨리기 쉬워 여기서만 읽는다.
export function kakaoJsKeyFromEnv(): string | null {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  return key === undefined || key === "" ? null : key;
}
