import { expect, test, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// 도메인 루트 발행 (ADR-029) — 공개 주소를 비워 둔 채 발행하면 도메인 그대로 열린다.
//
// 루트는 동시에 하나만 살아 있을 수 있으므로 이 파일의 테스트는 끝나면서 반드시
// 발행을 중단해 루트를 놓아준다. 그래야 다음 실행이 다시 루트를 차지할 수 있다.

const publishDialog = (page: Page) => page.getByRole("dialog", { name: "공유·발행" });

async function createSample(page: Page) {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
}

test("공개 주소를 비우고 발행하면 도메인 그대로 열리고, 루트에서도 RSVP가 접수된다", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await signUpFresh(page);
  await createSample(page);

  await page.getByRole("button", { name: "공유·발행" }).click();
  const panel = publishDialog(page);

  // 기본값은 빈 칸 = 도메인 주소. 슬러그를 강요하지 않는다
  await expect(panel.getByLabel(/공개 주소/)).toHaveValue("");
  await expect(panel.locator("[data-publish-target]")).toContainText("localhost:3100");
  await expect(panel.locator("[data-publish-target]")).not.toContainText("/i/");

  try {
    await panel.getByRole("button", { name: "발행하기" }).click();
    await expect(panel.getByText("발행됨")).toBeVisible({ timeout: 10000 });

    const href = await panel.getByRole("link", { name: "발행된 페이지 열기" }).getAttribute("href");
    expect(new URL(href!).pathname).toBe("/");

    // 하객: 로그인 없이 도메인 루트에서 청첩장을 본다
    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest.goto("/");
    await expect(guest.locator("[data-invitation-root]")).toBeVisible();

    // 일정 저장
    const ics = await guest.request.get("/wedding.ics");
    expect(ics.status()).toBe(200);
    expect(ics.headers()["content-type"]).toContain("text/calendar");

    // RSVP: 루트 청첩장은 slug가 없다 — 제출 대상 식별이 깨지기 쉬운 자리라 실제로 보낸다
    const open = guest.locator("[data-rsvp-open]");
    if (await open.isVisible()) await open.click();
    const form = guest.locator("[data-rsvp-form]");
    await form.getByLabel("성함").fill("루트 하객");
    await form.getByRole("radio", { name: "참석", exact: true }).check({ force: true });
    await guest.locator("[data-rsvp-consent] input[type=checkbox]").check();
    await guest.getByRole("button", { name: "참석 의사 전달하기" }).click();
    await expect(guest.locator("[data-rsvp-done]")).toBeVisible();

    await guestContext.close();
  } finally {
    // 루트 반납 — 중간에 실패해도 다음 실행이 막히지 않도록.
    // (발행 자체가 실패했으면 중단 버튼이 없다 — 원래 오류를 가리지 않게 건너뛴다)
    const stop = panel.getByRole("button", { name: "발행 중단" });
    if (await stop.isVisible()) {
      await stop.click();
      await expect(panel.getByText("발행 중단됨")).toBeVisible();
    }
  }
});
