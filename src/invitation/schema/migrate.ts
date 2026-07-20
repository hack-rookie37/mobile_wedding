import {
  DEFAULT_GALLERY_GAP_PX,
  DEFAULT_HERO_OVERLAY,
  DEFAULT_SECTION_PAD_X,
  DEFAULT_TRANSPORT_COLUMNS,
  documentSchema,
  type InvitationDocument,
} from "./document";
import { DEFAULT_SECTION_LABELS } from "./sectionDefaults";
import {
  DEFAULT_BODY_PT,
  DEFAULT_HEADING_PT,
  ITEM_PT_OF_BODY,
  LABEL_PT_OF_HEADING,
  PT_MAX,
  PT_MIN,
} from "./themes";

export const CURRENT_SCHEMA_VERSION = 12;

// v6의 글자 크기 3단계 → v7의 pt 값. 기존 배율(0.93·1·1.08)에 가장 가까운 정수 pt다.
const V6_SCALE_TO_PT: Record<string, number> = { sm: 10, md: 11, lg: 12 };

// 새 photoEffects — 기존 문서의 fadeBottom(있으면)만 이어받고 나머지는 기본값.
// 이미 v7 모양의 effects가 들어 있으면 손대지 않는다: 마이그레이션을 두 번 태워도
// 결과가 같아야 하고, 사용자가 맞춰 둔 밝기·페이드를 기본값으로 되돌리면 안 된다.
function effectsOf(content: { effects?: unknown; fadeBottom?: unknown } | undefined) {
  if (content?.effects !== undefined) return content.effects;
  return { fadeBottom: content?.fadeBottom !== false, sparkle: false, brightness: 1, opacity: 1 };
}

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
  //  * 최상위 music(배경음악)·typography(폰트·글자 크기) 추가 — 기본은 테마 그대로
  5: (raw) => {
    const doc = raw as { sections?: Array<{ type?: unknown; content?: object }> };
    return {
      ...(raw as object),
      schemaVersion: 6,
      music: { assetId: null },
      typography: { headingFont: "theme", bodyFont: "theme", scale: "md" },
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
  // v6 → v7: 벤치마크 리뉴얼 2차 (전면 사진 통일·직접 pt 입력·커스텀 폰트)
  //  * 글자 크기: 3단계 enum → pt 값 (전역 typography.basePt, 섹션 style.fontSizePt)
  //  * hero: 레이아웃을 전면 사진 하나로 통일하고, fadeBottom을 photoEffects로 승격
  //  * closing: 메인과 같은 전면 사진 연출을 위해 photoAspect·effects 추가
  //  * gallery: filmstrip(필름) 제거 — 가장 가까운 가로 스크롤인 slider로 옮긴다
  6: (raw) => {
    const doc = raw as {
      typography?: { scale?: unknown; basePt?: unknown };
      sections?: Array<{
        type?: unknown;
        style?: { fontScale?: unknown; fontSizePt?: unknown };
        layout?: { variant?: unknown };
        content?: { fadeBottom?: unknown; effects?: unknown; photoAspect?: unknown };
      }>;
    };
    const { scale, ...typographyRest } = doc.typography ?? {};
    return {
      ...(raw as object),
      schemaVersion: 7,
      typography: {
        ...typographyRest,
        basePt: typographyRest.basePt ?? V6_SCALE_TO_PT[String(scale)] ?? 11,
      },
      sections: (doc.sections ?? []).map((section) => {
        const { fontScale, ...styleRest } = section.style ?? {};
        const style =
          fontScale === undefined || styleRest.fontSizePt !== undefined
            ? styleRest
            : { ...styleRest, fontSizePt: V6_SCALE_TO_PT[String(fontScale)] ?? 11 };
        if (section.type === "hero") {
          const content = { ...section.content, effects: effectsOf(section.content) };
          delete content.fadeBottom; // v6의 fadeBottom은 effects 안으로 흡수됐다
          return { ...section, style, layout: { variant: "photoFull" }, content };
        }
        if (section.type === "closing") {
          return {
            ...section,
            style,
            content: {
              ...section.content,
              photoAspect: section.content?.photoAspect ?? "4/5",
              effects: effectsOf(section.content),
            },
          };
        }
        if (section.type === "gallery" && section.layout?.variant === "filmstrip") {
          return { ...section, style, layout: { variant: "slider" } };
        }
        return { ...section, style };
      }),
    };
  },
  // v7 → v8: 제목·본문 글자 크기 분리 + 테마 색 override + 공유 섹션 분리 (ADR-028)
  //  * 하나였던 pt가 둘로 갈린다. 제목은 20px, 본문은 15px 기준선이라 같은 화면 크기를
  //    유지하려면 제목 pt는 본문 pt의 4/3배다 (기존 basePt 11 → 제목 15pt·본문 11pt).
  //  * theme.palette는 비어 있는 채로 추가 — 색을 덮어쓰지 않으면 테마 그대로다.
  //  * 맺음말의 showShare가 켜져 있었다면 그 자리 뒤에 'share' 섹션을 만든다 —
  //    공유 버튼을 쓰고 있던 문서는 기능을 잃지 않고, 꺼 두었던 문서는 새 영역이 생기지 않는다.
  7: (raw) => {
    const doc = raw as {
      theme?: { palette?: unknown };
      typography?: { basePt?: unknown; headingPt?: unknown; bodyPt?: unknown };
      sections?: Array<{
        id?: unknown;
        type?: unknown;
        style?: { fontSizePt?: unknown; headingPt?: unknown; bodyPt?: unknown };
        content?: { showShare?: unknown };
      }>;
    };
    const splitPt = (base: unknown, existing: { headingPt?: unknown; bodyPt?: unknown }) => {
      const bodyPt = existing.bodyPt ?? base;
      return {
        ...(bodyPt !== undefined ? { bodyPt } : {}),
        ...(existing.headingPt !== undefined
          ? { headingPt: existing.headingPt }
          : typeof bodyPt === "number"
            ? { headingPt: Math.round(((bodyPt * 4) / 3) * 2) / 2 } // 0.5pt 단위로 반올림
            : {}),
      };
    };
    const { basePt, ...typographyRest } = doc.typography ?? {};
    return {
      ...(raw as object),
      schemaVersion: 8,
      theme: { ...doc.theme, palette: doc.theme?.palette ?? {} },
      typography: { ...typographyRest, ...splitPt(basePt ?? 11, typographyRest) },
      sections: (doc.sections ?? []).flatMap((section): unknown[] => {
        const { fontSizePt, ...styleRest } = section.style ?? {};
        // 섹션 override는 없던 문서가 대부분이다 — 있을 때만 둘로 나눈다
        const style =
          fontSizePt === undefined && styleRest.bodyPt === undefined
            ? styleRest
            : { ...styleRest, ...splitPt(fontSizePt, styleRest) };
        if (section.type !== "closing") return [{ ...section, style }];

        const { showShare, ...contentRest } = section.content ?? {};
        const closing = { ...section, style, content: contentRest };
        if (showShare !== true) return [closing];
        return [closing, shareSectionAfter(section.id)];
      }),
    };
  },
  // v8 → v9: 갤러리 사진의 모서리·간격을 섹션 옵션으로 승격 (요청된 표시 개선)
  //  * 지금까지는 테마의 결과 레이아웃이 함께 정해서 사용자가 손댈 수 없었다.
  //  * 기존 값을 문서에 심어 준다 — 기본 테마(웜 에디토리얼)를 쓰던 문서는 그대로 보인다.
  //    필름·모노크롬 테마를 쓰던 문서는 간격이 에디토리얼 기준으로 맞춰진다.
  8: (raw) => {
    const doc = raw as {
      sections?: Array<{
        type?: unknown;
        layout?: { variant?: unknown };
        content?: { photoCorner?: unknown; photoGapPx?: unknown };
      }>;
    };
    return {
      ...(raw as object),
      schemaVersion: 9,
      sections: (doc.sections ?? []).map((section) => {
        if (section.type !== "gallery") return section;
        const variant = String(section.layout?.variant);
        return {
          ...section,
          content: {
            ...section.content,
            // 대형 스트립만 각진 모서리였다
            photoCorner:
              section.content?.photoCorner ?? (variant === "strip" ? "sharp" : "rounded"),
            photoGapPx:
              section.content?.photoGapPx ?? V8_GALLERY_GAP[variant] ?? DEFAULT_GALLERY_GAP_PX,
          },
        };
      }),
    };
  },
  // v9 → v10: 섹션 눈썹 라벨과 좌우 여백을 편집 가능한 값으로 승격 (요청된 표시 개선)
  //  * 눈썹 라벨("GALLERY" 등)은 렌더러가 타입별로 박아 두고 있었다 — 섹션 이름과
  //    영문 라벨이 어긋나던 자리(인사말 = INVITATION)도 이제 직접 고칠 수 있다.
  //  * 좌우 여백은 24px 고정이거나 전면 사진·대형 스트립만 0이었다 — 숫자 하나로 합쳤다.
  //  두 값 모두 그때까지 화면에 보이던 값을 그대로 심으므로 기존 문서의 모습은 그대로다.
  9: (raw) => {
    const doc = raw as {
      sections?: Array<{
        type?: unknown;
        layout?: { variant?: unknown };
        style?: { paddingX?: unknown };
        content?: { label?: unknown };
      }>;
    };
    return {
      ...(raw as object),
      schemaVersion: 10,
      sections: (doc.sections ?? []).map((section) => {
        const type = String(section.type);
        const style = {
          ...section.style,
          paddingX: section.style?.paddingX ?? (wasEdgeToEdge(section) ? 0 : DEFAULT_SECTION_PAD_X),
        };
        // 메인만 눈썹 라벨이 없다 — 제목 자리 자체가 없는 전면 사진이다
        if (type === "hero") return { ...section, style };
        return {
          ...section,
          style,
          content: {
            ...section.content,
            label:
              section.content?.label ??
              DEFAULT_SECTION_LABELS[type as keyof typeof DEFAULT_SECTION_LABELS] ??
              "",
          },
        };
      }),
    };
  },
  // v10 → v11: 메인 사진 위 문구 · 배경음악 재생 설정 · 교통 안내 확장 · 공유 영역 색
  //  * hero content.overlay 추가 — 빈 문자열이라 아무것도 얹히지 않는다 (기존 모습 그대로).
  //  * music에 volume·speed·autoplay 추가 — 원본 크기·원래 속도·자동재생 끔이라 동작이 같다.
  //  * transport 항목에 emoji("" = 수단 기본 그림), content.columns(카드 격자 열 수) 추가.
  //  * 공유 영역의 카카오 버튼은 이제 테마 강조색을 기본으로 쓴다 — 노란색을 심어 두지 않는다.
  //    지금까지 카카오 노랑으로 굳어 있던 색이 강조색으로 바뀌는 '요청된 표시 개선'이다
  //    (되돌리려면 편집기에서 #FEE500을 직접 고른다).
  10: (raw) => {
    const doc = raw as {
      music?: object;
      sections?: Array<{
        type?: unknown;
        content?: { overlay?: unknown; items?: unknown; columns?: unknown };
      }>;
    };
    return {
      ...(raw as object),
      schemaVersion: 11,
      music: { volume: 1, speed: 1, autoplay: false, ...doc.music },
      sections: (doc.sections ?? []).map((section) => {
        if (section.type === "hero") {
          return {
            ...section,
            content: {
              ...section.content,
              overlay: section.content?.overlay ?? DEFAULT_HERO_OVERLAY,
            },
          };
        }
        if (section.type === "transportation") {
          const items = Array.isArray(section.content?.items) ? section.content.items : [];
          return {
            ...section,
            content: {
              ...section.content,
              items: items.map((item) => ({ emoji: "", ...(item as object) })),
              columns: section.content?.columns ?? DEFAULT_TRANSPORT_COLUMNS,
            },
          };
        }
        return section;
      }),
    };
  },
  // v11 → v12: 글자 설정을 네 역할(눈썹·제목·항목 제목·본문)로 나눈다 (ADR-035)
  //  * 전역 headingFont/bodyFont/headingPt/bodyPt → typography.roles 네 벌.
  //  * 섹션 style의 fontFamily·headingPt·bodyPt·color → style.text 네 벌.
  //  * 메인 사진 위 문구: 3단 위치(position) → 세로 위치 %(positionPct), 그림자 on/off 추가.
  //  눈썹은 그때까지 '제목' 배율을, 항목 제목은 '본문' 배율을 따라가고 있었다. 역할이 갈라져도
  //  처음 모습이 같도록 그 관계를 pt로 환산해 심는다 (제목 15pt → 눈썹 8.25pt).
  //  섹션 글자색(style.color)은 본문 역할의 색이 된다 — 섹션의 기본 글자색이라는 뜻이 같고,
  //  렌더러도 그 색에서 흐린 글자색·구분선을 파생시키던 자리를 그대로 잇는다.
  11: (raw) => {
    const doc = raw as {
      typography?: {
        roles?: unknown;
        headingFont?: unknown;
        bodyFont?: unknown;
        headingPt?: unknown;
        bodyPt?: unknown;
      };
      sections?: Array<{
        type?: unknown;
        content?: { overlay?: { position?: unknown; positionPct?: unknown } };
        style?: {
          text?: unknown;
          fontFamily?: unknown;
          headingPt?: unknown;
          bodyPt?: unknown;
          color?: unknown;
        };
      }>;
    };
    const typography = doc.typography ?? {};
    // 이미 있던 역할 설정이 옛 필드보다 우선한다 — 옛 버전 번호가 찍힌 최신 문서를 다시
    // 태워도 사용자가 맞춰 둔 자간·굵기가 기본값으로 되돌아가면 안 된다 (섹션도 같은 규칙).
    const keptRoles = (typography.roles ?? {}) as Record<string, object>;
    const roleOf = (name: string, legacy: object) => ({ ...legacy, ...(keptRoles[name] ?? {}) });
    const headingFont = typography.headingFont ?? "theme";
    const bodyFont = typography.bodyFont ?? "theme";
    const headingPt = ptOr(typography.headingPt, DEFAULT_HEADING_PT);
    const bodyPt = ptOr(typography.bodyPt, DEFAULT_BODY_PT);

    return {
      ...(raw as object),
      schemaVersion: 12,
      typography: {
        roles: {
          // 눈썹은 제목 글꼴이 아니라 본문 글꼴을 쓰고 있었다 (색만 강조색)
          label: roleOf("label", {
            font: bodyFont,
            sizePt: halfPt(headingPt * LABEL_PT_OF_HEADING),
          }),
          heading: roleOf("heading", { font: headingFont, sizePt: headingPt }),
          itemTitle: roleOf("itemTitle", {
            font: bodyFont,
            sizePt: halfPt(bodyPt * ITEM_PT_OF_BODY),
          }),
          body: roleOf("body", { font: bodyFont, sizePt: bodyPt }),
        },
      },
      sections: (doc.sections ?? []).map((section) => {
        const content =
          section.type === "hero" ? { ...section.content, overlay: overlayOf(section) } : undefined;
        const {
          fontFamily,
          headingPt: sectionHeadingPt,
          bodyPt: sectionBodyPt,
          color,
          ...styleRest
        } = section.style ?? {};
        // 섹션 글꼴 override는 제목·본문 양쪽을 한꺼번에 바꾸고 있었다 → 네 역할 모두에 건다
        const font = fontFamily === undefined ? {} : { font: fontFamily };
        const tint = color === undefined ? {} : { color };
        const headingOf =
          sectionHeadingPt === undefined ? undefined : ptOr(sectionHeadingPt, headingPt);
        const bodyOf = sectionBodyPt === undefined ? undefined : ptOr(sectionBodyPt, bodyPt);
        const size = (pt: number | undefined) => (pt === undefined ? {} : { sizePt: pt });
        // 이미 있던 역할 설정이 있으면 그것이 이긴다 — 앞 단계에서 만들어진 값만 채워 넣는다
        const kept = (section.style?.text ?? {}) as Record<string, object>;
        const merge = (role: string, legacy: object) => ({ ...legacy, ...(kept[role] ?? {}) });
        return {
          ...section,
          ...(content === undefined ? {} : { content }),
          style: {
            ...styleRest,
            text: {
              label: merge("label", {
                ...font,
                ...size(headingOf && halfPt(headingOf * LABEL_PT_OF_HEADING)),
              }),
              heading: merge("heading", { ...font, ...size(headingOf) }),
              itemTitle: merge("itemTitle", {
                ...font,
                ...tint,
                ...size(bodyOf && halfPt(bodyOf * ITEM_PT_OF_BODY)),
              }),
              // 섹션 글자색은 본문 역할이 이어받는다 (항목 제목도 같은 잉크를 쓰고 있었다)
              body: merge("body", { ...font, ...tint, ...size(bodyOf) }),
            },
          },
        };
      }),
    };
  },
};

// 0.5pt 단위로 맞추고 허용 범위 안으로 자른다 — 편집기의 pt 입력이 0.5 눈금이고,
// 파생값(눈썹 = 제목 × 0.55)은 원본이 작으면 최솟값 아래로 떨어진다.
// 자르지 않으면 스키마 검증에서 걸려 **문서가 아예 열리지 않는다**.
function halfPt(pt: number): number {
  return Math.min(PT_MAX, Math.max(PT_MIN, Math.round(pt * 2) / 2));
}

// v11의 3단 위치를 %로. 0 = 위쪽 끝, 50 = 한가운데, 100 = 아래쪽 끝이라
// 그때 보이던 자리가 그대로 나온다. 그림자는 v11에서 늘 켜져 있었다.
const V11_OVERLAY_POSITION: Record<string, number> = { top: 0, center: 50, bottom: 100 };

function overlayOf(section: {
  content?: { overlay?: { position?: unknown; positionPct?: unknown } };
}) {
  const overlay = section.content?.overlay;
  if (overlay === undefined) return DEFAULT_HERO_OVERLAY;
  const { position, ...rest } = overlay;
  return {
    ...DEFAULT_HERO_OVERLAY,
    ...rest,
    positionPct: overlay.positionPct ?? V11_OVERLAY_POSITION[String(position)] ?? 50,
  };
}

function ptOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// v9까지 좌우 여백이 0이던 자리: 전면 사진(메인·맺음말 photo)과 갤러리 대형 스트립.
function wasEdgeToEdge(section: { type?: unknown; layout?: { variant?: unknown } }): boolean {
  if (section.type === "hero") return true;
  if (section.type === "closing") return section.layout?.variant === "photo";
  if (section.type === "gallery") return section.layout?.variant === "strip";
  return false;
}

// v8까지 레이아웃별로 굳어 있던 간격(px) — 웜 에디토리얼 기준이다
const V8_GALLERY_GAP: Record<string, number> = {
  strip: 2,
  slider: 12,
  grid2: 8,
  grid3: 6,
  collage: 8,
};

// 맺음말에 붙어 있던 공유 버튼을 이어받는 새 섹션.
// id는 원래 섹션 id에서 파생한다 — 마이그레이션을 두 번 태워도 같은 문서가 나와야 한다
// (nanoid를 쓰면 실행할 때마다 다른 문서가 되어 재현이 깨진다).
function shareSectionAfter(closingId: unknown) {
  return {
    id: `${typeof closingId === "string" ? closingId : "closing"}-share`,
    type: "share",
    visible: true,
    layout: { variant: "default" },
    style: { paddingY: "md", animation: "fade" },
    content: { title: "청첩장 공유하기", body: "" },
  };
}

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
