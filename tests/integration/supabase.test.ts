import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createSampleDocument } from "@/invitation/fixtures/sample";
import type { InvitationDocument } from "@/invitation/schema/document";
import { CURRENT_SCHEMA_VERSION } from "@/invitation/schema/migrate";
import { SupabasePersistence } from "@/server/supabase/persistence";
import { deleteProject, duplicateProject } from "@/server/supabase/projectsApi";
import { anonClient, signUpUser, TINY_PNG } from "./helpers";

// anon은 테이블에 따라 '빈 결과'(RLS 필터) 또는 'permission denied'(grant 부재)를 받는다 —
// 어느 쪽이든 행이 노출되지 않아야 한다
function expectNoRows(result: { data: unknown[] | null }): void {
  expect(result.data ?? []).toEqual([]);
}

// 실제 로컬 Supabase(마이그레이션 적용 상태)에 대한 RLS·RPC 통합 테스트.
// 모든 클라이언트는 anon 키 + 사용자 세션 — service role은 어디에도 없다.

async function createProject(client: SupabaseClient, doc?: InvitationDocument): Promise<string> {
  const { data, error } = await client.rpc("create_project_with_document", {
    p_title: "통합 테스트 청첩장",
    p_doc: doc ?? createSampleDocument(),
    p_schema_version: CURRENT_SCHEMA_VERSION,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function uploadAsset(client: SupabaseClient, projectId: string): Promise<string> {
  const assetId = crypto.randomUUID();
  const path = `projects/${projectId}/${assetId}.png`;
  const upload = await client.storage.from("photos").upload(path, TINY_PNG, {
    contentType: "image/png",
  });
  if (upload.error) throw new Error(upload.error.message);
  const { error } = await client.from("project_assets").insert({
    id: assetId,
    project_id: projectId,
    filename: "it.png",
    mime_type: "image/png",
    bytes: TINY_PNG.byteLength,
    width: 1,
    height: 1,
    content_hash: `it-${assetId}`,
    storage_path: path,
    thumb_path: null,
  });
  if (error) throw new Error(error.message);
  return assetId;
}

let userA: SupabaseClient;
let userB: SupabaseClient;

beforeAll(async () => {
  userA = await signUpUser();
  userB = await signUpUser();
});

describe("project ownership (RLS)", () => {
  it("다른 사용자의 프로젝트는 조회·수정·저장이 전부 거부된다", async () => {
    const projectId = await createProject(userA);

    // B의 select → RLS가 빈 결과로 필터
    const projects = await userB.from("projects").select("*").eq("id", projectId);
    expect(projects.data).toEqual([]);
    const docs = await userB.from("invitation_documents").select("*").eq("project_id", projectId);
    expect(docs.data).toEqual([]);
    const revisions = await userB.from("revisions").select("*").eq("project_id", projectId);
    expect(revisions.data).toEqual([]);

    // B의 update → 영향 0행 (A에서 원제목 유지 확인)
    await userB.from("projects").update({ title: "탈취" }).eq("id", projectId);
    const after = await userA.from("projects").select("title").eq("id", projectId).single();
    expect(after.data?.title).toBe("통합 테스트 청첩장");

    // B의 save_document RPC → not_found (존재 여부조차 노출하지 않는다)
    const save = await userB.rpc("save_document", {
      p_project_id: projectId,
      p_expected_rev: 1,
      p_doc: createSampleDocument(),
      p_schema_version: CURRENT_SCHEMA_VERSION,
    });
    expect(save.data).toEqual({ status: "not_found" });

    // B의 delete → 영향 없음
    await userB.from("projects").delete().eq("id", projectId);
    const still = await userA.from("projects").select("id").eq("id", projectId);
    expect(still.data).toHaveLength(1);
  });

  it("anon(게스트)은 draft 문서를 어떤 경로로도 읽을 수 없다", async () => {
    const projectId = await createProject(userA);
    const anon = anonClient();
    expectNoRows(await anon.from("projects").select("*").eq("id", projectId));
    expectNoRows(await anon.from("invitation_documents").select("*").eq("project_id", projectId));
    expectNoRows(await anon.from("project_assets").select("*").eq("project_id", projectId));
  });
});

describe("asset ownership", () => {
  it("다른 사용자의 프로젝트에는 asset 메타·파일 모두 만들 수 없다", async () => {
    const projectId = await createProject(userA);

    // B의 메타 insert → RLS 위반
    const insert = await userB.from("project_assets").insert({
      project_id: projectId,
      filename: "hack.png",
      mime_type: "image/png",
      bytes: 1,
      width: 1,
      height: 1,
      content_hash: "hack",
      storage_path: `projects/${projectId}/hack.png`,
    });
    expect(insert.error).not.toBeNull();

    // B의 storage 업로드 → 경로 소유권 정책 위반
    const upload = await userB.storage
      .from("photos")
      .upload(`projects/${projectId}/hack.png`, TINY_PNG, { contentType: "image/png" });
    expect(upload.error).not.toBeNull();

    // A 본인은 성공
    const assetId = await uploadAsset(userA, projectId);
    const rows = await userA.from("project_assets").select("id").eq("project_id", projectId);
    expect(rows.data?.map((r) => r.id)).toContain(assetId);

    // B는 A의 asset 목록을 볼 수 없다
    const listB = await userB.from("project_assets").select("*").eq("project_id", projectId);
    expect(listB.data).toEqual([]);
  });
});

describe("save_document 낙관적 동시성", () => {
  it("stale rev 저장은 conflict를 반환하고 문서를 덮어쓰지 않는다", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);

    const doc1 = createSampleDocument();
    doc1.wedding.groom.name = "탭1의 편집";
    const first = await persistence.save(projectId, doc1, 1);
    expect(first).toEqual({ status: "saved", rev: 2 });

    // 같은 rev(1)로 다시 저장 시도 = 두 번째 탭의 stale 저장
    const doc2 = createSampleDocument();
    doc2.wedding.groom.name = "탭2의 편집";
    const second = await persistence.save(projectId, doc2, 1);
    expect(second).toEqual({ status: "conflict", currentRev: 2 });

    // 문서는 탭1의 내용 그대로
    const loaded = await persistence.load(projectId);
    expect(loaded?.doc.wedding.groom.name).toBe("탭1의 편집");
    expect(loaded?.rev).toBe(2);
  });
});

describe("revisions", () => {
  it("checkpoint 생성·조회·복원 — 복원은 새 revision을 만들고 과거를 보존한다", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);

    // origin(rev 1)이 이미 존재
    let revisions = await persistence.listRevisions(projectId);
    expect(revisions.map((r) => r.kind)).toEqual(["origin"]);

    // rev 1 상태를 checkpoint — 같은 rev의 origin이 있어 exists로 처리된다 → 수정 후 생성
    const edited = createSampleDocument();
    edited.wedding.groom.name = "수정된 이름";
    await persistence.save(projectId, edited, 1); // rev 2
    await persistence.createCheckpoint(projectId, "이름 수정본");

    const edited2 = structuredClone(edited);
    edited2.wedding.bride.name = "두번째 수정";
    await persistence.save(projectId, edited2, 2); // rev 3

    revisions = await persistence.listRevisions(projectId);
    expect(revisions.map((r) => [r.rev, r.kind])).toEqual([
      [2, "checkpoint"],
      [1, "origin"],
    ]);

    // origin(rev 1)으로 복원 → 새 rev 4 + restore revision, 기존 revision 불변.
    // 복원 직전의 rev 3(체크포인트 없던 현재 초안)은 자동 백업 checkpoint로 남는다 (ADR-023)
    const originRevision = revisions.find((r) => r.kind === "origin")!;
    const restored = await persistence.restoreRevision(projectId, originRevision.id);
    expect(restored.rev).toBe(4);
    expect(restored.doc.wedding.groom.name).toBe("김민준"); // 샘플 원본

    const loaded = await persistence.load(projectId);
    expect(loaded?.rev).toBe(4);
    expect(loaded?.doc.wedding.groom.name).toBe("김민준");

    revisions = await persistence.listRevisions(projectId);
    expect(revisions.map((r) => [r.rev, r.kind, r.label])).toEqual([
      [4, "restore", "‘처음 만든 상태’ 복원"],
      [3, "checkpoint", "복원 전 자동 저장"],
      [2, "checkpoint", "이름 수정본"],
      [1, "origin", "처음 만든 상태"],
    ]);

    // 자동 백업으로 복원하면 잃었을 뻔한 '두번째 수정'이 돌아온다
    const backup = revisions.find((r) => r.label === "복원 전 자동 저장")!;
    const recovered = await persistence.restoreRevision(projectId, backup.id);
    expect(recovered.doc.wedding.bride.name).toBe("두번째 수정");
  });
});

