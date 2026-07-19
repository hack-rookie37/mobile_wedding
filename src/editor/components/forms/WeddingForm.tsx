"use client";

import type { Parent, Person, Wedding } from "@/invitation/schema/document";
import { FieldLabel, FormSection, TextField } from "@/ui/fields";
import { useEditor } from "../../EditorStoreContext";

function ParentField({
  group,
  label,
  parent,
  onChange,
}: {
  group: string;
  label: string;
  parent: Parent | undefined;
  onChange: (parent: Parent | undefined) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="text"
          // 신랑·신부 양쪽에 같은 '아버지/어머니' 필드가 있어 group으로 구분한다
          aria-label={`${group} ${label} 이름`}
          value={parent?.name ?? ""}
          onChange={(e) => {
            const name = e.target.value;
            onChange(name === "" ? undefined : { name, deceased: parent?.deceased ?? false });
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-tool-border bg-white px-2.5 text-[13px] text-tool-ink focus:border-tool-accent focus:ring-[3px] focus:ring-tool-accent/15 focus:outline-none"
        />
        <label className="flex shrink-0 items-center gap-1 text-[12px] text-tool-ink-soft select-none">
          <input
            type="checkbox"
            checked={parent?.deceased ?? false}
            disabled={!parent}
            onChange={(e) => parent && onChange({ ...parent, deceased: e.target.checked })}
            className="size-3.5 accent-(--color-tool-accent)"
          />
          故
        </label>
      </div>
    </div>
  );
}

function PersonFields({
  title,
  person,
  onChange,
}: {
  title: string;
  person: Person;
  onChange: (person: Person) => void;
}) {
  return (
    <FormSection title={title}>
      <TextField
        label="이름"
        value={person.name}
        onChange={(name) => onChange({ ...person, name })}
      />
      <TextField
        label="관계 (장남, 차녀 등)"
        value={person.familyRole ?? ""}
        onChange={(v) => onChange({ ...person, familyRole: v === "" ? undefined : v })}
      />
      <ParentField
        group={title}
        label="아버지"
        parent={person.father}
        onChange={(father) => onChange({ ...person, father })}
      />
      <ParentField
        group={title}
        label="어머니"
        parent={person.mother}
        onChange={(mother) => onChange({ ...person, mother })}
      />
    </FormSection>
  );
}

export function WeddingForm() {
  const wedding = useEditor((s) => s.doc.wedding);
  const dispatch = useEditor((s) => s.dispatch);
  const patch = (p: Partial<Wedding>) => dispatch({ type: "updateWedding", patch: p });

  return (
    <div className="space-y-5">
      <FormSection title="예식">
        <TextField
          label="예식 일시"
          type="datetime-local"
          value={wedding.datetime.slice(0, 16)}
          onChange={(v) => {
            if (v === "") return; // 일시는 비울 수 없음 — 발행 필수값
            patch({ datetime: `${v}:00+09:00` });
          }}
        />
      </FormSection>

      <FormSection title="예식장">
        <TextField
          label="예식장 이름"
          value={wedding.venue.name}
          onChange={(name) => patch({ venue: { ...wedding.venue, name } })}
        />
        <TextField
          label="홀 · 층"
          value={wedding.venue.hall ?? ""}
          onChange={(v) => patch({ venue: { ...wedding.venue, hall: v === "" ? undefined : v } })}
        />
        <TextField
          label="주소"
          value={wedding.venue.address}
          onChange={(address) => patch({ venue: { ...wedding.venue, address } })}
        />
        <TextField
          label="전화"
          type="tel"
          value={wedding.venue.phone ?? ""}
          onChange={(v) => patch({ venue: { ...wedding.venue, phone: v === "" ? undefined : v } })}
        />
      </FormSection>

      <PersonFields title="신랑측" person={wedding.groom} onChange={(groom) => patch({ groom })} />
      <PersonFields title="신부측" person={wedding.bride} onChange={(bride) => patch({ bride })} />
    </div>
  );
}
