import clsx from "clsx";
import { roleStyle } from "../textRoles";

// 개행을 보존하는 본문 (DESIGN_SYSTEM.md §4 — body 15px / 1.8).
// 'body' 역할의 대표 요소다 — 자간·행간을 고치면 가장 먼저 여기가 움직인다 (ADR-035).
export function BodyText({ text, align = "center" }: { text: string; align?: "center" | "left" }) {
  return (
    <p
      className={clsx("whitespace-pre-line", align === "center" ? "text-center" : "text-left")}
      style={roleStyle("body", {
        size: "calc(15px * var(--canvas-fs))",
        leading: "1.8",
        tracking: "-0.005em",
      })}
    >
      {text}
    </p>
  );
}