describe("project duplicate", () => {
  it("문서·asset(파일 포함)이 복사되고 문서의 asset 참조가 새 id로 재매핑된다", async () => {
    const projectId = await createProject(userA);
    const assetId = await uploadAsset(userA, projectId);

    // 문서가 업로드 asset을 참조하도록 저장
    const doc = createSampleDocument();
    const hero = doc.sections[0];
    if (hero.type === "hero") hero.content.photoAssetId = assetId;
    const persistence = new SupabasePersistence(userA);
    await persistence.save(projectId, doc, 1);

    const newProjectId = await duplicateProject(userA, projectId);
    expect(newProjectId).not.toBe(projectId);

    // 새 프로젝트: 제목 '사본', 문서의 hero 참조가 새 asset id
    const newProject = await userA.from("projects").select("title").eq("id", newProjectId).single();
    expect(newProject.data?.title).toContain("사본");

    const newAssets = await userA
      .from("project_assets")
      .select("id, storage_path")
      .eq("project_id", newProjectId);
    expect(newAssets.data).toHaveLength(1);
    const newAssetId = newAssets.data![0].id;
    expect(newAssetId).not.toBe(assetId);
    expect(newAssets.data![0].storage_path).toContain(newProjectId);

    const loaded = await persistence.load(newProjectId);
    const newHero = loaded!.doc.sections[0];
    expect(newHero.type === "hero" && newHero.content.photoAssetId).toBe(newAssetId);

    // 복사된 파일이 실제로 존재한다
    const download = await userA.storage.from("photos").download(newAssets.data![0].storage_path);
    expect(download.error).toBeNull();

    // 원본은 그대로 (독립성)
    const sourceLoaded = await persistence.load(projectId);
    const sourceHero = sourceLoaded!.doc.sections[0];
    expect(sourceHero.type === "hero" && sourceHero.content.photoAssetId).toBe(assetId);
  });
});

