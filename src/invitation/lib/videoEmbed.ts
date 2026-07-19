// MVP 동영상은 YouTube·Vimeo 외부 URL만 지원한다 — 직접 업로드·트랜스코딩 없음 (ADR-017).
// 문서에는 사용자가 붙여넣은 원본 URL을 저장하고, 임베드 주소는 렌더 시점에 파생한다.

export interface VideoEmbed {
  provider: "youtube" | "vimeo";
  embedUrl: string;
  // facade(탭하여 재생)용 썸네일 — Vimeo는 인증 없는 예측 가능한 썸네일 URL이 없어 null
  thumbnailUrl: string | null;
}

const YOUTUBE_ID = /^[\w-]{6,20}$/;
const VIMEO_PATH = /^\/(?:video\/)?(\d{6,12})(?:$|\/)/;

export function parseVideoUrl(raw: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : (url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1] ?? null);
    return id !== null && YOUTUBE_ID.test(id) ? youtubeEmbed(id) : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return YOUTUBE_ID.test(id) ? youtubeEmbed(id) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(VIMEO_PATH)?.[1];
    return id !== undefined
      ? {
          provider: "vimeo",
          embedUrl: `https://player.vimeo.com/video/${id}`,
          thumbnailUrl: null,
        }
      : null;
  }
  return null;
}

function youtubeEmbed(id: string): VideoEmbed {
  return {
    provider: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}
