import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { absoluteImageUrl, kakaoSharePayload } from "./kakaoShare";

const wedding = createSampleDocument().wedding;
const PAGE = "https://example.com/i/abc";

describe("kakaoSharePayload", () => {
  it("사진이 있으면 큰 이미지 카드(feed)로 보낸다", () => {
    const payload = kakaoSharePayload(wedding, PAGE, "https://cdn.example.com/hero.jpg");
    if (payload.objectType !== "feed") throw new Error("feed가 아닙니다");
    expect(payload.content.title).toBe("이정훈♥양은진 결혼합니다");
    expect(payload.content.description).toContain("공군호텔");
    expect(payload.content.imageUrl).toBe("https://cdn.example.com/hero.jpg");
    expect(payload.content.link).toEqual({ mobileWebUrl: PAGE, webUrl: PAGE });
    expect(payload.buttons[0].link.webUrl).toBe(PAGE);
  });

  it("사진이 없으면 text로 보낸다 — feed는 imageUrl이 필수라 카카오가 거부한다", () => {
    const payload = kakaoSharePayload(wedding, PAGE, null);
    if (payload.objectType !== "text") throw new Error("text가 아닙니다");
    expect(payload.text).toContain("이정훈♥양은진 결혼합니다");
    expect(payload.link.mobileWebUrl).toBe(PAGE);
  });

  it("이름이 비어 있어도 카드가 깨지지 않는다", () => {
    const anonymous = { ...wedding, groom: { ...wedding.groom, name: "" } };
    const payload = kakaoSharePayload(anonymous, PAGE, null);
    if (payload.objectType !== "text") throw new Error("text가 아닙니다");
    expect(payload.text.startsWith("결혼합니다")).toBe(true);
  });
});

describe("absoluteImageUrl", () => {
  it("상대 경로는 페이지 origin 기준의 절대 URL이 된다", () => {
    expect(absoluteImageUrl("/samples/hero.svg", "https://example.com")).toBe(
      "https://example.com/samples/hero.svg",
    );
  });

  it("이미 절대 URL이면 그대로 둔다", () => {
    const url = "https://cdn.example.com/a.jpg";
    expect(absoluteImageUrl(url, "https://example.com")).toBe(url);
  });

  it("http(s)가 아니면 쓰지 않는다 — 카카오가 받지 못한다", () => {
    expect(absoluteImageUrl("blob:https://example.com/xyz", "https://example.com")).toBeNull();
    expect(absoluteImageUrl("data:image/png;base64,AAAA", "https://example.com")).toBeNull();
    expect(absoluteImageUrl(null, "https://example.com")).toBeNull();
  });
});