describe("삭제 동작", () => {
  it("발행 중(live) 청첩장이 참조하는 사진은 삭제가 거부되고, 발행 중단 후에는 지울 수 있다", async () => {
    const { SupabaseAssetStore } = await import("@/server/supabase/assetStore");
    const projectId = await createProject(userA);
    const assetId = await uploadAsset(userA, projectId);

    const doc = createSampleDocument();
    const hero = doc.sections[0];
    if (hero.type === "hero") hero.content.photoAssetId = assetId;
    const persistence = new SupabasePersistence(userA);
    await persistence.save(projectId, doc, 1);
    await persistence.publish(projectId, uniqueSlug());

    const store = new SupabaseAssetStore(userA, projectId, []);
    await expect(store.remove(assetId)).rejects.toThrow(/발행된 청첩장에서 사용 중/);
    // 파일·메타 모두 그대로다
    expect((await userA.from("project_assets").select("id").eq("id", assetId)).data).toHaveLength(
      1,
    );

    await persistence.unpublish(projectId);
    await store.remove(assetId);
    expect((await userA.from("project_assets").select("id").eq("id", assetId)).data).toEqual([]);
  });

  it("프로젝트 삭제 시 문서·revision·asset 메타가 cascade되고 storage 파일도 지워진다", async () => {
    const projectId = await createProject(userA);
    await uploadAsset(userA, projectId);
    const assetPath = (
      await userA.from("project_assets").select("storage_path").eq("project_id", projectId)
    ).data![0].storage_path;

    await deleteProject(userA, projectId);

    expect((await userA.from("projects").select("*").eq("id", projectId)).data).toEqual([]);
    expect(
      (await userA.from("invitation_documents").select("*").eq("project_id", projectId)).data,
    ).toEqual([]);
    expect((await userA.from("revisions").select("*").eq("project_id", projectId)).data).toEqual(
      [],
    );
    expect(
      (await userA.from("project_assets").select("*").eq("project_id", projectId)).data,
    ).toEqual([]);
    const download = await userA.storage.from("photos").download(assetPath);
    expect(download.error).not.toBeNull();
  });
});

