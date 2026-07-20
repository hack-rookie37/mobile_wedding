import { describe, expect, it } from "vitest";
import {
  AssetValidationError,
  formatBytes,
  lowResolutionWarning,
  MAX_UPLOAD_BYTES,
  MIN_RECOMMENDED_WIDTH,
  validateAudioFile,
  validateFontFile,
  validateUploadFile,
} from "./uploadPolicy";

describe("validateUploadFile", () => {
  it("허용 형식(JPG·PNG·WebP)은 통과한다", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(() => validateUploadFile({ type, size: 1024, name: "a" })).not.toThrow();
    }
  });

  it("허용되지 않는 형식은 즉시 거부한다", () => {
    for (const type of ["image/gif", "text/plain", "application/pdf", ""]) {
      expect(() => validateUploadFile({ type, size: 1024, name: "bad.gif" })).toThrow(
        AssetValidationError,
      );
    }
  });

  it("크기 상한을 초과하면 거부한다 (경계값 포함)", () => {
    expect(() =>
      validateUploadFile({ type: "image/png", size: MAX_UPLOAD_BYTES, name: "max.png" }),
    ).not.toThrow();
    expect(() =>
      validateUploadFile({ type: "image/png", size: MAX_UPLOAD_BYTES + 1, name: "big.png" }),
    ).toThrow(/파일이 너무 큽니다/);
  });
});

describe("validateFontFile", () => {
  it("표준 폰트 mime은 통과한다", () => {
    for (const type of ["font/woff2", "font/woff", "font/ttf", "font/otf"]) {
      expect(() => validateFontFile({ type, size: 1024, name: "a" })).not.toThrow();
    }
  });

  it("mime이 비어 있거나 엉뚱해도 확장자로 인정한다 (브라우저마다 다르다)", () => {
    for (const name of ["my.woff2", "MY.OTF", "b.ttf"]) {
      expect(() =>
        validateFontFile({ type: "application/octet-stream", size: 1024, name }),
      ).not.toThrow();
    }
  });

  it("폰트가 아닌 파일은 폰트 문구로 거부한다", () => {
    expect(() => validateFontFile({ type: "image/png", size: 1024, name: "a.png" })).toThrow(
      /폰트 파일 형식/,
    );
  });

  it("크기 상한을 초과하면 거부한다", () => {
    expect(() =>
      validateFontFile({ type: "font/woff2", size: MAX_UPLOAD_BYTES + 1, name: "big.woff2" }),
    ).toThrow(/파일이 너무 큽니다/);
  });
});

describe("lowResolutionWarning", () => {
  it("권장 폭 미만이면 경고, 이상이면 null", () => {
    expect(lowResolutionWarning(MIN_RECOMMENDED_WIDTH)).toBeNull();
    expect(lowResolutionWarning(MIN_RECOMMENDED_WIDTH - 1)).toMatch(/해상도가 낮습니다/);
  });
});

describe("formatBytes", () => {
  it("사람이 읽는 단위로 변환한다", () => {
    expect(formatBytes(512)).toBe("512B");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10.0MB");
  });
});

describe("validateAudioFile", () => {
  it("MP3·M4A만 허용하고 이미지·기타 형식은 거부한다", () => {
    expect(() =>
      validateAudioFile({ type: "audio/mpeg", size: 1024, name: "bgm.mp3" }),
    ).not.toThrow();
    expect(() =>
      validateAudioFile({ type: "audio/mp4", size: 1024, name: "bgm.m4a" }),
    ).not.toThrow();
    expect(() => validateAudioFile({ type: "audio/ogg", size: 1024, name: "bgm.ogg" })).toThrow(
      /지원하지 않는 음악 파일 형식/,
    );
    expect(() => validateAudioFile({ type: "image/png", size: 1024, name: "a.png" })).toThrow(
      /지원하지 않는 음악 파일 형식/,
    );
  });

  it("10MB 초과는 거부한다", () => {
    expect(() =>
      validateAudioFile({ type: "audio/mpeg", size: MAX_UPLOAD_BYTES + 1, name: "big.mp3" }),
    ).toThrow(/파일이 너무 큽니다/);
  });
});
