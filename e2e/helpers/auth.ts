import { expect, type Page } from "@playwright/test";

export interface TestUser {
  email: string;
  password: string;
}

let seq = 0;

// 테스트마다 새 사용자로 가입 → 빈 대시보드에서 시작 (사용자 단위 격리).
// 병렬 워커 간 충돌이 없도록 워커 인덱스 + 랜덤 suffix로 이메일을 만든다.
export async function signUpFresh(page: Page): Promise<TestUser> {
  const worker = process.env.TEST_WORKER_INDEX ?? "0";
  const user: TestUser = {
    email: `e2e-w${worker}-${Date.now()}-${seq++}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "e2e-password-123",
  };
  await page.goto("/login");
  await page.getByRole("button", { name: "처음이신가요? 회원가입" }).click();
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  // 병렬 워커가 몰릴 때 로컬 스택에서 드물게 클라이언트 fetch만 유실된다 — 재제출하되,
  // 서버에는 이미 가입됐을 수 있으므로(already registered) 그 경우 로그인으로 전환한다.
  let mode: "signup" | "signin" = "signup";
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await page.waitForURL((url) => url.pathname === "/", { timeout: 5000 });
      break;
    } catch {
      const alert = page.getByText(/회원가입 실패|로그인 실패/);
      if (!(await alert.isVisible())) continue;
      if (mode === "signup" && (await alert.innerText()).includes("already registered")) {
        await page.getByRole("button", { name: "이미 계정이 있나요? 로그인" }).click();
        mode = "signin";
      }
      await page
        .getByRole("button", { name: mode === "signup" ? "회원가입" : "로그인", exact: true })
        .click();
    }
  }
  await expect(page.getByRole("heading", { name: "내 청첩장" })).toBeVisible();
  return user;
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
}
