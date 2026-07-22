import { expect, test, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";
import { makeTestPng } from "./helpers/png";

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

// 글꼴 편집기의 역할 탭 — 전역(테마 패널)과 섹션 '스타일' 탭이 같은 화면을 쓴다 (ADR-035)
async function pickRole(page: Page, role: string) {
  await inspector(page).getByRole("button", { name: role, exact: true }).click();
}

test("메인: 상하 여백을 바꿔도 전면 사진 위에 빈 공간이 생기지 않는다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await expect(heroSection(page).locator("img").first()).toBeVisible();

  const paddingTop = () => heroSection(page).evaluate((el) => getComputedStyle(el).paddingTop);
  expect(await paddingTop()).toBe("0px");

  // 상하 여백을 셋 다 눌러도 위쪽은 계속 0 — 사진은 항상 캔버스 맨 위에 붙는다
  await selectSection(page, "메인", "스타일");
  for (const label of ["좁게", "넓게", "보통"]) {
    // '보통'은 글꼴 편집기의 굵기에도 있다 — 위쪽(상하 여백)을 고른다
    await inspector(page).getByRole("button", { name: label, exact: true }).first().click();
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
  // 빛줄기 하나가 아니라 여러 별빛이 흩어져 깜빡인다
  expect(await photoBox.locator("[data-star]").count()).toBeGreaterThan(3);

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

test("갤러리: 사진 모서리와 간격을 직접 고르면 미리보기에 그대로 나타난다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await selectSection(page, "갤러리", "레이아웃");

  const photoBox = canvas(page).locator("figure").first().locator("> div > div");
  const grid = canvas(page).locator("[data-gallery-photos]").first();
  const gap = () => grid.evaluate((el) => getComputedStyle(el).gap);
  const radius = () => photoBox.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);

  // 기본값: 둥근 모서리에 6px 간격 (v9 이전 3열 격자와 같은 모습)
  expect(await radius()).toBe("10px");
  expect(await gap()).toBe("6px");

  await inspector(page).getByRole("button", { name: "각지게", exact: true }).click();
  await expect.poll(radius).toBe("0px");

  await inspector(page).getByLabel("사진 간격", { exact: true }).fill("20");
  await expect.poll(gap).toBe("20px");

  // 대형 스트립도 같은 선택을 따른다 — 예전에는 레이아웃이 모서리를 강제했다
  await inspector(page).getByRole("button", { name: "대형 스트립", exact: true }).click();
  await inspector(page).getByRole("button", { name: "둥글게", exact: true }).click();
  await expect.poll(radius).toBe("10px");

  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
});

test("인사말: 라벨 위 장식 이미지를 올리면 눈썹 라벨 위에 그려지고, 제거하면 사라진다", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);
  const greeting = canvas(page).locator('section:has-text("소중한 분들을 초대합니다")').last();

  // 인사말 '내용' 탭 → 장식 이미지 선택 → 보관함에서 업로드 후 사용
  await selectSection(page, "인사말", "내용");
  await inspector(page).getByRole("button", { name: "사진 선택" }).click();
  const library = page.getByRole("dialog", { name: "사진 보관함" });
  await library.locator('input[type="file"]').setInputFiles({
    name: "ribbon.png",
    mimeType: "image/png",
    buffer: makeTestPng(240, 100, { seed: 7 }),
  });
  await expect(library.locator("[data-upload-item]")).toHaveAttribute("data-upload-status", "done");
  await library.getByRole("button", { name: "이 이미지로 사용" }).click();

  // 캔버스: 장식이 눈썹 라벨보다 위에, 기본 높이 56px로 그려진다
  const ornament = greeting.locator("img");
  await expect(ornament).toBeVisible();
  const ornamentBox = (await ornament.boundingBox())!;
  const labelBox = (await greeting.getByText("INVITATION").boundingBox())!;
  expect(ornamentBox.y + ornamentBox.height).toBeLessThanOrEqual(labelBox.y);
  expect(ornamentBox.height).toBeCloseTo(56, 0);

  // 높이를 조절하면 그대로 커진다 (폭은 비율을 따라온다: 240×100 원본 → 240px)
  await inspector(page).getByLabel("장식 이미지 높이", { exact: true }).fill("100");
  await expect.poll(async () => (await ornament.boundingBox())!.height).toBeCloseTo(100, 0);
  expect((await ornament.boundingBox())!.width).toBeCloseTo(240, 0);

  // 제거하면 사라진다
  await inspector(page).getByRole("button", { name: "사진 제거" }).click();
  await expect(greeting.locator("img")).toHaveCount(0);
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
});

