import type { NextConfig } from "next";

// dev 서버에 localhost가 아닌 origin(같은 와이파이의 폰 등)으로 접근하려면 명시적 허용이 필요하다.
// 허용하지 않으면 페이지는 뜨지만 HMR·dev 자원 요청이 막혀 hydration이 끝나지 않고,
// 폼이 React 핸들러 대신 브라우저 기본 제출로 넘어가 "새로고침만 된다"처럼 보인다.
// 사설 대역만 연다 — dev 전용 설정이라 운영 빌드에는 영향이 없다.
const LAN_DEV_ORIGINS = ["192.168.*.*", "172.16.*.*", "10.*.*.*"];

const nextConfig: NextConfig = {
  allowedDevOrigins: LAN_DEV_ORIGINS,
};

export default nextConfig;
