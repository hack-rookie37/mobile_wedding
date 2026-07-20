import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetRecord,
  AssetStore,
  StoredAsset,
  UploadOptions,
  UploadOutcome,
} from "@/invitation/assets/assetTypes";
import { decodeImage, downscaleImage, makeThumbnail, sha256Hex } from "@/invitation/assets/imageProcessing";
import {
  ALLOWED_AUDIO_TYPES,
  fontMimeOf,
  lowResolutionWarning,
  validateAudioFile,
  validateFontFile,
  validateUploadFile,
} from "@/invitation/assets/uploadPolicy";
import { referencedAssetIds } from "@/invitation/lib/assetRefs";
import { migrateDocument } from "@/invitation/schema/migrate";
import { PHOTOS_BUCKET, storagePublicUrl } from "./assetManifest";

export class AssetStorageError extends Error {}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
};

interface AssetRow {
  id: string;
  kind: "image" | "audio" | "font";
  filename: string;
  mime_type: string;
  bytes: number;
  width: number | null; // 오디오·폰트는 null (DB 제약과 동일)
  height: number | null;
  content_hash: string;
  storage_path: string;
  thumb_path: string | null;
  created_at: string;
}

// Phase 5의 AssetStore 인터페이스에 대한 Supabase Storage 구현 (ADR-016 §1의 교체 지점).
// 파일은 photos 버킷(projects/{projectId}/…), 메타는 project_assets — 전부 RLS 통과.
// builtin 샘플 병합은 AssetLibraryProvider가 담당하므로 여기서는 업로드 asset만 다룬다.
export class SupabaseAssetStore implements AssetStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly projectId: string,
    private readonly builtinAssets: StoredAsset[],
  ) {}

  private toStored(row: AssetRow): StoredAsset {
    const common = {
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.bytes,
      contentHash: row.content_hash,
      createdAt: row.created_at,
      builtin: false,
    };
    const record: AssetRecord =
      row.kind === "image"
        ? { kind: "image", ...common, width: row.width ?? 1, height: row.height ?? 1 }
        : { kind: row.kind, ...common };
    return {
      record,
      fullUrl: storagePublicUrl(this.client, row.storage_path),
      thumbUrl: row.thumb_path !== null ? storagePublicUrl(this.client, row.thumb_path) : null,
    };
  }

  async list(): Promise<StoredAsset[]> {
    const { data, error } = await this.client
      .from("project_assets")
      .select("*")
      .eq("project_id", this.projectId)
      .order("created_at", { ascending: false });
    if (error) throw new AssetStorageError(`사진 목록 조회 실패: ${error.message}`);
    return [...(data as AssetRow[]).map((row) => this.toStored(row)), ...this.builtinAssets];
  }

  async upload(file: File, { onProgress }: UploadOptions = {}): Promise<UploadOutcome> {
    onProgress?.(0.05);
    // 종류 판별은 업로드 정책이 단일 소스 — 폰트는 mime이 제각각이라 확장자까지 본다
    const fontMime = fontMimeOf(file);
    const kind: AssetRow["kind"] =
      file.type in ALLOWED_AUDIO_TYPES ? "audio" : fontMime !== null ? "font" : "image";
    if (kind === "audio") validateAudioFile(file);
    else if (kind === "font") validateFontFile(file);
    else validateUploadFile(file);
    const contentType = kind === "font" ? fontMime! : file.type;
    const contentHash = await sha256Hex(await file.arrayBuffer());
    onProgress?.(0.2);

    // 중복 파일: 같은 프로젝트에 같은 내용이 있으면 기존 asset을 반환
    const existing = await this.client
      .from("project_assets")
      .select("*")
      .eq("project_id", this.projectId)
      .eq("content_hash", contentHash)
      .maybeSingle();
    if (existing.error) throw new AssetStorageError(`중복 확인 실패: ${existing.error.message}`);
    if (existing.data !== null) {
      onProgress?.(1);
      return { asset: this.toStored(existing.data as AssetRow), duplicate: true, warnings: [] };
    }

    // 이미지가 아니면 디코드·축소·썸네일 없음 — 치수는 null (DB 제약)
    let width: number | null = null;
    let height: number | null = null;
    let thumbnail: Blob | null = null;
    let warning: string | null = null;
    // 저장·전송할 실체. 폰 원본을 그대로 내보내지 않는다 (ADR-030).
    let stored: Blob = file;
    if (kind === "image") {
      const bitmap = await decodeImage(file);
      onProgress?.(0.35);
      thumbnail = await makeThumbnail(bitmap, file.type);
      warning = lowResolutionWarning(bitmap.width); // 경고는 원본 해상도 기준
      ({ width, height } = bitmap);
      const downscaled = await downscaleImage(bitmap, file.type);
      // 다시 인코딩했는데 더 커지는 경우(이미 잘 압축된 파일)는 원본을 쓴다
      if (downscaled !== null && downscaled.blob.size < file.size) {
        stored = downscaled.blob;
        width = downscaled.width;
        height = downscaled.height;
      }
      bitmap.close();
    }

    // 경로는 내용 주소(content hash) — 파일 업로드 후 행 기록 전에 실패해도
    // 재시도가 같은 경로에 덮어쓰므로(upsert) 고아 파일이 남지 않는다
    const assetId = crypto.randomUUID();
    const storagePath = `projects/${this.projectId}/${contentHash}.${EXTENSIONS[contentType]}`;
    const bucket = this.client.storage.from(PHOTOS_BUCKET);

    const originalUpload = await bucket.upload(storagePath, stored, { contentType, upsert: true });
    if (originalUpload.error) {
      throw new AssetStorageError(`업로드 실패: ${originalUpload.error.message}`);
    }
    onProgress?.(0.7);

    let thumbPath: string | null = null;
    if (thumbnail !== null) {
      thumbPath = `projects/${this.projectId}/${contentHash}.thumb.jpg`;
      const thumbUpload = await bucket.upload(thumbPath, thumbnail, {
        contentType: thumbnail.type,
        upsert: true,
      });
      if (thumbUpload.error) {
        throw new AssetStorageError(`썸네일 업로드 실패: ${thumbUpload.error.message}`);
      }
    }
    onProgress?.(0.9);

    const row: AssetRow = {
      id: assetId,
      kind,
      filename: file.name,
      mime_type: contentType,
      bytes: stored.size,
      width,
      height,
      content_hash: contentHash,
      storage_path: storagePath,
      thumb_path: thumbPath,
      created_at: new Date().toISOString(),
    };
    const { error: insertError } = await this.client
      .from("project_assets")
      .insert({ ...row, project_id: this.projectId });
    if (insertError) {
      throw new AssetStorageError(`사진 기록 실패: ${insertError.message}`);
    }
    onProgress?.(1);
    return {
      asset: this.toStored(row),
      duplicate: false,
      warnings: warning !== null ? [warning] : [],
    };
  }

  async remove(assetId: string): Promise<void> {
    if (this.builtinAssets.some((asset) => asset.record.id === assetId)) {
      throw new AssetStorageError("기본 제공 이미지는 삭제할 수 없습니다");
    }
    // 발행 중(live)인 청첩장이 참조하는 사진은 삭제 거부 — 스냅샷 문서는 그대로인데
    // 파일만 사라지면 하객이 보는 공개 페이지의 사진이 '이미지 없음'으로 깨진다
    const published = await this.client
      .from("publish_records")
      .select("doc, status")
      .eq("project_id", this.projectId)
      .maybeSingle();
    if (published.error) {
      throw new AssetStorageError(`발행 상태 확인 실패: ${published.error.message}`);
    }
    if (published.data !== null && published.data.status === "live") {
      const publishedDoc = migrateDocument(published.data.doc);
      if (referencedAssetIds(publishedDoc).has(assetId)) {
        throw new AssetStorageError(
          "발행된 청첩장에서 사용 중인 파일입니다 — 발행을 중단하거나, 해당 파일을 빼고 재발행한 뒤 삭제할 수 있습니다",
        );
      }
    }
    const { data, error } = await this.client
      .from("project_assets")
      .select("storage_path, thumb_path")
      .eq("id", assetId)
      .maybeSingle();
    if (error) throw new AssetStorageError(`삭제 준비 실패: ${error.message}`);
    if (data === null) throw new AssetStorageError("삭제 실패: 사진을 찾을 수 없습니다");

    const paths = data.thumb_path !== null ? [data.storage_path, data.thumb_path] : [data.storage_path];
    const removed = await this.client.storage.from(PHOTOS_BUCKET).remove(paths);
    if (removed.error) throw new AssetStorageError(`파일 삭제 실패: ${removed.error.message}`);

    const { error: rowError } = await this.client.from("project_assets").delete().eq("id", assetId);
    if (rowError) throw new AssetStorageError(`사진 기록 삭제 실패: ${rowError.message}`);
  }
}
