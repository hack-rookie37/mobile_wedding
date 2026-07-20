import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PublicAssetEntry } from "@/invitation/publicPayload";

// 공개·미리보기 렌더용 asset manifest 구성 — 내부 storage 경로를 공개 URL로 변환한다.
// manifest의 스키마·projection은 invitation/publicPayload.ts가 단일 소스다.

export const PHOTOS_BUCKET = "photos";

export function storagePublicUrl(client: SupabaseClient, path: string): string {
  return client.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function publicAssetManifest(
  client: SupabaseClient,
  projectId: string,
): Promise<PublicAssetEntry[]> {
  const { data, error } = await client
    .from("project_assets")
    .select("id, kind, storage_path, thumb_path, width, height")
    .eq("project_id", projectId);
  if (error) throw new Error(`asset manifest 조회 실패: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    url: storagePublicUrl(client, row.storage_path),
    thumbUrl: row.thumb_path !== null ? storagePublicUrl(client, row.thumb_path) : null,
    width: row.width,
    height: row.height,
  }));
}

// get_preview_by_token RPC가 돌려주는 asset 행 (서버 안에서만 다룬다 — 경로는 클라이언트로 안 나간다)
const previewAssetRowSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "audio"]),
  storagePath: z.string().min(1),
  thumbPath: z.string().nullable(),
  width: z.number().int().min(1).nullable(), // 오디오는 null
  height: z.number().int().min(1).nullable(),
});

export function manifestFromPreviewAssets(
  client: SupabaseClient,
  rawAssets: unknown,
): PublicAssetEntry[] {
  const rows = z.array(previewAssetRowSchema).parse(rawAssets);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    url: storagePublicUrl(client, row.storagePath),
    thumbUrl: row.thumbPath !== null ? storagePublicUrl(client, row.thumbPath) : null,
    width: row.width,
    height: row.height,
  }));
}