test("섹션 눈썹 라벨과 좌우 여백을 직접 고칠 수 있다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  const greeting = canvas(page).locator('section:has-text("소중한 분들을 초대합니다")').last();

  // 눈썹 라벨: 기본값은 렌더러가 박아 두었던 INVITATION이고, 고치면 곧바로 바뀐다
  await selectSection(page, "인사말", "내용");
  await expect(greeting.getByText("INVITATION")).toBeVisible();
  await inspector(page).getByLabel("눈썹 라벨", { exact: true }).fill("우리의 초대");
  await expect(greeting.getByText("우리의 초대")).toBeVisible();

  // 비우면 눈썹 없이 제목만 남는다
  await inspector(page).getByLabel("눈썹 라벨", { exact: true }).fill("");
  await expect(greeting.getByText("우리의 초대")).toHaveCount(0);
  await expect(greeting.getByText("소중한 분들을 초대합니다")).toBeVisible();

  // 좌우 여백: 기본 24px, 0으로 두면 가로를 꽉 채운다
  const body = greeting.locator("[data-section-body]");
  const padding = () => body.evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(await padding()).toBe("24px");

  await inspector(page).getByRole("button", { name: "레이아웃", exact: true }).click();
  await inspector(page).getByLabel("좌우 여백", { exact: true }).fill("0");
  await expect.poll(padding).toBe("0px");

  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
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

const cssVar = (locator: ReturnType<typeof canvas>, name: string) =>
  locator.evaluate((el, v) => Number(getComputedStyle(el).getPropertyValue(v)), name);

test("글자 크기: 제목과 본문을 따로 조절할 수 있다 (전체·섹션별)", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  const bodyFs = () => cssVar(canvas(page), "--canvas-fs");
  const headingFs = () => cssVar(canvas(page), "--canvas-fs-heading");
  const [baseBody, baseHeading] = [await bodyFs(), await headingFs()];

  await page.getByRole("button", { name: "테마", exact: true }).click();
  // 본문만 키운다 — 제목은 그대로 있어야 역할이 독립임이 증명된다
  await pickRole(page, "본문");
  await inspector(page).getByLabel("크기", { exact: true }).fill("16");
  await inspector(page).getByLabel("크기", { exact: true }).blur();
  await expect.poll(bodyFs).toBeGreaterThan(baseBody);
  expect(await headingFs()).toBeCloseTo(baseHeading, 3);

  // 이제 제목만 키운다
  await pickRole(page, "제목");
  await inspector(page).getByLabel("크기", { exact: true }).fill("22");
  await inspector(page).getByLabel("크기", { exact: true }).blur();
  await expect.poll(headingFs).toBeGreaterThan(baseHeading);

  // 섹션별 override는 그 섹션 안에서만 다시 정의된다
  await selectSection(page, "인사말", "스타일");
  await pickRole(page, "본문");
  await inspector(page).getByLabel("크기", { exact: true }).fill("8");
  await inspector(page).getByLabel("크기", { exact: true }).blur();
  const greeting = canvas(page).locator('section:has-text("소중한 분들을 초대합니다")').last();
  await expect.poll(() => cssVar(greeting, "--canvas-fs")).toBeLessThan(await bodyFs());
});

