import { expect, test, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// 업로드 asset을 Vercel CDN 뒤로 숨기는 프록시 + 발행 스냅샷 캐시 (ADR-040).
// 하객이 받는 URL이 실제로 /a/ 프록시를 가리키고, 재발행이 캐시를 뚫고 반영되는지 본다.

const inspector = (page: Page) => page.locator("aside").last();
const publishDialog = (page: Page) => page.getByRole("dialog", { name: "공유·발행" });

async function createSample(page: Page) {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
}

function uniqueSlug(): string {
  return `egr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function publish(page: Page, slug: string) {
  await page.getByRole("button", { name: "공유·발행" }).click();
  await expect(publishDialog(page)).toBeVisible();
  await publishDialog(page).getByLabel("공개 주소").fill(slug);
  await publishDialog(page)
    .getByRole("button", { name: /^(발행하기|재발행하기)$/ })
    .click();
  await expect(publishDialog(page).getByText("발행됨")).toBeVisible();
  await publishDialog(page).getByRole("button", { name: "닫기" }).click();
}

test("업로드 asset은 하객에게 /a/ 프록시로 나가고, 프록시는 immutable 캐시로 응답한다", async ({
  page,
  browser,
}) => {
  await signUpFresh(page);
  await createSample(page);

  // 커스텀 폰트를 올려 참조를 만든다 — 빌트인 샘플 asset은 manifest에 없어 프록시 대상이 아니다
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await inspector(page)
    .locator("[data-font-upload]")
    .setInputFiles({
      name: "guest-font.woff2",
      mimeType: "font/woff2",
      buffer: Buffer.from("wOF2fake-font-bytes"),
    });
  await inspector(page).getByRole("combobox", { name: "글꼴" }).click();
  await inspector(page)
    .getByRole("option", { name: /guest-font\.woff2/ })
    .click();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  const slug = uniqueSlug();
  await publish(page, slug);

  // 하객 화면 — @font-face가 Supabase 직접 URL이 아니라 /a/ 프록시를 가리켜야 한다
  const guest = await browser.newPage();
  await guest.goto(`/i/${slug}`);
  await expect(guest.locator("[data-invitation-root]")).toBeVisible();
  const style = await guest
    .locator("[data-invitation-root] style")
    .first()
    .evaluate((el) => el.textContent ?? "");
  expect(style).toContain('url("/a/projects/');
  expect(style).not.toContain("/storage/v1/object/public"); // Supabase 직접 URL이 남으면 안 된다

  // 프록시 경로를 직접 받아 본다 — 200 + 1년 immutable 캐시(하객마다 Supabase를 안 때린다)
  const proxied = style.match(/url\("(\/a\/[^"]+)"\)/)?.[1];
  expect(proxied).toBeTruthy();
  const res = await guest.request.get(proxied!);
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("immutable");

  // 형태 밖 경로는 프록시가 거부한다 (임의 경로 중계 방지)
  const bad = await guest.request.get("/a/other/secret.txt");
  expect(bad.status()).toBe(404);
  await guest.close();
});

test("재발행하면 하객 페이지 캐시를 뚫고 새 내용이 보인다", async ({ page, browser }) => {
  await signUpFresh(page);
  await createSample(page);

  const slug = uniqueSlug();
  await publish(page, slug);

  const guest = await browser.newPage();
  await guest.goto(`/i/${slug}`);
  await expect(guest.locator("[data-invitation-root]").getByText("THE MARRIAGE OF")).toBeVisible();

  // 태그라인을 바꾸고 재발행 — 캐시가 무효화되지 않으면 하객은 옛 문구를 계속 본다
  await page.getByRole("button", { name: "메인", exact: true }).click();
  await inspector(page).getByRole("button", { name: "내용", exact: true }).click();
  await inspector(page).getByLabel("태그라인").fill("우리 결혼합니다 (재발행 확인)");
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  await publish(page, slug);

  // ISR은 stale-while-revalidate다 — revalidatePath가 캐시를 무효화하면 첫 요청이 옛 내용을
  // 주며 배경에서 다시 렌더하고, 그다음 요청이 새 내용을 준다. 새로고침 한 번 안에 반영된다.
  await expect
    .poll(
      async () => {
        const res = await guest.request.get(`/i/${slug}`);
        return (await res.text()).includes("재발행 확인");
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  await guest.close();
});
