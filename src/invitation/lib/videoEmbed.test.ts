import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "./videoEmbed";

describe("parseVideoUrl", () => {
  it("YouTube URL 형태들을 임베드 주소로 변환한다", () => {
    const expected = {
      provider: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(expected);
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual(expected);
    expect(parseVideoUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual(expected);
    expect(parseVideoUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toEqual(expected);
    expect(parseVideoUrl(" https://www.youtube.com/embed/dQw4w9WgXcQ ")).toEqual(expected);
  });

  it("Vimeo URL을 임베드 주소로 변환한다 (예측 가능한 썸네일 없음 — null)", () => {
    const expected = {
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/76979871",
      thumbnailUrl: null,
    };
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual(expected);
    expect(parseVideoUrl("https://player.vimeo.com/video/76979871")).toEqual(expected);
  });

  it("지원하지 않는 주소는 null", () => {
    expect(parseVideoUrl("")).toBeNull();
    expect(parseVideoUrl("유튜브 링크")).toBeNull();
    expect(parseVideoUrl("https://example.com/watch?v=abc123def")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/")).toBeNull();
    expect(parseVideoUrl("https://youtube.com/watch")).toBeNull();
    expect(parseVideoUrl("https://vimeo.com/about")).toBeNull();
    expect(parseVideoUrl("ftp://youtu.be/dQw4w9WgXcQ")).toBeNull();
    // 도메인 스푸핑: youtube.com이 서브스트링인 다른 호스트
    expect(parseVideoUrl("https://evil-youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
