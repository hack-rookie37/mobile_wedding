import clsx from "clsx";

// 개행을 보존하는 본문 (DESIGN_SYSTEM.md §4 — body 15px / 1.8)
export function BodyText({ text, align = "center" }: { text: string; align?: "center" | "left" }) {
  return (
    <p
      className={clsx(
        "text-[15px] leading-[1.8] tracking-[-0.005em] whitespace-pre-line text-(--canvas-ink)",
        align === "center" ? "text-center" : "text-left",
      )}
    >
      {text}
    </p>
  );
}
