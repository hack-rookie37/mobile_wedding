import { expect, test, type Browser, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// 배경음악(BGM) — 업로드 → 편집기 캔버스 토글 → 발행 후 게스트 페이지 토글.
// 실제 오디오 재생은 검증하지 않는다(헤드리스 정책 의존) — 참조·URL 배선과 UI 상태만 본다.

async function createSample(page: Page): Promise<string> {
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

const publishDialog = (page: Page) => page.getByRole("dialog", { name: "공유·발행" });

async function publishCurrent(page: Page): Promise<string> {
  const slug = `e2em-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

// 최소한의 mp3 프레임 헤더 + 무음 — mime·저장 배선 검증용 (실제 디코딩은 하지 않는다)
const TINY_MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x00, ...Array<number>(128).fill(0)]);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
});

test("배경음악: 업로드 → 캔버스 토글 → 발행 후 게스트 표시 → 없애기", async ({ page, browser }) => {
  await signUpFresh(page);
  await createSample(page);

  // 테마 패널의 배경음악 업로드
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await expect(page.getByRole("button", { name: /음악 파일 업로드/ })).toBeVisible();
  await page
    .locator('input[type="file"][accept*="audio"]')
    .setInputFiles({ name: "우리노래.mp3", mimeType: "audio/mpeg", buffer: TINY_MP3 });

  // 업로드 완료 → 파일명 표시 + 캔버스에 음악 토글
  await expect(page.getByText("우리노래.mp3")).toBeVisible();
  const canvas = page.locator("[data-invitation-root]");
  await expect(canvas.locator("[data-music-toggle]")).toBeVisible();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  // 발행 → 게스트 페이지에도 토글이 뜬다 (manifest의 오디오 URL 배선)
  const slug = await publishCurrent(page);
  const { context, page: guest } = await newGuestPage(browser);
  await guest.goto(`/i/${slug}`);
  const guestToggle = guest.locator("[data-music-toggle]");
  await expect(guestToggle).toBeVisible();
  await expect(guestToggle).toHaveAttribute("aria-label", "음악 켜기");
  // 오디오 파일 URL이 실제로 응답하는지 — 하객에게는 /a/ 프록시로 나간다 (ADR-040,
  // Supabase 직행 URL이면 egress 절감이 깨진 것이다. egress.spec이 이미지·폰트를 같은 규칙으로 검사한다)
  const audioSrc = await guest.locator("[data-music-toggle] + audio, audio").getAttribute("src");
  expect(audioSrc).toContain("/a/");
  expect(audioSrc).not.toContain("/storage/");
  const audioResponse = await guest.request.get(audioSrc!);
  expect(audioResponse.ok()).toBe(true);
  await context.close();

  // 없애기 → 캔버스 토글 제거 (undo 가능한 setMusic action)
  await page.getByRole("button", { name: "없애기" }).click();
  await expect(canvas.locator("[data-music-toggle]")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(canvas.locator("[data-music-toggle]")).toBeVisible();
});

test("음악 업로드: 지원하지 않는 형식은 거부 안내", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await page
    .locator('input[type="file"][accept*="audio"]')
    .setInputFiles({ name: "bgm.ogg", mimeType: "audio/ogg", buffer: TINY_MP3 });
  await expect(
    page.getByRole("alert").filter({ hasText: "지원하지 않는 음악 파일 형식" }),
  ).toBeVisible();
});

test("배경음악: 음량·속도·자동재생 설정이 게스트 화면의 audio에 그대로 얹힌다", async ({
  page,
  browser,
}) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await page
    .locator('input[type="file"][accept*="audio"]')
    .setInputFiles({ name: "우리노래.mp3", mimeType: "audio/mpeg", buffer: TINY_MP3 });
  await expect(page.getByText("우리노래.mp3")).toBeVisible();

  // 재생 설정은 파일이 올라온 뒤에만 나온다 — 틀 것이 없으면 고를 것도 없다
  await page.getByLabel("음량", { exact: true }).fill("40");
  await page.getByLabel("재생 속도", { exact: true }).fill("120");
  await page.getByLabel("자동 재생", { exact: true }).check();
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });

  const slug = await publishCurrent(page);
  const { context, page: guest } = await newGuestPage(browser);
  await guest.goto(`/i/${slug}`);
  const audio = guest.locator("[data-music-toggle] + audio");
  // 저장값 0.4 → 세제곱 곡선(ADR-047)으로 얹힌다 — 선형은 상단 절반이 다 비슷하게 들렸다.
  // 이 단언은 element volume 경로(Chromium — audioSession 없음)의 몫이다. Safari는
  // audioSession.type="playback" + GainNode로 같은 감쇠를 얹는다 (ADR-061 — iOS도 적용,
  // 그래프 경로에서는 element volume이 1로 남는다).
  await expect(audio).toHaveJSProperty("volume", 0.4 ** 3);
  await expect(audio).toHaveJSProperty("playbackRate", 1.2);
  // 자동재생을 켜면 미리 받아 둔다 — 첫 동작에 곧바로 소리가 나야 하기 때문
  await expect(audio).toHaveAttribute("preload", "auto");
  await context.close();
});

test("배경음악: 자동재생을 꺼 두면 편집기·게스트 모두 미리 받지 않는다", async ({ page }) => {
  await signUpFresh(page);
  await createSample(page);
  await page.getByRole("button", { name: "테마", exact: true }).click();
  await page
    .locator('input[type="file"][accept*="audio"]')
    .setInputFiles({ name: "우리노래.mp3", mimeType: "audio/mpeg", buffer: TINY_MP3 });
  await expect(page.getByText("우리노래.mp3")).toBeVisible();
  await expect(page.locator("[data-music-toggle] + audio")).toHaveAttribute("preload", "none");
});
