// 외부 지도 연결 — MVP는 지도 API 없이 공개 URL·딥링크만 사용한다 (Phase 8).
// 네이버·카카오는 웹 URL(모바일에서 앱으로 연결), 티맵은 앱 딥링크만 제공된다.

export interface MapLink {
  id: "naver" | "kakao" | "tmap";
  label: string;
  href: string;
}

export function mapSearchLinks(query: string): MapLink[] {
  const q = encodeURIComponent(query);
  return [
    { id: "naver", label: "네이버 지도", href: `https://map.naver.com/p/search/${q}` },
    { id: "kakao", label: "카카오맵", href: `https://map.kakao.com/link/search/${q}` },
    { id: "tmap", label: "티맵", href: `tmap://search?name=${q}` },
  ];
}

// 검색어: 주소가 가장 결정적이다 — 주소가 비어 있으면 장소명으로 대체
export function venueMapQuery(venue: { name: string; address: string }): string {
  return venue.address !== "" ? venue.address : venue.name;
}
