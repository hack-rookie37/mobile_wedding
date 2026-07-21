"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/server/supabase/serverClient";
import { PUBLISHED_ROOT_PATH, publishedSlugPath } from "./published";

// 발행/재발행/중단 직후 발행 스냅샷 캐시를 새로고침한다 (ADR-040).
// 발행은 편집기(클라이언트)에서 Supabase RPC로 일어나 서버 훅이 없으므로, 편집기가 성공 후
// 이 server action을 부른다. 이걸 빼면 revalidate(5분) 동안 하객에게 옛 스냅샷이 보인다.
//
// revalidatePath는 그 경로의 ISR 캐시를 무효화한다 — 다음 요청이 새 스냅샷으로 다시 렌더한다.
// (unstable_cache 태그 무효화는 Next 16에서 게스트 페이지에 닿지 않아 revalidatePath로 바꿨다.)
// 루트는 언제나 새로고침한다(전에 이 프로젝트가 루트였을 수 있다). 소유자만 호출 가능.
export async function revalidatePublished(slug: string | null): Promise<void> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return;

  revalidatePath(PUBLISHED_ROOT_PATH);
  if (slug !== null) revalidatePath(publishedSlugPath(slug));
}
