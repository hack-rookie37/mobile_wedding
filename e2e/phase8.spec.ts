import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// Phase 8 — 한국 청첩장 공개 섹션 (신랑신부 소개·캘린더·교통·연락처·마음 전하실 곳·맺음말)
// + venue 외부 지도 연결, copy·keyboard·external link 검증

async function createSample(page: Page): Promise<string> {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

async function waitSaved(page: Page) {
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
}

const publishDialog = (page: Page) => page.getByRole("dialog", { name: "공유·발행" });

function uniqueSlug(): string {
  return `e2e8-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function publishCurrent(page: Page): Promise<string> {
  const slug = uniqueSlug();
  await page.getByRole("button", { name: "공유·발행" }).click();
  await expect(publishDialog(page)).toBeVisible();
  await publishDialog(page).getByLabel("공개 주소").fill(slug);
  await publishDialog(page)
    .getByRole("button", { name: /^(발행하기|재발행하기)$/ })
    .click();
  await expect(publishDialog(page).getByText("발행됨")).toBeVisible();
  await publishDialog(page).getByRole("button", { name: "닫기" }).click();
  return slug;
}

async function republish(page: Page) {
  await page.getByRole("button", { name: "공유·발행" }).click();
  await expect(publishDialog(page)).toBeVisible();
  await publishDialog(page).getByRole("button", { name: "재발행하기" }).click();
  await expect(publishDialog(page).getByText(/재발행해야 공개본에 반영됩니다/)).toHaveCount(0);
  await publishDialog(page).getByRole("button", { name: "닫기" }).click();
}

async function newGuestPage(browser: Browser) {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  // Web Share API 제거 — 클립보드 fallback 경로를 결정적으로 검증
  await page.addInitScript(() => {
    // @ts-expect-error 테스트 전용
    delete Navigator.prototype.share;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  return { context, page };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
});

test("편집기: 동영상 섹션 추가 → URL 인식 → variant 전환에도 content 보존", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  // 섹션 추가 메뉴에 신규 타입이 모두 노출된다
  await page.getByRole("button", { name: "+ 섹션 추가" }).click();
  for (const label of [
    "신랑·신부 소개",
    "예식 캘린더",
    "교통 안내",
    "연락처",
    "마음 전하실 곳",
    "맺음말",
  ]) {
    await expect(page.getByRole("menuitem", { name: label })).toBeVisible();
  }
  await page.getByRole("menuitem", { name: "동영상" }).click();

  // URL 입력 → facade(탭하여 재생)가 기본
  await page.getByLabel("동영상 URL").fill("https://youtu.be/dQw4w9WgXcQ");
  await expect(page.getByText("YouTube 동영상으로 인식했습니다")).toBeVisible();
  await expect(page.locator("[data-video-facade]")).toBeVisible();

  // variant 전환: 즉시 임베드 → iframe, URL은 보존
  await page.getByRole("button", { name: "레이아웃" }).click();
  await page.getByRole("button", { name: "즉시 임베드" }).click();
  await expect(
    page.locator('[data-invitation-root] iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "내용", exact: true }).click();
  await expect(page.getByLabel("동영상 URL")).toHaveValue("https://youtu.be/dQw4w9WgXcQ");
  await waitSaved(page);
});

test("편집기: 계좌 추가·수정과 variant 전환 content 보존, 교통 안내 항목 편집", async ({
  page,
}) => {
  await signUpFresh(page);
  await createSample(page);

  // 마음 전하실 곳: 신부측 계좌 추가
  await page.getByRole("button", { name: "마음 전하실 곳", exact: true }).click();
  await page.getByRole("button", { name: "+ 신부측 계좌 추가" }).click();
  const newCard = page.locator("[data-list-item]").last();
  await newCard.getByLabel("은행").fill("카카오뱅크");
  await newCard.getByLabel("예금주").fill("최미경");
  await newCard.getByLabel("계좌번호").fill("3333-01-2345678");
  await expect(page.locator("[data-invitation-root]").getByText("카카오뱅크")).toBeVisible();

  // variant 전환(접이식 → 펼침) 후에도 입력한 계좌가 그대로다
  await page.getByRole("button", { name: "레이아웃" }).click();
  await page.getByRole("button", { name: "펼침" }).click();
  await expect(page.locator("[data-invitation-root]").getByText("카카오뱅크")).toBeVisible();
  await page.getByRole("button", { name: "내용", exact: true }).click();
  await expect(page.getByLabel("계좌번호").last()).toHaveValue("3333-01-2345678");

  // 교통 안내: 항목 추가·삭제
  await page.getByRole("button", { name: "교통 안내", exact: true }).click();
  await page.getByRole("button", { name: "+ 교통 안내 추가" }).click();
  const item = page.locator("[data-list-item]").last();
  await item.getByLabel("수단").selectOption("shuttle");
  await item.getByLabel("제목").fill("전세버스");
  await item.getByLabel("안내").fill("오전 11시 30분 시청역 앞 출발");
  await expect(page.locator("[data-invitation-root]").getByText("전세버스")).toBeVisible();
  await item.getByRole("button", { name: "항목 삭제" }).click();
  await expect(page.locator("[data-invitation-root]").getByText("전세버스")).toHaveCount(0);
  await waitSaved(page);
});

test("공개 페이지: 복사·전화/문자·지도 링크·일정 저장·D-day·공유가 동작한다 (키보드 포함)", async ({
  page,
  browser,
}) => {
  await signUpFresh(page);
  await createSample(page);
  await waitSaved(page);
  const slug = await publishCurrent(page);

  const { context, page: guest } = await newGuestPage(browser);
  await guest.goto(`/i/${slug}`);
  await expect(guest.locator("[data-invitation-root]")).toBeVisible();

  // ── 마음 전하실 곳: 접힘 기본 → 펼침 → 복사
  const groomToggle = guest.getByRole("button", { name: "신랑측", exact: true });
  await expect(groomToggle).toHaveAttribute("aria-expanded", "false");
  await expect(guest.getByText("123456-01-234567")).toHaveCount(0); // 접힌 동안 미표시
  await groomToggle.click();
  await expect(groomToggle).toHaveAttribute("aria-expanded", "true");
  await expect(guest.getByText("123456-01-234567")).toBeVisible();

  await guest.getByRole("button", { name: "김민준 국민은행 계좌번호 복사" }).click();
  await expect(guest.getByText("복사됨")).toBeVisible();
  expect(await guest.evaluate(() => navigator.clipboard.readText())).toBe(
    "국민은행 123456-01-234567",
  );

  // 키보드: 신부측 그룹을 Enter로 펼치고 Enter로 복사
  const brideToggle = guest.getByRole("button", { name: "신부측", exact: true });
  await brideToggle.focus();
  await guest.keyboard.press("Enter");
  await expect(brideToggle).toHaveAttribute("aria-expanded", "true");
  const brideCopy = guest.getByRole("button", { name: "이서연 우리은행 계좌번호 복사" });
  await brideCopy.focus();
  await guest.keyboard.press("Enter");
  expect(await guest.evaluate(() => navigator.clipboard.readText())).toBe(
    "우리은행 1002-345-678901",
  );

  // ── 연락처: 전화·문자 링크 (표기용 하이픈은 href에서 제거)
  const firstEntry = guest.locator("[data-contact-entry]").first();
  await expect(firstEntry.getByRole("link", { name: "전화" })).toHaveAttribute(
    "href",
    "tel:01012345678",
  );
  await expect(firstEntry.getByRole("link", { name: "문자" })).toHaveAttribute(
    "href",
    "sms:01012345678",
  );

  // ── 오시는 길: 외부 지도 링크 3종 (예식장 이름으로 검색 — 장소 카드로 바로 연결)
  const encoded = encodeURIComponent("라온컨벤션");
  const mapLinks = guest.locator("[data-map-links] a");
  await expect(mapLinks).toHaveCount(3);
  await expect(mapLinks.nth(0)).toHaveAttribute(
    "href",
    `https://map.naver.com/p/search/${encoded}`,
  );
  await expect(mapLinks.nth(1)).toHaveAttribute(
    "href",
    `https://map.kakao.com/link/search/${encoded}`,
  );
  await expect(mapLinks.nth(2)).toHaveAttribute("href", `tmap://search?name=${encoded}`);
  await expect(mapLinks.nth(0)).toHaveAttribute("target", "_blank");

  // ── 캘린더: 실시간 카운트다운(기본 표시) + 일정 저장(.ics 다운로드, UTC 변환 확인)
  const countdown = guest.locator("[data-dday-countdown]");
  await expect(countdown).toContainText(/\d+\s*DAYS/);
  await expect(countdown).toContainText("SEC");
  // 초가 실제로 줄어든다 — 1초 뒤 표시가 달라져야 한다
  const beforeTick = await countdown.innerText();
  await expect(async () => {
    expect(await countdown.innerText()).not.toBe(beforeTick);
  }).toPass({ timeout: 3_000 });
  const downloadPromise = guest.waitForEvent("download");
  await guest.getByRole("button", { name: /일정 저장/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("wedding.ics");
  const ics = await readFile((await download.path())!, "utf-8");
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).toContain("DTSTART:20261114T050000Z"); // 서울 14:00 → UTC 05:00
  expect(ics).toContain("SUMMARY:김민준 ♥ 이서연 결혼식");
  expect(ics).toContain("LOCATION:라온컨벤션 3층 그랜드볼룸 서울특별시 강남구 테헤란로 132");

  // ── 맺음말: 링크 공유 (Web Share 미지원 → 클립보드 fallback)
  await guest.getByRole("button", { name: "청첩장 링크 공유" }).click();
  await expect(guest.getByText("링크가 복사되었습니다")).toBeVisible();
  expect(await guest.evaluate(() => navigator.clipboard.readText())).toContain(`/i/${slug}`);

  await context.close();
});

