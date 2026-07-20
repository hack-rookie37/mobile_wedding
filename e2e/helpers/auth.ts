import { expect, type Page } from "@playwright/test";
import { anonClient } from "./env";

export interface TestUser {
  email: string;
  password: string;
}

let seq = 0;

// 테스트마다 새 사용자로 시작 → 빈 대시보드에서 출발 (사용자 단위 격리).
// 병렬 워커 간 충돌이 없도록 워커 인덱스 + 랜덤 suffix로 이메일을 만든다.
// 가입 화면은 제품에 없다(공개 가입 차단) — 운영에서 관리자가 계정을 직접 만드는 것과 같이
// 테스트도 계정 생성은 API로 하고, 로그인만 실제 UI로 수행한다.
export async function signUpFresh(page: Page): Promise<TestUser> {
  const worker = process.env.TEST_WORKER_INDEX ?? "0";
  const user: TestUser = {
    email: `e2e-w${worker}-${Date.now()}-${seq++}-${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: "e2e-password-123",
  };
  const { error } = await anonClient().auth.signUp(user);
  if (error) throw new Error(`테스트 사용자 생성 실패: ${error.message}`);
  await signIn(page, user);
  await expect(page.getByRole("heading", { name: "내 청첩장" })).toBeVisible();
  return user;
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/edit");
}
