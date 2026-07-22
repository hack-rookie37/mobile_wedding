import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createSampleDocument } from "@/invitation/fixtures/sample";
import type { InvitationDocument } from "@/invitation/schema/document";
import { CURRENT_SCHEMA_VERSION } from "@/invitation/schema/migrate";
import { SupabasePersistence } from "@/server/supabase/persistence";
import { SupabaseRsvpAdmin } from "@/server/supabase/rsvpApi";
import { deleteProject } from "@/server/supabase/projectsApi";
import { anonClient, signUpUser } from "./helpers";

// Phase 9 — RSVP private-data boundary (ADR-021)
// 실제 로컬 Supabase에 대해 RLS·submit_rsvp RPC의 경계를 검증한다.
// 모든 게스트 호출은 anon 키 — /api/rsvp를 우회한 직접 RPC 공격도 같은 경계에 막힌다.

function uniqueSlug(): string {
  return `rsvp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function token(): string {
  return crypto.randomUUID();
}

interface SubmitOverrides {
  clientToken?: string;
  guestName?: string;
  side?: string | null;
  attending?: boolean;
  companions?: number | null;
  meal?: string | null;
  phone?: string | null;
  message?: string | null;
}

async function submit(client: SupabaseClient, slug: string, overrides: SubmitOverrides = {}) {
  const { data, error } = await client.rpc("submit_rsvp", {
    p_slug: slug,
    p_client_token: overrides.clientToken ?? token(),
    p_guest_name: overrides.guestName ?? "통합테스트 게스트",
    p_side: overrides.side ?? "groom",
    p_attending: overrides.attending ?? true,
    p_companions: overrides.companions ?? 1,
    p_meal: overrides.meal ?? "yes",
    p_phone: overrides.phone ?? "010-9876-5432",
    p_message: overrides.message ?? "결혼 축하드립니다!",
  });
  if (error) throw new Error(error.message);
  return data as { status: string; result?: string };
}

let owner: SupabaseClient;
let other: SupabaseClient;

async function createProject(doc?: InvitationDocument): Promise<string> {
  const { data, error } = await owner.rpc("create_project_with_document", {
    p_title: "RSVP 통합 테스트",
    p_doc: doc ?? createSampleDocument(),
    p_schema_version: CURRENT_SCHEMA_VERSION,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function publishedProject(): Promise<{ projectId: string; slug: string }> {
  const projectId = await createProject();
  const slug = uniqueSlug();
  const outcome = await new SupabasePersistence(owner).publish(projectId, slug);
  expect(outcome.status).toBe("published");
  return { projectId, slug };
}

beforeAll(async () => {
  owner = await signUpUser();
  other = await signUpUser();
});

describe("게스트 제출과 중복 처리", () => {
  it("발행된 청첩장에 제출되고, 같은 토큰의 재제출은 새 행이 아니라 수정이다", async () => {
    const { projectId, slug } = await publishedProject();
    const anon = anonClient();
    const clientToken = token();

    const first = await submit(anon, slug, { clientToken, guestName: "김하객" });
    expect(first).toEqual({ status: "ok", result: "created" });

    // 같은 토큰으로 재제출 (더블 클릭·응답 수정) → updated, 행은 1개
    const second = await submit(anon, slug, {
      clientToken,
      guestName: "김하객",
      attending: false,
      message: "부득이 참석이 어렵습니다",
    });
    expect(second).toEqual({ status: "ok", result: "updated" });

    const admin = new SupabaseRsvpAdmin(owner);
    const rows = await admin.list(projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0].attending).toBe(false);
    expect(rows[0].message).toBe("부득이 참석이 어렵습니다");
    expect(rows[0].updatedAt).not.toBe(rows[0].createdAt);
  });

  it("SQL 메타문자가 든 입력도 데이터로만 저장된다 (parameterized RPC)", async () => {
    const { projectId, slug } = await publishedProject();
    const hostile = "로버트'); drop table rsvp_responses;--";
    const result = await submit(anonClient(), slug, { guestName: hostile });
    expect(result.status).toBe("ok");

    const rows = await new SupabaseRsvpAdmin(owner).list(projectId);
    expect(rows.map((r) => r.guestName)).toContain(hostile); // 문자열 그대로
    // 테이블이 살아 있고 추가 제출도 정상 동작한다
    expect((await submit(anonClient(), slug)).status).toBe("ok");
  });
});

describe("접수 가능 조건 (invalid input 포함)", () => {
  it("발행 전·발행 중단·없는 slug는 not_found다", async () => {
    const anon = anonClient();
    expect((await submit(anon, "no-such-slug")).status).toBe("not_found");

    const { projectId, slug } = await publishedProject();
    await new SupabasePersistence(owner).unpublish(projectId);
    expect((await submit(anon, slug)).status).toBe("not_found");
  });

  it("공개본에서 RSVP 섹션을 숨기면 접수도 닫힌다", async () => {
    const projectId = await createProject();
    const persistence = new SupabasePersistence(owner);
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (!rsvp) throw new Error("rsvp가 없습니다");
    rsvp.visible = false;
    await persistence.save(projectId, doc, 1);
    const slug = uniqueSlug();
    await persistence.publish(projectId, slug);

    expect((await submit(anonClient(), slug)).status).toBe("not_found");
  });

  it("마감일이 지난 청첩장은 closed다", async () => {
    const projectId = await createProject();
    const persistence = new SupabasePersistence(owner);
    const doc = createSampleDocument();
    const rsvp = doc.sections.find((s) => s.type === "rsvp");
    if (rsvp?.type !== "rsvp") throw new Error("rsvp가 없습니다");
    rsvp.content.deadline = "2020-01-01T00:00:00+09:00";
    await persistence.save(projectId, doc, 1);
    const slug = uniqueSlug();
    await persistence.publish(projectId, slug);

    expect((await submit(anonClient(), slug)).status).toBe("closed");
  });

  it("잘못된 입력은 DB에서도 invalid로 거부된다 (route 우회 공격 대비)", async () => {
    const { projectId, slug } = await publishedProject();
    const anon = anonClient();
    expect((await submit(anon, slug, { guestName: "가".repeat(41) })).status).toBe("invalid");
    expect((await submit(anon, slug, { guestName: "   " })).status).toBe("invalid");
    expect((await submit(anon, slug, { side: "family" })).status).toBe("invalid");
    expect((await submit(anon, slug, { companions: 99 })).status).toBe("invalid");
    expect((await submit(anon, slug, { meal: "maybe" })).status).toBe("invalid");
    expect((await submit(anon, slug, { message: "가".repeat(501) })).status).toBe("invalid");
    expect((await submit(anon, slug, { clientToken: "short" })).status).toBe("invalid");

    // 거부된 제출은 저장되지 않았다
    expect(await new SupabaseRsvpAdmin(owner).list(projectId)).toHaveLength(0);
  });
});

describe("접근 경계 (unauthorized / cross-project)", () => {
  it("anon은 응답을 어떤 경로로도 읽을 수 없다 (grant 자체가 없다)", async () => {
    const { slug } = await publishedProject();
    await submit(anonClient(), slug, { guestName: "비밀게스트" });

    const anon = anonClient();
    const direct = await anon.from("rsvp_responses").select("*");
    expect(direct.error).not.toBeNull(); // permission denied
    expect(direct.data ?? []).toEqual([]);
  });

  it("다른 사용자는 남의 프로젝트 응답을 조회·삭제할 수 없다", async () => {
    const { projectId, slug } = await publishedProject();
    await submit(anonClient(), slug, { guestName: "김하객" });

    // 목록: RLS가 빈 결과로 필터
    const listB = await other.from("rsvp_responses").select("*").eq("project_id", projectId);
    expect(listB.data).toEqual([]);
    const adminB = new SupabaseRsvpAdmin(other);
    expect(await adminB.list(projectId)).toEqual([]);
    expect(await adminB.loadProjectTitle(projectId)).toBeNull();

    // 삭제: 영향 0행 — 소유자에게는 그대로 남아 있다
    await adminB.removeAll(projectId);
    const rows = await new SupabaseRsvpAdmin(owner).list(projectId);
    expect(rows).toHaveLength(1);
  });

  it("소유자도 응답을 위조·수정할 수 없다 (insert·update 정책 없음)", async () => {
    const { projectId, slug } = await publishedProject();
    await submit(anonClient(), slug, { guestName: "김하객" });

    const forged = await owner.from("rsvp_responses").insert({
      project_id: projectId,
      client_token: token(),
      guest_name: "위조 게스트",
      attending: true,
      consented_at: new Date().toISOString(),
    });
    expect(forged.error).not.toBeNull();

    const tampered = await owner
      .from("rsvp_responses")
      .update({ guest_name: "조작됨" })
      .eq("project_id", projectId)
      .select();
    // update는 grant/정책이 없어 에러이거나 영향 0행이다
    if (tampered.error === null) expect(tampered.data).toEqual([]);
    const rows = await new SupabaseRsvpAdmin(owner).list(projectId);
    expect(rows.map((r) => r.guestName)).toEqual(["김하객"]);
  });
});

describe("public projection 제외", () => {
  it("공개 응답(publish_records)과 미리보기 payload에 게스트 데이터가 없다", async () => {
    const { projectId, slug } = await publishedProject();
    await submit(anonClient(), slug, {
      guestName: "프로젝션검증게스트",
      phone: "010-7777-8888",
      message: "프로젝션에 새면 안 되는 메시지",
    });

    const anon = anonClient();
    const published = await anon.rpc("get_published_by_slug", { p_slug: slug });
    const serialized = JSON.stringify(published.data);
    expect(serialized).not.toContain("프로젝션검증게스트");
    expect(serialized).not.toContain("010-7777-8888");
    expect(serialized).not.toContain("프로젝션에 새면 안 되는 메시지");
    // 재발행해도 스냅샷은 문서·asset뿐이다
    await new SupabasePersistence(owner).publish(projectId, slug);
    const republished = await anon.rpc("get_published_by_slug", { p_slug: slug });
    expect(JSON.stringify(republished.data)).not.toContain("프로젝션검증게스트");

    // 비공개 미리보기(draft projection)에도 응답은 없다
    const link = await new SupabasePersistence(owner).createPreviewLink(projectId, {
      expiresAt: null,
    });
    const preview = await anon.rpc("get_preview_by_token", { p_token: link.token });
    expect(JSON.stringify(preview.data)).not.toContain("프로젝션검증게스트");
  });
});

describe("삭제와 retention", () => {
  it("소유자는 응답을 개별·전체 삭제할 수 있다", async () => {
    const { projectId, slug } = await publishedProject();
    const anon = anonClient();
    await submit(anon, slug, { guestName: "삭제될 게스트" });
    await submit(anon, slug, { guestName: "남을 게스트" });

    const admin = new SupabaseRsvpAdmin(owner);
    let rows = await admin.list(projectId);
    expect(rows).toHaveLength(2);

    const target = rows.find((r) => r.guestName === "삭제될 게스트")!;
    await admin.remove(projectId, target.id);
    rows = await admin.list(projectId);
    expect(rows.map((r) => r.guestName)).toEqual(["남을 게스트"]);

    await admin.removeAll(projectId);
    expect(await admin.list(projectId)).toHaveLength(0);
  });

  it("프로젝트 삭제 시 응답도 cascade로 함께 삭제된다", async () => {
    const { projectId, slug } = await publishedProject();
    await submit(anonClient(), slug, { guestName: "곧 사라질 게스트" });

    await deleteProject(owner, projectId);

    expect(
      (await owner.from("rsvp_responses").select("*").eq("project_id", projectId)).data,
    ).toEqual([]);
    // 발행 기록도 없으므로 재제출도 불가
    expect((await submit(anonClient(), slug)).status).toBe("not_found");
  });
});

describe("rate limiting (프로젝트별 일일 상한)", () => {
  it("상한(200)에 도달하면 새 제출은 거부되고 기존 응답 수정은 허용된다", async () => {
    const { slug } = await publishedProject();
    const anon = anonClient();
    const firstToken = token();
    expect((await submit(anon, slug, { clientToken: firstToken })).status).toBe("ok");

    // 199건을 채워 상한 도달 — 20개 단위 동시 실행 (경계는 배치 사이에서만 판정된다)
    for (let batch = 0; batch < 10; batch++) {
      const size = batch === 9 ? 19 : 20;
      const results = await Promise.all(
        Array.from({ length: size }, () => submit(anon, slug, { companions: 0 })),
      );
      for (const result of results) expect(result.status).toBe("ok");
    }

    // 201번째 새 제출 → rate_limited
    expect((await submit(anon, slug)).status).toBe("rate_limited");
    // 기존 토큰의 수정은 상한과 무관하게 허용된다
    expect(await submit(anon, slug, { clientToken: firstToken, attending: false })).toEqual({
      status: "ok",
      result: "updated",
    });
  }, 120_000);
});
