import { AssetValidationError, THUMBNAIL_WIDTH } from "./uploadPolicy";

// 업로드 파이프라인의 브라우저 이미지 처리 — 저장 어댑터(IndexedDB·Supabase)가 공유한다.

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new AssetValidationError(
      `이미지를 해석할 수 없습니다: ${file.name} — 파일이 손상되었을 수 있습니다`,
    );
  }
}

// 그리드 표시용 파생 이미지 — 원본이 이미 작으면 만들지 않는다
export async function makeThumbnail(bitmap: ImageBitmap, mimeType: string): Promise<Blob | null> {
  if (bitmap.width <= THUMBNAIL_WIDTH) return null;
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = Math.max(1, Math.round((bitmap.height * THUMBNAIL_WIDTH) / bitmap.width));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = mimeType === "image/png" ? "image/png" : "image/jpeg";
  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
}
