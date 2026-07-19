import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { buildAiProjection } from "./projection";
import { buildMockProposal, MockAiProvider } from "./mockProvider";
import { validateAiProposal } from "./validate";

const input = (instruction: string) => ({
  instruction,
  projection: buildAiProjection(createSampleDocument(), []),
});

describe("MockAiProvider — 결정적 테스트 provider", () => {
  it("예시 요청이 hero variant·여백·갤러리 variant·테마 변경으로 변환되고 검증을 통과한다", async () => {
    const doc = createSampleDocument();
    const raw = await new MockAiProvider().propose({
      instruction: "첫 화면을 더 미니멀하게 하고 갤러리를 따뜻한 필름 느낌으로 바꿔줘.",
      projection: buildAiProjection(doc, []),
    });
    const proposal = validateAiProposal(doc, raw);
    expect(proposal.actions.map((a) => a.type)).toEqual([
      "setSectionVariant",
      "updateSectionSettings",
      "setSectionVariant",
      "setTheme",
    ]);
    expect(proposal.previewDoc.theme.id).toBe("film-diary");
  });

  it("인사말 다듬기 요청은 greeting 본문 patch를 만든다", () => {
    const raw = buildMockProposal(input("인사말을 다듬어줘")) as { actions: unknown[] };
    expect(raw.actions).toHaveLength(1);
  });

  it("해당 없는 요청은 빈 제안을 돌려준다", () => {
    const raw = buildMockProposal(input("아무 관련 없는 요청")) as {
      summary: string;
      actions: unknown[];
    };
    expect(raw.actions).toEqual([]);
    expect(raw.summary).toContain("찾지 못했습니다");
  });

  it("오류 트리거: '깨진 응답'은 malformed, '과도한 제안'은 개수 초과가 되어 검증에서 거부된다", () => {
    const doc = createSampleDocument();
    expect(() =>
      validateAiProposal(doc, buildMockProposal(input("깨진 응답을 만들어줘"))),
    ).toThrow();
    expect(() =>
      validateAiProposal(doc, buildMockProposal(input("과도한 제안을 만들어줘"))),
    ).toThrow();
  });
});
