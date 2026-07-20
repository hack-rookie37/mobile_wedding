import { expect, test, type Locator, type Page } from "@playwright/test";
import { signUpFresh } from "./helpers/auth";
import { fetchStoredDoc } from "./helpers/db";
import { makeTestPng } from "./helpers/png";

// Phase 5 — media library · gallery editor 검증
// Phase 6부터 asset은 사용자별 Supabase Storage — 테스트마다 새 사용자라 보관함이 비어 있다.

const PORTRAIT = {
  name: "portrait.png",
  mimeType: "image/png",
  buffer: makeTestPng(900, 1350, { seed: 1, marker: { x: 450, y: 400 } }),
};
const LANDSCAPE = {
  name: "landscape.png",
  mimeType: "image/png",
  buffer: makeTestPng(1350, 900, { seed: 2, marker: { x: 340, y: 450 } }),
};

async function createProject(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  const user = await signUpFresh(page);
  await page.getByRole("button", { name: "샘플 청첩장 만들기" }).click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator("[data-invitation-root]")).toBeVisible();
  return { projectId: new URL(page.url()).pathname.split("/").pop()!, user };
}

const inspector = (page: Page) => page.locator("aside").last();
const preview = (page: Page) => page.locator("[data-invitation-root]");
const galleryImages = (page: Page) => preview(page).locator("figure img");
const mediaDialog = (page: Page) => page.getByRole("dialog", { name: "사진 보관함" });

async function openGalleryLibrary(page: Page) {
  await page.getByRole("button", { name: "갤러리", exact: true }).click();
  await inspector(page).getByRole("button", { name: "+ 사진 추가" }).click();
  await expect(mediaDialog(page)).toBeVisible();
}

async function uploadFiles(
  page: Page,
  files: { name: string; mimeType: string; buffer: Buffer }[],
) {
  await mediaDialog(page).locator('input[type="file"]').setInputFiles(files);
}

function uploadItem(page: Page, filename: string): Locator {
  return mediaDialog(page).locator("[data-upload-item]", { hasText: filename });
}

async function photoRowLabels(page: Page): Promise<string[]> {
  return inspector(page).locator("[data-photo-row] [data-photo-select]").allTextContents();
}

test("업로드: 검증(형식·크기·저해상도)·중복·재시도·일괄 추가·undo", async ({ page }) => {
  await createProject(page);
  await openGalleryLibrary(page);

  // 정상 업로드 → 완료 + 자동 선택
  await uploadFiles(page, [PORTRAIT]);
  await expect(uploadItem(page, "portrait.png")).toHaveAttribute("data-upload-status", "done");

  // 중복 업로드 → 새 asset을 만들지 않고 기존 선택
  const tileCount = await mediaDialog(page).locator("[data-asset-tile]").count();
  await uploadFiles(page, [{ ...PORTRAIT, name: "same-content.png" }]);
  await expect(uploadItem(page, "same-content.png")).toHaveAttribute(
    "data-upload-status",
    "duplicate",
  );
  await expect(uploadItem(page, "same-content.png")).toContainText("이미 업로드된 사진");
  await expect(mediaDialog(page).locator("[data-asset-tile]")).toHaveCount(tileCount);

  // 잘못된 형식 → 실패 + 재시도 버튼 (재시도해도 같은 이유로 실패)
  await uploadFiles(page, [
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
  ]);
  const invalidItem = uploadItem(page, "notes.txt");
  await expect(invalidItem).toHaveAttribute("data-upload-status", "error");
  await expect(invalidItem).toContainText("지원하지 않는 파일 형식");
  await invalidItem.getByRole("button", { name: "재시도" }).click();
  await expect(invalidItem).toHaveAttribute("data-upload-status", "error");

  // 크기 초과 → 실패
  await uploadFiles(page, [
    { name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ]);
  await expect(uploadItem(page, "huge.png")).toContainText("파일이 너무 큽니다");

  // 저해상도 → 업로드는 성공하되 경고
  await uploadFiles(page, [
    {
      name: "tiny.png",
      mimeType: "image/png",
      buffer: makeTestPng(300, 200, { seed: 3 }),
    },
  ]);
  await expect(uploadItem(page, "tiny.png")).toHaveAttribute("data-upload-status", "done");
  await expect(uploadItem(page, "tiny.png")).toContainText("해상도가 낮습니다");

  // 성공한 2장(portrait·tiny)이 자동 선택되어 있다 → 일괄 추가 = undo 1스텝(batch)
  await expect(galleryImages(page)).toHaveCount(6);
  await mediaDialog(page).getByRole("button", { name: "선택한 2장 추가" }).click();
  await expect(mediaDialog(page)).toBeHidden();
  await expect(galleryImages(page)).toHaveCount(8);
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(galleryImages(page)).toHaveCount(6);
});

test("갤러리 reorder: 드래그와 키보드(Alt+화살표) 모두 동작하고 undo된다", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "갤러리", exact: true }).click();

  const initial = [
    "한강 산책",
    "자주 가던 카페",
    "제주, 봄",
    "웨딩 촬영 야외",
    "웨딩 촬영 스튜디오",
    "그날의 대답은 예",
  ];
  expect(await photoRowLabels(page)).toEqual(initial);

  // 드래그: 1번째를 3번째 아래로
  const rows = inspector(page).locator("[data-photo-row]");
  await rows.nth(0).dragTo(rows.nth(2), { targetPosition: { x: 60, y: 40 } });
  await expect
    .poll(() => photoRowLabels(page))
    .toEqual([
      "자주 가던 카페",
      "제주, 봄",
      "한강 산책",
      "웨딩 촬영 야외",
      "웨딩 촬영 스튜디오",
      "그날의 대답은 예",
    ]);
  // 미리보기 순서도 동기화
  await expect(galleryImages(page).first()).toHaveAttribute("alt", "카페에서");

  // 키보드: 첫 행을 Alt+↓로 한 칸 아래로
  const firstRowButton = inspector(page).locator("[data-photo-select]").first();
  await firstRowButton.focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect
    .poll(() => photoRowLabels(page))
    .toEqual([
      "제주, 봄",
      "자주 가던 카페",
      "한강 산책",
      "웨딩 촬영 야외",
      "웨딩 촬영 스튜디오",
      "그날의 대답은 예",
    ]);

  // undo 2번 → 원래 순서
  await page.getByRole("button", { name: "실행 취소" }).click();
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect.poll(() => photoRowLabels(page)).toEqual(initial);
  await expect(galleryImages(page).first()).toHaveAttribute("alt", "한강 산책 스냅");
});

