"use client";

import type { ReactNode } from "react";
import type {
  ContactEntry,
  ContactSide,
  ContactsSection,
  GiftAccount,
  GiftAccountSection,
  TransportationSection,
  TransportIcon,
  TransportItem,
} from "@/invitation/schema/document";
import { SelectField, TextAreaField, TextField } from "@/ui/fields";
import { useEditor } from "../../EditorStoreContext";

// 반복 그룹 편집기 (교통 안내·연락처·마음 전하실 곳)
// 항목 안 필드 수정 → updateListItem (같은 항목·필드의 타이핑만 undo 병합)
// 항목 추가·삭제 → updateSectionContent 배열 patch (병합 없음 — 각각 undo 1스텝)

const TRANSPORT_ICON_OPTIONS: { value: TransportIcon; label: string }[] = [
  { value: "subway", label: "지하철" },
  { value: "bus", label: "버스" },
  { value: "car", label: "자가용" },
  { value: "parking", label: "주차" },
  { value: "shuttle", label: "셔틀" },
  { value: "etc", label: "기타" },
];

const SIDE_LABELS: Record<ContactSide, string> = { groom: "신랑측", bride: "신부측" };

function ItemCard({
  onRemove,
  removeLabel,
  children,
}: {
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <div data-list-item className="space-y-3 rounded-md border border-tool-border p-3">
      {children}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="text-[12px] text-tool-danger underline underline-offset-2"
        >
          {removeLabel}
        </button>
      </div>
    </div>
  );
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-full rounded-md border border-dashed border-tool-border-strong text-[13px] text-tool-ink-soft transition-colors hover:border-tool-accent hover:text-tool-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

// ── 교통 안내

const MAX_TRANSPORT_ITEMS = 10;

export function TransportationForm({ section }: { section: TransportationSection }) {
  const dispatch = useEditor((s) => s.dispatch);
  const { content } = section;

  const patchItem = (index: number, patch: Partial<TransportItem>) =>
    dispatch({ type: "updateListItem", sectionId: section.id, field: "items", index, patch });
  const setItems = (items: TransportItem[]) =>
    dispatch({ type: "updateSectionContent", sectionId: section.id, patch: { items } });

  return (
    <div className="space-y-4">
      <TextField
        label="제목"
        value={content.title}
        onChange={(title) =>
          dispatch({ type: "updateSectionContent", sectionId: section.id, patch: { title } })
        }
      />
      {content.items.map((item, index) => (
        <ItemCard
          key={index}
          removeLabel="항목 삭제"
          onRemove={() => setItems(content.items.filter((_, i) => i !== index))}
        >
          <SelectField
            label="수단"
            value={item.icon}
            options={TRANSPORT_ICON_OPTIONS}
            onChange={(icon) => patchItem(index, { icon })}
          />
          <TextField
            label="제목"
            value={item.title}
            onChange={(title) => patchItem(index, { title })}
            placeholder="지하철"
          />
          <TextAreaField
            label="안내"
            value={item.body}
            onChange={(body) => patchItem(index, { body })}
            rows={3}
          />
        </ItemCard>
      ))}
      <AddButton
        label="+ 교통 안내 추가"
        disabled={content.items.length >= MAX_TRANSPORT_ITEMS}
        onClick={() => setItems([...content.items, { icon: "subway", title: "", body: "" }])}
      />
    </div>
  );
}

// ── 연락처 (신랑측/신부측 grouping — entry의 side로 파생)

const MAX_CONTACT_ENTRIES = 12;

export function ContactsForm({ section }: { section: ContactsSection }) {
  const dispatch = useEditor((s) => s.dispatch);
  const { content } = section;

  const patchEntry = (index: number, patch: Partial<ContactEntry>) =>
    dispatch({ type: "updateListItem", sectionId: section.id, field: "entries", index, patch });
  const setEntries = (entries: ContactEntry[]) =>
    dispatch({ type: "updateSectionContent", sectionId: section.id, patch: { entries } });

  const sideGroup = (side: ContactSide) => (
    <div className="space-y-3">
      <p className="text-[12px] font-semibold text-tool-ink">{SIDE_LABELS[side]}</p>
      {content.entries.map((entry, index) =>
        entry.side === side ? (
          <ItemCard
            key={index}
            removeLabel="연락처 삭제"
            onRemove={() => setEntries(content.entries.filter((_, i) => i !== index))}
          >
            <TextField
              label="구분"
              value={entry.label}
              onChange={(label) => patchEntry(index, { label })}
              placeholder="신랑 · 아버지 · 어머니"
            />
            <TextField
              label="이름"
              value={entry.name}
              onChange={(name) => patchEntry(index, { name })}
            />
            <TextField
              label="전화번호"
              type="tel"
              value={entry.phone}
              onChange={(phone) => patchEntry(index, { phone })}
              placeholder="010-0000-0000"
            />
          </ItemCard>
        ) : null,
      )}
      <AddButton
        label={`+ ${SIDE_LABELS[side]} 연락처 추가`}
        disabled={content.entries.length >= MAX_CONTACT_ENTRIES}
        onClick={() => setEntries([...content.entries, { side, label: "", name: "", phone: "" }])}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <TextField
        label="제목"
        value={content.title}
        onChange={(title) =>
          dispatch({ type: "updateSectionContent", sectionId: section.id, patch: { title } })
        }
      />
      {sideGroup("groom")}
      {sideGroup("bride")}
    </div>
  );
}

// ── 마음 전하실 곳

const MAX_ACCOUNTS = 8;

export function GiftAccountForm({ section }: { section: GiftAccountSection }) {
  const dispatch = useEditor((s) => s.dispatch);
  const { content } = section;

  const patchContent = (patch: Record<string, unknown>) =>
    dispatch({ type: "updateSectionContent", sectionId: section.id, patch });
  const patchAccount = (index: number, patch: Partial<GiftAccount>) =>
    dispatch({ type: "updateListItem", sectionId: section.id, field: "accounts", index, patch });
  const setAccounts = (accounts: GiftAccount[]) => patchContent({ accounts });

  const sideGroup = (side: ContactSide) => (
    <div className="space-y-3">
      <TextField
        label={`${SIDE_LABELS[side]} 그룹 이름`}
        value={side === "groom" ? content.groomLabel : content.brideLabel}
        onChange={(value) =>
          patchContent(side === "groom" ? { groomLabel: value } : { brideLabel: value })
        }
      />
      {content.accounts.map((account, index) =>
        account.side === side ? (
          <ItemCard
            key={index}
            removeLabel="계좌 삭제"
            onRemove={() => setAccounts(content.accounts.filter((_, i) => i !== index))}
          >
            <TextField
              label="은행"
              value={account.bank}
              onChange={(bank) => patchAccount(index, { bank })}
              placeholder="국민은행"
            />
            <TextField
              label="예금주"
              value={account.holder}
              onChange={(holder) => patchAccount(index, { holder })}
            />
            <TextField
              label="계좌번호"
              value={account.number}
              onChange={(number) => patchAccount(index, { number })}
              placeholder="000000-00-000000"
            />
          </ItemCard>
        ) : null,
      )}
      <AddButton
        label={`+ ${SIDE_LABELS[side]} 계좌 추가`}
        disabled={content.accounts.length >= MAX_ACCOUNTS}
        onClick={() =>
          setAccounts([...content.accounts, { side, bank: "", holder: "", number: "" }])
        }
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <TextField label="제목" value={content.title} onChange={(title) => patchContent({ title })} />
      {sideGroup("groom")}
      {sideGroup("bride")}
    </div>
  );
}