test("테마 색: 배경·글자색을 직접 고르면 캔버스에 그대로 칠해진다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();

  const root = canvas(page);
  await inspector(page).getByLabel("배경색", { exact: true }).fill("#102030");
  await inspector(page).getByLabel("글자색", { exact: true }).fill("#f0e8d8");
  await expect
    .poll(() => root.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(16, 32, 48)");
  await expect
    .poll(() => root.evaluate((el) => getComputedStyle(el).color))
    .toBe("rgb(240, 232, 216)");

  // ‘테마 기본값’을 누르면 배경만 되돌아가고 글자색 선택은 남는다
  await inspector(page)
    .getByLabel("배경색", { exact: true })
    .locator("xpath=following-sibling::button")
    .click();
  await expect
    .poll(() => root.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(250, 247, 241)"); // 웜 에디토리얼 기본 종이색
  expect(await root.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(240, 232, 216)");

  // 섹션 하나만 다른 글자색으로
  await selectSection(page, "인사말", "스타일");
  await pickRole(page, "본문");
  await inspector(page).getByLabel("색상", { exact: true }).fill("#c01020");
  const greeting = canvas(page).locator('section:has-text("소중한 분들을 초대합니다")').last();
  await expect
    .poll(() => greeting.evaluate((el) => getComputedStyle(el).color))
    .toBe("rgb(192, 16, 32)");
});

test("글자 크기: 두 자리 수를 한 글자씩 쳐도 중간에 최솟값으로 튀지 않는다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();

  await pickRole(page, "본문");
  const input = inspector(page).getByLabel("크기", { exact: true });
  await input.fill("");
  // "1"은 최솟값(7)보다 작다 — 여기서 곧바로 7로 잘리면 다음 글자가 붙어 "72" → 최댓값 20이 된다
  await input.pressSequentially("12");
  await expect(input).toHaveValue("12");
  await input.blur();
  await expect(input).toHaveValue("12");
  await expect
    .poll(() =>
      canvas(page).evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--canvas-fs"))),
    )
    .toBeCloseTo(16 / 15, 2);
});

test("오시는 길: 지도 버튼은 앱 아이콘과 함께 뜨고 네이버는 '네이버'로 적힌다", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);

  const buttons = canvas(page).locator("[data-map-links] > *");
  await expect(buttons).toHaveCount(3);
  await expect(buttons.nth(0)).toHaveText("네이버");
  await expect(buttons.nth(1)).toHaveText("카카오맵");
  await expect(buttons.nth(2)).toHaveText("티맵");

  // 앱 아이콘은 테마 강조색 배지의 인라인 SVG다 (ADR-043) — 버튼마다 하나씩 그려진다
  const icons = canvas(page).locator("[data-map-links] svg");
  await expect(icons).toHaveCount(3);

  // 모바일에서 누르기 쉬운 크기 — 손가락 터치 타깃 권장치(44px)를 넘는다
  const box = await buttons.nth(0).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(70);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
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

  await inspector(page).getByRole("combobox", { name: "글꼴" }).click();
  await inspector(page)
    .getByRole("option", { name: /my-wedding-font\.woff2/ })
    .click();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  const fontFace = await canvas(page).evaluate(
    (el) => el.querySelector("style")?.textContent ?? "",
  );
  expect(fontFace).toContain("@font-face");
  expect(fontFace).toMatch(/font-family:"cf-[\w-]+"/);

  // 사용 중인 폰트는 지울 수 없다
  await expect(inspector(page).getByRole("button", { name: "사용 중" })).toBeDisabled();

  // 소유자 미리보기(/preview/[projectId])에도 같은 @font-face가 실린다.
  // 이 화면만 폰트 배선이 빠져 커스텀 폰트가 기본 폰트로 보이던 적이 있다.
  const projectId = new URL(page.url()).pathname.split("/").pop()!;
  await page.goto(`/preview/${projectId}`);
  await expect(canvas(page)).toBeVisible();
  // 미리보기는 asset 목록을 비동기로 불러온다 — 첫 페인트에는 폰트 URL을 아직 모르므로
  // @font-face가 비어 있다. '언젠가 실린다'가 우리가 지키려는 성질이니 기다렸다 본다.
  const previewStyle = () =>
    canvas(page).evaluate((el) => el.querySelector("style")?.textContent ?? "");
  await expect.poll(previewStyle).toContain("@font-face");
  expect(await previewStyle()).toMatch(/font-family:"cf-[\w-]+"/);
});

test("커스텀 폰트: 한 번에 여러 개를 올리고, 하나가 잘못돼도 나머지는 올라간다", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();

  const fontFile = (name: string, mimeType: string) => ({
    name,
    mimeType,
    buffer: Buffer.from(`fake-font-bytes-${name}`),
  });

  await inspector(page)
    .locator("[data-font-upload]")
    .setInputFiles([
      fontFile("serif-one.woff2", "font/woff2"),
      fontFile("not-a-font.png", "image/png"), // 형식 오류 — 여기서 멈추면 안 된다
      fontFile("sans-two.otf", "font/otf"),
    ]);

  const item = (name: string) =>
    inspector(page).locator("[data-custom-fonts] li").filter({ hasText: name });
  const errors = inspector(page).locator("[data-font-upload-errors]");
  await expect(item("serif-one.woff2")).toBeVisible({ timeout: 30_000 });
  await expect(item("sans-two.otf")).toBeVisible({ timeout: 30_000 });
  await expect(item("not-a-font.png")).toHaveCount(0);

  // 실패한 파일만 이름과 함께 알려준다
  await expect(errors).toContainText("not-a-font.png");
  await expect(errors).toContainText("지원하지 않는 폰트 파일 형식");

  // 둘 다 선택지에 나타난다
  await inspector(page).getByRole("combobox", { name: "글꼴" }).click();
  await expect(inspector(page).getByRole("option", { name: /serif-one\.woff2/ })).toHaveCount(1);
  await expect(inspector(page).getByRole("option", { name: /sans-two\.otf/ })).toHaveCount(1);
});

