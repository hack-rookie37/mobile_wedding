import { describe, expect, it } from "vitest";
import { documentSchema } from "../schema/document";
import { createCaseDocument, FIXTURE_CASES } from "./cases";

describe("엣지 케이스 fixture", () => {
  it.each(FIXTURE_CASES)("%s 케이스 문서가 스키마를 통과한다", (kind) => {
    const doc = createCaseDocument(kind);
    expect(documentSchema.safeParse(doc).success).toBe(true);
  });

  it("ten-photos는 10장, one-photo는 1장이다", () => {
    const ten = createCaseDocument("ten-photos").sections.find((s) => s.type === "gallery");
    const one = createCaseDocument("one-photo").sections.find((s) => s.type === "gallery");
    expect(ten?.type === "gallery" && ten.content.photos).toHaveLength(10);
    expect(one?.type === "gallery" && one.content.photos).toHaveLength(1);
  });

  it("hidden-section은 greeting을 숨긴다", () => {
    const doc = createCaseDocument("hidden-section");
    const greeting = doc.sections.find((s) => s.type === "greeting");
    expect(greeting?.visible).toBe(false);
  });
});
