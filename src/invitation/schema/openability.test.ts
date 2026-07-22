import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../fixtures/sample";
import { documentSchema, type InvitationDocument } from "./document";
import { CURRENT_SCHEMA_VERSION, migrateDocument } from "./migrate";
import { PT_MAX, PT_MIN } from "./themes";

// 저장돼 있던 청첩장은 어느 버전에 저장됐든 반드시 다시 열려야 한다.
//
// 이 파일이 있는 이유: v12에서 실제로 열리지 않는 사고가 났다. 새 필드(positionPct·shadow)를
// 스키마에만 넣고 마이그레이션에 넣지 않았고, 파생 pt(눈썹 = 제목 × 0.55)가 최솟값 아래로
// 떨어져 검증에서 걸렸다. 둘 다 "새 문서 만들기"로는 절대 드러나지 않는다 —
// 샘플 문서는 언제나 최신 모양이기 때문이다.
//
// 그래서 여기서는 **옛 모양 그대로의 문서**를 만들어 열어 본다.

// v11에 저장돼 있던 문서 — 이 모양이 실제로 DB에 들어 있었다.
function v11Document(overrides: { headingPt?: number; bodyPt?: number } = {}) {
  const base = createSampleDocument() as unknown as Record<string, never>;
  const doc = base as unknown as InvitationDocument;
  return {
    ...base,
    schemaVersion: 11,
    // v11의 전역 글자 설정은 역할이 아니라 제목/본문 둘이었다
    typography: {
      headingFont: "theme",
      bodyFont: "theme",
      headingPt: overrides.headingPt ?? 15,
      bodyPt: overrides.bodyPt ?? 11,
    },
    sections: doc.sections.map((section) => {
      // v11 섹션 style에는 text가 없고 fontFamily·headingPt·bodyPt·color가 있었다
      const { text: _text, ...styleRest } = section.style;
      const style: Record<string, unknown> = { ...styleRest };
      if (section.type === "greeting") {
        style.fontFamily = "gowun-dodum";
        style.color = "#334455";
        style.headingPt = overrides.headingPt ?? 12;
        style.bodyPt = overrides.bodyPt ?? 9;
      }
      if (section.type !== "hero") return { ...section, style };
      // 실제로 열리지 않은 문서는 메인(sections[0])에 크기 override가 있었다 —
      // 파생 pt는 전역뿐 아니라 섹션에서도 최솟값 아래로 떨어질 수 있다
      style.headingPt = overrides.headingPt ?? 12;
      style.bodyPt = overrides.bodyPt ?? 9;
      // v11의 메인 사진 위 문구는 3단 위치였고 그림자·타자 효과 설정이 하나도 없었다
      const {
        positionPct: _pct,
        shadow: _shadow,
        shadowColor: _shadowColor,
        shadowStrength: _shadowStrength,
        animation: _animation,
        ...overlay
      } = section.content.overlay;
      const { contentOffsetPx: _offset, ...content } = section.content;
      return {
        ...section,
        style,
        content: { ...content, overlay: { ...overlay, position: "bottom" } },
      };
    }),
  };
}

// 버전마다 '그때 없던 칸'을 지운 메인 섹션을 만든다.
// 새 버전을 올릴 때마다 여기에 그 버전에서 생긴 칸을 적으면 케이스가 하나 늘어난다.
function heroWithout(
  schemaVersion: number,
  drop: { overlay?: string[]; content?: string[] },
): Record<string, unknown> {
  const doc = createSampleDocument();
  const without = (source: object, keys: string[]) =>
    Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
  return {
    ...doc,
    schemaVersion,
    sections: doc.sections.map((section) => {
      if (section.type !== "hero") return section;
      return {
        ...section,
        content: {
          ...without(section.content, drop.content ?? []),
          overlay: without(section.content.overlay, drop.overlay ?? []),
        },
      };
    }),
  };
}

// v12: 그림자 색·세기가 없고, 타자 효과·글 내리기도 아직 없었다.
const v12Document = () =>
  heroWithout(12, {
    overlay: ["shadowColor", "shadowStrength", "animation"],
    content: ["contentOffsetPx"],
  });

// v13: 그림자는 갖췄지만 타자 효과·글 내리기가 없었다.
const v13Document = () => heroWithout(13, { overlay: ["animation"], content: ["contentOffsetPx"] });