test("폰트 고르기: 목록의 각 줄이 자기 서체로 그려지고 키보드로도 고를 수 있다", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await pickRole(page, "제목");

  const picker = inspector(page).getByRole("combobox", { name: "글꼴" });
  await picker.click();

  // 각 줄의 견본은 그 줄의 서체로 그려진다 — '테마 기본'은 따라가는 규칙이라 견본이 없다
  const myeongjo = inspector(page).getByRole("option", { name: /나눔명조/ });
  await expect(myeongjo).toBeVisible();
  const family = await myeongjo
    .locator("span")
    .last()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toContain("Nanum Myeongjo");

  // 키보드: 아래로 이동 후 Enter로 선택
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(inspector(page).getByRole("listbox")).toHaveCount(0);
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
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
  const closing = canvas(page).locator('section:has-text("감사합니다")').last();
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

  // 마지막 장면은 상하 여백이 없다 — 여백 설정을 바꿔도 위아래 모두 0
  await selectSection(page, "맺음말", "스타일");
  for (const label of ["좁게", "넓게"]) {
    await inspector(page).getByRole("button", { name: label, exact: true }).first().click();
    await expect
      .poll(() =>
        closing.evaluate((el) => {
          const s = getComputedStyle(el);
          return `${s.paddingTop}/${s.paddingBottom}`;
        }),
      )
      .toBe("0px/0px");
  }

  // 눈썹 라벨(THANK YOU)은 없고 제목만 사진 위에 흰 글씨로 얹힌다
  await expect(closing.getByText("THANK YOU")).toHaveCount(0);
  const title = closing.getByRole("heading", { name: "감사합니다" });
  expect(await title.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 255, 255)");
  const [titleBox, photoRect] = await Promise.all([title.boundingBox(), photoBox.boundingBox()]);
  expect(titleBox!.y).toBeGreaterThan(photoRect!.y);
  expect(titleBox!.y + titleBox!.height).toBeLessThan(photoRect!.y + photoRect!.height);
});

test("마음 전하실 곳: 눈썹 라벨이 REGISTRY다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const gift = canvas(page).locator('section:has-text("마음 전하실 곳")').last();
  await expect(gift.getByText("REGISTRY")).toBeVisible();
  await expect(gift.getByText("GIFT")).toHaveCount(0);
});

