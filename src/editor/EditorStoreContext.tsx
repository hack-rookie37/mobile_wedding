"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { EditorState, EditorStore } from "./store";

const EditorStoreContext = createContext<EditorStore | null>(null);

export const EditorStoreProvider = EditorStoreContext.Provider;

export function useEditorStoreHandle(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) {
    throw new Error("EditorStoreProvider 바깥에서 편집기 store에 접근했습니다");
  }
  return store;
}

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorStoreHandle(), selector);
}
