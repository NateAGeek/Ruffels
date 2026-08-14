import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  InitializationProposal,
  ProjectCommandResponse,
  ProjectConfig,
  ProjectIndex,
  ProjectInspection,
  ProjectSummary,
  RecentProject,
} from "../../pages/SourceExplorer/SourceExplorer.types";
import type { SourceGraphController, SourceGraphState } from "./useSourceGraph.types";

function invocationError(error: unknown) {
  return {
    type: "ioFailed" as const,
    message: error instanceof Error ? error.message : String(error),
  };
}

async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const response = await invoke<ProjectCommandResponse<T>>(name, args);
  if (response.type === "error") {
    throw response.error;
  }
  return response.data;
}

function isProjectError(error: unknown): error is { readonly type: string } {
  return typeof error === "object" && error !== null && "type" in error;
}

function relativeEntry(root: string, selectedPath: string): string | null {
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedPath = selectedPath.replace(/\\/g, "/");
  const prefix = `${normalizedRoot}/`;
  return normalizedPath.toLowerCase().startsWith(prefix.toLowerCase())
    ? normalizedPath.slice(prefix.length)
    : null;
}

export function useSourceGraph(): SourceGraphController {
  const [state, setState] = React.useState<SourceGraphState>({ type: "loadingRecents" });
  const recentsRef = React.useRef<ReadonlyArray<RecentProject>>([]);

  const loadRecents = React.useCallback(async (): Promise<ReadonlyArray<RecentProject>> => {
    const recents = await command<RecentProject[]>("list_recent_projects");
    recentsRef.current = recents;
    return recents;
  }, []);

  React.useEffect(() => {
    void loadRecents()
      .then((recents) => setState({ type: "idle", recents }))
      .catch((error: unknown) =>
        setState({
          type: "error",
          error: isProjectError(error) ? (error as never) : invocationError(error),
          recents: [],
        }),
      );
  }, [loadRecents]);

  const openRoot = React.useCallback(
    async (
      root: string,
      forceReindex = false,
      additionalEntryPoints: ReadonlyArray<string> = [],
    ): Promise<void> => {
      const name = root.split(/[\\/]/).filter(Boolean).slice(-1)[0] ?? "project";
      setState({ type: "indexing", projectName: name });
      try {
        const index = await command<ProjectIndex>("open_project", {
          root,
          forceReindex,
          additionalEntryPoints,
        });
        setState({ type: "open", index });
      } catch (error: unknown) {
        setState({
          type: "error",
          error: isProjectError(error) ? (error as never) : invocationError(error),
          recents: recentsRef.current,
        });
      }
    },
    [],
  );

  const inspectRoot = React.useCallback(
    async (root: string): Promise<void> => {
      setState({ type: "inspecting", recents: recentsRef.current });
      try {
        const inspection = await command<ProjectInspection>("inspect_project", { path: root });
        if (inspection.type === "needsInitialization") {
          setState({
            type: "needsInitialization",
            proposal: inspection.proposal,
            recents: recentsRef.current,
          });
        } else {
          await openRoot(inspection.project.root);
        }
      } catch (error: unknown) {
        setState({
          type: "error",
          error: isProjectError(error) ? (error as never) : invocationError(error),
          recents: recentsRef.current,
        });
      }
    },
    [openRoot],
  );

  const selectProject = React.useCallback(async (): Promise<void> => {
    const selected = await open({ multiple: false, directory: true });
    if (typeof selected === "string") {
      await inspectRoot(selected);
    }
  }, [inspectRoot]);

  const confirmInitialization = React.useCallback(async (): Promise<void> => {
    if (state.type !== "needsInitialization") return;
    const proposal: InitializationProposal = state.proposal;
    let config: ProjectConfig = proposal.config;
    if (proposal.requiresEntrySelection) {
      const selected = await open({
        multiple: true,
        directory: false,
        defaultPath: proposal.project.root,
        filters: [{ name: "TypeScript", extensions: ["ts", "tsx"] }],
      });
      const paths = typeof selected === "string" ? [selected] : (selected ?? []);
      const entries = paths
        .map((path) => relativeEntry(proposal.project.root, path))
        .filter((path): path is string => path !== null);
      if (entries.length === 0) return;
      config = { ...config, entryPoints: entries };
    }
    setState({ type: "indexing", projectName: proposal.project.name });
    try {
      const project = await command<ProjectSummary>("initialize_project", {
        root: proposal.project.root,
        config,
      });
      await openRoot(project.root);
    } catch (error: unknown) {
      setState({
        type: "error",
        error: isProjectError(error) ? (error as never) : invocationError(error),
        recents: recentsRef.current,
      });
    }
  }, [openRoot, state]);

  const forgetRecentProject = React.useCallback(
    async (root: string): Promise<void> => {
      try {
        await command<void>("forget_recent_project", { root });
        const recents = await loadRecents();
        setState({ type: "idle", recents });
      } catch (error: unknown) {
        setState({
          type: "error",
          error: isProjectError(error) ? (error as never) : invocationError(error),
          recents: recentsRef.current,
        });
      }
    },
    [loadRecents],
  );

  const reindexProject = React.useCallback(async (): Promise<void> => {
    if (state.type === "open")
      await openRoot(state.index.project.root, true, state.index.entryPoints);
  }, [openRoot, state]);

  const includeProjectFile = React.useCallback(
    async (path: string): Promise<void> => {
      if (state.type !== "open") return;
      await openRoot(state.index.project.root, false, [...state.index.entryPoints, path]);
    },
    [openRoot, state],
  );

  const closeProject = React.useCallback(async (): Promise<void> => {
    try {
      const recents = await loadRecents();
      setState({ type: "idle", recents });
    } catch {
      setState({ type: "idle", recents: recentsRef.current });
    }
  }, [loadRecents]);

  return {
    state,
    selectProject,
    confirmInitialization,
    cancelInitialization: () => setState({ type: "idle", recents: recentsRef.current }),
    openRecentProject: (root) => openRoot(root),
    forgetRecentProject,
    reindexProject,
    includeProjectFile,
    closeProject,
  };
}