test("메인: 사진 위 문구를 넣고 위치·크기·색을 고른 대로 얹힌다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const photoBox = heroSection(page).locator("[data-photo-stage]");
  const overlay = heroSection(page).locator("[data-hero-overlay] p");

  // 샘플은 사진 아래쪽에 문구를 얹은 채로 시작한다
  await expect(overlay).toHaveText("we're getting married");

  await selectSection(page, "메인", "내용");
  await inspector(page).getByLabel("사진 위 문구").fill("우리 결혼합니다");
  await expect(overlay).toHaveText("우리 결혼합니다");

  // 줄바꿈 — 입력한 그대로 두 줄로 얹힌다 (한 줄 입력 칸이면 애초에 넣을 수가 없다)
  const overlayHeight = async () => (await overlay.boundingBox())!.height;
  const oneLine = await overlayHeight();
  await inspector(page).getByLabel("사진 위 문구").fill("우리\n결혼합니다");
  await expect.poll(overlayHeight).toBeGreaterThan(oneLine * 1.8);
  await inspector(page).getByLabel("사진 위 문구").fill("우리 결혼합니다");

  // 세로 위치 — 0%는 위쪽 끝, 100%는 아래쪽 끝. 사진 밖으로는 나가지 않는다.
  const yOf = async () => (await overlay.boundingBox())!.y;
  const photoRect = (await photoBox.boundingBox())!;
  const position = inspector(page).getByLabel("세로 위치", { exact: true });
  await position.fill("0");
  const top = await yOf();
  await position.fill("100");
  const bottom = await yOf();
  expect(bottom).toBeGreaterThan(top);
  expect(top).toBeGreaterThanOrEqual(photoRect.y - 1);
  const overlayBox = (await overlay.boundingBox())!;
  expect(bottom + overlayBox.height).toBeLessThanOrEqual(photoRect.y + photoRect.height + 1);

  // 그림자 — 색과 정도를 고른 대로 그려진다 (정도 100% = 알파 1·번짐 25px)
  const shadow = () => overlay.evaluate((el) => getComputedStyle(el).textShadow);
  expect(await shadow()).not.toBe("none");
  await inspector(page).getByLabel("그림자 색", { exact: true }).fill("#ff0000");
  await inspector(page).getByLabel("그림자 정도", { exact: true }).fill("100");
  await expect.poll(shadow).toBe("rgb(255, 0, 0) 0px 1px 25px");

  // 끄면 색·정도 손잡이도 함께 사라진다 — 아무 일도 하지 않는 입력을 남기지 않는다
  await inspector(page).getByLabel("글자 그림자", { exact: true }).uncheck();
  await expect.poll(shadow).toBe("none");
  await expect(inspector(page).getByLabel("그림자 색", { exact: true })).toHaveCount(0);

  // 크기·색 — 고른 값이 그대로 그려진다 (pt는 96/72로 px 환산된다).
  // 역할 글자의 상한 28pt와 달리 사진 위 문구는 훨씬 크게 갈 수 있다.
  await inspector(page).getByLabel("글자 크기", { exact: true }).fill("48");
  await expect
    .poll(() => overlay.evaluate((el) => getComputedStyle(el).fontSize))
    .toBe(`${48 * (96 / 72)}px`);
  await inspector(page).getByLabel("글자 크기", { exact: true }).fill("24");
  await inspector(page).getByLabel("글자색", { exact: true }).fill("#ff0000");
  await expect
    .poll(() => overlay.evaluate((el) => getComputedStyle(el).color))
    .toBe("rgb(255, 0, 0)");

  // 사진을 어둡게 해도 문구는 흐려지지 않는다 — 사진 필터 밖에 있다
  await selectSection(page, "메인", "레이아웃");
  await inspector(page).getByLabel("투명도", { exact: true }).fill("30");
  await expect.poll(() => overlay.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  // 문구를 비우면 자리째 사라진다
  await selectSection(page, "메인", "내용");
  await inspector(page).getByLabel("사진 위 문구").fill("");
  await expect(heroSection(page).locator("[data-hero-overlay]")).toHaveCount(0);
});

test("메인: 사진 위 문구의 등장 효과를 고르면 그 방식대로 그려진다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const overlay = heroSection(page).locator("[data-hero-overlay] p");
  await selectSection(page, "메인", "내용");
  const effect = inspector(page).getByLabel("나타나는 효과", { exact: true });

  // 기본은 '없음' — 글자를 쪼개지 않고 통째로 그린다
  await expect(overlay.locator("[data-canvas-anim]")).toHaveCount(0);

  // 한 글자씩 — 글자마다 상자가 생기고, 뒤로 갈수록 시작이 늦다
  await effect.selectOption("typing");
  const chars = overlay.locator("[data-canvas-anim]");
  await expect(chars).toHaveCount("we're getting married".length);
  const delayOf = (index: number) =>
    chars.nth(index).evaluate((el) => parseFloat(getComputedStyle(el).animationDelay));
  expect(await delayOf(5)).toBeGreaterThan(await delayOf(0));

  // 펜으로 쓰듯 — 글자마다 상자가 생기되 타자보다 촘촘한 페이드로 배어 나오고,
  // 둘째 줄의 첫 글자는 첫 줄을 다 쓴 뒤에 시작한다. 움직이는 창·잉크 상자가 아니라
  // 글자별 opacity 페이드다 (ADR-054 — 잘려 있던 픽셀은 모바일에서 뒤늦게 칠해졌다).
  await inspector(page).getByLabel("사진 위 문구").fill("우리\n결혼합니다");
  await effect.selectOption("writing");
  await expect(overlay.locator("[data-canvas-anim]")).toHaveCount(7); // "우리"(2) + "결혼합니다"(5)
  const writeAnim = await overlay
    .locator("[data-canvas-anim]")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(writeAnim).toBe("canvas-fade-in");
  // 둘째 줄 첫 글자(index 2)는 첫 줄 두 글자를 다 쓴 뒤에 시작한다
  const second = await overlay
    .locator("[data-canvas-anim]")
    .nth(2)
    .evaluate((el) => parseFloat(getComputedStyle(el).animationDelay));
  expect(second).toBeGreaterThan(0);
});

