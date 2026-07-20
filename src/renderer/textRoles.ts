import type { CSSProperties } from "react";
import type { SectionTextRoles, SectionTextStyle, TextRole } from "@/invitation/schema/document";
import { fontCssOf, roleScaleFromPt, TEXT_ROLES } from "@/invitation/schema/themes";

// 글자 역할 (ADR-035) — 청첩장의 글자를 눈썹·제목·항목 제목·본문 네 무리로 나눈다.
//
// 전달 방식은 CSS 커스텀 속성 하나뿐이다. 전역(캔버스 루트)과 섹션이 같은 이름을 쓰고,
// 섹션이 더 안쪽이라 자연스럽게 덮는다 — 두 층을 JS에서 합칠 필요가 없다.
//
// 핵심 규칙: **정해지지 않은 값은 변수를 아예 내보내지 않는다.** 그래야 요소가 원래
// 갖고 있던 값(fallback)이 살아남는다. 굵기를 '보통'으로 정하는 것과 정하지 않는 것은
// 다르다 — 전자는 400으로 못박고, 후자는 항목 제목의 semibold를 그대로 둔다.

const prop = (role: TextRole, name: string) => `--r-${role}-${name}`;

// 크기만은 역할별 '배율' 변수를 쓴다. 한 역할 안에서도 요소마다 기준 px이 다르므로
// (제목 h2 20px vs 메인 이름 26px) 절대값으로 덮으면 역할 안의 위계가 무너진다.
// 본문·제목은 v12 전부터 쓰던 이름을 그대로 둔다 — 90곳 가까이가 이미 참조한다.
const SCALE_VAR: Record<TextRole, string> = {
  label: "--canvas-fs-label",
  heading: "--canvas-fs-heading",
  itemTitle: "--canvas-fs-item",
  body: "--canvas-fs",
};

export function roleScaleVar(role: TextRole): string {
  return SCALE_VAR[role];
}

// 역할 하나가 내보내는 변수들
function varsOf(role: TextRole, style: SectionTextStyle): Record<string, string> {
  const vars: Record<string, string> = {};
  if (style.sizePt !== undefined) {
    vars[SCALE_VAR[role]] = String(roleScaleFromPt(role, style.sizePt));
  }
  if (style.font !== undefined) {
    const css = fontCssOf(style.font); // "theme"이면 null — 테마 기본을 쓰라는 뜻이다
    if (css !== null) vars[prop(role, "font")] = css;
  }
  if (style.bold !== undefined) vars[prop(role, "weight")] = style.bold ? "700" : "400";
  if (style.italic !== undefined) vars[prop(role, "italic")] = style.italic ? "italic" : "normal";
  if (style.color !== undefined) vars[prop(role, "color")] = style.color;
  if (style.letterSpacing !== undefined) {
    vars[prop(role, "tracking")] = `${style.letterSpacing}em`;
  }
  if (style.lineHeight !== undefined) vars[prop(role, "leading")] = String(style.lineHeight);
  return vars;
}

// 네 역할이 내보내는 변수 전부 + 본문 역할이 캔버스 잉크에 미치는 파급.
//
// 본문 색은 '이 무리의 색'이 아니라 '이 자리의 기본 글자색'이다 (v12 전의 style.color가
// 그 자리였다). 그래서 흐린 글자색·구분선까지 함께 옮긴다 — 하나만 바꾸면 색이 따로 논다.
export function textRoleVars(roles: SectionTextRoles): CSSProperties {
  const vars: Record<string, string> = {};
  for (const role of TEXT_ROLES) Object.assign(vars, varsOf(role, roles[role]));

  const ink = roles.body.color;
  if (ink !== undefined) {
    vars["--canvas-ink"] = ink;
    vars["--canvas-ink-soft"] = `color-mix(in srgb, ${ink} 68%, transparent)`;
    vars["--canvas-line"] = `color-mix(in srgb, ${ink} 22%, transparent)`;
  }
  return vars as CSSProperties;
}

// 본문 역할을 '상속되는 속성'으로 깐다. 스스로 값을 적지 않은 글자(연락처 숫자·설명 문구
// 등 수십 곳)는 이 한 벌만으로 따라온다 — 요소마다 변수를 심지 않아도 된다.
//
// 이 선언은 변수를 정의하는 바로 그 요소에 함께 붙어야 한다. font-family는 상속될 때
// 계산된 값으로 굳으므로, 안쪽에서 --r-body-font만 다시 정의해 봐야 되살아나지 않는다.
export const INHERITED_BODY_STYLE: CSSProperties = {
  fontFamily: "var(--r-body-font, var(--canvas-font-body))",
  color: "var(--r-body-color, var(--canvas-ink))",
  fontWeight: "var(--r-body-weight, 400)",
  fontStyle: "var(--r-body-italic, normal)",
  letterSpacing: "var(--r-body-tracking, normal)",
};

// 역할에 속한 요소가 쓰는 스타일. base는 그 요소가 v12 전에 쓰던 값 그대로이며,
// 역할 변수가 정해지지 않았을 때 살아남는 fallback이다.
export interface RoleBase {
  size: string; // 이미 역할 배율이 곱해진 식 — 예: calc(11px * var(--canvas-fs-label))
  font?: string;
  weight?: string;
  italic?: string;
  color?: string;
  tracking?: string;
  leading?: string;
}

export function roleStyle(role: TextRole, base: RoleBase): CSSProperties {
  return {
    fontSize: base.size,
    fontFamily: `var(${prop(role, "font")}, ${base.font ?? "var(--canvas-font-body)"})`,
    fontWeight: `var(${prop(role, "weight")}, ${base.weight ?? "400"})`,
    fontStyle: `var(${prop(role, "italic")}, ${base.italic ?? "normal"})`,
    color: `var(${prop(role, "color")}, ${base.color ?? "var(--canvas-ink)"})`,
    letterSpacing: `var(${prop(role, "tracking")}, ${base.tracking ?? "normal"})`,
    lineHeight: `var(${prop(role, "leading")}, ${base.leading ?? "normal"})`,
  } as CSSProperties;
}