// v15: 사진 위 문구의 발광·자간·행간·등장 속도, 그리고 전면 사진의 꽃잎 효과가 없었다.
// 꽃잎은 hero뿐 아니라 closing의 effects에도 없었다 — heroWithout은 hero만 만지므로 따로 만든다.
function v15Document() {
  const doc = createSampleDocument();
  const withoutNewFields = (section: (typeof doc.sections)[number]) => {
    if (section.type !== "hero" && section.type !== "closing") return section;
    const { petals: _petals, ...effects } = section.content.effects;
    if (section.type === "closing") return { ...section, content: { ...section.content, effects } };
    const {
      letterSpacing: _ls,
      lineHeight: _lh,
      glow: _glow,
      glowStrength: _gs,
      animationSpeed: _speed,
      ...overlay
    } = section.content.overlay;
    return { ...section, content: { ...section.content, effects, overlay } };
  };
  return { ...doc, schemaVersion: 15, sections: doc.sections.map(withoutNewFields) };
}

// v16: 외곽 흐림(overlay), 꽃잎의 색·양·투명도(effects)가 아직 없었다 — 꽃잎 on/off만 있었다.
function v16Document() {
  const doc = createSampleDocument();
  const withoutNewFields = (section: (typeof doc.sections)[number]) => {
    if (section.type !== "hero" && section.type !== "closing") return section;
    const {
      petalColor: _pc,
      petalCount: _pn,
      petalOpacity: _po,
      ...effects
    } = section.content.effects;
    if (section.type === "closing") return { ...section, content: { ...section.content, effects } };
    const { edgeBlurPx: _eb, ...overlay } = section.content.overlay;
    return { ...section, content: { ...section.content, effects, overlay } };
  };
  return { ...doc, schemaVersion: 16, sections: doc.sections.map(withoutNewFields) };
}

// v17: 기울기(rotateDeg)가 아직 없었다 (자간·행간 하한·크기 상한 확장은 필드가 아니라
// 범위 변화라 '없던 칸'이 생기지 않는다 — 그쪽은 아래 '넓힌 범위' 케이스가 덮는다).
function v17Document() {
  const doc = createSampleDocument();
  return {
    ...doc,
    schemaVersion: 17,
    sections: doc.sections.map((section) => {
      if (section.type !== "hero") return section;
      const { rotateDeg: _rot, ...overlay } = section.content.overlay;
      return { ...section, content: { ...section.content, overlay } };
    }),
  };
}

// v14 전이 상태 — 이 사고가 실제로 났다. 개발 중 이 필드가 typewriter(boolean) →
// animation(enum)으로 바뀌었고, 그 사이에 dev 서버가 문서를 저장하면서 schemaVersion만 14로
// 찍혔다. 버전이 이미 최신이라 마이그레이션이 손대지 못해 열리지 않았다.
function transitionalV14(overlayExtra: Record<string, unknown>) {
  const base = heroWithout(14, { overlay: ["animation"] }) as {
    sections: Array<{ type: string; content: { overlay: Record<string, unknown> } }>;
  };
  base.sections[0].content.overlay = { ...base.sections[0].content.overlay, ...overlayExtra };
  return base;
}

