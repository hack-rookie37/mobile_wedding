import type { ResolvedAsset, StoredAsset } from "@/invitation/assets/assetTypes";

// 기본 제공 샘플 이미지 (public/samples) — 업로드 전에도 문서를 채울 수 있게 하고,
// 미디어 라이브러리에도 함께 노출된다. builtin은 삭제할 수 없다.

const BUILTIN_DEFS: { id: string; filename: string; width: number; height: number }[] = [
  { id: "hero-main", filename: "샘플 대표 사진", width: 800, height: 1000 },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `gallery-${String(i + 1).padStart(2, "0")}`,
    filename: `샘플 갤러리 ${i + 1}`,
    width: 800,
    height: 800,
  })),
];

export const BUILTIN_ASSETS: StoredAsset[] = BUILTIN_DEFS.map((def) => ({
  record: {
    id: def.id,
    filename: def.filename,
    mimeType: "image/svg+xml",
    size: 600,
    width: def.width,
    height: def.height,
    contentHash: `builtin:${def.id}`,
    createdAt: "2026-07-16T00:00:00.000Z",
    builtin: true,
  },
  fullUrl: `/samples/${def.id}.svg`,
  thumbUrl: null,
}));

// 업로드 asset이 필요 없는 화면(테마 비교·fixture)용 정적 해석기
export function resolveBuiltinAsset(assetId: string): ResolvedAsset | null {
  const found = BUILTIN_ASSETS.find((asset) => asset.record.id === assetId);
  if (!found) return null;
  return { src: found.fullUrl, width: found.record.width, height: found.record.height };
}
