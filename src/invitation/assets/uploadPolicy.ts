// 업로드 정책 — 저장 구현과 무관한 순수 규칙 (제한값의 단일 소스)

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

// 배경음악 — 모바일 브라우저가 보편 지원하는 형식만 (버킷 mime 제한과 동일 목록)
export const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "MP3",
  "audio/mp4": "M4A",
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
export const MIN_RECOMMENDED_WIDTH = 800; // px — 미만이면 저해상도 경고 (거부 아님)
export const THUMBNAIL_WIDTH = 640; // px — 그리드 표시용 파생 이미지 폭

export class AssetValidationError extends Error {}

// 파일을 읽기 전에 확인할 수 있는 것(형식·크기)은 진입점에서 즉시 거부한다 (fail fast)
export function validateUploadFile(file: { type: string; size: number; name: string }): void {
  if (!(file.type in ALLOWED_IMAGE_TYPES)) {
    throw new AssetValidationError(
      `지원하지 않는 파일 형식입니다: ${file.name} — ${Object.values(ALLOWED_IMAGE_TYPES).join("·")}만 업로드할 수 있습니다`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AssetValidationError(
      `파일이 너무 큽니다: ${file.name} (${formatBytes(file.size)}) — 최대 ${formatBytes(MAX_UPLOAD_BYTES)}`,
    );
  }
}

export function validateAudioFile(file: { type: string; size: number; name: string }): void {
  if (!(file.type in ALLOWED_AUDIO_TYPES)) {
    throw new AssetValidationError(
      `지원하지 않는 음악 파일 형식입니다: ${file.name} — ${Object.values(ALLOWED_AUDIO_TYPES).join("·")}만 업로드할 수 있습니다`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AssetValidationError(
      `파일이 너무 큽니다: ${file.name} (${formatBytes(file.size)}) — 최대 ${formatBytes(MAX_UPLOAD_BYTES)}`,
    );
  }
}

export function lowResolutionWarning(width: number): string | null {
  if (width >= MIN_RECOMMENDED_WIDTH) return null;
  return `해상도가 낮습니다 (가로 ${width}px) — 큰 화면에서 흐릿하게 보일 수 있습니다`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
