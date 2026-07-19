import { describe, expect, it } from "vitest";
import {
  AssetValidationError,
  formatBytes,
  lowResolutionWarning,
  MAX_UPLOAD_BYTES,
  MIN_RECOMMENDED_WIDTH,
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
