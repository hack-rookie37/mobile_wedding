"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AiAssistantPort } from "@/invitation/ai/port";
import type { AssetStore } from "@/invitation/assets/assetTypes";
import type { ProjectPersistence } from "@/invitation/persistence/port";
import { useDeferredLoad } from "@/ui/useDeferredLoad";
import { AssetLibraryProvider } from "../assets/AssetLibraryContext";
import { createAutosaveController, type AutosaveController } from "../autosave";
import { EditorStoreProvider, useEditorStoreHandle } from "../EditorStoreContext";
import { createEditorStore, type EditorStore } from "../store";
import { AiAssistantDialog } from "./ai/AiAssistantDialog";
import { EditorFontFaces } from "./forms/FontFields";
import { InspectorPanel } from "./InspectorPanel";
import { PreviewCanvas } from "./PreviewCanvas";
import { PublishPanel } from "./PublishPanel";
import { RevisionPanel } from "./RevisionPanel";
import { SectionListPanel } from "./SectionListPanel";
import { TopBar } from "./TopBar";

interface LoadedEditor {
  store: EditorStore;
  title: string;
  initialRev: number;
}

function CenteredNotice({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-tool-bg text-tool-ink">
      <p className="text-[15px] font-medium">{title}</p>
      {detail && <p className="max-w-md text-center text-[13px] text-tool-ink-soft">{detail}</p>}
      <Link href="/edit" className="text-[13px] text-tool-accent underline underline-offset-2">
        내 청첩장으로 돌아가기
      </Link>
    </div>
  );
}

// 충돌(다른 탭이 먼저 저장) 안내 — 이 탭의 저장은 차단된 상태다
function ConflictBanner({ onReload }: { onReload: () => void }) {
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center gap-3 border-b border-tool-danger/30 bg-[#fdf1f0] px-4 py-2"
    >
      <p className="text-[12px] leading-[1.5] text-tool-ink">
        <span className="font-semibold text-tool-danger">
          다른 탭에서 이 청첩장이 수정되었습니다.
        </span>{" "}
        이 탭의 최근 변경은 저장되지 않습니다. 최신 상태를 불러와 계속 편집하세요.
      </p>
      <button
        type="button"
        onClick={onReload}
        className="ml-auto h-7 shrink-0 rounded-md bg-tool-danger px-2.5 text-[12px] font-medium text-white hover:opacity-90"
      >
        최신 상태 불러오기
      </button>
    </div>
  );
}

