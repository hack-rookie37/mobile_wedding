// 외부 지도 연결 — MVP는 지도 API 없이 공개 URL·딥링크만 사용한다 (Phase 8).
// 네이버·카카오는 웹 URL(모바일에서 앱으로 연결), 티맵은 앱 딥링크만 제공된다.

export interface MapLink {
  id: "naver" | "kakao" | "tmap";
  label: string;
  href: string;
  brandColor: string; // 버튼의 서비스 식별 색 (로고 이미지는 쓰지 않는다 — 상표 리소스 미포함)
}

export function mapSearchLinks(query: string): MapLink[] {
  const q = encodeURIComponent(query);
  return [
    {
      id: "naver",
      label: "네이버 지도",
      href: `https://map.naver.com/p/search/${q}`,
      brandColor: "#03C75A",
    },
    {
      id: "kakao",
      label: "카카오맵",
      href: `https://map.kakao.com/link/search/${q}`,
      brandColor: "#FEE500",
    },
    { id: "tmap", label: "티맵", href: `tmap://search?name=${q}`, brandColor: "#F82F62" },
  ];
}

// 검색어: 예식장 이름 — 지도 앱에서 장소 카드(전화·길찾기·리뷰)로 바로 잡힌다.
// 도로명 주소 검색은 건물 지점만 찍혀 안내가 빈약하다. 이름이 비어 있으면 주소로 대체.
export function venueMapQuery(venue: { name: string; address: string }): string {
  return venue.name !== "" ? venue.name : venue.address;
}