test("개인정보: 숨긴 섹션의 계좌·연락처는 공개 응답에 실리지 않는다", async ({ page, browser }) => {
  await signUpFresh(page);
  await createSample(page);
  await waitSaved(page);

  // 마음 전하실 곳·연락처 섹션 숨김 (creator가 섹션을 끌 수 있어야 한다)
  await page.getByRole("button", { name: "마음 전하실 곳 숨기기" }).click();
  await page.getByRole("button", { name: "연락처 숨기기" }).click();
  await waitSaved(page);
  const slug = await publishCurrent(page);

  const { context, page: guest } = await newGuestPage(browser);
  await guest.goto(`/i/${slug}`);
  await expect(guest.locator("[data-invitation-root]")).toBeVisible();

  // 렌더만 안 되는 것이 아니라 HTML(직렬화된 payload 포함) 어디에도 없어야 한다
  const hiddenHtml = await guest.content();
  expect(hiddenHtml).not.toContain("123456-01-234567");
  expect(hiddenHtml).not.toContain("110-234-567890");
  expect(hiddenHtml).not.toContain("010-1234-5678");
  expect(hiddenHtml).not.toContain("마음 전하실 곳");

  // 다시 표시 + 재발행하면 게스트에게 보인다
  await page.getByRole("button", { name: "마음 전하실 곳 표시" }).click();
  await page.getByRole("button", { name: "연락처 표시" }).click();
  await waitSaved(page);
  await republish(page);
  await guest.reload();
  await expect(guest.getByRole("button", { name: "신랑측", exact: true })).toBeVisible();
  const shownHtml = await guest.content();
  expect(shownHtml).toContain("123456-01-234567");

  await context.close();
});

