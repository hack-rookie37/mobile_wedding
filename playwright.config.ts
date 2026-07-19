import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    // 개발용 dev 서버(3000)와 분리된 테스트 전용 프로덕션 서버 — dev 서버를 재사용하면
    // StrictMode·HMR이 끼어들어 결과가 달라진다
    baseURL: "http://localhost:3100",
  },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 30_000,
    // AI는 결정적 mock provider로 — 실제 모델 없이 전체 파이프라인(검증·검토·적용)을 검증한다
    env: { AI_PROVIDER: "mock" },
  },
});
