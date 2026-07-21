import { beforeAll, describe, expect, it } from "vitest";
import { ASSET_PATH_RE, proxyManifest, toProxiedUrl } from "./assetProxy";

// env가 없으면 supabaseUrl()이 던진다 — 접두사만 필요하므로 데모 값을 심는다
beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
});

const PUB = "https://demo.supabase.co/storage/v1/object/public/photos/";
const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("toProxiedUrl", () => {
  it("Supabase 공개 URL은 /a/ 프록시 경로로 바뀐다", () => {
    expect(toProxiedUrl(`${PUB}projects/${UUID}/abc.jpg`)).toBe(`/a/projects/${UUID}/abc.jpg`);
  });

  it("우리 URL이 아니면 그대로 둔다 (빌트인 샘플·data URI)", () => {
    expect(toProxiedUrl("/builtin/hero.jpg")).toBe("/builtin/hero.jpg");
    expect(toProxiedUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});

describe("proxyManifest", () => {
  it("url·thumbUrl 둘 다 프록시로 바꾸되, null 썸네일은 null로 유지한다", () => {
    const out = proxyManifest([
      {
        id: "a",
        kind: "image",
        url: `${PUB}projects/${UUID}/1.jpg`,
        thumbUrl: `${PUB}projects/${UUID}/1.thumb.jpg`,
        width: 800,
        height: 600,
      },
      {
        id: "b",
        kind: "audio",
        url: `${PUB}projects/${UUID}/song.mp3`,
        thumbUrl: null,
        width: null,
        height: null,
      },
    ]);
    expect(out[0].url).toBe(`/a/projects/${UUID}/1.jpg`);
    expect(out[0].thumbUrl).toBe(`/a/projects/${UUID}/1.thumb.jpg`);
    expect(out[1].url).toBe(`/a/projects/${UUID}/song.mp3`);
    expect(out[1].thumbUrl).toBeNull();
  });
});

describe("ASSET_PATH_RE (임의 경로 중계 차단)", () => {
  it("규약 경로만 통과한다", () => {
    expect(ASSET_PATH_RE.test(`projects/${UUID}/abc123.jpg`)).toBe(true);
    expect(ASSET_PATH_RE.test(`projects/${UUID}/abc.thumb.jpg`)).toBe(true);
  });

  it("상위 경로 탈출·다른 버킷·빈 세그먼트는 막는다", () => {
    expect(ASSET_PATH_RE.test(`projects/${UUID}/../secret`)).toBe(false); // 슬래시 포함 → 거부
    expect(ASSET_PATH_RE.test(`other/${UUID}/x.jpg`)).toBe(false);
    expect(ASSET_PATH_RE.test(`projects//x.jpg`)).toBe(false);
    expect(ASSET_PATH_RE.test("")).toBe(false);
  });
});
