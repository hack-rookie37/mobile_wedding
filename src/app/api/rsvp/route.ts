import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseRsvpSubmission } from "@/invitation/rsvp/submission";
import { rsvpLogLine } from "@/server/rsvp/logSafe";
import { SlidingWindowLimiter } from "@/server/lib/rateLimit";
import { supabaseAnonKey, supabaseUrl } from "@/server/supabase/env";

// 게스트 RSVP 제출 endpoint (ADR-021) — 인증 없음, 세션 쿠키를 읽지 않는다.
//
// CSRF 검토: 이 endpoint는 쿠키 권한을 전혀 쓰지 않으므로 위조할 세션이 없고,
// JSON body만 받으므로 cross-origin HTML form 제출은 content-type 검사에서 거부된다.
// 남는 위험은 스팸뿐이며 아래 rate limit + DB 일일 상한이 담당한다.
//
// 로그 정책: 게스트 입력값은 어떤 경로로도 로그에 남기지 않는다 — rsvpLogLine만 사용.

// IP+slug 슬라이딩 윈도우 (1차 방어) — 내구적 상한은 DB submit_rsvp의 일일 상한
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const limiter = new SlidingWindowLimiter(RATE_LIMIT, RATE_WINDOW_MS);

function clientIp(request: Request): string {
  // 프록시 뒤에서는 첫 x-forwarded-for가 원 IP. 헤더가 없는 직결 환경(로컬 등)은
  // 공유 버킷 "direct"로 계산한다 — 식별 실패가 제한 완화로 이어지지 않게 한다.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded === null ? "direct" : forwarded.split(",")[0].trim();
}

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ status: "invalid" }, { status: 415 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  // 허니팟 (A-17): 사람에게 보이지 않는 폼 필드가 채워져 있으면 봇 —
  // 봇에게 탐지 신호를 주지 않도록 성공처럼 응답하고 저장하지 않는다.
  if (typeof raw === "object" && raw !== null && (raw as { website?: unknown }).website) {
    return NextResponse.json({ status: "ok", result: "created" });
  }

  let submission;
  try {
    submission = parseRsvpSubmission(raw);
  } catch {
    // 검증 실패 상세는 로그에 남기지 않는다 — 게스트 입력값이 포함될 수 있다
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  if (!limiter.allow(`${clientIp(request)}:${submission.slug}`, Date.now())) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  const supabase = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_slug: submission.slug,
    p_client_token: submission.clientToken,
    p_guest_name: submission.guestName,
    p_side: submission.side,
    p_attending: submission.attending,
    p_companions: submission.companions,
    p_meal: submission.meal,
    p_phone: submission.phone,
    p_message: submission.message,
    p_consent: submission.consent,
  });
  if (error) {
    console.error(rsvpLogLine("submit_failed", error));
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  const outcome = data as { status: string; result?: "created" | "updated" };
  switch (outcome.status) {
    case "ok":
      return NextResponse.json({ status: "ok", result: outcome.result });
    case "invalid":
      return NextResponse.json({ status: "invalid" }, { status: 400 });
    case "not_found":
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    case "closed":
      return NextResponse.json({ status: "closed" }, { status: 409 });
    case "rate_limited":
      return NextResponse.json({ status: "rate_limited" }, { status: 429 });
    default:
      console.error(rsvpLogLine("unexpected_status"));
      return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
