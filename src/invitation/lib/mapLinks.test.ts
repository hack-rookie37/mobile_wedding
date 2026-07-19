import { describe, expect, it } from "vitest";
import { mapSearchLinks, venueMapQuery } from "./mapLinks";

describe("mapSearchLinks", () => {
  it("네이버·카카오·티맵 3개 링크를 검색어 인코딩과 함께 만든다", () => {
    const links = mapSearchLinks("서울특별시 강남구 테헤란로 132");
    const encoded = encodeURIComponent("서울특별시 강남구 테헤란로 132");
    expect(links.map((l) => l.id)).toEqual(["naver", "kakao", "tmap"]);
    expect(links[0].href).toBe(`https://map.naver.com/p/search/${encoded}`);
    expect(links[1].href).toBe(`https://map.kakao.com/link/search/${encoded}`);
    expect(links[2].href).toBe(`tmap://search?name=${encoded}`);
  });
});

describe("venueMapQuery", () => {
  it("예식장 이름이 있으면 이름으로, 없으면 주소로 검색한다", () => {
    expect(venueMapQuery({ name: "라온컨벤션", address: "테헤란로 132" })).toBe("라온컨벤션");
    expect(venueMapQuery({ name: "", address: "테헤란로 132" })).toBe("테헤란로 132");
  });
});
