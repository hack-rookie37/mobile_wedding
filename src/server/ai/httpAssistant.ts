import type { InvitationDocument } from "@/invitation/schema/document";
import type { AiAssetMeta } from "@/invitation/ai/projection";
import {
  AiRequestError,
  type AiAssistantPort,
  type AiProposal,
  type AiRequestFailureKind,
} from "@/invitation/ai/port";

// AiAssistantPort의 HTTP 구현 — 편집기(브라우저)가 자기 서버의 /api/ai/propose를 호출한다.
// provider 키는 서버에만 있다. app이 이 어댑터를 편집기에 주입한다 (ADR-018 패턴).

function kindOf(status: number): AiRequestFailureKind {
  switch (status) {
    case 401:
      return "unauthorized";
    case 404:
      return "not_found";
    case 400:
      return "bad_request";
    case 422:
      return "invalid_response";
    case 429:
      return "rate_limited";
    case 503:
      return "unconfigured";
    default:
      return "provider";
  }
}

const KIND_MESSAGES: Record<AiRequestFailureKind, string> = {
  unconfigured: "AI가 아직 설정되지 않았습니다 — 편집기의 다른 기능은 그대로 사용할 수 있습니다.",
  unauthorized: "로그인이 필요합니다.",
  not_found: "이 청첩장에 대한 권한이 없습니다.",
  bad_request: "요청을 처리할 수 없습니다 — 문구를 다시 확인해 주세요.",
  invalid_response: "AI 응답이 검증을 통과하지 못했습니다 — 다시 시도해 주세요.",
  rate_limited: "요청이 너무 잦습니다 — 잠시 후 다시 시도해 주세요.",
  provider: "AI 호출에 실패했습니다 — 잠시 후 다시 시도해 주세요.",
  network: "네트워크 연결을 확인해 주세요.",
};

export class HttpAiAssistant implements AiAssistantPort {
  async propose(input: {
    projectId: string;
    instruction: string;
    doc: InvitationDocument;
    assets: AiAssetMeta[];
  }): Promise<AiProposal> {
    let response: Response;
    try {
      response = await fetch("/api/ai/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      throw new AiRequestError(KIND_MESSAGES.network, "network");
    }

    const body = (await response.json().catch(() => null)) as {
      status?: string;
      summary?: string;
      actions?: unknown;
    } | null;

    if (response.ok && body?.status === "ok") {
      return {
        summary: body.summary ?? "",
        actions: (body.actions ?? []) as AiProposal["actions"],
      };
    }
    const kind = kindOf(response.status);
    throw new AiRequestError(KIND_MESSAGES[kind], kind);
  }
}
