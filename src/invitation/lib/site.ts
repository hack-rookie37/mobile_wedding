// 도메인 루트(junghoon-eunjin.com)가 보여줄 청첩장.
//
// 발행 자체는 예전 그대로 slug 단위다 (/i/<slug>). 루트는 그중 "지금 이 도메인이 대표로
// 내보내는 하나"를 가리키는 배포 설정일 뿐이라, 프로젝트를 여러 개 두고 각각 발행해
// 비교해보는 기존 흐름은 그대로 살아 있다.
//
// slug는 하객 URL에 그대로 드러나는 값이라 NEXT_PUBLIC_이어도 숨길 게 없다. 편집기의
// 공유·발행 패널이 "지금 발행한 주소가 도메인에 걸린 그 주소인지"를 알려주려면
// 클라이언트에서도 읽을 수 있어야 한다.
export function rootSlugFromEnv(): string | null {
  const slug = process.env.NEXT_PUBLIC_INVITATION_SLUG;
  return slug === undefined || slug === "" ? null : slug;
}

// 하객에게 건네줄 주소. 루트에 걸린 청첩장이면 도메인만 주는 게 맞다 —
// 같은 화면이 /i/<slug>로도 열리지만 그건 내부 사정이지 공유할 주소는 아니다.
export function publicUrlOf(origin: string, slug: string, rootSlug: string | null): string {
  return slug === rootSlug ? origin : `${origin}/i/${slug}`;
}