test("메인: 세로 파노라마 사진과 '글 내리기'로 첫 화면을 사진만으로 채운다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const photoBox = heroSection(page).locator("[data-photo-stage]");
  const heightOf = async () => (await photoBox.boundingBox())!.height;

  await selectSection(page, "메인", "레이아웃");
  const before = await heightOf();
  await inspector(page).getByRole("button", { name: "9:20", exact: true }).click();
  const panorama = await heightOf();
  expect(panorama).toBeGreaterThan(before);
  // 폰 세로(844px)를 넘겨야 첫 화면이 사진으로 덮인다
  expect(panorama).toBeGreaterThan(844);

  // 글 내리기 — 이름 블록이 그만큼 아래로 내려간다
  const names = heroSection(page).locator("h1");
  const nameY = async () => (await names.boundingBox())!.y;
  const atZero = await nameY();
  await inspector(page).getByLabel("사진 아래 글 내리기", { exact: true }).fill("200");
  await expect.poll(async () => (await nameY()) - atZero).toBeGreaterThan(190);
});

test("버튼 색: 캘린더 저장·참석 여부·카카오가 모두 테마 강조색을 따르고 따로 고를 수 있다", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);
  const bg = (locator: ReturnType<typeof canvas>) =>
    locator.evaluate((el) => getComputedStyle(el).backgroundColor);

  // warm-editorial 강조색 #A6795B — 캔버스가 실제로 칠하는 값을 기준으로 삼는다
  const accent = await canvas(page).evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--canvas-accent").trim(),
  );
  expect(accent).toBe("#A6795B");
  const accentRgb = "rgb(166, 121, 91)";

  // 캘린더 '오늘' 표시와 강조색은 같은 값이다 — 진하기가 달라 보이는 건 굵기 차이지 색 차이가 아니다.
  // (이 단언이 깨지면 어딘가에서 강조색에 투명도·혼합이 섞인 것이다)
  const daySelected = canvas(page).locator("table span[style*='background']").first();
  expect(await bg(daySelected)).toBe(accentRgb);

  // 세 버튼 모두 기본으로 강조색을 따른다
  const saveButton = canvas(page).getByRole("button", { name: /일정 저장/ });
  const rsvpButton = canvas(page).locator("[data-rsvp-open]");
  expect(await bg(saveButton)).toBe(accentRgb);
  expect(await bg(rsvpButton)).toBe(accentRgb);

  // 따로 고르면 그 색만 바뀐다 — 흰 버튼 위 글자는 자동으로 검게 뒤집힌다
  await selectSection(page, "예식 캘린더", "내용");
  await inspector(page).getByLabel("‘캘린더에 일정 저장’ 버튼 색", { exact: true }).fill("#ffffff");
  await expect.poll(() => bg(saveButton)).toBe("rgb(255, 255, 255)");
  await expect
    .poll(() => saveButton.evaluate((el) => getComputedStyle(el).color))
    .toBe("rgb(26, 26, 26)");
  expect(await bg(rsvpButton)).toBe(accentRgb); // 다른 버튼은 그대로
});

