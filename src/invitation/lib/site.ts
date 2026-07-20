// 발행 주소 규칙 (ADR-029).
//
// 발행의 기본은 도메인 그 자체다 — 하객에게 건네는 주소에 슬러그가 붙어 있을 이유가 없다.
// 공개 주소를 따로 적어 넣은 발행본만 /i/<slug>로 열린다.
export function publicUrlOf(origin: string, slug: string | null): string {
  return slug === null ? origin : `${origin}/i/${slug}`;
}
