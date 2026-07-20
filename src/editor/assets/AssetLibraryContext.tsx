"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AssetStore,
  ResolveAsset,
  StoredAsset,
  UploadOptions,
  UploadOutcome,
} from "@/invitation/assets/assetTypes";
import { THUMBNAIL_WIDTH } from "@/invitation/assets/uploadPolicy";

// AssetStore(비동기)를 renderer가 요구하는 동기 resolveAsset으로 이어주는 라이브러리 컨텍스트.
// 저장 구현(AssetStore)은 app이 주입한다 — editor는 Supabase를 모른다 (ADR-016·018).
// 목록을 메모리에 유지하고 업로드·삭제 후 갱신한다.

export type AssetLibraryStatus = "loading" | "ready" | "error";

interface AssetLibraryValue {
  status: AssetLibraryStatus;
  errorMessage: string | null;
  assets: StoredAsset[];
  resolveAsset: ResolveAsset;
  upload: (file: File, opts?: UploadOptions) => Promise<UploadOutcome>;
  remove: (assetId: string) => Promise<void>;
}

const AssetLibraryContext = createContext<AssetLibraryValue | null>(null);

export function useAssetLibrary(): AssetLibraryValue {
  const value = useContext(AssetLibraryContext);
  if (!value) {
    throw new Error("AssetLibraryProvider 바깥에서 asset 라이브러리에 접근했습니다");
  }
  return value;
}

export function AssetLibraryProvider({
  store,
  children,
}: {
  store: AssetStore;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<AssetLibraryStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assets, setAssets] = useState<StoredAsset[]>([]);

  useEffect(() => {
    let cancelled = false;
    store
      .list()
      .then((list) => {
        if (cancelled) return;
        setAssets(list);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [store]);

  const byId = useMemo(() => {
    const map = new Map<string, StoredAsset>();
    for (const asset of assets) map.set(asset.record.id, asset);
    return map;
  }, [assets]);

  const resolveAsset = useCallback<ResolveAsset>(
    (assetId) => {
      const asset = byId.get(assetId);
      if (!asset) return null; // 누락 asset — renderer가 placeholder로 표시
      if (asset.record.kind !== "image") return null; // 오디오는 <img> 해석 대상이 아니다
      return {
        src: asset.fullUrl,
        srcSet:
          asset.thumbUrl !== null
            ? `${asset.thumbUrl} ${THUMBNAIL_WIDTH}w, ${asset.fullUrl} ${asset.record.width}w`
            : undefined,
        width: asset.record.width,
        height: asset.record.height,
      };
    },
    [byId],
  );

  const upload = useCallback(
    async (file: File, opts?: UploadOptions) => {
      const outcome = await store.upload(file, opts);
      if (!outcome.duplicate) {
        setAssets((current) => [outcome.asset, ...current]);
      }
      return outcome;
    },
    [store],
  );

  const remove = useCallback(
    async (assetId: string) => {
      await store.remove(assetId);
      setAssets((current) => current.filter((asset) => asset.record.id !== assetId));
    },
    [store],
  );

  const value = useMemo(
    () => ({ status, errorMessage, assets, resolveAsset, upload, remove }),
    [status, errorMessage, assets, resolveAsset, upload, remove],
  );

  return <AssetLibraryContext.Provider value={value}>{children}</AssetLibraryContext.Provider>;
}
