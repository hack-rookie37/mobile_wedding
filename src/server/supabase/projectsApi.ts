import type { SupabaseClient } from "@supabase/supabase-js";
import { createSampleDocument, SAMPLE_PROJECT_TITLE } from "@/invitation/fixtures/sample";
import { remapAssetIds } from "@/invitation/lib/remapAssetIds";
import { migrateDocument, CURRENT_SCHEMA_VERSION } from "@/invitation/schema/migrate";
import { PHOTOS_BUCKET } from "./assetManifest";
import { PersistenceError } from "./persistence";

// 대시보드의 프로젝트 수명주기 작업 — 전부 사용자 세션(RLS invoker), service role 없음.

export interface ProjectListItem {
  id: string;
  title: string;
  status: "draft" | "archived";
  updatedAt: string;
}

export async function listProjects(client: SupabaseClient): Promise<ProjectListItem[]> {
  const { data, error } = await client
    .from("projects")
    .select("id, title, status, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new PersistenceError(`프로젝트 목록 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

export async function createSampleProject(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc("create_project_with_document", {
    p_title: SAMPLE_PROJECT_TITLE,
    p_doc: createSampleDocument(),
    p_schema_version: CURRENT_SCHEMA_VERSION,
  });
  if (error) throw new PersistenceError(`프로젝트 생성 실패: ${error.message}`);
  return data as string;
}

export async function renameProject(
  client: SupabaseClient,
  projectId: string,
  title: string,
): Promise<void> {
  if (title.trim() === "") throw new PersistenceError("프로젝트 이름은 비울 수 없습니다");
  const { error } = await client
    .from("projects")
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw new PersistenceError(`이름 변경 실패: ${error.message}`);
}

export async function setProjectStatus(
  client: SupabaseClient,
  projectId: string,
  status: "draft" | "archived",
): Promise<void> {
  const { error } = await client.from("projects").update({ status }).eq("id", projectId);
  if (error) throw new PersistenceError(`상태 변경 실패: ${error.message}`);
}

// 삭제: Storage 파일 → DB 행(cascade) 순서. 파일 삭제가 실패하면 행도 지우지 않는다.
export async function deleteProject(client: SupabaseClient, projectId: string): Promise<void> {
  const { data: assets, error: listError } = await client
    .from("project_assets")
    .select("storage_path, thumb_path")
    .eq("project_id", projectId);
  if (listError) throw new PersistenceError(`삭제 준비 실패: ${listError.message}`);

  const paths = (assets ?? []).flatMap((asset) =>
    asset.thumb_path !== null ? [asset.storage_path, asset.thumb_path] : [asset.storage_path],
  );
  if (paths.length > 0) {
    const { error } = await client.storage.from(PHOTOS_BUCKET).remove(paths);
    if (error) throw new PersistenceError(`사진 파일 삭제 실패: ${error.message}`);
  }

  const { error } = await client.from("projects").delete().eq("id", projectId);
  if (error) throw new PersistenceError(`프로젝트 삭제 실패: ${error.message}`);
}

// 복제: 문서 + asset(파일 복사, 새 id) + 문서 안의 asset 참조 재매핑 (ADR-018).
// 단계별 실패 시 부분 생성물이 남을 수 있다 — 사용자가 대시보드에서 삭제 가능(원자성은 후속 과제).
export async function duplicateProject(
  client: SupabaseClient,
  sourceProjectId: string,
): Promise<string> {
  const source = await client
    .from("projects")
    .select("title, invitation_documents ( doc, schema_version )")
    .eq("id", sourceProjectId)
    .maybeSingle();
  if (source.error) throw new PersistenceError(`복제 원본 조회 실패: ${source.error.message}`);
  if (source.data === null) throw new PersistenceError("복제 실패: 원본 프로젝트가 없습니다");
  const documentRow = source.data.invitation_documents as unknown as { doc: unknown } | null;
  if (documentRow === null) throw new PersistenceError("복제 실패: 원본 문서가 없습니다");

  const sourceDoc = migrateDocument(documentRow.doc);

  // 1) 새 프로젝트 + (일단 원본 그대로의) 문서 생성
  const { data: newProjectId, error: createError } = await client.rpc(
    "create_project_with_document",
    {
      p_title: `${source.data.title} 사본`,
      p_doc: sourceDoc,
      p_schema_version: CURRENT_SCHEMA_VERSION,
    },
  );
  if (createError) throw new PersistenceError(`복제 실패: ${createError.message}`);
  const newId = newProjectId as string;

  // 2) asset 행·파일 복사 (새 id, 새 경로 — 원본 삭제와 무관해진다)
  const { data: assets, error: assetsError } = await client
    .from("project_assets")
    .select("*")
    .eq("project_id", sourceProjectId);
  if (assetsError) throw new PersistenceError(`asset 복제 실패: ${assetsError.message}`);

  const idMap = new Map<string, string>();
  for (const asset of assets ?? []) {
    const newAssetId = crypto.randomUUID();
    const extension = asset.storage_path.split(".").pop();
    const newPath = `projects/${newId}/${newAssetId}.${extension}`;
    const copy = await client.storage.from(PHOTOS_BUCKET).copy(asset.storage_path, newPath);
    if (copy.error) throw new PersistenceError(`사진 복사 실패: ${copy.error.message}`);

    let newThumbPath: string | null = null;
    if (asset.thumb_path !== null) {
      newThumbPath = `projects/${newId}/${newAssetId}.thumb.jpg`;
      const thumbCopy = await client.storage
        .from(PHOTOS_BUCKET)
        .copy(asset.thumb_path, newThumbPath);
      if (thumbCopy.error) throw new PersistenceError(`썸네일 복사 실패: ${thumbCopy.error.message}`);
    }

    const { error: insertError } = await client.from("project_assets").insert({
      id: newAssetId,
      project_id: newId,
      filename: asset.filename,
      mime_type: asset.mime_type,
      bytes: asset.bytes,
      width: asset.width,
      height: asset.height,
      content_hash: asset.content_hash,
      storage_path: newPath,
      thumb_path: newThumbPath,
    });
    if (insertError) throw new PersistenceError(`asset 기록 실패: ${insertError.message}`);
    idMap.set(asset.id, newAssetId);
  }

  // 3) 문서 안의 asset 참조를 새 id로 재매핑해 저장 (rev 1 → 2)
  if (idMap.size > 0) {
    const remapped = remapAssetIds(sourceDoc, idMap);
    const { data: saveResult, error: saveError } = await client.rpc("save_document", {
      p_project_id: newId,
      p_expected_rev: 1,
      p_doc: remapped,
      p_schema_version: CURRENT_SCHEMA_VERSION,
    });
    if (saveError) throw new PersistenceError(`복제 문서 저장 실패: ${saveError.message}`);
    const status = (saveResult as { status: string }).status;
    if (status !== "saved") throw new PersistenceError(`복제 문서 저장 실패: ${status}`);
  }

  return newId;
}