test("caption·alt 편집과 variant 전환(이미지·순서 보존)", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "갤러리", exact: true }).click();

  // caption·alt 수정 → 문서와 미리보기 반영 (슬라이더에서 caption 노출)
  await inspector(page).getByRole("button", { name: "레이아웃", exact: true }).click();
  await inspector(page).getByRole("button", { name: "슬라이더" }).click();
  await inspector(page).getByRole("button", { name: "내용", exact: true }).click();
  await inspector(page).locator("[data-photo-select]").first().click();
  await inspector(page).getByLabel("캡션 (사진 아래 표시)").fill("첫눈 오던 날");
  await inspector(page).getByLabel("대체 텍스트 (스크린리더용)").fill("눈 내리던 거리에서");
  await expect(preview(page).getByText("첫눈 오던 날")).toBeVisible();
  await expect(galleryImages(page).first()).toHaveAttribute("alt", "눈 내리던 거리에서");

  // variant 순회: 사진 수·첫 사진이 그대로 보존된다
  const firstSrc = await galleryImages(page).first().getAttribute("src");
  await inspector(page).getByRole("button", { name: "레이아웃", exact: true }).click();
  for (const variant of ["2열", "3열", "콜라주", "슬라이더"]) {
    await inspector(page).getByRole("button", { name: variant, exact: true }).click();
    await expect(galleryImages(page)).toHaveCount(6);
    expect(await galleryImages(page).first().getAttribute("src")).toBe(firstSrc);
  }
  // 슬라이더로 돌아왔으니 caption도 그대로
  await expect(preview(page).getByText("첫눈 오던 날")).toBeVisible();
});

test("crop(확대·초점): 키보드 조정, JSON 저장, 초기화, undo", async ({ page }) => {
  const { projectId, user } = await createProject(page);
  await page.getByRole("button", { name: "갤러리", exact: true }).click();
  await inspector(page).locator("[data-photo-select]").first().click();

  // 확대 1.00 → 2.00 (ArrowRight ×20, step 0.05) — 슬라이더 키보드 접근성 검증 겸용
  const zoom = inspector(page).getByLabel("확대");
  for (let i = 0; i < 20; i++) await zoom.press("ArrowRight");
  // 초점 세로 0.5 → 0.2 (ArrowLeft ×30, step 0.01)
  const focalY = inspector(page).getByLabel("초점 세로");
  for (let i = 0; i < 30; i++) await focalY.press("ArrowLeft");

  const firstImage = galleryImages(page).first();
  await expect(firstImage).toHaveCSS("transform", "matrix(2, 0, 0, 2, 0, 0)");
  await expect(firstImage).toHaveCSS("object-position", "50% 20%");

  // 자동 저장 후 서버에 저장된 문서 JSON에 crop metadata만 있는지 확인 (원본·base64 없음)
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  const storedDoc = (await fetchStoredDoc(user, projectId)) as {
    sections: { type: string }[];
  };
  const gallery = storedDoc.sections.find(
    (s: { type: string }) => s.type === "gallery",
  ) as unknown as { content: { photos: { assetId: string; frame?: object }[] } };
  expect(gallery.content.photos[0].frame).toEqual({ zoom: 2, focalX: 0.5, focalY: 0.2 });
  expect(JSON.stringify(storedDoc)).not.toContain("data:image"); // base64 금지

  // 초기화 → 기본 표시로 복귀, undo → crop 복원
  await inspector(page).getByRole("button", { name: "Crop 초기화" }).click();
  await expect(firstImage).toHaveCSS("transform", "none");
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(firstImage).toHaveCSS("transform", "matrix(2, 0, 0, 2, 0, 0)");
});