describe("저장돼 있던 문서는 반드시 다시 열린다", () => {
  it("v11 문서가 열리고, 그때 보이던 자리·설정이 이어진다", () => {
    const opened = migrateDocument(v11Document());
    expect(opened.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.content.overlay.positionPct).toBe(100); // "bottom" = 아래쪽 끝
    expect(hero.content.overlay.shadow).toBe(true); // v11에서는 늘 켜져 있었다
    expect(hero.content.overlay.text).toBe("we're getting married"); // 문구 보존

    // 섹션 글꼴·글자색은 네 역할로 퍼지고, 색은 본문 역할이 이어받는다
    const greeting = opened.sections.find((s) => s.type === "greeting");
    if (greeting?.type !== "greeting") throw new Error("greeting이 없습니다");
    expect(greeting.style.text.heading.font).toBe("gowun-dodum");
    expect(greeting.style.text.body.color).toBe("#334455");
  });

  it("v12 문서가 열리고, 그때 보이던 그림자가 그대로다", () => {
    const opened = migrateDocument(v12Document());
    expect(opened.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    // v12까지 그림자는 검정 40%로 못박혀 있었다 — 열었더니 모습이 달라지면 안 된다
    expect(hero.content.overlay.shadowColor).toBe("#000000");
    expect(hero.content.overlay.shadowStrength).toBe(40);
    // 나머지 칸은 저장돼 있던 값 그대로 (기본값이 덮어쓰면 안 된다)
    expect(hero.content.overlay.text).toBe("we're getting married");
    expect(hero.content.overlay.positionPct).toBe(50);
  });

  it("v13 문서가 열리고, 타자 효과·글 내리기는 꺼진 채로 들어온다", () => {
    const opened = migrateDocument(v13Document());
    expect(opened.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    // 둘 다 '지금까지와 같은 모습'인 값이어야 한다 — 열었더니 글자가 타이핑되면 안 된다
    expect(hero.content.overlay.animation).toBe("none");
    expect(hero.content.contentOffsetPx).toBe(0);
    // 버튼 색은 optional이라 비어 있고, 그 뜻은 '테마 강조색을 따른다'이다
    const calendar = opened.sections.find((s) => s.type === "calendar");
    if (calendar?.type !== "calendar") throw new Error("calendar가 없습니다");
    expect(calendar.content.buttonColor).toBeUndefined();
  });

  it("v15 문서가 열리고, 발광·꽃잎은 꺼진 채 자간·행간·속도는 그때 모습 그대로다", () => {
    const opened = migrateDocument(v15Document());
    expect(opened.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    // 전부 '지금까지와 같은 모습'인 값이어야 한다 — 열었더니 글자가 빛나거나 꽃잎이 내리면 안 된다
    expect(hero.content.overlay.glow).toBe(false);
    expect(hero.content.overlay.letterSpacing).toBe(0);
    expect(hero.content.overlay.lineHeight).toBe(1.45); // v15까지 렌더러 고정값
    expect(hero.content.overlay.animationSpeed).toBe(1);
    expect(hero.content.effects.petals).toBe(false);
    // 저장돼 있던 값은 그대로 (기본값이 덮어쓰면 안 된다)
    expect(hero.content.overlay.text).toBe("we're getting married");

    const closing = opened.sections.find((s) => s.type === "closing");
    if (closing?.type !== "closing") throw new Error("closing이 없습니다");
    expect(closing.content.effects.petals).toBe(false);
    expect(closing.content.effects.brightness).toBe(0.6); // 저장돼 있던 값 보존
  });

  it("v16 문서가 열리고, 외곽 흐림은 꺼진 채 꽃잎은 그때 굳어 있던 모습 그대로다", () => {
    const opened = migrateDocument(v16Document());
    expect(opened.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.content.overlay.edgeBlurPx).toBe(0); // 열었더니 글자가 흐려지면 안 된다
    // 꽃잎 옵션은 v16 렌더러에 굳어 있던 값이 그대로 들어온다 — 켜 두었던 꽃잎의 모습이 유지된다
    expect(hero.content.effects.petalColor).toBe("#ffd6e0");
    expect(hero.content.effects.petalCount).toBe(9);
    expect(hero.content.effects.petalOpacity).toBe(0.9);

    const closing = opened.sections.find((s) => s.type === "closing");
    if (closing?.type !== "closing") throw new Error("closing이 없습니다");
    expect(closing.content.effects.petalColor).toBe("#ffd6e0");
  });

  it("v17 문서가 열리고, 기울기는 0으로 들어온다", () => {
    const opened = migrateDocument(v17Document());
    expect(opened.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.content.overlay.rotateDeg).toBe(0); // 열었더니 글자가 기울면 안 된다
    expect(hero.content.overlay.text).toBe("we're getting married"); // 저장돼 있던 값 보존
  });

  it("v18에서 넓힌 범위의 값(겹치는 자간·행간, 200pt, 기울기)이 담긴 문서가 열린다", () => {
    const doc = createSampleDocument();
    const hero = doc.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    hero.content.overlay = {
      ...hero.content.overlay,
      sizePt: 200,
      letterSpacing: -0.5,
      lineHeight: 0.3,
      rotateDeg: -90,
    };
    const opened = migrateDocument(doc);
    const openedHero = opened.sections[0];
    if (openedHero.type !== "hero") throw new Error("hero가 없습니다");
    expect(openedHero.content.overlay.sizePt).toBe(200);
    expect(openedHero.content.overlay.letterSpacing).toBe(-0.5);
    expect(openedHero.content.overlay.lineHeight).toBe(0.3);
    expect(openedHero.content.overlay.rotateDeg).toBe(-90);
  });

  it("교통 수단 '전화'가 담긴 문서가 열린다 (v17에서 넓어진 값)", () => {
    const doc = createSampleDocument();
    const transport = doc.sections.find((s) => s.type === "transportation");
    if (transport?.type !== "transportation") throw new Error("transportation이 없습니다");
    transport.content.items = [
      ...transport.content.items,
      { icon: "phone", emoji: "", title: "예식장 전화", body: "02-000-0000" },
    ];
    const opened = migrateDocument(doc);
    const openedTransport = opened.sections.find((s) => s.type === "transportation");
    if (openedTransport?.type !== "transportation") throw new Error("transportation이 없습니다");
    expect(openedTransport.content.items.at(-1)?.icon).toBe("phone");
  });

  // 실제로 열리지 않았던 모양: 필드 이름이 한 버전 안에서 바뀌어, 저장 버전은 최신인데
  // overlay는 옛 모양(typewriter 있고 animation 없음)으로 굳었다.
  it("v14 전이 상태(typewriter만 있고 animation 없음)가 열린다", () => {
    const opened = migrateDocument(transitionalV14({ typewriter: false }));
    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.content.overlay.animation).toBe("none"); // 없으면 '없음'으로
    expect("typewriter" in hero.content.overlay).toBe(false); // 옛 이름은 사라진다
  });

  it("옛 typewriter가 켜져 있었다면 그 의도를 살려 '한 글자씩'으로 연다", () => {
    const opened = migrateDocument(transitionalV14({ typewriter: true }));
    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.content.overlay.animation).toBe("typing");
  });

  it("animation에 스키마 밖 값이 들어와 있어도 '없음'으로 되돌려 연다", () => {
    const opened = migrateDocument(transitionalV14({ animation: "sparkle" }));
    const hero = opened.sections[0];
    if (hero.type !== "hero") throw new Error("hero가 없습니다");
    expect(hero.content.overlay.animation).toBe("none");
  });

  // 파생 pt(눈썹 = 제목 × 0.55, 항목 제목 = 본문 × 0.9)는 원본이 작으면 최솟값 아래로
  // 떨어진다. 자르지 않으면 "글자를 작게 해 둔 사람만" 문서가 열리지 않는다.
  it("어떤 글자 크기로 저장돼 있어도 열린다", () => {
    for (let pt = PT_MIN; pt <= PT_MAX; pt += 0.5) {
      const opened = migrateDocument(v11Document({ headingPt: pt, bodyPt: pt }));
      for (const role of ["label", "heading", "itemTitle", "body"] as const) {
        const sizePt = opened.typography.roles[role].sizePt;
        expect(sizePt, `전역 ${role} @ ${pt}pt`).toBeGreaterThanOrEqual(PT_MIN);
        expect(sizePt, `전역 ${role} @ ${pt}pt`).toBeLessThanOrEqual(PT_MAX);
        // 섹션 override도 같은 규칙을 지켜야 한다 (실제 사고는 sections[0]에서 났다)
        for (const section of opened.sections) {
          const overridden = section.style.text[role].sizePt;
          if (overridden === undefined) continue;
          expect(overridden, `${section.type} ${role} @ ${pt}pt`).toBeGreaterThanOrEqual(PT_MIN);
          expect(overridden, `${section.type} ${role} @ ${pt}pt`).toBeLessThanOrEqual(PT_MAX);
        }
      }
    }
  });

  // 마이그레이션을 두 번 태워도 같은 문서가 나와야 한다 — 저장·재로드가 반복되는 자리다
  it("이미 열린 문서를 다시 태워도 그대로다", () => {
    for (const stored of [
      v11Document(),
      v12Document(),
      v13Document(),
      transitionalV14({ typewriter: false }),
      v15Document(),
      v16Document(),
      v17Document(),
    ]) {
      const opened = migrateDocument(stored);
      expect(migrateDocument(opened)).toEqual(opened);
      expect(documentSchema.safeParse(opened).success).toBe(true);
    }
  });
});
