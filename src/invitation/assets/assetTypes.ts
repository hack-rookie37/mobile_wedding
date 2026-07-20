import { z } from "zod";

// ADR-016 — asset 저장 경계.
// 업로드된 이미지의 원본·파생(썸네일) 파일은 AssetStore가 관리하고,
// 청첩장 JSON에는 assetId와 표시용 metadata(alt·caption·frame)만 저장한다.
// UI는 이 인터페이스만 알며, 저장 구현(IndexedDB → Supabase Storage)은 교체 가능하다.

// 종류별 치수 규칙: 이미지는 필수, 오디오·폰트는 없음 (DB 제약과 동일 — 단일 소스는 이 스키마)
export const assetKindSchema = z.enum(["image", "audio", "font"]);

export const assetRecordSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    id: z.string().min(1),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number().int().min(0), // bytes
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    contentHash: z.string().min(1), // SHA-256 hex — 같은 내용의 중복 업로드 감지
    createdAt: z.iso.datetime(),
    builtin: z.boolean(), // 기본 제공 샘플 여부 (삭제 불가)
  }),
  z.object({
    kind: z.literal("audio"),
    id: z.string().min(1),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number().int().min(0),
    contentHash: z.string().min(1),
    createdAt: z.iso.datetime(),
    builtin: z.boolean(),
  }),
  z.object({
    kind: z.literal("font"),
    id: z.string().min(1),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number().int().min(0),
    contentHash: z.string().min(1),
    createdAt: z.iso.datetime(),
    builtin: z.boolean(),
  }),
]);

export type AssetKind = z.infer<typeof assetKindSchema>;
export type ImageAssetRecord = Extract<z.infer<typeof assetRecordSchema>, { kind: "image" }>;

export type AssetRecord = z.infer<typeof assetRecordSchema>;

// renderer가 img를 구성하는 데 필요한 전부 — 저장 방식을 모른다
export interface ResolvedAsset {
  src: string;
  srcSet?: string; // "thumbUrl 640w, fullUrl 1600w" 형태의 반응형 소스
  width: number;
  height: number;
}

// 알 수 없는 assetId는 null — renderer는 안전한 placeholder로 표시한다
export type ResolveAsset = (assetId: string) => ResolvedAsset | null;

export interface StoredAsset {
  record: AssetRecord;
  fullUrl: string;
  thumbUrl: string | null; // 원본이 충분히 작으면 파생 없음
}

export interface UploadOutcome {
  asset: StoredAsset;
  duplicate: boolean; // 같은 내용의 파일이 이미 있어 기존 asset을 반환한 경우
  warnings: string[]; // 저해상도 등 — 업로드 자체는 성공
}

export interface UploadOptions {
  onProgress?: (fraction: number) => void; // 0 ~ 1
}

export interface AssetStore {
  list(): Promise<StoredAsset[]>;
  upload(file: File, opts?: UploadOptions): Promise<UploadOutcome>;
  remove(assetId: string): Promise<void>;
}
