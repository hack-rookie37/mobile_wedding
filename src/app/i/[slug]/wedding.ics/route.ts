import { publishedIcsResponse } from "../../../_shared/published";

// slug로 지정한 발행본의 예식 일정.
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return publishedIcsResponse(slug);
}