test("공유하기: 어두운 판의 색을 직접 고르면 글자색이 따라 뒤집힌다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const share = canvas(page).locator("section").last();

  await selectSection(page, "공유하기", "레이아웃");
  await inspector(page).getByRole("button", { name: "어둡게", exact: true }).click();
  await expect
    .poll(() => share.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(26, 26, 26)");

  // 밝은 색을 골라도 글자가 묻히지 않는다 — 글자색이 검정으로 뒤집힌다
  await selectSection(page, "공유하기", "내용");
  await inspector(page).getByLabel("어두운 판 색", { exact: true }).fill("#f2e8dc");
  await expect
    .poll(() => share.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(242, 232, 220)");
  await expect
    .poll(() =>
      share.evaluate((el) => getComputedStyle(el).getPropertyValue("--canvas-ink").trim()),
    )
    .toBe("#1A1A1A");
});

test("교통 안내: 그림을 직접 고르고, 카드 열 수와 접이식 레이아웃을 쓸 수 있다", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);
  const transport = canvas(page).locator('section:has-text("교통 안내")').last();
  const items = transport.locator("[data-transport-item]");

  // 그림을 비워 두면 수단의 기본 이모지 — 샘플의 첫 항목은 지하철이다
  await expect(items.first()).toContainText("🚇");
  await selectSection(page, "교통 안내", "내용");
  await inspector(page).getByLabel("그림").first().fill("🚈");
  await expect(items.first()).toContainText("🚈");
  await expect(items.first()).not.toContainText("🚇");

  // 카드 격자 — 열 수를 고른 대로 나뉜다
  await selectSection(page, "교통 안내", "레이아웃");
  await inspector(page).getByRole("button", { name: "카드 격자", exact: true }).click();
  const columnCount = () =>
    transport
      .locator("ul")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  await expect.poll(columnCount).toBe(2);
  await inspector(page).getByLabel("열 수", { exact: true }).fill("3");
  await expect.poll(columnCount).toBe(3);

  // 접이식 — 편집 중에는 펼쳐 두고, 게스트 화면에서만 눌러서 여닫는다
  await inspector(page).getByRole("button", { name: "접이식", exact: true }).click();
  await expect(items.first().getByRole("button")).toBeDisabled();
  await expect(items.first()).toContainText("대방역");
});

test("공유하기: 어두운 판과 카카오 버튼 색을 고를 수 있다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const share = canvas(page).locator('section:has-text("청첩장 공유하기")').last();

  const background = () => share.evaluate((el) => getComputedStyle(el).backgroundColor);
  const titleColor = () =>
    share.getByRole("heading", { name: "청첩장 공유하기" }).evaluate((el) => {
      return getComputedStyle(el).color;
    });
  expect(await background()).not.toBe("rgb(26, 26, 26)");

  await selectSection(page, "공유하기", "레이아웃");
  await inspector(page).getByRole("button", { name: "어둡게", exact: true }).click();
  await expect.poll(background).toBe("rgb(26, 26, 26)");
  await expect.poll(titleColor).toBe("rgb(255, 255, 255)");

  // 카카오 버튼 색은 기본이 테마 강조색이고(브랜드 노랑이 아니다), 직접 고를 수 있다.
  // 버튼 자체는 카카오 JS 키가 있는 빌드에서만 나오므로, 없으면 여기서 끝낸다.
  await selectSection(page, "공유하기", "내용");
  const kakao = share.getByRole("button", { name: "카카오톡 공유" });
  if ((await kakao.count()) === 0) return;
  expect(await kakao.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    "rgb(254, 229, 0)",
  );
  await inspector(page).getByLabel("카카오톡 버튼 색", { exact: true }).fill("#fee500");
  await expect
    .poll(() => kakao.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgb(254, 229, 0)");
  // 밝은 버튼 위에는 검은 글자가 얹힌다
  await expect
    .poll(() => kakao.evaluate((el) => getComputedStyle(el).color))
    .toBe("rgb(26, 26, 26)");
});

