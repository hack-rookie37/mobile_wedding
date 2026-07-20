import { describe, expect, it } from "vitest";
import { storedDimensions } from "./imageProcessing";
import { MAX_STORED_HEIGHT, MAX_STORED_WIDTH } from "./uploadPolicy";

// 저장 치수 결정 (ADR-030) — 캔버스가 430px이라 1600px이면 화소밀도 3배 화면도 채운다.
describe("storedDimensions", () => {
  it("한도 안이면 줄이지 않는다 — 다시 인코딩하면 화질만 깎인다", () => {
    expect(storedDimensions(1200, 1600)).toBeNull();
    expect(storedDimensions(MAX_STORED_WIDTH, MAX_STORED_HEIGHT)).toBeNull();
  });

  it("가로가 넘치면 가로에 맞춰 비율을 지킨 채 줄인다", () => {
    // 아이폰 가로 사진 4032x3024 (4:3)
    expect(storedDimensions(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it("세로가 넘치면 세로에 맞춘다 — 가로만 보면 긴 사진이 한도를 넘는다", () => {
    // 3024x4032 세로 사진: 가로 기준으로 줄여도 높이 2133이라 한도 안이다
    expect(storedDimensions(3024, 4032)).toEqual({ width: 1600, height: 2133 });
    // 세로로 아주 긴 사진은 세로가 먼저 걸린다
    const tall = storedDimensions(1000, 5000);
    expect(tall).toEqual({ width: 480, height: MAX_STORED_HEIGHT });
  });

  it("치수는 최소 1px — 극단적인 비율에서도 0이 되지 않는다", () => {
    expect(storedDimensions(20000, 1)).toEqual({ width: 1600, height: 1 });
  });
});
