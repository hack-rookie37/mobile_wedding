import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSampleDocument } from "./fixtures/sample";
import { contactEntrySchema, documentSchema, giftAccountSchema } from "./schema/document";
import { REDACTED_PLACEHOLDER, redactForAi } from "./sensitive";

describe("sensitive 선언 (스키마 .meta — 단일 소스)", () => {
  it("연락처 phone과 계좌 number가 스키마에 sensitive로 선언되어 있다", () => {
    expect(z.globalRegistry.get(contactEntrySchema.shape.phone)).toMatchObject({
      sensitive: true,
    });
    expect(z.globalRegistry.get(giftAccountSchema.shape.number)).toMatchObject({
      sensitive: true,
    });
  });

  it("redactForAi는 선언된 필드를 정확히 구현한다 — 그 외 문자열 필드는 redact되지 않는다", () => {
    const redacted = redactForAi(createSampleDocument());
    const serialized = JSON.stringify(redacted);
    // sensitive가 아닌 필드가 실수로 지워지지 않았다
    expect(serialized).toContain("국민은행");
    expect(serialized).toContain("김민준");
  });
});

describe("redactForAi (sensitive 필드 — PRODUCT_SPEC §9)", () => {
  it("연락처 전화번호와 계좌번호를 placeholder로 치환한다", () => {
    const redacted = redactForAi(createSampleDocument());
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("010-1234-5678");
    expect(serialized).not.toContain("123456-01-234567");

    const contacts = redacted.sections.find((s) => s.type === "contacts");
    if (contacts?.type !== "contacts") throw new Error("contacts가 없습니다");
    expect(contacts.content.entries.every((e) => e.phone === REDACTED_PLACEHOLDER)).toBe(true);

    const gift = redacted.sections.find((s) => s.type === "giftAccount");
    if (gift?.type !== "giftAccount") throw new Error("giftAccount가 없습니다");
    expect(gift.content.accounts.every((a) => a.number === REDACTED_PLACEHOLDER)).toBe(true);
  });

  it("구조와 비민감 필드는 보존한다 — AI가 구조 편집을 할 수 있어야 한다", () => {
    const doc = createSampleDocument();
    const redacted = redactForAi(doc);
    expect(redacted.sections.map((s) => s.id)).toEqual(doc.sections.map((s) => s.id));

    const contacts = redacted.sections.find((s) => s.type === "contacts");
    if (contacts?.type !== "contacts") throw new Error("contacts가 없습니다");
    expect(contacts.content.entries.map((e) => e.name)).toEqual([
      "김민준",
      "김영호",
      "이서연",
      "최미경",
    ]);

    const gift = redacted.sections.find((s) => s.type === "giftAccount");
    if (gift?.type !== "giftAccount") throw new Error("giftAccount가 없습니다");
    expect(gift.content.accounts.map((a) => a.bank)).toEqual(["국민은행", "신한은행", "우리은행"]);
  });

  it("redact된 문서도 스키마를 통과한다 (AI action 적용 가능)", () => {
    expect(documentSchema.safeParse(redactForAi(createSampleDocument())).success).toBe(true);
  });

  it("원본 문서를 변경하지 않는다", () => {
    const doc = createSampleDocument();
    const snapshot = structuredClone(doc);
    redactForAi(doc);
    expect(doc).toEqual(snapshot);
  });
});
