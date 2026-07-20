import { rootSlugFromEnv } from "@/invitation/lib/site";
import { publishedIcsResponse } from "../_shared/published";

// 도메인 루트 청첩장의 예식 일정. 루트 페이지가 이 주소를 '일정 저장' 버튼에 건다.
export async function GET() {
  const slug = rootSlugFromEnv();
  if (slug === null) {
    return new Response("루트 청첩장이 설정되지 않았습니다", { status: 404 });
  }
  return publishedIcsResponse(slug);
}
