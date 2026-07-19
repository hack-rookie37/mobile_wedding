"use client";

import { useEffect, useState } from "react";

export type LoadState<T> =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: T };

// 외부 시스템(백엔드·localStorage)을 마운트 시점에 읽는 공용 패턴.
// 읽기를 커밋 이후 마이크로태스크로 미뤄 effect 내 동기 setState의
// cascading render를 피한다 (react-hooks/set-state-in-effect).
// `load`는 참조가 안정적이어야 하며(모듈 함수 또는 useCallback) 동기·비동기 모두 허용.
export function useDeferredLoad<T>(load: () => T | Promise<T>): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(load)
      .then(
        (value) => {
          if (active) setState({ status: "ready", value });
        },
        (error: unknown) => {
          if (active) {
            setState({
              status: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        },
      );
    return () => {
      active = false;
    };
  }, [load]);

  return state;
}
