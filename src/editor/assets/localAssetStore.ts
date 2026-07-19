import { nanoid } from "nanoid";
import type {
  AssetRecord,
  AssetStore,
  StoredAsset,
  UploadOptions,
  UploadOutcome,
} from "@/invitation/assets/assetTypes";
import { decodeImage, makeThumbnail, sha256Hex } from "@/invitation/assets/imageProcessing";
import { lowResolutionWarning, validateUploadFile } from "@/invitation/assets/uploadPolicy";
import { BUILTIN_ASSETS } from "./builtinAssets";

// Phase 5 로컬 개발용 AssetStore — 원본·썸네일 Blob을 IndexedDB에 저장한다.
// UI는 AssetStore 인터페이스만 알며, backend 도입 시 이 파일만 교체된다 (ADR-016).

const DB_NAME = "marriage-assets";
const DB_VERSION = 1;
const STORE_NAME = "assets";

export class AssetStorageError extends Error {}

interface StoredRow {
  record: AssetRecord;
  original: Blob;
  thumbnail: Blob | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "record.id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new AssetStorageError(`이미지 저장소를 열 수 없습니다: ${request.error?.message}`));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new AssetStorageError(`이미지 저장소 작업 실패: ${request.error?.message}`));
  });
}

async function withStore<T>(
  dbMode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await requestToPromise(run(db.transaction(STORE_NAME, dbMode).objectStore(STORE_NAME)));
  } finally {
    db.close();
  }
}

export class LocalAssetStore implements AssetStore {
  // asset당 object URL은 한 번만 만들고 세션 동안 재사용한다
  private urls = new Map<string, { fullUrl: string; thumbUrl: string | null }>();

  async list(): Promise<StoredAsset[]> {
    const rows = await withStore<StoredRow[]>("readonly", (store) => store.getAll());
    const uploaded = rows
      .sort((a, b) => b.record.createdAt.localeCompare(a.record.createdAt))
      .map((row) => this.toStored(row));
    return [...uploaded, ...BUILTIN_ASSETS];
  }

  async upload(file: File, { onProgress }: UploadOptions = {}): Promise<UploadOutcome> {
    onProgress?.(0.05);
    validateUploadFile(file);
    const contentHash = await sha256Hex(await file.arrayBuffer());
    onProgress?.(0.3);

    // 중복 파일: 같은 내용(hash)이 이미 있으면 저장하지 않고 기존 asset을 반환한다
    const rows = await withStore<StoredRow[]>("readonly", (store) => store.getAll());
    const existing = rows.find((row) => row.record.contentHash === contentHash);
    if (existing) {
      onProgress?.(1);
      return { asset: this.toStored(existing), duplicate: true, warnings: [] };
    }

    const bitmap = await decodeImage(file);
    onProgress?.(0.6);
    const thumbnail = await makeThumbnail(bitmap, file.type);
    onProgress?.(0.85);

    const row: StoredRow = {
      record: {
        id: nanoid(12),
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        width: bitmap.width,
        height: bitmap.height,
        contentHash,
        createdAt: new Date().toISOString(),
        builtin: false,
      },
      original: file,
      thumbnail,
    };
    const warning = lowResolutionWarning(bitmap.width);
    bitmap.close();
    await withStore("readwrite", (store) => store.put(row));
    onProgress?.(1);
    return {
      asset: this.toStored(row),
      duplicate: false,
      warnings: warning !== null ? [warning] : [],
    };
  }

  async remove(assetId: string): Promise<void> {
    if (BUILTIN_ASSETS.some((asset) => asset.record.id === assetId)) {
      throw new AssetStorageError("기본 제공 이미지는 삭제할 수 없습니다");
    }
    await withStore("readwrite", (store) => store.delete(assetId));
    const urls = this.urls.get(assetId);
    if (urls) {
      URL.revokeObjectURL(urls.fullUrl);
      if (urls.thumbUrl !== null) URL.revokeObjectURL(urls.thumbUrl);
      this.urls.delete(assetId);
    }
  }

  private toStored(row: StoredRow): StoredAsset {
    let urls = this.urls.get(row.record.id);
    if (!urls) {
      urls = {
        fullUrl: URL.createObjectURL(row.original),
        thumbUrl: row.thumbnail !== null ? URL.createObjectURL(row.thumbnail) : null,
      };
      this.urls.set(row.record.id, urls);
    }
    return { record: row.record, ...urls };
  }
}
