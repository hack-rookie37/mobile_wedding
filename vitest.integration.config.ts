import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 실제 로컬 Supabase 스택(supabase start)을 요구하는 통합 테스트 전용 설정.
// 단위 테스트(npm test)와 분리해 hermetic함을 유지한다 — 실행: npm run test:integration
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 사용자·프로젝트 생성이 서로 얽히지 않도록 순차 실행
    fileParallelism: false,
  },
});
