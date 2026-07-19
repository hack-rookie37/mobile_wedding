"use client";

import { use, useState } from "react";
import { BUILTIN_ASSETS } from "@/editor/assets/builtinAssets";
import { EditorShell } from "@/editor/components/EditorShell";
import { HttpAiAssistant } from "@/server/ai/httpAssistant";
import { SupabaseAssetStore } from "@/server/supabase/assetStore";
import { getBrowserSupabase } from "@/server/supabase/browserClient";
import { SupabasePersistence } from "@/server/supabase/persistence";

// Supabase 구현체는 여기(app)에서 조립해 주입한다 — editor 모듈은 Supabase를 모른다 (ADR-018)
export default function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [deps] = useState(() => {
    const client = getBrowserSupabase();
    return {
      persistence: new SupabasePersistence(client),
      assetStore: new SupabaseAssetStore(client, projectId, BUILTIN_ASSETS),
      ai: new HttpAiAssistant(),
    };
  });
  // key: 프로젝트 전환 시 store·자동저장 컨트롤러를 통째로 리마운트
  return (
    <EditorShell
      key={projectId}
      projectId={projectId}
      persistence={deps.persistence}
      assetStore={deps.assetStore}
      ai={deps.ai}
    />
  );
}
