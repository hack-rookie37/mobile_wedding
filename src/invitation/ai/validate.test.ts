import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import type { InvitationDocument } from "../schema/document";
import { AiProposalError, validateAiProposal } from "./validate";
import { MAX_AI_ACTIONS } from "./schema";

function sectionOf(doc: InvitationDocument, type: string) {
  const section = doc.sections.find((s) => s.type === type);
  if (!section) throw new Error(`${type} 섹션이 없습니다`);
  return section;
}

function proposal(doc: InvitationDocument, actions: unknown[]): unknown {
  return { summary: "테스트 제안", actions };
}

describe("validateAiProposal — 유효한 제안", () => {
  it("허용된 action들이 통과하고 미리보기 문서를 얻는다 (원본 불변)", () => {
    const doc = createSampleDocument();
    const snapshot = structuredClone(doc);
    const hero = sectionOf(doc, "hero");
    const gallery = sectionOf(doc, "gallery");

    const result = validateAiProposal(
      doc,
      proposal(doc, [
        { type: "setSectionVariant", sectionId: hero.id, variant: "textOnly" },
        { type: "updateSectionSettings", sectionId: hero.id, patch: { paddingY: "lg" } },
        { type: "setSectionVariant", sectionId: gallery.id, variant: "filmstrip" },
        { type: "setTheme", themeId: "film-diary" },
        { type: "moveGalleryPhoto", sectionId: gallery.id, from: 0, to: 2 }, // arrangeGallery
        {
          type: "updateGalleryPhoto", // setImageFocalPoint
          sectionId: gallery.id,
          index: 0,
          patch: { frame: { zoom: 1.4, focalX: 0.5, focalY: 0.3 } },
        },
      ]),
    );

    expect(result.actions).toHaveLength(6);
    // preview: 전체 적용 결과가 미리 계산된다
    const previewHero = result.previewDoc.sections[0];
    if (previewHero.type !== "hero") throw new Error("hero가 없습니다");
    expect(previewHero.layout.variant).toBe("textOnly");
    expect(result.previewDoc.theme.id).toBe("film-diary");
    // 원본은 변하지 않았다
    expect(doc).toEqual(snapshot);
  });

  it("addSection에 명시한 sectionId로 이어지는 편집을 검증할 수 있다", () => {
    const doc = createSampleDocument();
    const result = validateAiProposal(
      doc,
      proposal(doc, [
        {
          type: "addSection",
          sectionType: "greeting",
          index: doc.sections.length,
          sectionId: "ai-new-1",
        },
        { type: "updateSectionContent", sectionId: "ai-new-1", patch: { title: "새 인사말" } },
      ]),
    );
    expect(result.previewDoc.sections.at(-1)?.id).toBe("ai-new-1");
  });
});