test("hero 사진: 기존 이미지 선택으로 교체, crop, 제거", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "메인", exact: true }).click();

  const heroImage = preview(page).locator('img[alt="대표 사진"]');
  await expect(heroImage).toHaveAttribute("src", /hero-main/);

  // 보관함에서 기존(기본 제공) 이미지 선택
  await inspector(page).getByRole("button", { name: "사진 교체" }).click();
  await mediaDialog(page).getByRole("button", { name: "샘플 갤러리 2 선택" }).click();
  await mediaDialog(page).getByRole("button", { name: "대표 사진으로 사용" }).click();
  await expect(heroImage).toHaveAttribute("src", /gallery-02/);

  // hero도 같은 crop 편집기 사용
  const zoom = inspector(page).getByLabel("확대");
  for (let i = 0; i < 10; i++) await zoom.press("ArrowRight");
  await expect(heroImage).toHaveCSS("transform", "matrix(1.5, 0, 0, 1.5, 0, 0)");

  // 제거 → 사진 없음 (undo로 복원)
  await inspector(page).getByRole("button", { name: "사진 제거" }).click();
  await expect(heroImage).toBeHidden();
  await page.getByRole("button", { name: "실행 취소" }).click();
  await expect(heroImage).toHaveAttribute("src", /gallery-02/);
});

test("asset 삭제: 사용 중 경고 후 삭제하면 안전한 '이미지 없음' fallback", async ({ page }) => {
  await createProject(page);
  await openGalleryLibrary(page);
  await uploadFiles(page, [PORTRAIT]);
  await expect(uploadItem(page, "portrait.png")).toHaveAttribute("data-upload-status", "done");
  await mediaDialog(page).getByRole("button", { name: "선택한 1장 추가" }).click();
  await expect(galleryImages(page)).toHaveCount(7);

  // 다시 열어 사용 중인 asset 삭제 (경고 문구 확인)
  await inspector(page).getByRole("button", { name: "+ 사진 추가" }).click();
  await mediaDialog(page).getByRole("button", { name: "portrait.png 삭제" }).click();
  await expect(mediaDialog(page).getByText("사용 중 — ‘이미지 없음’으로 표시됩니다")).toBeVisible();
  await mediaDialog(page).getByRole("button", { name: "삭제", exact: true }).click();
  await expect(
    mediaDialog(page).locator("[data-asset-tile][data-asset-id]", { hasText: "portrait.png" }),
  ).toHaveCount(0);
  await mediaDialog(page).getByRole("button", { name: "취소" }).click();

  // 참조는 남아 있고 placeholder로 표시된다 (레이아웃 자리도 유지)
  await expect(preview(page).getByText("이미지 없음")).toBeVisible();
  expect(await photoRowLabels(page)).toHaveLength(7);
});

test("lightbox 접근성: 열기·화살표 탐색·Esc 닫기·포커스 복귀", async ({ page }) => {
  await createProject(page);
  // 인터랙션 모드 = published 렌더 → 사진 탭이 lightbox를 연다
  await page.getByRole("button", { name: "인터랙션", exact: true }).click();

  const trigger = preview(page).getByRole("button", { name: "사진 크게 보기: 한강 산책" });
  await trigger.click();

  const lightbox = page.getByRole("dialog", { name: "사진 크게 보기" });
  await expect(lightbox).toBeVisible();
  await expect(lightbox).toContainText("1 / 6");
  await expect(lightbox).toContainText("한강 산책");

  // 키보드 화살표 → 다음/이전
  await page.keyboard.press("ArrowRight");
  await expect(lightbox).toContainText("2 / 6");
  await page.keyboard.press("ArrowLeft");
  await expect(lightbox).toContainText("1 / 6");
  // 버튼 탐색
  await lightbox.getByRole("button", { name: "다음 사진" }).click();
  await expect(lightbox).toContainText("2 / 6");

  // Esc 닫기 → 트리거로 포커스 복귀 (native dialog 보장)
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
  await expect(trigger).toBeFocused();

  // 편집 모드에서는 클릭이 섹션 선택에 쓰인다 — lightbox 트리거가 없어야 한다
  await page.getByRole("button", { name: "편집", exact: true }).click();
  await expect(preview(page).getByRole("button", { name: /사진 크게 보기/ })).toHaveCount(0);
});

