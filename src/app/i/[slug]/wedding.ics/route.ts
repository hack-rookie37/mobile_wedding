import { icsResponseOf, loadPublished } from "../../../_shared/published";

// 공개 주소를 따로 둔 발행본의 예식 일정.
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return icsResponseOf(await loadPublished(slug));
}