test("좁은 뷰포트: 긴 주소·긴 교통 안내가 360/390/430에서 넘치지 않는다", async ({ browser }) => {
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.emulateMedia({ reducedMotion: "reduce" });

  for (const width of [360, 390, 430]) {
    await guest.setViewportSize({ width, height: 844 });
    await guest.goto("/fixture/warm-editorial/long-transport");
    await expect(guest.getByText("지하철로 오시는 매우 상세한 안내")).toBeVisible();
    await expect(guest.locator("[data-section-id] > div.px-6").last()).toHaveCSS("opacity", "1");

    // 가로 스크롤(넘침) 없음
    const overflow = await guest.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await guest.screenshot({
      path: `screenshots/phase8/long-transport-${width}.png`,
      fullPage: true,
    });
  }
  await context.close();
});

test("공개 페이지 스크린샷: 신규 섹션 전체 (360/390/430)", async ({ page, browser }) => {
  await signUpFresh(page);
  await createSample(page);
  await waitSaved(page);
  const slug = await publishCurrent(page);

  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [360, 390, 430]) {
    await guest.setViewportSize({ width, height: 844 });
    await guest.goto(`/i/${slug}`);
    await expect(guest.locator("[data-invitation-root]")).toBeVisible();
    await expect(guest.locator("[data-section-id] > div.px-6").last()).toHaveCSS("opacity", "1");
    await guest.screenshot({ path: `screenshots/phase8/public-${width}.png`, fullPage: true });
  }
  await context.close();
});
