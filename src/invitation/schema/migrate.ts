import { documentSchema, type InvitationDocument } from "./document";

export const CURRENT_SCHEMA_VERSION = 6;

export class InvalidDocumentError extends Error {}

// forward-only 마이그레이션 (ADR-002)
const migrations: Record<number, (raw: unknown) => unknown> = {
  // v1 → v2: theme { preset, fontPair } → theme { id } (Phase 3 테마 시스템, ADR-014)
  1: (raw) => {
    const doc = raw as { theme?: { preset?: unknown } };
    const preset = doc.theme?.preset;
    return {
      ...(raw as object),
      schemaVersion: 2,
      theme: { id: preset === "snow" ? "modern-monochrome" : "warm-editorial" },
    };
  },
  // v2 → v3: gallery variant 확장으로 carousel → slider 개명 (Phase 5, ADR-016)
  // photos 항목의 optional 필드(caption·frame)와 video 섹션은 추가만 되어 변환이 필요 없다
  2: (raw) => {
    const doc = raw as { sections?: Array<{ type?: unknown; layout?: { variant?: unknown } }> };
    return {
      ...(raw as object),
      schemaVersion: 3,
      sections: (doc.sections ?? []).map((section) =>
        section.type === "gallery" && section.layout?.variant === "carousel"
          ? { ...section, layout: { ...section.layout, variant: "slider" } }
          : section,
      ),
    };
  },
  // v3 → v4: Phase 8 공개 섹션 (신규 타입은 추가만이라 변환 불필요)
  //  * video variant "default" → "embed" (facade|embed로 확장 — 기존 즉시 임베드 동작 보존)
  //  * venue content에 showMapButtons 추가 (외부 지도 열기 버튼 — 기존 문서는 켬)
  3: (raw) => {
    const doc = raw as {
      sections?: Array<{ type?: unknown; layout?: object; content?: object }>;
    };
    return {
      ...(raw as object),
      schemaVersion: 4,
      sections: (doc.sections ?? []).map((section) => {
        if (section.type === "video") {
          return { ...section, layout: { variant: "embed" } };
        }
        if (section.type === "venue") {
          return { ...section, content: { ...section.content, showMapButtons: true } };
        }
        return section;
      }),
    };
  },
  // v4 → v5: RSVP 섹션 타입 추가 (Phase 9) — 추가만이라 변환할 것이 없다.
  // 버전 경계만 올린다: rsvp를 담을 수 있는 문서를 구버전 코드가 스키마 오류로
  // 오해하지 않고 "지원하지 않는 버전"으로 명확히 거부하게 한다 (ADR-002).
  4: (raw) => ({ ...(raw as object), schemaVersion: 5 }),
  // v5 → v6: 벤치마크 리뉴얼 1차 (전면 히어로·실시간 카운트다운·대형 갤러리)
  //  * hero content에 photoAspect·fadeBottom 추가 — photoArch·textOnly에서는 무시되는
  //    값이라 기존 렌더 결과는 바뀌지 않는다 (기본 3:4·페이드 켬)
  //  * calendar content에 ddayStyle 추가 — 기존 문서도 실시간 카운트다운으로 전환한다
  //    (요청된 표시 개선 — 배지로 되돌리려면 편집기에서 선택)
  //  * gallery content에 photoAspect 추가 (strip variant 전용 — 기존 variant에서는 무시)
  //  * 최상위 music 추가 (배경음악 — 기존 문서는 없음)
  5: (raw) => {
    const doc = raw as { sections?: Array<{ type?: unknown; content?: object }> };
    return {
      ...(raw as object),
      schemaVersion: 6,
      music: { assetId: null },
      sections: (doc.sections ?? []).map((section) => {
        if (section.type === "hero") {
          return {
            ...section,
            content: { ...section.content, photoAspect: "3/4", fadeBottom: true },
          };
        }
        if (section.type === "calendar") {
          return { ...section, content: { ...section.content, ddayStyle: "countdown" } };
        }
        if (section.type === "gallery") {
          return { ...section, content: { ...section.content, photoAspect: "3/4" } };
        }
        if (section.type === "venue") {
          return { ...section, content: { ...section.content, mapImageAssetId: null } };
        }
        if (section.type === "rsvp") {
          // variant 이름 변경: default → sheet (요청된 표시 개선 — inline으로 되돌릴 수 있다)
          return { ...section, layout: { variant: "sheet" } };
        }
        return section;
      }),
    };
  },
};

export function migrateDocument(raw: unknown): InvitationDocument {
  if (typeof raw !== "object" || raw === null || !("schemaVersion" in raw)) {
    throw new InvalidDocumentError("문서에 schemaVersion이 없습니다");
  }
  const version = (raw as { schemaVersion: unknown }).schemaVersion;
  if (typeof version !== "number") {
    throw new InvalidDocumentError("schemaVersion이 숫자가 아닙니다");
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new InvalidDocumentError(
      `지원하지 않는 문서 버전입니다: v${version} (지원 최대 v${CURRENT_SCHEMA_VERSION})`,
    );
  }

  let current: unknown = raw;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const migration = migrations[v];
    if (!migration) {
      throw new InvalidDocumentError(`v${v} → v${v + 1} 마이그레이션이 없습니다`);
    }
    current = migration(current);
  }

  const result = documentSchema.safeParse(current);
  if (!result.success) {
    throw new InvalidDocumentError(`문서 검증 실패: ${result.error.message}`);
  }
  return result.data;
}
