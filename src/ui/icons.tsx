import type { ReactNode } from "react";

// 편집기 도구용 최소 아이콘 세트 — 장식 아이콘 남용 금지 (디자인 방향)

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function UndoIcon() {
  return (
    <Icon>
      <path d="M6.5 3.5 3 7l3.5 3.5" />
      <path d="M3 7h6a4 4 0 0 1 0 8H7.5" />
    </Icon>
  );
}

export function RedoIcon() {
  return (
    <Icon>
      <path d="M9.5 3.5 13 7l-3.5 3.5" />
      <path d="M13 7H7a4 4 0 0 0 0 8h1.5" />
    </Icon>
  );
}

export function DragHandleIcon() {
  return (
    <Icon className="size-3.5">
      {[5.5, 10.5].map((x) =>
        [4, 8, 12].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="currentColor" stroke="none" />
        )),
      )}
    </Icon>
  );
}

export function EyeIcon() {
  return (
    <Icon className="size-3.5">
      <path d="M1.5 8s2.4-4.3 6.5-4.3S14.5 8 14.5 8 12.1 12.3 8 12.3 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </Icon>
  );
}

export function EyeOffIcon() {
  return (
    <Icon className="size-3.5">
      <path d="M1.5 8s2.4-4.3 6.5-4.3S14.5 8 14.5 8 12.1 12.3 8 12.3 1.5 8 1.5 8Z" />
      <path d="M3 2.5l10 11" />
    </Icon>
  );
}

export function DotsIcon() {
  return (
    <Icon className="size-3.5">
      {[3.5, 8, 12.5].map((x) => (
        <circle key={x} cx={x} cy="8" r="1.1" fill="currentColor" stroke="none" />
      ))}
    </Icon>
  );
}
