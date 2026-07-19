import { expect, test } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

const THEMES = ["warm-editorial", "modern-monochrome", "film-diary"] as const;
const WIDTHS = [360, 390, 430] as const;
const EDGE_CASES = [
  "long-names",
  "long-greeting",
  "one-photo",
  "ten-photos",
  "missing-image",
  "hidden-section",
] as const;

// 스크린샷은 reduced motion으로 촬영 — 진입 모션 중간 상태(투명)가 찍히는 것을 방지하고
// reduced motion에서 콘텐츠가 전부 보인다는 요구사항도 함께 검증한다.
test.describe("테마 스크린샷 (reduced motion)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  for (const theme of THEMES) {
    test(`${theme}: 3폭 기본 스크린샷`, async ({ page }) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/fixture/${theme}/base`);
        await expect(page.getByText("서울특별시 강남구 테헤란로 132")).toBeVisible();
        // reduced motion: 뷰포트 밖 마지막 섹션 본문도 즉시 완전 표시 (모션 스킵)
        const lastBody = page.locator("[data-section-id] > div.px-6").last();
        await expect(lastBody).toHaveCSS("opacity", "1");
        await page.screenshot({
          path: `screenshots/themes/${theme}-${width}.png`,
          fullPage: true,
        });
      }
    });

    test(`${theme}: 엣지 케이스 스크린샷 (390px)`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const edgeCase of EDGE_CASES) {
        await page.goto(`/fixture/${theme}/${edgeCase}`);
        await expect(page.locator("[data-invitation-root]")).toBeVisible();
        if (edgeCase === "hidden-section") {
          // 숨긴 greeting은 어떤 테마에서도 렌더되지 않는다
          await expect(page.getByText("소중한 분들을 초대합니다")).toHaveCount(0);
        }
        await page.screenshot({
          path: `screenshots/themes/cases/${theme}-${edgeCase}-390.png`,
          fullPage: true,
        });
      }
    });
  }

  test("테마 간 콘텐츠 보존: 세 테마가 동일한 텍스트를 렌더한다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const REQUIRED_TEXTS = [
      "김민준",
      "이서연",
      "서로가 마주 보며",
      "라온컨벤션",
      "서울특별시 강남구 테헤란로 132",
      "김영호",
      "우리의 순간들",
    ];
    for (const theme of THEMES) {
      await page.goto(`/fixture/${theme}/base`);
      await expect(page.locator("[data-invitation-root]")).toBeVisible();
      const text = await page.locator("[data-invitation-root]").innerText();
      for (const required of REQUIRED_TEXTS) {
        expect(text, `${theme}에 "${required}" 누락`).toContain(required);
      }
    }
  });

  test("비교 페이지: 세 테마가 나란히 렌더된다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/themes");
    await expect(page.locator("[data-canvas-theme]")).toHaveCount(3);
    await expect(page.locator('[data-canvas-theme="warm-editorial"]')).toBeVisible();
    await expect(page.locator('[data-canvas-theme="modern-monochrome"]')).toBeVisible();
    await expect(page.locator('[data-canvas-theme="film-diary"]')).toBeVisible();
    await page.screenshot({ path: "screenshots/themes/compare-1440.png" });
  });
});

test.describe("진입 모션 (일반 모드)", () => {
  test("film-diary: 뷰포트 밖 섹션은 스크롤 진입 시 나타난다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fixture/film-diary/base");
    await expect(page.getByText("서울특별시 강남구 테헤란로 132")).toBeAttached();

    const lastBody = page.locator("[data-section-id] > div.px-6").last();
    await expect(lastBody).toHaveCSS("opacity", "0"); // 아직 미진입 — 숨김 상태
    await lastBody.scrollIntoViewIfNeeded();
    await expect(lastBody).toHaveCSS("opacity", "1", { timeout: 3000 }); // 진입 후 표시
  });

  test("modern-monochrome: 모션 토큰이 0이라 스크롤 없이 즉시 표시된다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fixture/modern-monochrome/base");
    await expect(page.locator("[data-invitation-root]")).toBeVisible();
    const lastBody = page.locator("[data-section-id] > div.px-6").last();
    await expect(lastBody).toHaveCSS("opacity", "1");
  });
});

test.describe("편집기 테마 전환", () => {
  test("테마 전환 시 콘텐츠가 보존되고 undo로 되돌아간다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await signUpFresh(page);
    await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
    await page.waitForURL(/\/editor\//);

    const root = page.locator("[data-invitation-root]");
    await expect(root).toHaveAttribute("data-canvas-theme", "warm-editorial");

    await page.getByRole("button", { name: "테마", exact: true }).click();
    await page.getByRole("button", { name: /모던 모노크롬/ }).click();
    await expect(root).toHaveAttribute("data-canvas-theme", "modern-monochrome");
    // 콘텐츠 보존
    await expect(root.getByText("김민준").first()).toBeVisible();
    await expect(root.getByText(/서로가 마주 보며/)).toBeVisible();

    await page.getByRole("button", { name: "실행 취소" }).click();
    await expect(root).toHaveAttribute("data-canvas-theme", "warm-editorial");
  });
});
