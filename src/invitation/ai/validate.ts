import { applyAction } from "../actions/apply";
import { SECTION_CONTENT_SCHEMAS, type InvitationDocument } from "../schema/document";
import { REDACTED_PLACEHOLDER } from "../sensitive";
import { aiProposalSchema, type AiAction } from "./schema";

// AI 응답의 runtime 검증 (ADR-022) — 순서대로 4겹:
//  1. zod allowlist parse: 알 수 없는 action 타입·형식 위반·개수 초과 거부
//  2. 값 가드: HTML/마크업 문자열, "<redacted>" 자리표시자 echo 거부
//  3. content patch 키 검증: 섹션 content 스키마에 없는 임의 경로 거부
//     (zod가 조용히 버리는 대신 명시적으로 실패한다 — AI 응답에 silent 변형은 없다)
//  4. dry-run 적용: 실제 applyAction으로 순차 실행 — 없는 섹션 id·variant·불변식 위반이
//     수동 편집과 정확히 같은 규칙으로 거부되고, 부산물로 미리보기 문서를 얻는다

export class AiProposalError extends Error {}

export interface ValidatedAiProposal {
  summary: string;
  actions: AiAction[];
  previewDoc: InvitationDocument; // 전체 적용 시의 결과 (원본 불변)
}

// HTML/XML 태그 시작 패턴 — 콘텐츠는 순수 텍스트만 허용한다 ("<3" 같은 일반 텍스트는 통과)
const MARKUP_PATTERN = /<\s*[a-zA-Z!/]/;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
}

function assertSafeValues(action: AiAction, index: number): void {
  const strings: string[] = [];
  collectStrings(action, strings);
  for (const value of strings) {
    // "<redacted>"는 마크업 패턴에도 걸리므로 먼저 구분해 정확한 이유를 준다
    if (value.includes(REDACTED_PLACEHOLDER)) {
      throw new AiProposalError(
        `action ${index + 1}: 가려진 민감 값(${REDACTED_PLACEHOLDER})을 문서에 되쓸 수 없습니다`,
      );
    }
    if (MARKUP_PATTERN.test(value)) {
      throw new AiProposalError(
        `action ${index + 1}: 콘텐츠에 HTML/마크업을 넣을 수 없습니다 — 순수 텍스트만 허용됩니다`,
      );
    }
  }
}

function assertContentPatchKeys(doc: InvitationDocument, action: AiAction, index: number): void {
  if (action.type !== "updateSectionContent") return;
  const section = doc.sections.find((s) => s.id === action.sectionId);
  if (!section) {
    throw new AiProposalError(`action ${index + 1}: 섹션을 찾을 수 없습니다 — ${action.sectionId}`);
  }
  const allowed = new Set(Object.keys(SECTION_CONTENT_SCHEMAS[section.type].shape));
  for (const key of Object.keys(action.patch)) {
    if (!allowed.has(key)) {
      throw new AiProposalError(
        `action ${index + 1}: ${section.type} content에 없는 필드입니다 — '${key}'`,
      );
    }
  }
}

export function validateAiProposal(doc: InvitationDocument, raw: unknown): ValidatedAiProposal {
  const parsed = aiProposalSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiProposalError(`AI 응답이 action 스키마를 벗어났습니다: ${parsed.error.message}`);
  }
  const { summary, actions } = parsed.data;

  let current = doc;
  actions.forEach((action, index) => {
    assertSafeValues(action, index);
    // addSection으로 만든 섹션을 뒤이어 편집할 수 있도록, 키 검증은 진행 중 문서 기준
    assertContentPatchKeys(current, action, index);
    try {
      const result = applyAction(current, action);
      if (result.outcome === "applied") current = result.doc;
    } catch (error) {
      throw new AiProposalError(
        `action ${index + 1}(${action.type}) 적용 불가: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  return { summary, actions, previewDoc: current };
}
