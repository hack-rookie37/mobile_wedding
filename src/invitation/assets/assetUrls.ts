import type { AssetRecord, StoredAsset } from "./assetTypes";

// 보관함(StoredAsset 목록)에서 파일 URL을 찾는다. 편집기 미리보기와 소유자 미리보기가
// 각자 같은 코드를 들고 있다가 한쪽에 폰트 배선이 빠져 커스텀 폰트가 안 먹었다 — 한곳에 둔다.
// 종류가 다르면 null이다: 음악 슬롯에 잘못 참조된 사진을 음악으로 재생하지 않는다.
export function assetUrlOf(
  assets: StoredAsset[],
  assetId: string | null,
  kind: AssetRecord["kind"],
): string | null {
  if (assetId === null) return null;
  const asset = assets.find((candidate) => candidate.record.id === assetId);
  return asset !== undefined && asset.record.kind === kind ? asset.fullUrl : null;
}
