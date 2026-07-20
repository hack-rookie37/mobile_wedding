"use client";

import clsx from "clsx";
import { useRenderer } from "../RendererContext";
import { roleStyle } from "../textRoles";

// 테마 variant에 따라 세 가지 얼굴을 갖는 섹션 헤더.
// editorial: 중앙 정렬 + 세리프 / mono: 좌측 번호 라벨 + hairline / film: 손글씨 라벨
// label을 비우면 눈썹 라벨 없이 제목만 나온다 (맺음말처럼 사진 위에 얹는 자리).
//
// 눈썹은 'label' 역할, 제목은 'heading' 역할이다 (ADR-035) — 크기는 역할 배율 변수로,
// 나머지는 roleStyle의 fallback 자리에 테마가 정한 값이 그대로 남는다.
export function SectionHeader({
  label: rawLabel,
  title,
  index,
}: {
  label?: string;
  title: string;
  index?: number;
}) {
  const { theme } = useRenderer();
  const variant = theme.variants.header;
  // 빈 문구는 "없음"과 같다 — 라벨을 지웠는데 빈 줄과 그 간격만 남으면 지운 것이 아니다
  const label = rawLabel === "" ? undefined : rawLabel;

  if (variant === "mono") {
    return (
      <header>
        {label !== undefined && (
          <div className="flex items-center gap-3">
            {index !== undefined && (
              <span
                className="tabular-nums"
                style={roleStyle("label", {
                  size: "calc(10px * var(--canvas-fs-label))",
                  weight: "600",
                  tracking: "0.08em",
                })}
              >
                {String(index).padStart(2, "0")}
              </span>
            )}
            <span
              className="uppercase"
              style={roleStyle("label", {
                size: "calc(10px * var(--canvas-fs-label))",
                weight: "500",
                tracking: "0.22em",
                color: "var(--canvas-ink-soft)",
              })}
            >
              {label}
            </span>
            <span aria-hidden className="h-px flex-1 bg-(--canvas-line)" />
          </div>
        )}
        <h2
          className={clsx(label !== undefined && "mt-4")}
          style={roleStyle("heading", {
            size: "calc(17px * var(--canvas-fs-heading))",
            font: "var(--canvas-font-heading)",
            weight: "700",
            tracking: "-0.01em",
            leading: "1.4",
          })}
        >
          {title}
        </h2>
      </header>
    );
  }

  if (variant === "film") {
    return (
      <header>
        {label !== undefined && (
          <p
            className="lowercase"
            style={roleStyle("label", {
              size: "calc(22px * var(--canvas-fs-label))",
              font: "var(--canvas-font-hand)",
              color: "var(--canvas-accent)",
              leading: "1",
            })}
          >
            {label.toLowerCase()}
          </p>
        )}
        <h2
          className={clsx(label !== undefined && "mt-2")}
          style={roleStyle("heading", {
            size: "calc(19px * var(--canvas-fs-heading))",
            font: "var(--canvas-font-heading)",
            weight: "600",
            leading: "1.45",
          })}
        >
          {title}
        </h2>
      </header>
    );
  }

  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {label !== undefined && (
        <p
          style={roleStyle("label", {
            size: "calc(11px * var(--canvas-fs-label))",
            weight: "500",
            tracking: "0.18em",
            color: "var(--canvas-accent)",
          })}
        >
          {label}
        </p>
      )}
      <h2
        style={roleStyle("heading", {
          size: "calc(20px * var(--canvas-fs-heading))",
          font: "var(--canvas-font-heading)",
          weight: "600",
          leading: "1.45",
        })}
      >
        {title}
      </h2>
    </header>
  );
}
