import {
  AssetValidationError,
  MAX_STORED_HEIGHT,
  MAX_STORED_WIDTH,
  STORED_JPEG_QUALITY,
  THUMBNAIL_WIDTH,
} from "./uploadPolicy";

// 업로드 파이프라인의 브라우저 이미지 처리 — 저장 어댑터(IndexedDB·Supabase)가 공유한다.

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    // imageOrientation을 명시한다. 캔버스로 다시 그리면 EXIF가 사라지는데(GPS가 지워지는 건
    // 이득이지만 회전 정보도 같이 지워진다), 브라우저가 EXIF 회전을 적용하지 않고 픽셀을
    // 읽어오면 폰 세로 사진이 누운 채로 저장된다. 기본값에 기대지 않고 못을 박는다.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new AssetValidationError(
      `이미지를 해석할 수 없습니다: ${file.name} — 파일이 손상되었을 수 있습니다`,
    );
  }
}

// 저장할 치수. 이미 한도 안이면 null — 줄일 필요가 없는데 다시 인코딩하면 화질만 깎는다.
// 가로·세로 중 더 많이 넘치는 쪽에 맞춰 비율을 유지한 채 축소한다.
export function storedDimensions(
  width: number,
  height: number,
): { width: number; height: number } | null {
  const scale = Math.min(MAX_STORED_WIDTH / width, MAX_STORED_HEIGHT / height);
  if (scale >= 1) return null;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// 저장용 원본 축소 (ADR-030) — 하객이 실제로 내려받는 파일이다.
// null이면 줄일 필요가 없어 원본을 그대로 쓴다는 뜻이다.
export async function downscaleImage(
  bitmap: ImageBitmap,
  mimeType: string,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  const target = storedDimensions(bitmap.width, bitmap.height);
  if (target === null) return null;
  const blob = await drawToBlob(bitmap, target.width, target.height, mimeType);
  return blob === null ? null : { blob, width: target.width, height: target.height };
}

// 그리드 표시용 파생 이미지 — 원본이 이미 작으면 만들지 않는다
export async function makeThumbnail(bitmap: ImageBitmap, mimeType: string): Promise<Blob | null> {
  if (bitmap.width <= THUMBNAIL_WIDTH) return null;
  const height = Math.max(1, Math.round((bitmap.height * THUMBNAIL_WIDTH) / bitmap.width));
  return await drawToBlob(bitmap, THUMBNAIL_WIDTH, height, mimeType);
}

// PNG는 PNG로 남긴다 — 투명도를 잃지 않기 위해서다. 나머지는 JPEG로 인코딩한다.
async function drawToBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  mimeType: string,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  const type = mimeType === "image/png" ? "image/png" : "image/jpeg";
  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, STORED_JPEG_QUALITY),
  );
}
