import { expect, test, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";

// Phase 4B — 편집기 UI ↔ action 엔진 연결 검증

async function createProject(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await signUpFresh(page);
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
}

async function rowLabels(page: Page): Promise<string[]> {
  return page.locator("[data-section-row] [data-row-select]").allTextContents();
}

function sectionRow(page: Page, name: string) {
  return page.locator("[data-section-row]", { hasText: name });
}

const inspector = (page: Page) => page.locator("aside").last();

// 샘플 문서의 섹션 라벨 순서 (Phase 9에서 RSVP 포함 11개 섹션으로 확장)
const SAMPLE_LABELS = [
  "메인",
  "인사말",
  "신랑·신부 소개",
  "예식 캘린더",
  "갤러리",
  "오시는 길",
  "교통 안내",
  "연락처",
  "마음 전하실 곳",
  "참석 여부 (RSVP)",
  "맺음말",
];

test("섹션 추가: 목록·미리보기에 나타나고 새 섹션이 선택된다", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "+ 섹션 추가" }).click();
  await page.getByRole("menuitem", { name: "오시는 길" }).click();

  expect(await rowLabels(page)).toEqual([...SAMPLE_LABELS, "오시는 길"]);
  await expect(page.locator("[data-invitation-root] [data-section-id]")).toHaveCount(
    SAMPLE_LABELS.length + 1,
  );
  await expect(inspector(page).getByRole("heading", { name: "오시는 길" })).toBeVisible();

  // undo 한 번으로 추가 취소
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(page.locator("[data-invitation-root] [data-section-id]")).toHaveCount(
    SAMPLE_LABELS.length,
  );
});

test("섹션 복제: 사본이 원본 뒤에 생기고 내용이 같다", async ({ page }) => {
  await createProject(page);
  await sectionRow(page, "인사말").getByRole("button", { name: "인사말 섹션 메뉴" }).click();
  await page.getByRole("menuitem", { name: "복제" }).click();

  expect(await rowLabels(page)).toEqual(["메인", "인사말", "인사말", ...SAMPLE_LABELS.slice(2)]);
  await expect(page.locator("[data-invitation-root]").getByText(/서로가 마주 보며/)).toHaveCount(2);
});

test("섹션 삭제(확인 단계) 후 undo로 복원", async ({ page }) => {
  await createProject(page);
  await sectionRow(page, "갤러리").getByRole("button", { name: "갤러리 섹션 메뉴" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await expect(page.getByText("‘갤러리’ 섹션을 삭제할까요?")).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();

  expect(await rowLabels(page)).toEqual(SAMPLE_LABELS.filter((l) => l !== "갤러리"));

  await page.getByRole("button", { name: "실행 취소" }).click();
  expect(await rowLabels(page)).toEqual(SAMPLE_LABELS);
});

test("drag reorder 후 undo", async ({ page }) => {
  await createProject(page);
  const gallery = page.getByRole("button", { name: "갤러리", exact: true });
  const greeting = page.getByRole("button", { name: "인사말", exact: true });
  await gallery.dragTo(greeting, { targetPosition: { x: 60, y: 4 } });

  await expect
    .poll(() => rowLabels(page))
    .toEqual(["메인", "갤러리", ...SAMPLE_LABELS.slice(1).filter((l) => l !== "갤러리")]);

  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect.poll(() => rowLabels(page)).toEqual(SAMPLE_LABELS);
});

const MOVED_UP = [...SAMPLE_LABELS];
[MOVED_UP[3], MOVED_UP[4]] = [MOVED_UP[4], MOVED_UP[3]]; // 갤러리 ↔ 예식 캘린더

test("keyboard reorder: Alt+화살표로 마우스 없이 순서 변경", async ({ page }) => {
  await createProject(page);
  const gallery = page.getByRole("button", { name: "갤러리", exact: true });
  await gallery.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => rowLabels(page)).toEqual(MOVED_UP);

  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => rowLabels(page)).toEqual(SAMPLE_LABELS);

  // Ctrl+Y redo 경로도 확인: undo → Ctrl+Y
  await page.keyboard.press("Alt+ArrowUp");
  await page.getByRole("button", { name: "실행 취소" }).click();
  await page.keyboard.press("ControlOrMeta+y");
  await expect.poll(() => rowLabels(page)).toEqual(MOVED_UP);
});