test("video 섹션: YouTube·Vimeo URL만 임베드, 잘못된 주소는 안내", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "+ 섹션 추가" }).click();
  await page.getByRole("menuitem", { name: "동영상" }).click();

  // 빈 URL: placeholder (16:9 자리 예약)
  await expect(preview(page).getByText("동영상 주소를 입력하면 여기에 표시됩니다")).toBeVisible();

  // 잘못된 주소
  const urlField = inspector(page).getByLabel("동영상 URL");
  await urlField.fill("https://example.com/watch?v=abc123def");
  await expect(inspector(page).getByText("인식할 수 없는 주소입니다")).toBeVisible();
  await expect(preview(page).getByText("지원하지 않는 동영상 주소입니다")).toBeVisible();

  // YouTube 인식 → 기본 variant는 facade(탭하여 재생) — 자동재생 금지 (Phase 8)
  await urlField.fill("https://youtu.be/dQw4w9WgXcQ");
  await expect(inspector(page).getByText("YouTube 동영상으로 인식했습니다")).toBeVisible();
  await expect(preview(page).locator("[data-video-facade]")).toBeVisible();

  // '즉시 임베드' variant → lazy iframe
  await inspector(page).getByRole("button", { name: "레이아웃", exact: true }).click();
  await inspector(page).getByRole("button", { name: "즉시 임베드" }).click();
  const iframe = preview(page).locator("iframe");
  await expect(iframe).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  await expect(iframe).toHaveAttribute("loading", "lazy");
});

test("모바일 스크린샷: 세로·가로 사진 crop을 4개 variant와 crop 적용 상태로 촬영", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { projectId } = await createProject(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  // 세로·가로 테스트 사진 업로드 후 갤러리에 추가
  await openGalleryLibrary(page);
  await uploadFiles(page, [PORTRAIT, LANDSCAPE]);
  await expect(uploadItem(page, "portrait.png")).toHaveAttribute("data-upload-status", "done");
  await expect(uploadItem(page, "landscape.png")).toHaveAttribute("data-upload-status", "done");
  await mediaDialog(page).getByRole("button", { name: "선택한 2장 추가" }).click();
  await expect(galleryImages(page)).toHaveCount(8);

  // hero도 업로드 사진(세로)으로 교체 — 아치 프레임에서의 crop 확인용
  await page.getByRole("button", { name: "메인", exact: true }).click();
  await inspector(page).getByRole("button", { name: "사진 교체" }).click();
  await mediaDialog(page).getByRole("button", { name: "portrait.png 선택" }).click();
  await mediaDialog(page).getByRole("button", { name: "대표 사진으로 사용" }).click();
  await expect(preview(page).locator('img[alt="대표 사진"]')).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/public\/photos\//,
  );

  const editorUrl = page.url();
  const setVariant = async (label: string) => {
    await page.getByRole("button", { name: "갤러리", exact: true }).click();
    await inspector(page).getByRole("button", { name: "레이아웃", exact: true }).click();
    await inspector(page).getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  };
  const shoot = async (name: string) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/preview/${projectId}`);
    await expect(page.locator("[data-invitation-root]")).toBeVisible();
    await expect(galleryImages(page).first()).toBeVisible();
    await page.waitForTimeout(400); // blob 이미지 페인트 대기
    await page.screenshot({ path: `screenshots/media/${name}.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(editorUrl);
    await expect(page.locator("[data-invitation-root]")).toBeVisible();
  };

  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  await shoot("preview-grid3-390");
  await setVariant("2열");
  await shoot("preview-grid2-390");
  await setVariant("슬라이더");
  await shoot("preview-slider-390");
  await setVariant("콜라주");
  await shoot("preview-collage-390");

  // 업로드한 세로 사진(7번째)에 crop: 확대 1.5 + 초점을 마커(위쪽 30%)로
  await page.getByRole("button", { name: "갤러리", exact: true }).click();
  await inspector(page).getByRole("button", { name: "내용", exact: true }).click();
  await inspector(page).locator("[data-photo-select]").nth(6).click();
  const zoom = inspector(page).getByLabel("확대");
  for (let i = 0; i < 10; i++) await zoom.press("ArrowRight");
  const focalY = inspector(page).getByLabel("초점 세로");
  for (let i = 0; i < 20; i++) await focalY.press("ArrowLeft");
  await expect(page.getByText("저장됨")).toBeVisible({ timeout: 5000 });
  await shoot("preview-collage-crop-390");
});
