import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";
import { fetchRsvpRows } from "./helpers/db";

// Phase 9 — RSVP: 게스트 제출·중복 처리·소프트 가드, 제작자 결과 뷰(집계·검색·필터·삭제·CSV),
// /api/rsvp 보안(검증·허니팟·rate limit), XSS·CSV injection 방어

async function createSample(page: Page): Promise<string> {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

const publishDialog = (page: Page) => page.getByRole("dialog", { name: "공유·발행" });

function uniqueSlug(): string {
  return `e2e9-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

async function newGuestPage(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  return { context, page };
}

// 폼이 바텀시트 뒤에 있으면 연다 (sheet variant 기본) — 이미 열려 있으면 그대로
async function openRsvpSheetIfNeeded(page: Page) {
  if (await page.locator("[data-rsvp-form]").isVisible()) return;
  const open = page.locator("[data-rsvp-open]");
  if (await open.isVisible()) await open.click();
}

// 게스트 폼 채우기 — 라디오 칩은 sr-only input이라 force로 체크한다
async function fillRsvpForm(
  page: Page,
  values: { name: string; attending: "참석" | "불참"; side?: string; companions?: string },
) {
  await openRsvpSheetIfNeeded(page);
  const root = page.locator("[data-rsvp-form]");
  await root.getByLabel("성함").fill(values.name);
  await root.getByRole("radio", { name: values.attending, exact: true }).check({ force: true });
  if (values.side !== undefined) {
    await root.getByRole("radio", { name: values.side, exact: true }).check({ force: true });
  }
  if (values.companions !== undefined) {
    await root.getByLabel("동반 인원").fill(values.companions);
  }
}

function apiPayload(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    clientToken: crypto.randomUUID(),
    guestName: "API 게스트",
    side: null,
    attending: true,
    companions: null,
    meal: null,
    phone: null,
    message: null,
    consent: true,
    ...overrides,
  };
}

async function postRsvp(request: APIRequestContext, slug: string, overrides = {}) {
  return request.post("/api/rsvp", { data: apiPayload(slug, overrides) });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
});

test("게스트: 제출 → 성공 상태 → 소프트 가드 → 수정 제출, 동의 없이는 제출 불가", async ({
  page,
  browser,
}) => {
  const user = await signUpFresh(page);
  const projectId = await createSample(page);
  const slug = await publishCurrent(page);

  const { context, page: guest } = await newGuestPage(browser);
  await guest.goto(`/i/${slug}`);
  await expect(guest.locator("[data-rsvp-open]")).toBeVisible();

  // 필수 입력 + 선택 항목 작성 (fillRsvpForm이 시트를 연다)
  await fillRsvpForm(guest, { name: "김하객", attending: "참석", side: "신랑측", companions: "2" });
  await guest
    .locator("[data-rsvp-form]")
    .getByRole("radio", { name: "식사 예정" })
    .check({ force: true });
  await guest.locator("[data-rsvp-form]").getByLabel("연락처").fill("010-2222-3333");
  await guest.locator("[data-rsvp-form]").getByLabel("전하고 싶은 말").fill("결혼 축하드립니다!");

  // 동의 없이 제출 → native required가 막는다 (성공 패널이 나타나지 않음)
  await guest.getByRole("button", { name: "참석 의사 전달하기" }).click();
  await expect(guest.locator("[data-rsvp-done]")).toHaveCount(0);

  // 동의 후 제출 성공
  await guest.locator("[data-rsvp-consent] input[type=checkbox]").check();
  await guest.getByRole("button", { name: "참석 의사 전달하기" }).click();
  await expect(guest.locator("[data-rsvp-done]")).toBeVisible();
  await expect(guest.getByText("참석 의사가 전달되었습니다")).toBeVisible();

  // 새로고침 → localStorage 소프트 가드
  await guest.reload();
  await expect(guest.locator("[data-rsvp-already]")).toBeVisible();
  await expect(guest.getByText("이미 참석 의사를 전달하셨습니다")).toBeVisible();

  // 수정 제출 — 같은 토큰이 재사용되어 서버에서 '수정'으로 처리된다 (중복 제출 처리)
  await guest.getByRole("button", { name: "응답 수정하기" }).click();
  await fillRsvpForm(guest, { name: "김하객", attending: "불참" });
  await guest.locator("[data-rsvp-consent] input[type=checkbox]").check();
  await guest.getByRole("button", { name: "참석 의사 전달하기" }).click();
  await expect(guest.getByText("응답이 수정되었습니다")).toBeVisible();

  // 게스트 페이지 HTML에는 어떤 응답 데이터도 없다 (public projection 제외)
  const html = await (await guest.request.get(`/i/${slug}`)).text();
  expect(html).not.toContain("김하객");
  expect(html).not.toContain("010-2222-3333");

  await guest.screenshot({ path: "screenshots/phase9/guest-rsvp-390.png", fullPage: false });
  await context.close();

  // 서버에는 최종 1건(불참)만 존재한다
  const rows = await fetchRsvpRows(user, projectId);
  expect(rows.map((r) => r.guest_name)).toEqual(["김하객"]);
});

test("제작자: 집계·검색·필터·상세·삭제·CSV(수식 주입 방어)·XSS 방어", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const slug = await publishCurrent(page);

  // API로 게스트 3명 제출 (악성 이름·메시지 포함)
  await expect(
    await postRsvp(page.request, slug, {
      guestName: "박참석",
      side: "groom",
      companions: 2,
      meal: "yes",
      phone: "010-1111-2222",
    }),
  ).toBeOK();
  await expect(
    await postRsvp(page.request, slug, { guestName: "이불참", side: "bride", attending: false }),
  ).toBeOK();
  await expect(
    await postRsvp(page.request, slug, {
      guestName: "=SUM(A1:A2)",
      message: "<script>alert(1)</script>",
      side: null,
      companions: 0,
      meal: "undecided",
    }),
  ).toBeOK();

  // 편집기 상단 링크로 결과 페이지 진입
  await page.getByRole("link", { name: "RSVP 응답" }).click();
  await page.waitForURL(/\/rsvp$/);

  // 집계: 참석 2(동반 +2 → 예상 4) / 불참 1
  const summarySection = page.getByRole("region", { name: "집계" });
  await expect(summarySection.getByText("참석").first()).toBeVisible();
  await expect(summarySection.getByText("2명").first()).toBeVisible();
  await expect(summarySection.getByText("동반 +2 → 예상 4명")).toBeVisible();
  await expect(page.getByText("3 / 3건")).toBeVisible();

  // XSS 방어: 스크립트가 텍스트로 렌더된다 (React escaping)
  await page.getByRole("row").filter({ hasText: "=SUM(A1:A2)" }).click();
  await expect(
    page.locator("[data-rsvp-detail]").getByText("<script>alert(1)</script>"),
  ).toBeVisible();

  // 검색
  await page.getByLabel("응답 검색").fill("박참석");
  await expect(page.locator("[data-rsvp-row]")).toHaveCount(1);
  await expect(page.getByText("1 / 3건")).toBeVisible();
  await page.getByLabel("응답 검색").fill("");

  // 참석 여부 필터
  await page.getByRole("button", { name: "불참", exact: true }).click();
  await expect(page.locator("[data-rsvp-row]")).toHaveCount(1);
  await expect(page.locator("[data-rsvp-row]").getByText("이불참")).toBeVisible();
  await page.getByRole("button", { name: "전체", exact: true }).click();
  await expect(page.locator("[data-rsvp-row]")).toHaveCount(3);

  // 상세 보기 + 개별 삭제
  await page.getByRole("row").filter({ hasText: "박참석" }).click();
  const detail = page.locator("[data-rsvp-detail]");
  await expect(detail.getByText("010-1111-2222")).toBeVisible();
  await detail.getByRole("button", { name: "이 응답 삭제" }).click();
  await detail.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.locator("[data-rsvp-row]")).toHaveCount(2);

  // CSV: BOM + 헤더 + 수식 무력화
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV 다운로드" }).click();
  const download = await downloadPromise;
  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(await download.path(), "utf8");
  expect(csv.startsWith("\uFEFF이름,구분,참석 여부,동반 인원,식사,연락처,메시지,제출 시각")).toBe(
    true,
  );
  expect(csv).toContain("'=SUM(A1:A2)");
  expect(csv).toContain("이불참,신부측,불참");

  // 전체 삭제 (retention 대응)
  await page.getByRole("button", { name: "전체 삭제" }).click();
  await page.getByRole("button", { name: /건 모두 삭제/ }).click();
  await expect(page.getByText("아직 응답이 없습니다")).toBeVisible();
});

test("/api/rsvp: invalid input 400, 잘못된 content-type 415, 허니팟은 저장 없이 무해화", async ({
  page,
}) => {
  const user = await signUpFresh(page);
  const projectId = await createSample(page);
  const slug = await publishCurrent(page);

  // 동의 누락 → 400
  expect((await postRsvp(page.request, slug, { consent: false })).status()).toBe(400);
  // 초과 길이 → 400
  expect((await postRsvp(page.request, slug, { guestName: "가".repeat(41) })).status()).toBe(400);
  // JSON이 아닌 body → 415 (cross-origin form 제출 벡터 차단)
  const formPost = await page.request.post("/api/rsvp", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: "slug=x",
  });
  expect(formPost.status()).toBe(415);
  // 없는 slug → 404
  expect((await postRsvp(page.request, "no-such-slug-e2e9")).status()).toBe(404);

  // 허니팟: 성공처럼 응답하지만 저장되지 않는다
  const bot = await postRsvp(page.request, slug, { guestName: "봇게스트", website: "http://spam" });
  expect(bot.status()).toBe(200);
  expect(await fetchRsvpRows(user, projectId)).toEqual([]);
});

test("/api/rsvp: IP+slug 슬라이딩 윈도우 rate limit — 초과분은 429", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  const slug = await publishCurrent(page);

  // 같은 토큰으로 반복 제출(행은 1개 유지) — 20/분 초과분부터 429
  const clientToken = crypto.randomUUID();
  const statuses: number[] = [];
  for (let i = 0; i < 22; i++) {
    statuses.push((await postRsvp(page.request, slug, { clientToken })).status());
  }
  expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
  expect(statuses.slice(20)).toEqual([429, 429]);
});

test("편집기: RSVP 단일 인스턴스, 폼 구성 편집이 미리보기에 반영", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);

  // 이미 있으므로 추가 메뉴에서 비활성
  await page.getByRole("button", { name: "+ 섹션 추가" }).click();
  await expect(page.getByRole("menuitem", { name: "참석 여부 (RSVP) (추가됨)" })).toBeDisabled();
  await page.locator(".fixed.inset-0").first().click(); // 백드롭 클릭으로 메뉴 닫기

  // 섹션 선택 → 수집 항목 토글: 연락처 off → 미리보기에서 연락처 필드 제거
  await page.getByRole("button", { name: "참석 여부 (RSVP)", exact: true }).click();
  const canvas = page.locator("[data-invitation-root]");
  await expect(canvas.getByLabel("연락처")).toBeVisible();
  await page.getByRole("checkbox", { name: "연락처" }).uncheck();
  await expect(canvas.getByLabel("연락처")).toHaveCount(0);

  // 마감일 설정 → 미리보기에 안내 표시, 과거 마감일 → 마감 상태
  await page.getByLabel("마감일").fill("2030-12-31T23:59");
  await expect(canvas.locator("[data-rsvp-deadline]")).toContainText("까지 전해 주세요");
  await page.getByLabel("마감일").fill("2020-01-01T00:00");
  await expect(canvas.locator("[data-rsvp-closed]")).toBeVisible();
  await page.getByRole("button", { name: "없애기" }).click();
  await expect(canvas.locator("[data-rsvp-form]")).toBeVisible();

  // 삭제하면 다시 추가할 수 있다
  await page.getByRole("button", { name: "참석 여부 (RSVP) 섹션 메뉴" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("button", { name: "+ 섹션 추가" }).click();
  const addItem = page.getByRole("menuitem", { name: "참석 여부 (RSVP)" });
  await expect(addItem).toBeEnabled();
  await addItem.click();
  await expect(
    page.locator("aside").last().getByRole("heading", { name: "참석 여부 (RSVP)" }),
  ).toBeVisible();
});

test("발행 전 미리보기·비공개 미리보기의 RSVP 폼은 제출 불가 상태다", async ({ page, browser }) => {
  await signUpFresh(page);
  await createSample(page);

  // 편집기 미리보기(인터랙션 모드): 시트는 열리지만 제출 버튼은 비활성 + 안내 문구
  await page.getByRole("button", { name: "인터랙션" }).click();
  const canvas = page.locator("[data-invitation-root]");
  await canvas.getByRole("button", { name: "참석 여부 전달하기" }).click();
  const sheet = page.locator("[data-rsvp-sheet]");
  await expect(sheet.getByRole("button", { name: "참석 의사 전달하기" })).toBeDisabled();
  await expect(sheet.getByText("게스트는 발행된 청첩장에서 제출할 수 있습니다.")).toBeVisible();
  await sheet.getByRole("button", { name: "닫기" }).click();

  // 발행 후 게스트 페이지에서는 활성
  const slug = await publishCurrent(page);
  const { context, page: guest } = await newGuestPage(browser);
  await guest.goto(`/i/${slug}`);
  await guest.locator("[data-rsvp-open]").click();
  await expect(guest.getByRole("button", { name: "참석 의사 전달하기" })).toBeEnabled();
  await context.close();
});

// 통합 관점 확인: 발행 중단 후 게스트 제출은 서버가 거부한다 (UI 에러 표시)
test("발행 중단 뒤에는 게스트 제출이 거부된다", async ({ page, browser }) => {
  const user = await signUpFresh(page);
  const projectId = await createSample(page);
  const slug = await publishCurrent(page);

  const { context, page: guest } = await newGuestPage(browser);
  await guest.goto(`/i/${slug}`);
  await expect(guest.locator("[data-rsvp-open]")).toBeVisible();

  // 게스트 페이지가 열린 상태에서 발행 중단
  await page.getByRole("button", { name: "공유·발행" }).click();
  await page.getByRole("button", { name: "발행 중단" }).click();
  await expect(publishDialog(page).getByText("발행 중단됨")).toBeVisible();

  await fillRsvpForm(guest, { name: "늦은하객", attending: "참석" });
  await guest.locator("[data-rsvp-consent] input[type=checkbox]").check();
  await guest.getByRole("button", { name: "참석 의사 전달하기" }).click();
  await expect(guest.locator("[data-rsvp-form] [role=alert]")).toContainText(
    "지금은 접수할 수 없습니다",
  );
  await context.close();

  expect(await fetchRsvpRows(user, projectId)).toEqual([]);
});
