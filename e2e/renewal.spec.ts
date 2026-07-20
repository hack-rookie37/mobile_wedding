import { expect, test, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// 벤치마크 리뉴얼 2차 — 전면 사진 통일·pt 직접 입력·커스텀 폰트·애니메이션 미리보기.
// 각 항목은 "편집기에서 고른 것이 미리보기에 실제로 나타나는가"를 본다.

const inspector = (page: Page) => page.locator("aside").last();
const canvas = (page: Page) => page.locator("[data-invitation-root]").first();

async function createSample(page: Page) {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(canvas(page)).toBeVisible();
}

async function selectSection(page: Page, name: string, tab: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await inspector(page).getByRole("button", { name: tab, exact: true }).click();
}

const heroSection = (page: Page) => canvas(page).locator("section").first();

test("메인: 상하 여백을 바꿔도 전면 사진 위에 빈 공간이 생기지 않는다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await expect(heroSection(page).locator("img").first()).toBeVisible();

  const paddingTop = () => heroSection(page).evaluate((el) => getComputedStyle(el).paddingTop);
  expect(await paddingTop()).toBe("0px");

  // 상하 여백을 셋 다 눌러도 위쪽은 계속 0 — 사진은 항상 캔버스 맨 위에 붙는다
  await selectSection(page, "메인", "스타일");
  for (const label of ["좁게", "넓게", "보통"]) {
    await inspector(page).getByRole("button", { name: label, exact: true }).click();
    await expect.poll(paddingTop).toBe("0px");
    // 아래쪽 여백은 정상적으로 적용된다
    expect(
      await heroSection(page).evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
    ).toBeGreaterThan(0);
  }
});

test("메인: 레이아웃 탭이 전면 사진 효과(페이드·반짝임·밝기·투명도)를 다룬다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await selectSection(page, "메인", "레이아웃");

  // 레이아웃 선택지는 없다 — 전면 사진 하나뿐
  await expect(inspector(page).getByRole("button", { name: "아치 사진" })).toHaveCount(0);

  const photoBox = heroSection(page).locator("[data-photo-stage]");
  await inspector(page).getByLabel("반짝임").check();
  await expect(photoBox.locator("[data-sparkle]")).toBeVisible();

  await inspector(page).getByLabel("밝기", { exact: true }).fill("60");
  await inspector(page).getByLabel("투명도", { exact: true }).fill("50");
  await expect
    .poll(() => photoBox.evaluate((el) => getComputedStyle(el).filter))
    .toContain("brightness(0.6)");
  await expect.poll(() => photoBox.evaluate((el) => getComputedStyle(el).opacity)).toBe("0.5");

  await inspector(page).getByLabel("하단 페이드아웃").uncheck();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
});

test("갤러리: 필름 레이아웃이 없고, 사진 세로 길이는 레이아웃 탭에 있다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  // 내용 탭에는 더 이상 세로 길이가 없다
  await selectSection(page, "갤러리", "내용");
  await expect(inspector(page).getByText("사진 세로 길이")).toHaveCount(0);

  await selectSection(page, "갤러리", "레이아웃");
  await expect(inspector(page).getByRole("button", { name: "필름", exact: true })).toHaveCount(0);
  // 격자형에서는 세로 길이를 고를 수 없다는 안내가 뜬다
  await expect(inspector(page).getByText(/대형 스트립·슬라이더에서만/)).toBeVisible();

  await inspector(page).getByRole("button", { name: "대형 스트립", exact: true }).click();
  await inspector(page).getByRole("button", { name: "9:16", exact: true }).click();
  const firstPhoto = canvas(page).locator("figure").first().locator("> div > div");
  await expect
    .poll(() => firstPhoto.evaluate((el) => getComputedStyle(el).aspectRatio))
    .toBe("9 / 16");
});

test("오시는 길: 약도 이미지는 제목 바로 아래에 온다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await selectSection(page, "오시는 길", "내용");
  await inspector(page).getByRole("button", { name: "사진 선택" }).click();
  await page
    .getByRole("dialog", { name: "사진 보관함" })
    .getByRole("button", { name: "샘플 갤러리 2 선택" })
    .click();
  await page
    .getByRole("dialog", { name: "사진 보관함" })
    .getByRole("button", { name: "이 약도로 사용" })
    .click();
  await expect(inspector(page).getByAltText("약도 이미지 미리보기")).toBeVisible();

  const venue = canvas(page).locator('section:has-text("오시는 길")').last();
  const map = venue.getByAltText("예식장 약도");
  await expect(map).toBeVisible();
  // 제목보다 아래, 주소보다 위
  const [titleBottom, mapTop, addressTop] = await Promise.all([
    venue
      .getByText("오시는 길")
      .first()
      .evaluate((el) => el.getBoundingClientRect().bottom),
    map.evaluate((el) => el.getBoundingClientRect().top),
    venue
      .getByText("서울 영등포구 여의대방로 259")
      .evaluate((el) => el.getBoundingClientRect().top),
  ]);
  expect(mapTop).toBeGreaterThan(titleBottom);
  expect(mapTop).toBeLessThan(addressTop);
});

