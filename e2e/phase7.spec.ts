import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// Phase 7 — private preview 토큰 + 발행 수명주기 + 공개 페이지

async function createSample(page: Page): Promise<string> {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function editGreetingTitle(page: Page, text: string) {
  await page.getByRole("button", { name: "인사말", exact: true }).click();
  await page.getByLabel("제목").fill(text);
  await expect(page.locator("[data-invitation-root]").getByText(text)).toBeVisible();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
}

const publishDialog = (page: Page) => page.getByRole("dialog", { name: "공유·발행" });

async function openPublishPanel(page: Page) {
  await page.getByRole("button", { name: "공유·발행" }).click();
  await expect(publishDialog(page)).toBeVisible();
}

async function closePublishPanel(page: Page) {
  await publishDialog(page).getByRole("button", { name: "닫기" }).click();
}

async function newAnonPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  return { context, page };
}

function uniqueSlug(): string {
  return `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
});

test("private preview: 생성 → 초안 실시간 반영 → 재생성(이전 무효) → 폐기, noindex", async ({
  page,
  browser,
}) => {
  await signUpFresh(page);
  await createSample(page);
  await editGreetingTitle(page, "미리보기 첫 문구");

  // 링크 생성 (만료 없음)
  await openPublishPanel(page);
  await publishDialog(page).getByRole("button", { name: "미리보기 링크 만들기" }).click();
  const previewUrl = await publishDialog(page).locator("[data-preview-url]").innerText();
  expect(previewUrl).toMatch(/\/p\/.{24,}/);
  await closePublishPanel(page);

  // 인증 없는 컨텍스트에서 접근 성공 + 미리보기 배지 + noindex + 동일 renderer
  const { context: anonContext, page: anonPage } = await newAnonPage(browser);
  await anonPage.goto(previewUrl);
  await expect(anonPage.getByText("비공개 미리보기 — 이 링크가 있는 사람만")).toBeVisible();
  await expect(anonPage.getByText("미리보기 첫 문구")).toBeVisible();
  await expect(anonPage.locator("[data-invitation-root]")).toHaveAttribute(
    "data-canvas-theme",
    "warm-editorial",
  );
  await expect(anonPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // 미리보기는 현재 초안 — 소유자 수정이 새로고침에 반영된다
  await editGreetingTitle(page, "미리보기 수정 문구");
  await anonPage.reload();
  await expect(anonPage.getByText("미리보기 수정 문구")).toBeVisible();

  // 재생성 → 이전 토큰 즉시 무효, 새 토큰 유효
  await openPublishPanel(page);
  await publishDialog(page).getByRole("button", { name: "링크 재생성" }).click();
  await expect(publishDialog(page).locator("[data-preview-url]")).not.toHaveText(previewUrl);
  const regeneratedUrl = await publishDialog(page).locator("[data-preview-url]").innerText();
  await anonPage.goto(previewUrl);
  await expect(anonPage.getByText("미리보기 링크가 유효하지 않습니다")).toBeVisible();
  await anonPage.goto(regeneratedUrl);
  await expect(anonPage.getByText("미리보기 수정 문구")).toBeVisible();

  // 폐기 → 접근 거부. 무작위 토큰도 거부
  await publishDialog(page).getByRole("button", { name: "링크 폐기" }).click();
  await expect(
    publishDialog(page).getByRole("button", { name: "미리보기 링크 만들기" }),
  ).toBeVisible();
  await anonPage.goto(regeneratedUrl);
  await expect(anonPage.getByText("미리보기 링크가 유효하지 않습니다")).toBeVisible();
  await anonPage.goto("/p/this-token-does-not-exist-at-all-123");
  await expect(anonPage.getByText("미리보기 링크가 유효하지 않습니다")).toBeVisible();
  await anonContext.close();
});

test("발행 수명주기: slug 검증 → publish → draft 수정 미반영 → republish 반영 → unpublish", async ({
  page,
  browser,
}) => {
  await signUpFresh(page);
  const projectId = await createSample(page);
  await editGreetingTitle(page, "처음 발행될 문구");

  // draft 상태에서는 공개 접근 실패 (발행 전)
  const { context: anonContext, page: anonPage } = await newAnonPage(browser);
  await anonPage.goto(`/i/no-such-slug-${Date.now()}`);
  await expect(anonPage.getByText("청첩장을 찾을 수 없습니다")).toBeVisible();

  // slug 형식 검증 — 유효하지 않으면 이유 표시 + 발행 비활성
  await openPublishPanel(page);
  const slugInput = publishDialog(page).getByLabel("공개 주소");
  await slugInput.fill("잘못된 주소!");
  await expect(publishDialog(page).getByText(/영문 소문자/)).toBeVisible();
  await expect(publishDialog(page).getByRole("button", { name: "발행하기" })).toBeDisabled();

  // 유효한 slug로 발행
  const slug = uniqueSlug();
  await slugInput.fill(slug);
  await publishDialog(page).getByRole("button", { name: "발행하기" }).click();
  await expect(publishDialog(page).getByText("발행됨")).toBeVisible();
  await expect(publishDialog(page).getByText(/발행 revision \d+/)).toBeVisible();
  await closePublishPanel(page);

  await anonPage.goto(`/i/${slug}`);
  await expect(anonPage.getByText("처음 발행될 문구")).toBeVisible();
  await expect(anonPage.locator("[data-invitation-root]")).toHaveAttribute(
    "data-canvas-theme",
    "warm-editorial",
  );

  // draft 수정 → 공개본은 자동으로 바뀌지 않는다
  await editGreetingTitle(page, "재발행 후에만 보일 문구");
  await anonPage.reload();
  await expect(anonPage.getByText("처음 발행될 문구")).toBeVisible();
  await expect(anonPage.getByText("재발행 후에만 보일 문구")).toHaveCount(0);

  // 패널이 '재발행 필요'를 안내한다
  await openPublishPanel(page);
  await expect(publishDialog(page).getByText(/재발행해야 공개본에 반영됩니다/)).toBeVisible();

  // republish → 반영
  await publishDialog(page).getByRole("button", { name: "재발행하기" }).click();
  await expect(publishDialog(page).getByText(/재발행해야 공개본에 반영됩니다/)).toHaveCount(0);
  await anonPage.reload();
  await expect(anonPage.getByText("재발행 후에만 보일 문구")).toBeVisible();

  // unpublish → 공개 접근 실패, draft·미리보기 경로는 여전히 보호
  await publishDialog(page).getByRole("button", { name: "발행 중단" }).click();
  await expect(publishDialog(page).getByText("발행 중단됨")).toBeVisible();
  await anonPage.reload();
  await expect(anonPage.getByText("청첩장을 찾을 수 없습니다")).toBeVisible();
  await anonPage.goto(`/preview/${projectId}`);
  await anonPage.waitForURL(/\/login/);

  // 다시 발행 → 접근 복구
  await publishDialog(page).getByRole("button", { name: "발행하기" }).click();
  await expect(publishDialog(page).getByText("발행됨")).toBeVisible();
  await anonPage.goto(`/i/${slug}`);
  await expect(anonPage.getByText("재발행 후에만 보일 문구")).toBeVisible();
  await anonContext.close();
});

test("slug 중복: 다른 사용자의 동일 slug 발행은 거부된다", async ({ page, browser }) => {
  await signUpFresh(page);
  await createSample(page);
  const slug = uniqueSlug();
  await openPublishPanel(page);
  await publishDialog(page).getByLabel("공개 주소").fill(slug);
  await publishDialog(page).getByRole("button", { name: "발행하기" }).click();
  await expect(publishDialog(page).getByText("발행됨")).toBeVisible();

  // 두 번째 사용자
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.setViewportSize({ width: 1440, height: 960 });
  await signUpFresh(page2);
  await createSample(page2);
  await openPublishPanel(page2);
  await publishDialog(page2).getByLabel("공개 주소").fill(slug);
  await publishDialog(page2).getByRole("button", { name: "발행하기" }).click();
  await expect(publishDialog(page2).getByText("이미 사용 중인 주소입니다")).toBeVisible();
  await context2.close();
});

test("공개 응답에 private 데이터가 없고, social metadata·공유(복사 fallback)가 동작한다", async ({
  page,
  browser,
}) => {
  await signUpFresh(page);
  await createSample(page);
  await editGreetingTitle(page, "공개용 문구");

  // 비밀 정보가 될 수 있는 것들: checkpoint 라벨, 미리보기 토큰
  await page.getByRole("button", { name: "기록" }).click();
  const revisionPanel = page.getByRole("dialog", { name: "편집 기록" });
  await revisionPanel.getByLabel("체크포인트 이름").fill("비밀 체크포인트 라벨");
  await revisionPanel.getByRole("button", { name: "체크포인트 만들기" }).click();
  await expect(
    revisionPanel.locator("[data-revision-row]", { hasText: "비밀 체크포인트 라벨" }),
  ).toBeVisible();
  await revisionPanel.getByRole("button", { name: "닫기" }).click();

  await openPublishPanel(page);
  await publishDialog(page).getByRole("button", { name: "미리보기 링크 만들기" }).click();
  const previewUrl = await publishDialog(page).locator("[data-preview-url]").innerText();
  const previewToken = previewUrl.split("/p/")[1];
  const slug = uniqueSlug();
  await publishDialog(page).getByLabel("공개 주소").fill(slug);
  await publishDialog(page).getByRole("button", { name: "발행하기" }).click();
  await expect(publishDialog(page).getByText("발행됨")).toBeVisible();

  // 익명 접근: HTML 전체에 private 데이터가 없어야 한다
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const anonPage = await context.newPage();
  // Web Share API를 제거해 데스크톱 클립보드 fallback 경로를 결정적으로 검증
  await anonPage.addInitScript(() => {
    // @ts-expect-error 테스트 전용
    delete Navigator.prototype.share;
  });
  await anonPage.setViewportSize({ width: 390, height: 844 });
  await anonPage.goto(`/i/${slug}`);
  await expect(anonPage.getByText("공개용 문구")).toBeVisible();

  const html = await anonPage.content();
  expect(html).not.toContain("비밀 체크포인트 라벨"); // revision history 미노출
  expect(html).not.toContain(previewToken); // preview token 미노출
  expect(html).not.toContain("doc_rev"); // editor/저장 내부 상태 미노출
  expect(html).not.toContain('"storage_path"'); // 내부 storage key 미노출

  // social metadata + noindex
  await expect(anonPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(anonPage.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "이정훈♥양은진 결혼합니다",
  );
  await expect(anonPage.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    /2026년 9월 19일/,
  );

  // 공유: Web Share 미지원 → 링크 복사 fallback
  await anonPage.getByRole("button", { name: "청첩장 공유하기" }).click();
  await expect(anonPage.getByText("링크가 복사되었습니다")).toBeVisible();
  const clipboard = await anonPage.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(`/i/${slug}`);
  await context.close();
});

test("공개 페이지 스크린샷: 360/390/430 + 데스크톱 중앙 정렬", async ({ page, browser }) => {
  await signUpFresh(page);
  await createSample(page);
  await editGreetingTitle(page, "스크린샷 검증 문구");
  await openPublishPanel(page);
  const slug = uniqueSlug();
  await publishDialog(page).getByLabel("공개 주소").fill(slug);
  await publishDialog(page).getByRole("button", { name: "발행하기" }).click();
  await expect(publishDialog(page).getByText("발행됨")).toBeVisible();

  const context = await browser.newContext();
  const anonPage = await context.newPage();
  await anonPage.emulateMedia({ reducedMotion: "reduce" });

  for (const width of [360, 390, 430]) {
    await anonPage.setViewportSize({ width, height: 844 });
    await anonPage.goto(`/i/${slug}`);
    await expect(anonPage.getByText("스크린샷 검증 문구")).toBeVisible();
    // reduced motion: 뷰포트 밖 섹션도 즉시 완전 표시된 뒤에 촬영 (SSR hydration 포함 검증)
    await expect(anonPage.locator("[data-section-id] > [data-section-body]").last()).toHaveCSS(
      "opacity",
      "1",
    );
    await anonPage.screenshot({
      path: `screenshots/publish/public-${width}.png`,
      fullPage: true,
    });
  }

  // 데스크톱: 컨텐츠 컬럼(최대 430px)이 중앙 정렬된다
  await anonPage.setViewportSize({ width: 1440, height: 900 });
  await anonPage.goto(`/i/${slug}`);
  const column = anonPage.locator("main > div");
  const box = (await column.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(430);
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(4); // 화면 중앙
  await anonPage.screenshot({ path: "screenshots/publish/public-desktop-1440.png" });
  await context.close();
});