test("글꼴 편집기: 네 역할의 굵기·기울임·자간·행간을 따로 조절한다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();

  const greeting = canvas(page).locator('section:has-text("소중한 분들을 초대합니다")').last();
  const eyebrow = greeting.getByText("INVITATION");
  const title = greeting.getByRole("heading", { name: "소중한 분들을 초대합니다" });
  const body = greeting.getByText(/서로가 마주 보며/);
  const styleOf = (target: typeof eyebrow, prop: string) =>
    target.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

  // 눈썹만 굵게 — 제목·본문은 그대로여야 역할이 갈라져 있음이 증명된다
  const titleWeightBefore = await styleOf(title, "font-weight");
  const bodyWeightBefore = await styleOf(body, "font-weight");
  await pickRole(page, "눈썹");
  await inspector(page).getByRole("button", { name: "굵게", exact: true }).click();
  await expect.poll(() => styleOf(eyebrow, "font-weight")).toBe("700");
  expect(await styleOf(title, "font-weight")).toBe(titleWeightBefore);
  expect(await styleOf(body, "font-weight")).toBe(bodyWeightBefore);

  // 제목만 기울임
  await pickRole(page, "제목");
  await inspector(page).getByRole("button", { name: "기울임", exact: true }).click();
  await expect.poll(() => styleOf(title, "font-style")).toBe("italic");
  expect(await styleOf(body, "font-style")).toBe("normal");

  // 본문의 자간·행간 — 글자 크기에 대한 비율이라 px로 환산되어 나온다
  await pickRole(page, "본문");
  await inspector(page).getByLabel("자간", { exact: true }).fill("20");
  await inspector(page).getByLabel("행간", { exact: true }).fill("220");
  await expect.poll(() => styleOf(body, "letter-spacing")).not.toBe("normal");
  const [size, leading] = await Promise.all([
    body.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    body.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight)),
  ]);
  expect(leading / size).toBeCloseTo(2.2, 1);

  // 섹션 하나만 다시 덮어쓴다 — 전역은 그대로 남는다
  await selectSection(page, "맺음말", "스타일");
  await pickRole(page, "본문");
  await inspector(page).getByLabel("행간", { exact: true }).fill("100");
  const greetingLeading = await body.evaluate(
    (el) => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize),
  );
  expect(greetingLeading).toBeCloseTo(2.2, 1); // 인사말은 전역 설정 그대로다
  const closing = canvas(page).locator('section:has-text("감사합니다")').last();
  const closingLeading = await closing
    .getByText(/두 사람의 시작/)
    .evaluate(
      (el) =>
        parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize),
    );
  expect(closingLeading).toBeCloseTo(1, 1); // 맺음말만 따로 좁혔다
});

test("글꼴 고르기: 최근 고른 글꼴이 목록 맨 위에 모인다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await pickRole(page, "제목");

  const picker = inspector(page).getByRole("combobox", { name: "글꼴" });
  const recent = inspector(page).locator("[data-font-recent]");

  // 아무것도 고르지 않았으면 최근 목록이 없다
  await picker.click();
  await expect(recent).toHaveCount(0);
  await inspector(page)
    .getByRole("option", { name: /고운바탕/ })
    .click();

  // 고른 글꼴이 최근 목록 맨 위에 생긴다 (전체 목록에도 그대로 남는다)
  await picker.click();
  await expect(recent).toHaveCount(1);
  await expect(recent.first()).toContainText("고운바탕");
  await inspector(page)
    .getByRole("option", { name: /나눔명조/ })
    .first()
    .click();

  // 가장 최근에 고른 것이 맨 위 — 같은 글꼴을 두 번 골라도 중복으로 쌓이지 않는다
  await picker.click();
  await expect(recent).toHaveCount(2);
  await expect(recent.first()).toContainText("나눔명조");
  await expect(recent.nth(1)).toContainText("고운바탕");
});

test("메인 사진 위 문구: 업로드한 글꼴을 고르면 @font-face가 주입되고 실제로 그려진다", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);

  // 폰트 업로드 (테마 패널)
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await inspector(page)
    .locator('input[type="file"][accept*="font"]')
    .setInputFiles({
      name: "overlay-font.woff2",
      mimeType: "font/woff2",
      buffer: Buffer.from("wOF2fake-font-bytes-for-e2e"),
    });
  await expect(
    inspector(page).getByRole("listitem").filter({ hasText: "overlay-font.woff2" }),
  ).toBeVisible();

  // 메인 '내용' 탭에서 사진 위 문구의 글꼴로 그 폰트를 고른다
  await selectSection(page, "메인", "내용");
  await inspector(page).getByLabel("사진 위 문구").fill("we're getting married");
  await inspector(page).getByRole("combobox", { name: "글꼴" }).click();
  await inspector(page)
    .getByRole("option", { name: /overlay-font\.woff2/ })
    .first()
    .click();

  // 문서가 참조하는 폰트라면 @font-face가 캔버스에 주입돼야 한다 —
  // 빠지면 브라우저가 조용히 기본 글꼴로 떨어져서 "글꼴이 안 먹는다"로만 보인다
  const overlay = heroSection(page).locator("[data-hero-overlay] p");
  const family = await overlay.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^"?cf-/);
  const injected = await canvas(page).evaluate(
    (el) => el.querySelector("style")?.textContent ?? "",
  );
  const declared = family.replace(/^"?(cf-[\w-]+)"?.*$/, "$1");
  expect(injected).toContain(`font-family:"${declared}"`);
});
