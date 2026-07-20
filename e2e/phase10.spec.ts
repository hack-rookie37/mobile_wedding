import { expect, test, type Page } from "@playwright/test";
import { createSampleDocument } from "../src/invitation/fixtures/sample";
import { signUpFresh } from "./helpers/auth";

// Phase 10 — AI 도우미 (mock provider): 자연어 요청 → 검토 화면(변경 목록·전후 비교·
// 미리보기) → 전체/일부 적용 → undo. AI는 기존 action 파이프라인 위에서만 동작한다.

async function createSample(page: Page): Promise<string> {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

const aiDialog = (page: Page) => page.getByRole("dialog", { name: "AI 도우미" });

async function requestProposal(page: Page, instruction: string) {
  await page.getByRole("button", { name: "AI 도우미" }).click();
  await aiDialog(page).getByLabel("AI 요청").fill(instruction);
  await aiDialog(page).locator("[data-ai-request]").click();
}

const EXAMPLE = "첫 화면을 더 미니멀하게 하고 갤러리를 따뜻한 필름 느낌으로 바꿔줘.";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
});

test("검토 → 일부 적용 → undo: 제안은 바로 적용되지 않고, 적용은 undo 1스텝", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const canvas = page.locator("[data-invitation-root]").first();
  await expect(canvas).toHaveAttribute("data-canvas-theme", "warm-editorial");
  // asset 라이브러리 로딩 후 hero 전면 사진이 나타난다
  const heroSection = canvas.locator("section").first();
  await expect(heroSection.locator("img").first()).toBeVisible();
  const heroTagline = heroSection.getByText("THE MARRIAGE OF");
  await expect(heroTagline).toBeVisible();

  await requestProposal(page, EXAMPLE);

  // 변경 예정 목록: hero 태그라인·여백, 갤러리 레이아웃, 테마 — 전후 비교 표기
  const changes = aiDialog(page).locator("[data-ai-change]");
  await expect(changes).toHaveCount(4);
  await expect(changes.nth(0)).toContainText("메인 — 태그라인 수정");
  await expect(changes.nth(0)).toContainText("THE MARRIAGE OF");
  await expect(changes.nth(1)).toContainText("상하 여백 변경");
  await expect(changes.nth(2)).toContainText("갤러리 — 레이아웃 변경");
  await expect(changes.nth(3)).toContainText("테마 변경");
  await expect(changes.nth(3)).toContainText("필름 다이어리");

  // 제안 단계에서는 문서가 그대로다 (검토 전 적용 금지)
  await expect(canvas).toHaveAttribute("data-canvas-theme", "warm-editorial");

  // 일부 적용: 테마 변경만 체크 해제 → 3개 적용
  await aiDialog(page).getByRole("checkbox", { name: "테마 변경 적용" }).uncheck();
  await expect(aiDialog(page).locator("[data-ai-apply]")).toContainText("선택한 3개 적용");
  await aiDialog(page).locator("[data-ai-apply]").click();
  await expect(aiDialog(page).locator("[data-ai-applied]")).toContainText(
    "3개 변경을 적용했습니다",
  );
  await aiDialog(page).getByRole("button", { name: "닫기" }).first().click();

  // 적용 결과: hero 태그라인이 비었고, 테마는 그대로
  await expect(canvas).toHaveAttribute("data-canvas-theme", "warm-editorial");
  await expect(heroTagline).toHaveCount(0);

  // undo 1번으로 전체(batch)가 되돌아간다
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(heroTagline).toBeVisible();
});

test("전체 적용 + 미리보기(변경 전후) + 취소", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const canvas = page.locator("[data-invitation-root]").first();

  // 취소: 제안을 받았다가 취소하면 문서가 그대로다
  await requestProposal(page, EXAMPLE);
  await expect(aiDialog(page).locator("[data-ai-change]")).toHaveCount(4);
  await aiDialog(page).locator("[data-ai-cancel]").click();
  await expect(aiDialog(page).locator("[data-ai-change]")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-canvas-theme", "warm-editorial");

  // 같은 요청을 다시 받아 미리보기 확인 후 전체 적용
  await aiDialog(page).getByLabel("AI 요청").fill(EXAMPLE);
  await aiDialog(page).locator("[data-ai-request]").click();
  await aiDialog(page).locator("[data-ai-preview-toggle]").click();
  const previewRoot = aiDialog(page).locator("[data-ai-preview] [data-invitation-root]");
  // 변경 후: 테마가 필름 다이어리로 보인다 / 변경 전: 현재 테마
  await expect(previewRoot).toHaveAttribute("data-canvas-theme", "film-diary");
  await aiDialog(page).getByRole("button", { name: "변경 전" }).click();
  await expect(previewRoot).toHaveAttribute("data-canvas-theme", "warm-editorial");

  await expect(aiDialog(page).locator("[data-ai-apply]")).toContainText("전체 적용 (4개)");
  await aiDialog(page).locator("[data-ai-apply]").click();
  await aiDialog(page).getByRole("button", { name: "닫기" }).first().click();
  await expect(canvas).toHaveAttribute("data-canvas-theme", "film-diary");
});

test("오류 처리: malformed 응답과 과도한 action 수는 서버 검증이 거부한다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  await requestProposal(page, "깨진 응답을 만들어줘");
  await expect(aiDialog(page).getByRole("alert")).toContainText("검증을 통과하지 못했습니다");

  // 오류 후에도 패널은 계속 사용 가능
  await aiDialog(page).getByLabel("AI 요청").fill("과도한 제안을 만들어줘");
  await aiDialog(page).locator("[data-ai-request]").click();
  await expect(aiDialog(page).getByRole("alert")).toContainText("검증을 통과하지 못했습니다");

  // 해당 없는 요청 → 빈 제안 안내
  await aiDialog(page).getByLabel("AI 요청").fill("전혀 관련 없는 요청입니다");
  await aiDialog(page).locator("[data-ai-request]").click();
  await expect(aiDialog(page).getByText("적용할 변경이 없습니다")).toBeVisible();
});

test("scope 검증: 남의(없는) 프로젝트를 대상으로 한 요청은 404로 거부된다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  const doc = createSampleDocument();
  const foreignProjectId = crypto.randomUUID(); // 실재하지 않는(=남의 것과 구분 없는) 프로젝트
  const foreign = await page.request.post("/api/ai/propose", {
    data: { projectId: foreignProjectId, instruction: "테마 바꿔줘", doc, assets: [] },
  });
  expect(foreign.status()).toBe(404);

  // 요청 형식 위반(빈 문구·잘못된 문서)은 400
  const badDoc = await page.request.post("/api/ai/propose", {
    data: { projectId: crypto.randomUUID(), instruction: "x", doc: {}, assets: [] },
  });
  expect(badDoc.status()).toBe(400);
});