describe("validateAiProposal — 거부 경로", () => {
  it("알 수 없는 action 타입을 거부한다", () => {
    const doc = createSampleDocument();
    expect(() =>
      validateAiProposal(doc, proposal(doc, [{ type: "dropDatabase", table: "projects" }])),
    ).toThrow(AiProposalError);
  });

  it("allowlist 밖의 기존 action(updateWedding·updateListItem·batch)도 거부한다", () => {
    const doc = createSampleDocument();
    const contacts = sectionOf(doc, "contacts");
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          { type: "updateWedding", patch: { datetime: "2027-01-01T12:00:00+09:00" } },
        ]),
      ),
    ).toThrow(AiProposalError);
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          {
            type: "updateListItem",
            sectionId: contacts.id,
            field: "entries",
            index: 0,
            patch: { phone: "010-0000-0000" },
          },
        ]),
      ),
    ).toThrow(AiProposalError);
    expect(() => validateAiProposal(doc, proposal(doc, [{ type: "batch", actions: [] }]))).toThrow(
      AiProposalError,
    );
  });

  it("content 스키마에 없는 임의 경로(patch 키)를 거부한다 — 조용히 버리지 않는다", () => {
    const doc = createSampleDocument();
    const greeting = sectionOf(doc, "greeting");
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          { type: "updateSectionContent", sectionId: greeting.id, patch: { ownerId: "attacker" } },
        ]),
      ),
    ).toThrow(/없는 필드/);
    // __proto__는 JS 의미상 own key가 되지 못해 파이프라인 전체에서 무해화된다
    // (zod record 재구성·스프레드 병합 모두 own enumerable key만 다룬다) — 전역 오염 없음
    const evil = JSON.parse(
      `{"type":"updateSectionContent","sectionId":"${greeting.id}","patch":{"__proto__":{"polluted":true}}}`,
    ) as unknown;
    validateAiProposal(doc, proposal(doc, [evil]));
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("raw HTML이 든 콘텐츠를 거부한다", () => {
    const doc = createSampleDocument();
    const greeting = sectionOf(doc, "greeting");
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          {
            type: "updateSectionContent",
            sectionId: greeting.id,
            patch: { body: '<script>alert("x")</script>' },
          },
        ]),
      ),
    ).toThrow(/HTML/);
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          { type: "updateSectionContent", sectionId: greeting.id, patch: { title: "<b>강조</b>" } },
        ]),
      ),
    ).toThrow(/HTML/);
    // 일반 텍스트의 부등호는 허용된다
    const ok = validateAiProposal(
      doc,
      proposal(doc, [
        {
          type: "updateSectionContent",
          sectionId: greeting.id,
          patch: { body: "사랑 <3 그리고 1 < 2" },
        },
      ]),
    );
    expect(ok.actions).toHaveLength(1);
  });

  it("raw CSS(형식 밖 background 값)를 거부한다 — 스키마가 hex 색만 허용", () => {
    const doc = createSampleDocument();
    const greeting = sectionOf(doc, "greeting");
    for (const background of [
      "url(javascript:alert(1))",
      "red; position: fixed",
      "expression(alert(1))",
    ]) {
      expect(() =>
        validateAiProposal(
          doc,
          proposal(doc, [
            { type: "updateSectionSettings", sectionId: greeting.id, patch: { background } },
          ]),
        ),
      ).toThrow(AiProposalError);
    }
    // 허용 형식(hex)은 통과
    const ok = validateAiProposal(
      doc,
      proposal(doc, [
        { type: "updateSectionSettings", sectionId: greeting.id, patch: { background: "#f5efe6" } },
      ]),
    );
    expect(ok.actions).toHaveLength(1);
  });

  it("존재하지 않는 섹션 id를 거부한다", () => {
    const doc = createSampleDocument();
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          { type: "setSectionVariant", sectionId: "no-such-id", variant: "textOnly" },
        ]),
      ),
    ).toThrow(AiProposalError);
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          { type: "updateSectionContent", sectionId: "no-such-id", patch: { title: "x" } },
        ]),
      ),
    ).toThrow(/섹션을 찾을 수 없습니다/);
  });

  it(`action 개수 제한(${MAX_AI_ACTIONS}) 초과를 거부한다`, () => {
    const doc = createSampleDocument();
    const hero = sectionOf(doc, "hero");
    const actions = Array.from({ length: MAX_AI_ACTIONS + 1 }, () => ({
      type: "updateSectionSettings",
      sectionId: hero.id,
      patch: { paddingY: "md" },
    }));
    expect(() => validateAiProposal(doc, proposal(doc, actions))).toThrow(AiProposalError);
  });

  it('가려진 민감 값("<redacted>")을 되쓰는 patch를 거부한다', () => {
    const doc = createSampleDocument();
    const contacts = sectionOf(doc, "contacts");
    if (contacts.type !== "contacts") throw new Error("contacts가 없습니다");
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [
          {
            type: "updateSectionContent",
            sectionId: contacts.id,
            patch: {
              entries: contacts.content.entries.map((entry) => ({ ...entry, phone: "<redacted>" })),
            },
          },
        ]),
      ),
    ).toThrow(/민감 값/);
  });

  it("문서 불변식 위반(hero 삭제·rsvp 중복 추가)은 수동 편집과 같은 규칙으로 거부된다", () => {
    const doc = createSampleDocument();
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [{ type: "removeSection", sectionId: doc.sections[0].id }]),
      ),
    ).toThrow(AiProposalError);
    expect(() =>
      validateAiProposal(
        doc,
        proposal(doc, [{ type: "addSection", sectionType: "rsvp", index: doc.sections.length }]),
      ),
    ).toThrow(AiProposalError);
  });

  it("summary가 없거나 제안 형태가 아니면 거부한다 (malformed)", () => {
    const doc = createSampleDocument();
    expect(() => validateAiProposal(doc, { nonsense: true })).toThrow(AiProposalError);
    expect(() => validateAiProposal(doc, null)).toThrow(AiProposalError);
    expect(() => validateAiProposal(doc, { summary: "", actions: [] })).toThrow(AiProposalError);
  });
});
