import { z } from "zod";
import type { AiPromptInput, AiProvider } from "@/invitation/ai/port";
import { aiProposalSchema, MAX_AI_ACTIONS } from "@/invitation/ai/schema";
import { themeIdSchema, SECTION_LAYOUT_SCHEMAS } from "@/invitation/schema/document";
import { ADDABLE_SECTION_TYPES } from "@/invitation/schema/sectionDefaults";

// 서버 전용 Anthropic provider adapter (ADR-022).
// tool 정의는 z.toJSONSchema(aiProposalSchema)로 생성한다 — action 스키마의 이중 관리 없음.
// 반환은 tool 입력 그대로(raw)이며, 검증은 호출부의 validateAiProposal이 한다.
//
// 로그·에러 메시지에 사용자 콘텐츠(요청 문구·문서)를 싣지 않는다 — 상태 코드·사유만.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2; // 재시도 정책: 일시 장애(429·5xx·타임아웃·형식 불량)에 1회 재시도
const RETRY_DELAY_MS = 800;
const MAX_OUTPUT_TOKENS = 4096;

export type AiProviderFailureReason = "timeout" | "http" | "malformed";

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly reason: AiProviderFailureReason,
  ) {
    super(message);
  }
}

const PROPOSE_TOOL_NAME = "propose_actions";

function variantCatalog(): string {
  return Object.entries(SECTION_LAYOUT_SCHEMAS)
    .map(([type, schema]) => `${type}: ${schema.shape.variant.options.join(" | ")}`)
    .join("\n");
}

function buildSystemPrompt(): string {
  return [
    "당신은 한국 모바일 청첩장 편집 도우미다. 사용자의 요청을 편집 action 목록으로 변환한다.",
    "할 수 있는 일: 구조화된 정보로 초안 제안, 인사말 다듬기, 전체 분위기 변경(테마·레이아웃·여백), 갤러리 레이아웃 제안, 접근성 검토(사진 대체 텍스트 등).",
    "",
    "규칙:",
    `- 반드시 ${PROPOSE_TOOL_NAME} tool로만 응답한다. summary는 한국어 1~2문장.`,
    "- 문서에 실재하는 sectionId·assetId만 사용한다. 지어내지 않는다.",
    "- 새 섹션을 추가하고 이어서 편집하려면 sectionId를 직접 지정한다 (예: ai-greeting-1).",
    '- "<redacted>"는 가려진 민감 값의 자리표시자다 — 어떤 필드에도 그대로 쓰지 않는다. 연락처·계좌 값은 사용자가 요청 문구에 직접 적은 경우에만 바꾼다.',
    "- 콘텐츠에 HTML·CSS·코드를 넣지 않는다. 순수 텍스트만.",
    `- action은 ${MAX_AI_ACTIONS}개 이하로, 요청 범위를 벗어난 변경은 하지 않는다.`,
    "- 신랑·신부 이름과 예식 일시·장소(wedding)는 바꾸지 않는다.",
    "",
    `추가 가능한 섹션 타입: ${ADDABLE_SECTION_TYPES.join(", ")} (hero·rsvp는 문서에 1개만)`,
    `테마 id: ${themeIdSchema.options.join(", ")}`,
    "섹션별 layout variant:",
    variantCatalog(),
  ].join("\n");
}

interface AnthropicDeps {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class AnthropicAiProvider implements AiProvider {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly config: { apiKey: string; model: string },
    deps: AnthropicDeps = {},
  ) {
    this.fetchFn = deps.fetchFn ?? fetch;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async propose(input: AiPromptInput): Promise<unknown> {
    const body = JSON.stringify({
      model: this.config.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: buildSystemPrompt(),
      tools: [
        {
          name: PROPOSE_TOOL_NAME,
          description: "청첩장 문서에 적용할 편집 action 목록을 제안한다",
          input_schema: z.toJSONSchema(aiProposalSchema),
        },
      ],
      tool_choice: { type: "tool", name: PROPOSE_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            `[요청]\n${input.instruction}`,
            `[문서]\n${JSON.stringify(input.projection.doc)}`,
            `[사진 목록 — id·치수·방향]\n${JSON.stringify(input.projection.assets)}`,
          ].join("\n\n"),
        },
      ],
    });

    let lastError: AiProviderError | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.requestOnce(body);
      } catch (error) {
        if (!(error instanceof AiProviderError)) throw error;
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await this.sleep(RETRY_DELAY_MS);
      }
    }
    throw lastError ?? new AiProviderError("AI 호출에 실패했습니다", "http");
  }

  private async requestOnce(body: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new AiProviderError(`AI 응답 시간 초과 (${REQUEST_TIMEOUT_MS / 1000}초)`, "timeout");
      }
      throw new AiProviderError("AI 서비스에 연결하지 못했습니다", "http");
    }

    if (!response.ok) {
      // 상태 코드만 — 응답 본문은 로그·메시지에 싣지 않는다
      throw new AiProviderError(`AI 서비스 오류 (HTTP ${response.status})`, "http");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AiProviderError("AI 응답을 해석할 수 없습니다", "malformed");
    }

    const content = (payload as { content?: unknown }).content;
    if (Array.isArray(content)) {
      for (const block of content) {
        const candidate = block as { type?: unknown; name?: unknown; input?: unknown };
        if (candidate.type === "tool_use" && candidate.name === PROPOSE_TOOL_NAME) {
          return candidate.input;
        }
      }
    }
    throw new AiProviderError("AI가 편집 제안 형식으로 응답하지 않았습니다", "malformed");
  }
}
