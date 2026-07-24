import { expect, test, type Page } from "@playwright/test";
import { signIn, signUpFresh } from "./helpers/auth";

// Phase 6 — 인증·영속화·자동 저장·revision·발행 검증 (로컬 Supabase 스택 필요)

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
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
});

test("인증: 보호 경로는 로그인으로 보내고, 가입·로그아웃·재로그인이 동작한다", async ({ page }) => {
  // 세션 없이 보호 경로 접근 → /login
  await page.goto("/edit");
  await page.waitForURL(/\/login/);
  await page.goto("/editor/anything");
  await page.waitForURL(/\/login/);

  // 도메인 루트는 하객이 받는 주소다 — 세션 없이도 로그인으로 튕기지 않아야 한다
  await page.goto("/");
  await expect(page).toHaveURL(/localhost:3100\/$/);

  // 하객이 받는 일정 파일도 같은 이유로 공개다. 발행 여부와 무관하게 로그인으로만 안 튕기면 된다
  const ics = await page.request.get("/wedding.ics");
  expect(new URL(ics.url()).pathname).toBe("/wedding.ics");

  const user = await signUpFresh(page);

  // 로그인 상태에서 /login 접근 → 대시보드로
  await page.goto("/login");
  await page.waitForURL((url) => url.pathname === "/edit");

  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL(/\/login/);

  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "내 청첩장" })).toBeVisible();
});

test("프로젝트: 생성·이름 변경·복제·보관·삭제와 마지막 수정 시간", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.goto("/edit");

  const row = page.locator("[data-project-row]");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("수정"); // 마지막 수정 시간 표기

  // RSVP 응답은 편집기를 거치지 않고 목록에서 바로 간다
  await expect(row.getByRole("link", { name: "RSVP 응답" })).toHaveAttribute(
    "href",
    /\/editor\/.+\/rsvp$/,
  );

  // 이름 변경 — 자주 안 쓰는 동작은 ⋯ 메뉴 안에 접혀 있다
  await row.getByRole("button", { name: "프로젝트 메뉴" }).click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  await page.getByLabel("프로젝트 이름").fill("우리 결혼식 v2");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("우리 결혼식 v2")).toBeVisible();

  // 복제 → '사본' 행 추가
  await row
    .filter({ hasText: "우리 결혼식 v2" })
    .getByRole("button", { name: "프로젝트 메뉴" })
    .click();
  await page.getByRole("menuitem", { name: "복제" }).click();
  await expect(page.locator("[data-project-row]")).toHaveCount(2);
  await expect(page.getByText("우리 결혼식 v2 사본")).toBeVisible();

  // 보관 → 보관함 섹션으로 이동, 편집·RSVP 링크 없음
  const copyRow = page.locator("[data-project-row]", { hasText: "사본" });
  await copyRow.getByRole("button", { name: "프로젝트 메뉴" }).click();
  await page.getByRole("menuitem", { name: "보관", exact: true }).click();
  await expect(page.getByRole("heading", { name: "보관함" })).toBeVisible();
  await expect(copyRow.getByText("보관됨")).toBeVisible();
  await expect(copyRow.getByRole("link", { name: "편집" })).toHaveCount(0);
  await expect(copyRow.getByRole("link", { name: "RSVP 응답" })).toHaveCount(0);

  // 보관 해제
  await copyRow.getByRole("button", { name: "프로젝트 메뉴" }).click();
  await page.getByRole("menuitem", { name: "보관 해제" }).click();
  await expect(page.getByRole("heading", { name: "보관함" })).toHaveCount(0);

  // 삭제 — 프로젝트 이름을 그대로 입력해야 실행된다
  await copyRow.getByRole("button", { name: "프로젝트 메뉴" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(copyRow.getByText("사진·응답·기록까지 모두 삭제됩니다.")).toBeVisible();
  const confirmDelete = copyRow.getByRole("button", { name: "영구 삭제" });
  await expect(confirmDelete).toBeDisabled();
  await copyRow.getByLabel("삭제할 프로젝트 이름").fill("다른 이름");
  await expect(confirmDelete).toBeDisabled();
  await copyRow.getByLabel("삭제할 프로젝트 이름").fill("우리 결혼식 v2 사본");
  await confirmDelete.click();
  await expect(page.locator("[data-project-row]")).toHaveCount(1);
});

test("자동 저장: 편집 → 저장됨 → 새로고침 후 유지, 떠나기 전 경고", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  await editGreetingTitle(page, "서버에 저장되는 제목");
  await expect(page.getByText("저장 중…")).toBeVisible();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(
    page.locator("[data-invitation-root]").getByText("서버에 저장되는 제목"),
  ).toBeVisible();

  // 저장되지 않은 변경이 있으면 beforeunload 경고가 뜬다
  await editGreetingTitle(page, "아직 저장 안 된 제목");
  const dialogPromise = page.waitForEvent("dialog");
  const closePromise = page.close({ runBeforeUnload: true });
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.accept();
  await closePromise;
});

