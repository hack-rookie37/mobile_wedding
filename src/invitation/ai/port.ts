import type { InvitationDocument } from "../schema/document";
import type { AiAssetMeta, AiProjection } from "./projection";
import type { AiAction } from "./schema";

// AI 경계의 두 port (ADR-022):
//  * AiProvider — 서버가 모델 호출에 사용. sanitized projection만 받고, 검증 전의
//    raw 제안을 반환한다 (검증은 항상 validateAiProposal이 수행 — provider를 신뢰하지 않는다).
//  * AiAssistantPort — 편집기 UI가 사용. 구현체(HTTP)는 app이 주입한다 (ADR-018 패턴).
//    AI가 없어도(미설정) 편집기는 완전히 동작해야 한다 — 실패는 kind로 구분해 안내만 한다.

export interface AiPromptInput {
  instruction: string;
  projection: AiProjection;
}

export interface AiProvider {
  propose(input: AiPromptInput): Promise<unknown>;
}

export interface AiProposal {
  summary: string;
  actions: AiAction[];
}

export type AiRequestFailureKind =
  | "unconfigured" // AI 미설정 (키 없음) — 편집기는 정상
  | "unauthorized"
  | "not_found" // 소유하지 않은 프로젝트
  | "bad_request"
  | "invalid_response" // provider 응답이 검증을 통과하지 못함
  | "rate_limited" // 요청 빈도 제한 (provider 비용 보호)
  | "provider" // provider 호출 실패 (타임아웃 포함)
  | "network";

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly kind: AiRequestFailureKind,
  ) {
    super(message);
  }
}

export interface AiAssistantPort {
  propose(input: {
    projectId: string;
    instruction: string;
    doc: InvitationDocument;
    assets: AiAssetMeta[];
  }): Promise<AiProposal>;
}
