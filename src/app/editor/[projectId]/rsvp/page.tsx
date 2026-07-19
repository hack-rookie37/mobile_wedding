"use client";

import { use, useState } from "react";
import { RsvpDashboard } from "@/editor/components/RsvpDashboard";
import { getBrowserSupabase } from "@/server/supabase/browserClient";
import { SupabaseRsvpAdmin } from "@/server/supabase/rsvpApi";

// 제작자 RSVP 결과 페이지 (A-22) — Supabase 구현체는 여기(app)에서 조립해 주입한다.
// middleware가 세션을 요구하고, 데이터 접근은 RLS(소유자만)를 통과한다.
export default function RsvpResponsesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [admin] = useState(() => new SupabaseRsvpAdmin(getBrowserSupabase()));
  return <RsvpDashboard key={projectId} projectId={projectId} admin={admin} />;
}
