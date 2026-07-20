"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ContactSide,
  GiftAccount,
  GiftAccountSection as GiftAccountSectionData,
} from "@/invitation/schema/document";
import { Collapsible } from "../primitives/Collapsible";
import { SectionHeader } from "../primitives/SectionHeader";
import { SectionShell } from "../primitives/SectionShell";
import { useRenderer } from "../RendererContext";
import { roleStyle } from "../textRoles";

const COPIED_FEEDBACK_MS = 1800;

function CopyButton({ account }: { account: GiftAccount }) {
  const { mode } = useRenderer();
  const interactive = mode === "published";
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    await navigator.clipboard.writeText(`${account.bank} ${account.number}`);
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={`${account.holder} ${account.bank} 계좌번호 복사`}
      aria-live="polite"
      onClick={() => void copy()}
      className="flex h-8 shrink-0 items-center rounded-full px-3.5 text-[length:calc(12px*var(--canvas-fs))] font-medium text-(--canvas-ink)"
      style={{ border: "1px solid var(--canvas-line)" }}
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function AccountRow({ account }: { account: GiftAccount }) {
  return (
    <li data-account-row className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[length:calc(13px*var(--canvas-fs))] leading-[1.6] text-(--canvas-ink)">
          <span className="text-(--canvas-ink-soft)">{account.bank}</span>{" "}
          <span className="tabular-nums">{account.number}</span>
        </p>
        <p className="text-[length:calc(12px*var(--canvas-fs))] leading-[1.6] text-(--canvas-ink-soft)">
          예금주 {account.holder}
        </p>
      </div>
      <CopyButton account={account} />
    </li>
  );
}

function SideGroup({
  label,
  side,
  accounts,
  accordion,
}: {
  label: string;
  side: ContactSide;
  accounts: GiftAccount[];
  accordion: boolean;
}) {
  const filtered = accounts.filter((account) => account.side === side);
  if (filtered.length === 0) return null;

  const list = (
    <ul
      className={accordion ? "divide-y px-4" : "divide-y"}
      style={{ borderColor: "var(--canvas-line)" }}
    >
      {filtered.map((account, accountIndex) => (
        <AccountRow key={accountIndex} account={account} />
      ))}
    </ul>
  );

  if (accordion) {
    return <Collapsible summary={label}>{list}</Collapsible>;
  }
  return (
    <div>
      <p
        className="mb-1"
        style={roleStyle("itemTitle", {
          size: "calc(11px * var(--canvas-fs-item))",
          weight: "500",
          tracking: "0.14em",
          color: "var(--canvas-accent)",
        })}
      >
        {label}
      </p>
      {list}
    </div>
  );
}

export function GiftAccountSection({
  section,
  index,
}: {
  section: GiftAccountSectionData;
  index: number;
}) {
  const { mode } = useRenderer();
  const { content, layout } = section;
  const accordion = layout.variant === "accordion";

  return (
    <SectionShell section={section} index={index}>
      <SectionHeader label={content.label} title={content.title} index={index} />
      {content.accounts.length === 0 && mode === "editor-edit" && (
        <p className="mt-6 text-center text-[length:calc(12px*var(--canvas-fs))] text-(--canvas-ink-soft)">
          오른쪽 패널에서 계좌를 추가하세요.
        </p>
      )}
      <div className="mt-8 space-y-4">
        <SideGroup
          label={content.groomLabel}
          side="groom"
          accounts={content.accounts}
          accordion={accordion}
        />
        <SideGroup
          label={content.brideLabel}
          side="bride"
          accounts={content.accounts}
          accordion={accordion}
        />
      </div>
    </SectionShell>
  );
}
