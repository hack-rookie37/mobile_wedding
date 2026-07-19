import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: {} },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "invitation", pattern: "src/invitation/**" },
        { type: "renderer", pattern: "src/renderer/**" },
        { type: "editor", pattern: "src/editor/**" },
        { type: "server", pattern: "src/server/**" },
        { type: "ui", pattern: "src/ui/**" },
        { type: "app", pattern: "src/app/**" },
      ],
    },
    rules: {
      // ARCHITECTURE.md §2 의존성 매트릭스 — 위반은 빌드 실패
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { types: "invitation" } },
              allow: { to: { element: { types: "invitation" } } },
            },
            {
              from: { element: { types: "renderer" } },
              allow: { to: { element: { types: { anyOf: ["renderer", "invitation"] } } } },
            },
            {
              from: { element: { types: "editor" } },
              allow: {
                to: { element: { types: { anyOf: ["editor", "invitation", "renderer", "ui"] } } },
              },
            },
            {
              from: { element: { types: "server" } },
              allow: { to: { element: { types: { anyOf: ["server", "invitation"] } } } },
            },
            { from: { element: { types: "ui" } }, allow: { to: { element: { types: "ui" } } } },
            {
              from: { element: { types: "app" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["app", "invitation", "renderer", "editor", "server", "ui"] },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
  {
    // renderer: 로컬 asset 단계 한정 — VS3에서 next/image + Storage 변환으로 전환
    // editor: object URL(blob:) 썸네일은 next/image 최적화 대상이 아니다
    files: ["src/renderer/**/*.tsx", "src/editor/**/*.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
