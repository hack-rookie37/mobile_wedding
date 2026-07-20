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

// 커스텀 폰트 — 웹폰트로 바로 쓸 수 있는 형식만 (버킷 mime 제한과 동일 목록)
export const ALLOWED_FONT_TYPES: Record<string, string> = {
  "font/woff2": "WOFF2",
  "font/woff": "WOFF",
  "font/ttf": "TTF",
  "font/otf": "OTF",
};

// 브라우저가 폰트 파일에 붙이는 mime은 제각각이라(빈 값·application/octet-stream 등)
// 확장자로도 판별한다 — 저장 시에는 위 표준 mime으로 정규화한다.
const FONT_EXTENSION_TYPES: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

export function fontMimeOf(file: { type: string; name: string }): string | null {
  if (file.type in ALLOWED_FONT_TYPES) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return FONT_EXTENSION_TYPES[extension] ?? null;
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — 받아주는 파일 크기
export const MIN_RECOMMENDED_WIDTH = 800; // px — 미만이면 저해상도 경고 (거부 아님)
export const THUMBNAIL_WIDTH = 640; // px — 그리드 표시용 파생 이미지 폭

// 저장·전송하는 이미지의 최대 치수 (ADR-030). 받는 크기와 내보내는 크기를 분리한다.
// 청첩장은 폰으로 본다 — 캔버스 최대 폭이 430px이고 화소밀도 3배 화면이 1290px를
// 요구하므로 1600px이면 넘친다. 폰 원본(4032px·5MB)을 그대로 저장하면 하객 한 명이
// 사진 열몇 장에 수십 MB를 내려받고, 그게 전송량과 로딩 시간의 대부분이다.
export const MAX_STORED_WIDTH = 1600;
export const MAX_STORED_HEIGHT = 2400; // 전면 사진이 세로로 길어질 수 있어 여유를 둔다
export const STORED_JPEG_QUALITY = 0.82;

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

export function validateFontFile(file: { type: string; size: number; name: string }): void {
  if (fontMimeOf(file) === null) {
    throw new AssetValidationError(
      `지원하지 않는 폰트 파일 형식입니다: ${file.name} — ${Object.values(ALLOWED_FONT_TYPES).join("·")}만 업로드할 수 있습니다`,
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