function uniqueSlug(): string {
  return `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("publish_records 공개 경계", () => {
  it("발행 전에는 anon이 아무것도 못 보고, 발행 후에는 live 스냅샷만 보인다", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);
    const anon = anonClient();

    const slug = uniqueSlug();
    expect((await anon.rpc("get_published_by_slug", { p_slug: slug })).data).toBeNull();

    const outcome = await persistence.publish(projectId, slug);
    expect(outcome.status).toBe("published");
    const published = await anon.rpc("get_published_by_slug", { p_slug: slug });
    expect(published.error).toBeNull();
    expect(published.data?.doc).toBeDefined();

    // 발행 중단(unpublish) → anon에게서 사라진다
    await persistence.unpublish(projectId);
    expect((await anon.rpc("get_published_by_slug", { p_slug: slug })).data).toBeNull();

    // anon은 발행 여부와 무관하게 draft 문서에 접근 불가
    expectNoRows(await anon.from("invitation_documents").select("*").eq("project_id", projectId));
  });

  it("anon은 publish_records를 직접 SELECT할 수 없다 — 열거·projection 우회 차단 (ADR-023)", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);
    const slug = uniqueSlug();
    await persistence.publish(projectId, slug);

    const anon = anonClient();
    // slug 단건이든 목록이든 테이블 접근 자체가 거부된다 (grant 없음)
    expect(
      (await anon.from("publish_records").select("slug").eq("slug", slug)).error,
    ).not.toBeNull();
    expect((await anon.from("publish_records").select("slug")).error).not.toBeNull();

    // 다른 authenticated 사용자도 남의 발행본을 직접 읽을 수 없다
    const rows = await userB.from("publish_records").select("slug").eq("slug", slug);
    expect(rows.data ?? []).toEqual([]);
  });

  it("숨긴 섹션은 발행본 조회 응답에서 내용째 제거된다 (DB측 projection)", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);

    // 계좌 섹션을 숨긴 상태로 발행 — 숨긴 섹션의 내용(계좌번호)이 새면 안 된다
    const doc = createSampleDocument();
    const account = doc.sections.find((section) => section.type === "giftAccount")!;
    account.visible = false;
    await persistence.save(projectId, doc, 1);
    const slug = uniqueSlug();
    await persistence.publish(projectId, slug);

    const anon = anonClient();
    const published = await anon.rpc("get_published_by_slug", { p_slug: slug });
    const serialized = JSON.stringify(published.data);
    expect(serialized).not.toContain('"giftAccount"');
    expect(serialized).not.toContain(account.id);
    // 보이는 섹션은 순서 그대로 남는다
    const sections = (published.data as { doc: { sections: { id: string }[] } }).doc.sections;
    expect(sections.map((section) => section.id)).toEqual(
      doc.sections.filter((section) => section.visible).map((section) => section.id),
    );
  });
});

describe("발행 수명주기 (Phase 7)", () => {
  it("draft 수정은 published revision에 자동 반영되지 않고, republish해야 반영된다", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);
    const anon = anonClient();
    const slug = uniqueSlug();

    // rev 1 상태로 발행 — publish_records가 발행 revision을 참조한다
    const first = await persistence.publish(projectId, slug);
    expect(first).toMatchObject({ status: "published", publishedRev: 1 });
    const record = await userA
      .from("publish_records")
      .select("published_rev, revision_id, published_at")
      .eq("project_id", projectId)
      .single();
    expect(record.data?.published_rev).toBe(1);
    expect(record.data?.revision_id).not.toBeNull();
    const firstPublishedAt = record.data!.published_at as string;

    // draft 수정 (rev 2) → 공개본은 그대로 rev 1의 내용
    const edited = createSampleDocument();
    edited.wedding.groom.name = "발행 후 수정된 이름";
    await persistence.save(projectId, edited, 1);

    const publicDoc = await anon.rpc("get_published_by_slug", { p_slug: slug });
    expect(JSON.stringify(publicDoc.data)).not.toContain("발행 후 수정된 이름");

    // republish → rev 2가 공개되고 마지막 발행 시간이 갱신된다
    const second = await persistence.publish(projectId, slug);
    expect(second).toMatchObject({ status: "published", publishedRev: 2 });
    const after = await anon.rpc("get_published_by_slug", { p_slug: slug });
    expect(JSON.stringify(after.data)).toContain("발행 후 수정된 이름");
    const afterRecord = await userA
      .from("publish_records")
      .select("published_rev, published_at")
      .eq("project_id", projectId)
      .single();
    expect(afterRecord.data?.published_rev).toBe(2);
    expect(afterRecord.data?.published_at).not.toBe(firstPublishedAt);

    // 발행 상태 조회
    const state = await persistence.getPublishState(projectId);
    expect(state).toMatchObject({ slug, status: "live", publishedRev: 2 });
  });

  it("slug 중복은 거부되고(다른 프로젝트), 형식 위반은 네트워크 전에 거부된다", async () => {
    const persistence = new SupabasePersistence(userA);
    const projectA = await createProject(userA);
    const projectB = await createProject(userB);
    const slug = uniqueSlug();

    await persistence.publish(projectA, slug);
    // 다른 사용자의 프로젝트가 같은 slug로 발행 시도 → slug_taken
    const other = new SupabasePersistence(userB);
    expect(await other.publish(projectB, slug)).toEqual({ status: "slug_taken" });

    // 같은 프로젝트의 republish는 같은 slug 사용 가능
    const republished = await persistence.publish(projectA, slug);
    expect(republished.status).toBe("published");

    // 형식 위반 (대문자·공백·짧음·연속 하이픈)
    for (const bad of ["AB", "has space", "UPPER-case", "a--b", "-lead", "trail-"]) {
      await expect(persistence.publish(projectA, bad)).rejects.toThrow(/발행 실패/);
    }
  });

  it("공개 응답에는 private 필드가 없다 (projection + 스냅샷 컬럼 한정)", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);
    await uploadAsset(userA, projectId);
    await persistence.createCheckpoint(projectId, "비밀 체크포인트 라벨"); // rev 1에 이미 origin → exists
    const slug = uniqueSlug();
    await persistence.publish(projectId, slug);

    const anon = anonClient();
    const record = await anon.rpc("get_published_by_slug", { p_slug: slug });
    const serialized = JSON.stringify(record.data);
    // revision 이력·checkpoint 라벨·내부 메타(published_rev 등)는 공개 응답 어디에도 없다
    expect(serialized).not.toContain("비밀 체크포인트 라벨");
    expect(serialized).not.toContain("undoStack");
    expect(serialized).not.toContain("published_rev");
    // asset manifest는 공개 URL만 — 내부 storage 경로 필드는 없다
    const assets = (record.data as { assets: Record<string, unknown>[] }).assets;
    for (const entry of assets) {
      expect(Object.keys(entry).sort()).toEqual(["height", "id", "thumbUrl", "url", "width"]);
    }
    // anon은 revisions 테이블 자체에 접근 불가
    expectNoRows(await anon.from("revisions").select("*").eq("project_id", projectId));
  });
});

describe("private preview 토큰 (Phase 7)", () => {
  it("유효 토큰은 draft를 반환하고, 폐기·재생성·만료·무효 토큰은 거부된다", async () => {
    const projectId = await createProject(userA);
    const persistence = new SupabasePersistence(userA);
    const anon = anonClient();

    // 링크 없음 → 무효 토큰 거부
    expect((await anon.rpc("get_preview_by_token", { p_token: "x".repeat(32) })).data).toBeNull();

    // 생성 → anon이 토큰으로 draft 조회 가능
    const link = await persistence.createPreviewLink(projectId, { expiresAt: null });
    expect(link.token.length).toBeGreaterThanOrEqual(24);
    const preview = await anon.rpc("get_preview_by_token", { p_token: link.token });
    expect(preview.data).not.toBeNull();
    expect(JSON.stringify(preview.data.doc)).toContain("김민준");

    // draft 수정이 미리보기에 즉시 반영된다 (미리보기 = 현재 초안)
    const edited = createSampleDocument();
    edited.wedding.groom.name = "미리보기 확인용";
    await persistence.save(projectId, edited, 1);
    const updated = await anon.rpc("get_preview_by_token", { p_token: link.token });
    expect(JSON.stringify(updated.data.doc)).toContain("미리보기 확인용");

    // 재생성 → 이전 토큰 즉시 무효, 새 토큰 유효
    const regenerated = await persistence.createPreviewLink(projectId, { expiresAt: null });
    expect(regenerated.token).not.toBe(link.token);
    expect((await anon.rpc("get_preview_by_token", { p_token: link.token })).data).toBeNull();
    expect(
      (await anon.rpc("get_preview_by_token", { p_token: regenerated.token })).data,
    ).not.toBeNull();

    // 만료된 토큰 거부
    const expired = await persistence.createPreviewLink(projectId, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect((await anon.rpc("get_preview_by_token", { p_token: expired.token })).data).toBeNull();

    // 폐기 → 거부, 소유자 조회도 null
    await persistence.createPreviewLink(projectId, { expiresAt: null });
    await persistence.revokePreviewLink(projectId);
    expect(await persistence.getPreviewLink(projectId)).toBeNull();
  });

  it("다른 사용자는 남의 프로젝트의 미리보기 링크를 만들거나 볼 수 없다", async () => {
    const projectId = await createProject(userA);
    const other = new SupabasePersistence(userB);
    await expect(other.createPreviewLink(projectId, { expiresAt: null })).rejects.toThrow(
      /미리보기 링크 생성 실패/,
    );
    expect(await other.getPreviewLink(projectId)).toBeNull();
  });
});