test("두 탭 동시 편집: 늦게 저장한 탭이 충돌을 감지하고 최신 상태를 불러온다", async ({
  page,
  context,
}) => {
  await signUpFresh(page);
  const projectId = await createSample(page);

  // 두 번째 탭(같은 세션)
  const tab2 = await context.newPage();
  await tab2.setViewportSize({ width: 1440, height: 960 });
  await tab2.goto(`/editor/${projectId}`);
  await expect(tab2.locator("[data-invitation-root]")).toBeVisible();

  // 탭1 저장 (rev 상승)
  await editGreetingTitle(page, "탭1의 제목");
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  // 탭2는 stale rev로 저장 시도 → 충돌
  await editGreetingTitle(tab2, "탭2의 제목");
  await expect(tab2.getByText("다른 탭에서 수정됨")).toBeVisible({ timeout: 5000 });
  await expect(tab2.getByText("다른 탭에서 이 청첩장이 수정되었습니다.")).toBeVisible();

  // 탭1의 내용은 덮어써지지 않았다
  await page.reload();
  await expect(page.locator("[data-invitation-root]").getByText("탭1의 제목")).toBeVisible();

  // 최신 상태 불러오기 → 충돌 해제 + 탭1 내용 반영, 이후 편집은 정상 저장
  await tab2.getByRole("button", { name: "최신 상태 불러오기" }).click();
  await expect(tab2.locator("[data-invitation-root]").getByText("탭1의 제목")).toBeVisible();
  await expect(tab2.getByText("저장됨")).toBeVisible();
  await editGreetingTitle(tab2, "충돌 해소 후 제목");
  await expect(tab2.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  await tab2.close();
});

test("revision: checkpoint 생성 → 복원 → 복원 자체가 새 기록으로 남는다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  await editGreetingTitle(page, "확정 전 문구");
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  // checkpoint 생성
  await page.getByRole("button", { name: "기록" }).click();
  const panel = page.getByRole("dialog", { name: "편집 기록" });
  await panel.getByLabel("체크포인트 이름").fill("문구 확정본");
  await panel.getByRole("button", { name: "체크포인트 만들기" }).click();
  await expect(panel.locator("[data-revision-row]", { hasText: "문구 확정본" })).toBeVisible();
  await panel.getByRole("button", { name: "닫기" }).click();

  // 추가 편집 후 저장
  await editGreetingTitle(page, "실수로 바꾼 문구");
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  // checkpoint로 복원
  await page.getByRole("button", { name: "기록" }).click();
  const checkpointRow = panel.locator("[data-revision-row]", { hasText: "문구 확정본" });
  await checkpointRow.getByRole("button", { name: "복원" }).click();
  await expect(panel.getByText("이 상태로 되돌릴까요?")).toBeVisible();
  await checkpointRow.getByRole("button", { name: "복원" }).last().click();

  // 복원이 새 revision으로 남는다 (파괴적이지 않음 — 원래 checkpoint도 그대로)
  await expect(
    panel.locator("[data-revision-row]", { hasText: "‘문구 확정본’ 복원" }),
  ).toBeVisible();
  await expect(checkpointRow).toHaveCount(2); // checkpoint + 복원 기록(라벨에 같은 문구 포함)
  await panel.getByRole("button", { name: "닫기" }).click();

  await expect(page.locator("[data-invitation-root]").getByText("확정 전 문구")).toBeVisible();
  await expect(page.getByText("저장됨")).toBeVisible();

  // 새로고침해도 복원된 상태
  await page.reload();
  await expect(page.locator("[data-invitation-root]").getByText("확정 전 문구")).toBeVisible();
});

test("발행: /i/[slug]는 인증 없이 접근되고 draft 경로는 계속 보호된다", async ({
  page,
  browser,
}) => {
  await signUpFresh(page);
  const projectId = await createSample(page);

  await editGreetingTitle(page, "발행될 문구");
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: "공유·발행" }).click();
  const panel = page.getByRole("dialog", { name: "공유·발행" });
  // 공개 주소를 적으면 /i/<slug>로 간다. 비웠을 때의 도메인 발행은 root.spec.ts가 본다
  await panel.getByLabel(/공개 주소/).fill(`e2e6-${Date.now().toString(36)}`);
  await panel.getByRole("button", { name: "발행하기" }).click();
  const publicLink = panel.getByRole("link", { name: "발행된 페이지 열기" });
  await expect(publicLink).toBeVisible({ timeout: 10000 });
  const publicUrl = await publicLink.getAttribute("href");
  const publicPath = new URL(publicUrl!).pathname;
  expect(publicPath).toMatch(/^\/i\//);

  // 완전히 새로운(로그인 안 한) 브라우저 컨텍스트에서 공개 페이지 접근
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.setViewportSize({ width: 390, height: 844 });
  await anonPage.goto(publicPath!);
  await expect(anonPage.locator("[data-invitation-root]")).toBeVisible();
  await expect(anonPage.getByText("발행될 문구")).toBeVisible();

  // public/의 정적 파일은 하객에게도 그대로 와야 한다. 미들웨어가 이걸 로그인으로
  // 돌려보내면 <img>가 이미지 대신 HTML을 받아 깨진 이미지가 된다 — 실제로 지도 앱
  // 아이콘(당시 PNG)이 그렇게 깨졌고, 편집기(로그인 상태)에서는 멀쩡해서 늦게 발견됐다.
  // 지금 지도 아이콘은 인라인 SVG지만(ADR-043), 기본 사진 등 public/ 자원은 여전히 있다.
  const staticAsset = await anonPage.request.get("/samples/gallery-01.svg");
  expect(staticAsset.status(), "public 정적 자원").toBe(200);
  expect(staticAsset.headers()["content-type"]).toContain("image/");

  // 같은 anon 컨텍스트에서 private 경로는 로그인으로 리다이렉트
  await anonPage.goto(`/preview/${projectId}`);
  await anonPage.waitForURL(/\/login/);
  await anonPage.goto(`/editor/${projectId}`);
  await anonPage.waitForURL(/\/login/);
  await anonContext.close();
});
