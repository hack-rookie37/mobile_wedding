import { NextResponse } from "next/server";
import { z } from "zod";
import { MockAiProvider } from "@/invitation/ai/mockProvider";
import type { AiProvider } from "@/invitation/ai/port";
import { aiAssetMetaSchema, buildAiProjection } from "@/invitation/ai/projection";
import { AiProposalError, validateAiProposal } from "@/invitation/ai/validate";
import { documentSchema } from "@/invitation/schema/document";
import { AiProviderError, AnthropicAiProvider } from "@/server/ai/anthropic";
import { SlidingWindowLimiter } from "@/server/lib/rateLimit";
import { getServerSupabase } from "@/server/supabase/serverClient";

// AI 편집 제안 endpoint (ADR-022) — 소유자 세션 필수.
//
// 순서가 privacy 경계다:
//  1. 세션·프로젝트 소유권 검증 (RLS) — 다른 프로젝트를 대상으로 한 요청은 404
//  2. 문서 zod full parse → buildAiProjection (redact + asset 메타만) — provider에는
//     sanitized projection만 나간다
//  3. provider 호출 (서버 전용 — 키는 브라우저에 없다)
//  4. validateAiProposal — allowlist·값 가드·dry-run. 검증 전의 raw 응답은 클라이언트로
//     나가지 않는다
//
// 로그 정책: 요청 문구·문서 내용은 로그에 남기지 않는다 — 이벤트 이름·사유만.

const requestSchema = z.object({
  projectId: z.uuid(),
  instruction: z.string().min(1).max(1000),
  doc: z.unknown(),
  assets: z.array(aiAssetMetaSchema).max(200),
});

// provider 비용 보호 — 소유자 전용 endpoint지만 호출당 비용이 있으므로 사용자별로 제한한다
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const limiter = new SlidingWindowLimiter(RATE_LIMIT, RATE_WINDOW_MS);

function aiLogLine(event: string, reason?: string): string {
  return JSON.stringify({ scope: "ai", event, ...(reason !== undefined ? { reason } : {}) });
}

// AI_PROVIDER=mock은 e2e·로컬 데모용 결정적 provider. 그 외에는 Anthropic —
// 키·모델 미설정이면 null(= 503 unconfigured, 편집기는 AI 없이 완전 동작한다).
function resolveProvider(): AiProvider | null {
  if (process.env.AI_PROVIDER === "mock") return new MockAiProvider();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiKey || !model) return null;
  return new AnthropicAiProvider({ apiKey, model });
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  if (!limiter.allow(user.id, Date.now())) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ status: "bad_request" }, { status: 400 });
  }
  const parsedRequest = requestSchema.safeParse(raw);
  if (!parsedRequest.success) {
    return NextResponse.json({ status: "bad_request" }, { status: 400 });
  }
  const parsedDoc = documentSchema.safeParse(parsedRequest.data.doc);
  if (!parsedDoc.success) {
    return NextResponse.json({ status: "bad_request" }, { status: 400 });
  }
  const doc = parsedDoc.data;

  // 프로젝트 소유권 (RLS) — 남의 프로젝트는 존재 여부 구분 없이 404
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", parsedRequest.data.projectId)
    .maybeSingle();
  if (projectError !== null) {
    console.error(aiLogLine("ownership_check_failed"));
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
  if (project === null) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  const provider = resolveProvider();
  if (provider === null) {
    return NextResponse.json({ status: "unconfigured" }, { status: 503 });
  }

  const projection = buildAiProjection(doc, parsedRequest.data.assets);

  let proposalRaw: unknown;
  try {
    proposalRaw = await provider.propose({
      instruction: parsedRequest.data.instruction,
      projection,
    });
  } catch (error) {
    const reason = error instanceof AiProviderError ? error.reason : "unknown";
    console.error(aiLogLine("provider_failed", reason));
    const status = reason === "timeout" ? 504 : 502;
    return NextResponse.json({ status: "provider_error", reason }, { status });
  }

  try {
    const proposal = validateAiProposal(doc, proposalRaw);
    return NextResponse.json({
      status: "ok",
      summary: proposal.summary,
      actions: proposal.actions,
    });
  } catch (error) {
    // 검증 실패 상세에는 AI가 만든 콘텐츠가 섞일 수 있어 로그에는 사유 없이 남긴다
    console.error(
      aiLogLine("proposal_rejected", error instanceof AiProposalError ? "invalid" : "unknown"),
    );
    return NextResponse.json({ status: "invalid_response" }, { status: 422 });
  }
}