function EditorChrome({
  projectId,
  title,
  initialRev,
  persistence,
  ai,
}: {
  projectId: string;
  title: string;
  initialRev: number;
  persistence: ProjectPersistence;
  ai: AiAssistantPort;
}) {
  const store = useEditorStoreHandle();
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // 패널을 여는 시점의 draft rev — '발행 이후 변경됨' 판단에 사용
  const [publishOpenRev, setPublishOpenRev] = useState<number | null>(null);

  // 자동 저장 컨트롤러 — saveStatus의 유일한 소유자 (디바운스·실패 재시도·충돌 감지).
  // 생성·폐기를 effect 안에서 짝지어 StrictMode의 이중 마운트에도 안전하다.
  const controllerRef = useRef<AutosaveController | null>(null);
  useEffect(() => {
    const controller = createAutosaveController({
      save: (doc, expectedRev) => persistence.save(projectId, doc, expectedRev),
      initialRev,
      onStateChange: (state) => store.getState().setSaveStatus(state),
    });
    controllerRef.current = controller;
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.doc === prev.doc) return;
      // replaceDocument(복원·최신 불러오기)는 saveStatus를 'saved'로 두므로 재저장하지 않는다
      if (state.saveStatus === "saved") return;
      controller.noteChange(state.doc);
    });
    return () => {
      unsubscribe();
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [store, persistence, projectId, initialRev]);

  // 저장되지 않은 변경이 있으면 떠나기 전에 경고한다 (네트워크 저장은 unload 중 완료를 보장할 수 없다)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!controllerRef.current?.hasUnsavedChanges()) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // 단축키: ⌘Z / ⇧⌘Z / Ctrl+Y (Windows redo 관례)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) store.getState().redo();
        else store.getState().undo();
      } else if (key === "y") {
        e.preventDefault();
        store.getState().redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  const reloadLatest = useCallback(async () => {
    const loaded = await persistence.load(projectId);
    if (loaded === null) return;
    store.getState().replaceDocument(loaded.doc);
    controllerRef.current?.adoptServerRev(loaded.rev);
  }, [persistence, projectId, store]);

  return (
    <div className="flex h-dvh min-w-[1280px] flex-col bg-tool-bg text-tool-ink">
      <TopBar
        title={title}
        projectId={projectId}
        onRetrySave={() => controllerRef.current?.retry()}
        onOpenRevisions={() => setRevisionsOpen(true)}
        onOpenPublish={() => setPublishOpenRev(controllerRef.current?.currentRev() ?? initialRev)}
        onOpenAi={() => setAiOpen(true)}
      />
      <ConflictGate onReload={() => void reloadLatest()} />
      <div className="flex min-h-0 flex-1">
        <SectionListPanel />
        <PreviewCanvas />
        <InspectorPanel />
      </div>
      {publishOpenRev !== null && (
        <PublishPanel
          persistence={persistence}
          projectId={projectId}
          currentRev={publishOpenRev}
          onClose={() => setPublishOpenRev(null)}
        />
      )}
      {aiOpen && (
        <AiAssistantDialog projectId={projectId} ai={ai} onClose={() => setAiOpen(false)} />
      )}
      {revisionsOpen && (
        <RevisionPanel
          persistence={persistence}
          projectId={projectId}
          onClose={() => setRevisionsOpen(false)}
          onRestored={({ doc, rev }) => {
            store.getState().replaceDocument(doc);
            controllerRef.current?.adoptServerRev(rev);
          }}
        />
      )}
    </div>
  );
}

// saveStatus 구독을 배너에 한정해 상단 전체 리렌더를 피한다
function ConflictGate({ onReload }: { onReload: () => void }) {
  const store = useEditorStoreHandle();
  const [conflicted, setConflicted] = useState(false);
  useEffect(
    () =>
      store.subscribe((state) => {
        setConflicted(state.saveStatus === "conflict");
      }),
    [store],
  );
  if (!conflicted) return null;
  return <ConflictBanner onReload={onReload} />;
}

export function EditorShell({
  projectId,
  persistence,
  assetStore,
  ai,
}: {
  projectId: string;
  persistence: ProjectPersistence;
  assetStore: AssetStore;
  ai: AiAssistantPort;
}) {
  const load = useCallback(async (): Promise<LoadedEditor | null> => {
    const loaded = await persistence.load(projectId);
    if (loaded === null) return null;
    return {
      store: createEditorStore({ doc: loaded.doc }),
      title: loaded.title,
      initialRev: loaded.rev,
    };
  }, [persistence, projectId]);
  const state = useDeferredLoad(load);

  switch (state.status) {
    case "loading":
      return <div className="h-dvh bg-tool-bg" aria-busy />;
    case "error":
      return <CenteredNotice title="청첩장을 불러오지 못했습니다" detail={state.message} />;
    case "ready":
      if (state.value === null) {
        return <CenteredNotice title="청첩장을 찾을 수 없습니다" />;
      }
      return (
        <EditorStoreProvider value={state.value.store}>
          <AssetLibraryProvider store={assetStore}>
            <EditorFontFaces />
            <EditorChrome
              projectId={projectId}
              title={state.value.title}
              initialRev={state.value.initialRev}
              persistence={persistence}
              ai={ai}
            />
          </AssetLibraryProvider>
        </EditorStoreProvider>
      );
  }
}
