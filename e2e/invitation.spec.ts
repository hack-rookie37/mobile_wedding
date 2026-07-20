import { expect, test } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// Phase 1 핵심 여정: 생성 → 편집 → undo → 자동 저장/복원 → 순서 변경 → 소유자 미리보기
test("첫 vertical slice 여정과 스크린샷", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });

  // 가입 후 대시보드에서 샘플 프로젝트 생성
  await signUpFresh(page);
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  const projectId = new URL(page.url()).pathname.split("/").pop()!;

  const preview = page.locator("[data-invitation-root]");
  await expect(preview.getByRole("heading", { name: /이정훈.*양은진/ })).toBeVisible();

  // Greeting 텍스트 편집 → 미리보기 즉시 반영
  await page.getByRole("button", { name: "인사말", exact: true }).click();
  const bodyField = page.getByLabel("본문");
  await expect(bodyField).toBeVisible();
  await bodyField.fill("저희 두 사람, 이제 한 길을 함께 걷습니다.");
  await expect(preview.getByText("저희 두 사람, 이제 한 길을 함께 걷습니다.")).toBeVisible();

  // undo → 원복, redo → 재적용
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(preview.getByText("저희 두 사람, 이제 한 길을 함께 걷습니다.")).toBeHidden();
  await expect(preview.getByText(/서로가 마주 보며/)).toBeVisible();
  await page.getByRole("button", { name: "다시 실행" }).click();
  await expect(preview.getByText("저희 두 사람, 이제 한 길을 함께 걷습니다.")).toBeVisible();

  // 기본 정보(전역 wedding 데이터) 편집 → Hero에 반영
  await page.getByRole("button", { name: "기본 정보" }).click();
  await page.getByLabel("이름", { exact: true }).first().fill("김도윤");
  await expect(preview.getByRole("heading", { name: /김도윤.*양은진/ })).toBeVisible();

  // 자동 저장(1.5s 디바운스) 후 새로고침 복원
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  await page.reload();
  await expect(preview.getByRole("heading", { name: /김도윤.*양은진/ })).toBeVisible();
  await expect(preview.getByText("저희 두 사람, 이제 한 길을 함께 걷습니다.")).toBeVisible();

  // 섹션 순서 변경: 갤러리를 인사말 위로 드래그 (top edge를 노려 상단 좌표로 드롭)
  const galleryRow = page.getByRole("button", { name: "갤러리", exact: true });
  const greetingRow = page.getByRole("button", { name: "인사말", exact: true });
  await galleryRow.dragTo(greetingRow, { targetPosition: { x: 60, y: 4 } });
  await expect
    .poll(async () => {
      const names = await page.locator("aside").first().locator("button").allTextContents();
      const joined = names.join(" ");
      return joined.indexOf("갤러리") < joined.indexOf("인사말");
    })
    .toBe(true);

  // 편집기 스크린샷 (1440×960)
  await page.screenshot({ path: "screenshots/editor-1440x960.png" });

  // public preview (390×844, 같은 renderer)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/preview/${projectId}`);
  await expect(page.getByRole("heading", { name: /김도윤.*양은진/ })).toBeVisible();
  await expect(page.getByText("공군호텔", { exact: true })).toBeVisible();
  await page.screenshot({ path: "screenshots/public-390x844.png" });
  await page.screenshot({ path: "screenshots/public-390-full.png", fullPage: true });

  // 일정 저장: 소유자 미리보기에서도 실제로 내려받힌다 (게스트 화면과 같은 동작이어야 한다).
  // 모바일에서 캘린더가 열리느냐는 Content-Type에 달려 있으므로 헤더까지 본다.
  const icsPath = `/preview/${projectId}/wedding.ics`;
  await expect(page.getByRole("link", { name: /일정 저장/ })).toHaveAttribute("href", icsPath);
  const ics = await page.request.get(icsPath);
  expect(ics.status()).toBe(200);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("BEGIN:VEVENT");
});

test("남의 초안 .ics는 내려받을 수 없다", async ({ page, browser }) => {
  await signUpFresh(page);
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  const projectId = page.url().split("/editor/")[1];

  // 다른 사용자 — RLS가 조회 자체를 막으므로 '없음'과 구분되지 않는 404가 나와야 한다
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUpFresh(otherPage);
  const res = await otherPage.request.get(`/preview/${projectId}/wedding.ics`);
  expect(res.status()).toBe(404);
  await other.close();
});

test("존재하지 않는 프로젝트는 명시적 안내를 보여준다", async ({ page }) => {
  await signUpFresh(page);
  await page.goto("/editor/does-not-exist");
  await expect(page.getByText("청첩장을 찾을 수 없습니다")).toBeVisible();
  await page.goto("/preview/does-not-exist");
  await expect(page.getByText("청첩장을 찾을 수 없습니다")).toBeVisible();
});
