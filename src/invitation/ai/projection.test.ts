import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { buildAiProjection, orientationOf } from "./projection";

describe("buildAiProjection — sanitized project projection (PRODUCT_SPEC §9)", () => {
  it("연락처 전화번호·계좌번호가 제외(redact)된다", () => {
    const projection = buildAiProjection(createSampleDocument(), []);
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain("010-1234-5678");
    expect(serialized).not.toContain("123456-01-234567");
    expect(serialized).toContain("<redacted>");
  });

  it("asset은 id·치수·방향만 — 파일명·해시·경로·bytes가 들어갈 자리가 없다", () => {
    const projection = buildAiProjection(createSampleDocument(), [
      { id: "a1", width: 1600, height: 1200 },
      { id: "a2", width: 800, height: 1200 },
      { id: "a3", width: 900, height: 900 },
    ]);
    expect(projection.assets).toEqual([
      { id: "a1", width: 1600, height: 1200, orientation: "landscape" },
      { id: "a2", width: 800, height: 1200, orientation: "portrait" },
      { id: "a3", width: 900, height: 900, orientation: "square" },
    ]);
    for (const asset of projection.assets) {
      expect(Object.keys(asset).sort()).toEqual(["height", "id", "orientation", "width"]);
    }
  });

  it("RSVP 응답·참석자 정보는 구조적으로 존재하지 않는다 (문서에 자리가 없다)", () => {
    const projection = buildAiProjection(createSampleDocument(), []);
    const rsvp = projection.doc.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    expect(Object.keys(rsvp.content).sort()).toEqual(["body", "collect", "deadline", "title"]);
  });

  it("원본 문서를 변경하지 않는다", () => {
    const doc = createSampleDocument();
    const snapshot = structuredClone(doc);
    buildAiProjection(doc, [{ id: "a1", width: 10, height: 10 }]);
    expect(doc).toEqual(snapshot);
  });

  it("orientationOf 경계", () => {
    expect(orientationOf({ width: 2, height: 1 })).toBe("landscape");
    expect(orientationOf({ width: 1, height: 2 })).toBe("portrait");
    expect(orientationOf({ width: 5, height: 5 })).toBe("square");
  });
});
