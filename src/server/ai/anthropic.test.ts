import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildAiProjection } from "@/invitation/ai/projection";
import { aiProposalSchema } from "@/invitation/ai/schema";
import { createSampleDocument } from "@/invitation/fixtures/sample";
import { AiProviderError, AnthropicAiProvider } from "./anthropic";

const PROMPT_INPUT = {
  instruction: "테마를 바꿔줘",
  projection: buildAiProjection(createSampleDocument(), []),
};

const noSleep = () => Promise.resolve();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toolUseBody(input: unknown) {
  return { content: [{ type: "tool_use", name: "propose_actions", input }] };
}

describe("AnthropicAiProvider", () => {
  it("tool 정의는 aiProposalSchema에서 생성된다 (이중 관리 없음)", () => {
    const schema = z.toJSONSchema(aiProposalSchema) as unknown as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties)).toEqual(["summary", "actions"]);
  });

  it("정상 응답: tool_use 블록의 input을 그대로 반환하고 요청에 키·모델·projection이 실린다", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init!.body as string) as {
        model: string;
        tool_choice: { name: string };
        messages: { content: string }[];
      };
      expect(body.model).toBe("claude-test");
      expect(body.tool_choice.name).toBe("propose_actions");
      // sanitized projection만 나간다 — 민감 값은 redact된 상태
      expect(body.messages[0].content).toContain("<redacted>");
      expect(body.messages[0].content).not.toContain("010-1234-5678");
      const headers = init!.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("sk-test");
      return jsonResponse(toolUseBody({ summary: "요약", actions: [] }));
    });

    const provider = new AnthropicAiProvider(
      { apiKey: "sk-test", model: "claude-test" },
      { fetchFn: fetchFn as unknown as typeof fetch, sleep: noSleep },
    );
    const raw = await provider.propose(PROMPT_INPUT);
    expect(raw).toEqual({ summary: "요약", actions: [] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("timeout: 재시도 후에도 실패하면 timeout 사유로 던진다", async () => {
    const abort = () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    };
    const fetchFn = vi.fn(async () => abort());
    const provider = new AnthropicAiProvider(
      { apiKey: "k", model: "m" },
      { fetchFn: fetchFn as unknown as typeof fetch, sleep: noSleep },
    );
    await expect(provider.propose(PROMPT_INPUT)).rejects.toMatchObject({ reason: "timeout" });
    expect(fetchFn).toHaveBeenCalledTimes(2); // 재시도 정책: 총 2회 시도
  });

  it("429 후 성공: 일시 장애는 재시도로 복구된다", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate" }, 429))
      .mockResolvedValueOnce(jsonResponse(toolUseBody({ summary: "ok", actions: [] })));
    const provider = new AnthropicAiProvider(
      { apiKey: "k", model: "m" },
      { fetchFn: fetchFn as unknown as typeof fetch, sleep: noSleep },
    );
    await expect(provider.propose(PROMPT_INPUT)).resolves.toEqual({ summary: "ok", actions: [] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("malformed 응답(tool_use 없음·JSON 아님)은 malformed 사유로 던진다", async () => {
    const noTool = vi.fn(async () => jsonResponse({ content: [{ type: "text", text: "안녕" }] }));
    const provider = new AnthropicAiProvider(
      { apiKey: "k", model: "m" },
      { fetchFn: noTool as unknown as typeof fetch, sleep: noSleep },
    );
    await expect(provider.propose(PROMPT_INPUT)).rejects.toMatchObject({ reason: "malformed" });

    const notJson = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));
    const provider2 = new AnthropicAiProvider(
      { apiKey: "k", model: "m" },
      { fetchFn: notJson as unknown as typeof fetch, sleep: noSleep },
    );
    await expect(provider2.propose(PROMPT_INPUT)).rejects.toMatchObject({ reason: "malformed" });
  });

  it("HTTP 오류 메시지에는 상태 코드만 — 응답 본문(잠재적 유출)을 싣지 않는다", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ secret: "leak-me" }, 500));
    const provider = new AnthropicAiProvider(
      { apiKey: "k", model: "m" },
      { fetchFn: fetchFn as unknown as typeof fetch, sleep: noSleep },
    );
    const error = await provider.propose(PROMPT_INPUT).then(
      () => null,
      (e: unknown) => e,
    );
    if (!(error instanceof AiProviderError)) throw new Error("AiProviderError가 아닙니다");
    expect(error.message).toContain("500");
    expect(error.message).not.toContain("leak-me");
  });
});