test("text 수정과 variant 변경이 미리보기에 동기화되고 내용이 보존된다", async ({ page }) => {
  await createProject(page);
  const preview = page.locator("[data-invitation-root]");

  // 내용 탭에서 text 수정 → 즉시 반영
  await page.getByRole("button", { name: "인사말", exact: true }).click();
  await page.getByLabel("제목").fill("저희 결혼합니다");
  await expect(preview.getByText("저희 결혼합니다")).toBeVisible();

  // 레이아웃 탭에서 variant 변경 → 사진 개수(내용) 보존
  await page.getByRole("button", { name: "갤러리", exact: true }).click();
  const photoCount = await preview.locator("figure img").count();
  await inspector(page).getByRole("button", { name: "레이아웃", exact: true }).click();
  await inspector(page).getByRole("button", { name: "슬라이더" }).click();
  await expect(preview.locator(".snap-x")).toBeVisible();
  await expect(preview.locator("figure img")).toHaveCount(photoCount);

  // 스타일 탭 여백 변경도 엔진 경유로 동작
  await inspector(page).getByRole("button", { name: "스타일", exact: true }).click();
  await inspector(page).getByRole("button", { name: "좁게" }).click();
  await expect(inspector(page).getByRole("button", { name: "좁게" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("preview 클릭으로 섹션 선택", async ({ page }) => {
  await createProject(page);
  // 마지막 섹션(맺음말)의 상단 여백 지점을 클릭
  await page
    .locator("[data-invitation-root] [data-section-id]")
    .last()
    .click({ position: { x: 30, y: 20 } });
  await expect(inspector(page).getByRole("heading", { name: "맺음말" })).toBeVisible();
  // 좌측 목록에도 선택 반영
  await expect(sectionRow(page, "맺음말").locator("[data-row-select]")).toHaveClass(
    /text-tool-accent/,
  );
});

test("preview 폭 전환(360/390/430)과 숨김 토글", async ({ page }) => {
  await createProject(page);
  const frame = page.locator("[data-preview-frame]");
  await expect(frame).toHaveCSS("width", "390px");

  await page.getByRole("button", { name: "360", exact: true }).click();
  await expect(frame).toHaveCSS("width", "360px");
  await page.getByRole("button", { name: "430", exact: true }).click();
  await expect(frame).toHaveCSS("width", "430px");

  // 숨김 토글 → 미리보기에서 제외, 다시 표시
  await sectionRow(page, "갤러리").getByRole("button", { name: "갤러리 숨기기" }).click();
  await expect(page.locator("[data-invitation-root] [data-section-id]")).toHaveCount(
    SAMPLE_LABELS.length - 1,
  );
  await sectionRow(page, "갤러리").getByRole("button", { name: "갤러리 표시" }).click();
  await expect(page.locator("[data-invitation-root] [data-section-id]")).toHaveCount(
    SAMPLE_LABELS.length,
  );
});

test("편집기 4B 스크린샷 (1440×960)", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "갤러리", exact: true }).click();
  await inspector(page).getByRole("button", { name: "레이아웃", exact: true }).click();
  await inspector(page).getByRole("button", { name: "슬라이더" }).click();
  await expect(page.locator("[data-invitation-root] .snap-x")).toBeVisible();
  // 탭·variant 하이라이트가 실제 상태와 일치하는지 검증
  await expect(
    inspector(page).getByRole("button", { name: "레이아웃", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(inspector(page).getByRole("button", { name: "슬라이더" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // 활성 pill(white)과 비활성(transparent)의 실제 렌더 색 검증
  await expect(inspector(page).getByRole("button", { name: "슬라이더" })).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(inspector(page).getByRole("button", { name: "3열" })).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.mouse.move(700, 500); // hover 상태 제거
  await page.screenshot({ path: "screenshots/editor-4b-1440x960.png" });
});