test("글자 크기: pt를 직접 입력하면 전체·섹션별로 반영된다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  const canvasFs = () =>
    canvas(page).evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--canvas-fs")));
  const base = await canvasFs();

  await page.getByRole("button", { name: "테마", exact: true }).click();
  await inspector(page).getByLabel("전체 글자 크기", { exact: true }).fill("16");
  await inspector(page).getByLabel("전체 글자 크기", { exact: true }).blur();
  await expect.poll(canvasFs).toBeGreaterThan(base);

  // 섹션별 override는 그 섹션 안에서만 다시 정의된다
  await selectSection(page, "인사말", "스타일");
  await inspector(page).getByLabel("글자 크기 (이 섹션만)", { exact: true }).fill("8");
  await inspector(page).getByLabel("글자 크기 (이 섹션만)", { exact: true }).blur();
  const greeting = canvas(page).locator('section:has-text("소중한 분들을 초대합니다")').last();
  await expect
    .poll(() =>
      greeting.evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--canvas-fs"))),
    )
    .toBeLessThan(await canvasFs());
});

test("커스텀 폰트: 업로드하면 선택지에 뜨고 @font-face가 주입된다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();

  // 폰트 파일의 내용은 렌더러가 해석하지 않는다 — 참조 배선과 @font-face 주입만 검증한다
  await inspector(page)
    .locator("[data-font-upload]")
    .setInputFiles({
      name: "my-wedding-font.woff2",
      mimeType: "font/woff2",
      buffer: Buffer.from("wOF2fake-font-bytes-for-e2e"),
    });
  await expect(
    inspector(page).getByRole("listitem").filter({ hasText: "my-wedding-font.woff2" }),
  ).toBeVisible();

  await inspector(page)
    .getByLabel("제목·이름 폰트")
    .selectOption({ label: "my-wedding-font.woff2" });
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  const fontFace = await canvas(page).evaluate(
    (el) => el.querySelector("style")?.textContent ?? "",
  );
  expect(fontFace).toContain("@font-face");
  expect(fontFace).toMatch(/font-family:"cf-[\w-]+"/);

  // 사용 중인 폰트는 지울 수 없다
  await expect(inspector(page).getByRole("button", { name: "사용 중" })).toBeDisabled();
});

test("진입 애니메이션: 옵션을 고르면 미리보기에서 그 자리에서 재생된다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await selectSection(page, "인사말", "스타일");

  const greetingBody = canvas(page)
    .locator('section:has-text("소중한 분들을 초대합니다")')
    .last()
    .locator("[data-section-body]");
  await expect(greetingBody).toBeVisible();

  // 클릭 직후의 한 프레임을 놓치지 않도록 style 변화를 관찰해 둔다
  await greetingBody.evaluate((el) => {
    (window as unknown as { sawHidden: boolean }).sawHidden = false;
    new MutationObserver(() => {
      if ((el as HTMLElement).style.opacity === "0") {
        (window as unknown as { sawHidden: boolean }).sawHidden = true;
      }
    }).observe(el, { attributes: true, attributeFilter: ["style"] });
  });

  await inspector(page).getByRole("button", { name: "페이드", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { sawHidden: boolean }).sawHidden))
    .toBe(true);
  // 재생이 끝나면 다시 보인다
  await expect.poll(() => greetingBody.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

test("맺음말: 전면 사진 레이아웃과 밝기·투명도 조절", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await selectSection(page, "맺음말", "레이아웃");
  await expect(
    inspector(page).getByRole("button", { name: "전면 사진", exact: true }),
  ).toBeVisible();

  await inspector(page).getByLabel("밝기", { exact: true }).fill("70");
  const closing = canvas(page).locator("section").last();
  const photoBox = closing.locator("[data-photo-stage]");
  await expect
    .poll(() => photoBox.evaluate((el) => getComputedStyle(el).filter))
    .toContain("brightness(0.7)");

  // 사진은 캔버스 가로를 꽉 채운다 (좌우 여백 없음)
  const [photoWidth, canvasWidth] = await Promise.all([
    photoBox.evaluate((el) => el.getBoundingClientRect().width),
    canvas(page).evaluate((el) => el.getBoundingClientRect().width),
  ]);
  expect(photoWidth).toBeCloseTo(canvasWidth, 0);
});
