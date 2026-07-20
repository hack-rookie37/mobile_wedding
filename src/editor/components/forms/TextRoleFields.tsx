"use client";

import { useState } from "react";
import {
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  type FontId,
  type GlobalTextStyle,
  type SectionTextStyle,
  type TextRole,
} from "@/invitation/schema/document";
import { PT_MAX, PT_MIN, TEXT_ROLES } from "@/invitation/schema/themes";
import { ColorOverrideField, NumberField, Segmented, SegmentedField } from "@/ui/fields";
import { useFontOptions } from "./FontFields";
import { FontPicker } from "./FontPicker";

// 글자 역할 편집기 (ADR-035) — 전역(테마 패널)과 섹션('스타일' 탭)이 같은 화면을 쓴다.
// 다른 점은 하나뿐이다: 전역은 글꼴·크기를 반드시 갖고, 섹션은 비우면 전역을 따른다.

export const ROLE_TAB_LABELS: Record<TextRole, string> = {
  label: "눈썹",
  heading: "제목",
  itemTitle: "항목 제목",
  body: "본문",
};

const ROLE_HINTS: Record<TextRole, string> = {
  label: "제목 위의 작은 글자입니다. 메인에서는 태그라인이 이 자리입니다.",
  heading: "섹션 제목입니다. 메인에서는 신랑·신부 이름이 이 자리입니다.",
  itemTitle: "반복되는 항목의 제목입니다 — 교통 안내의 ‘지하철’, 연락처의 이름 같은 줄입니다.",
  body: "나머지 글자 전부입니다. 항목마다 굵기가 다른 위계는 그대로 유지됩니다.",
};

// 굵기·기울임은 세 갈래다. '기본'은 값을 지우는 것이고, 그러면 각 요소가 원래 갖고 있던
// 굵기(항목 제목의 semibold 등)가 그대로 남는다 — '보통'으로 못박는 것과 다르다.
const TRISTATE = { inherit: undefined, off: false, on: true } as const;
type TriKey = keyof typeof TRISTATE;

const triKeyOf = (value: boolean | undefined): TriKey =>
  value === undefined ? "inherit" : value ? "on" : "off";

function TriToggle({
  label,
  offLabel,
  onLabel,
  value,
  onChange,
}: {
  label: string;
  offLabel: string;
  onLabel: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
}) {
  return (
    <SegmentedField
      label={label}
      value={triKeyOf(value)}
      options={[
        { value: "inherit", label: "기본" },
        { value: "off", label: offLabel },
        { value: "on", label: onLabel },
      ]}
      onChange={(key) => onChange(TRISTATE[key as TriKey])}
    />
  );
}

// 비울 수 있는 수치 한 줄 — 값이 없으면 물려받는 값을 보여 주고, 있으면 되돌리기가 붙는다
function OptionalNumber({
  label,
  value,
  inherited,
  min,
  max,
  step,
  unit,
  resettable,
  onChange,
}: {
  label: string;
  value: number | undefined;
  inherited: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  resettable: boolean;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div>
      <NumberField
        label={label}
        value={value ?? inherited}
        min={min}
        max={max}
        step={step}
        unit={unit}
        onChange={onChange}
      />
      {resettable && value !== undefined && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="mt-1.5 text-[12px] text-tool-ink-soft underline underline-offset-2"
        >
          전역 설정 따르기
        </button>
      )}
    </div>
  );
}

export function TextRoleEditor({
  roles,
  inherited,
  scope,
  onPatch,
}: {
  // 섹션 편집기는 비어 있는 값을 갖고, 전역 편집기는 전부 채워져 있다
  roles: Record<TextRole, SectionTextStyle>;
  // 비웠을 때 실제로 그려지는 값 — 전역 편집기에서는 자기 자신이다
  inherited: Record<TextRole, GlobalTextStyle>;
  scope: "global" | "section";
  onPatch: (role: TextRole, patch: Partial<SectionTextStyle>) => void;
}) {
  const [role, setRole] = useState<TextRole>("heading");
  const section = scope === "section";
  const fontOptions = useFontOptions(section ? "전역 설정 따름" : "테마 기본", "inherit");

  const style = roles[role];
  const base = inherited[role];
  const patch = (p: Partial<SectionTextStyle>) => onPatch(role, p);

  // 섹션 편집기에서는 '전역 따름'이 undefined다. 전역 편집기에서는 "theme"이 테마 기본이다.
  const fontValue = style.font ?? (section ? "inherit" : "theme");

  return (
    <div className="space-y-4">
      <Segmented
        value={role}
        options={TEXT_ROLES.map((value) => ({ value, label: ROLE_TAB_LABELS[value] }))}
        onChange={setRole}
        grow
      />
      <p className="text-[11px] leading-[1.5] text-tool-ink-faint">{ROLE_HINTS[role]}</p>

      <FontPicker
        label="글꼴"
        value={fontValue}
        options={fontOptions}
        onChange={(value) => patch({ font: value === "inherit" ? undefined : (value as FontId) })}
      />
      <OptionalNumber
        label="크기"
        value={style.sizePt}
        inherited={base.sizePt}
        min={PT_MIN}
        max={PT_MAX}
        step={0.5}
        unit="pt"
        resettable={section}
        onChange={(sizePt) => patch({ sizePt })}
      />
      <TriToggle
        label="굵기"
        offLabel="보통"
        onLabel="굵게"
        value={style.bold}
        onChange={(bold) => patch({ bold })}
      />
      <TriToggle
        label="기울임"
        offLabel="곧게"
        onLabel="기울임"
        value={style.italic}
        onChange={(italic) => patch({ italic })}
      />
      <ColorOverrideField
        label="색상"
        value={style.color}
        fallback={base.color ?? "#222222"}
        resetLabel={section ? "전역 설정 따르기" : "테마 기본값"}
        onChange={(color) => patch({ color })}
      />
      {/* 자간·행간은 글자 크기에 대한 비율이다 — 크기를 키우면 함께 벌어진다 */}
      <OptionalNumber
        label="자간"
        value={style.letterSpacing === undefined ? undefined : style.letterSpacing * 100}
        inherited={(base.letterSpacing ?? 0) * 100}
        min={LETTER_SPACING_MIN * 100}
        max={LETTER_SPACING_MAX * 100}
        step={1}
        unit="%"
        resettable
        onChange={(percent) =>
          patch({ letterSpacing: percent === undefined ? undefined : percent / 100 })
        }
      />
      <OptionalNumber
        label="행간"
        value={style.lineHeight === undefined ? undefined : style.lineHeight * 100}
        inherited={(base.lineHeight ?? 1.6) * 100}
        min={LINE_HEIGHT_MIN * 100}
        max={LINE_HEIGHT_MAX * 100}
        step={5}
        unit="%"
        resettable
        onChange={(percent) =>
          patch({ lineHeight: percent === undefined ? undefined : percent / 100 })
        }
      />
      <p className="rounded-md bg-tool-bg px-3 py-2.5 text-[12px] leading-[1.6] text-tool-ink-soft">
        {section
          ? "비운 값은 전역 설정을 따릅니다. 크기는 이 역할 안의 크기 위계를 유지한 채 함께 커지고 작아집니다."
          : "자간·행간을 비우면 테마가 정한 값을 씁니다. 섹션 하나만 다르게 하려면 그 섹션의 ‘스타일’ 탭에서 바꿀 수 있습니다."}
      </p>
    </div>
  );
}
