import type { MapAppId } from "@/invitation/lib/mapLinks";

// 지도 앱 아이콘 — 각 서비스의 공식 앱 아이콘 파일(제3자 상표).
// 표시 크기는 34px이고 고해상도 화면을 위해 136px 원본을 담았다.
const ICON_SRC: Record<MapAppId, string> = {
  naver: "/map-apps/naver.png",
  kakao: "/map-apps/kakao.png",
  tmap: "/map-apps/tmap.png",
};

// alt는 비운다 — 바로 옆 라벨이 같은 내용을 이미 읽어 주므로 중복 낭독이 된다
export function MapAppIcon({ id }: { id: MapAppId }) {
  return (
    <img
      src={ICON_SRC[id]}
      alt=""
      aria-hidden
      width={34}
      height={34}
      loading="lazy"
      decoding="async"
      className="size-[34px] shrink-0 rounded-lg object-contain"
    />
  );
}
