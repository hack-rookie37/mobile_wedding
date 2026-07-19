import type { InvitationDocument } from "./schema/document";

// sensitive 필드 정책 (PRODUCT_SPEC §9, ADR-011)
// 연락처 전화번호와 계좌번호는 게스트에게는 보이지만, AI 요청 projection에서는
// 구조를 보존한 placeholder로 치환된다 — AI는 섹션 순서·표시 여부 등 구조 편집은
// 할 수 있으나 민감한 값 자체는 읽을 수 없다.

export const REDACTED_PLACEHOLDER = "<redacted>";

// sensitive 선언의 단일 소스는 스키마다: document.ts의 `.meta({ sensitive: true })`.
// 이 함수는 그 선언의 projection 구현이며, 선언·구현의 일치는 sensitive.test.ts가 고정한다.
export function redactForAi(doc: InvitationDocument): InvitationDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => {
      if (section.type === "contacts") {
        return {
          ...section,
          content: {
            ...section.content,
            entries: section.content.entries.map((entry) => ({
              ...entry,
              phone: REDACTED_PLACEHOLDER,
            })),
          },
        };
      }
      if (section.type === "giftAccount") {
        return {
          ...section,
          content: {
            ...section.content,
            accounts: section.content.accounts.map((account) => ({
              ...account,
              number: REDACTED_PLACEHOLDER,
            })),
          },
        };
      }
      return section;
    }),
  };
}
