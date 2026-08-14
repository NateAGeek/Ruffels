import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectIndex } from "../../pages/SourceExplorer/SourceExplorer.types";
import { useSourceGraph } from "./useSourceGraph";

jest.mock("@tauri-apps/api/core", () => ({ invoke: jest.fn() }));
jest.mock("@tauri-apps/plugin-dialog", () => ({ open: jest.fn() }));

const projectIndex: ProjectIndex = {
  project: { root: "C:\\project", name: "project", configPath: "C:\\project\\ruffels.config.json" },
  entryPoints: ["src/main.ts"],
  files: [],
  graph: {
    sourcePath: "C:\\project",
    sourceType: "typeScript",
    nodes: [],
    edges: [],
    diagnostics: [],
  },
  stats: { fileCount: 1, reusedFiles: 0, parsedFiles: 1, externalDependencyCount: 0 },
};

describe("useSourceGraph", () => {
  beforeEach(() => {
    jest.mocked(invoke).mockImplementation(async (name) => {
      if (name === "list_recent_projects") return { type: "success", data: [] };
      throw new Error(`Unexpected command: ${String(name)}`);
    });
  });

  it("leaves the project list unchanged when folder selection is cancelled", async () => {
    jest.mocked(open).mockResolvedValue(null);
    const { result } = renderHook(() => useSourceGraph());
    await waitFor(() => expect(result.current.state.type).toBe("idle"));
    await act(async () => result.current.selectProject());
    expect(result.current.state).toEqual({ type: "idle", recents: [] });
  });

  it("inspects and opens an initialized project", async () => {
    jest.mocked(open).mockResolvedValue("C:\\project");
    jest.mocked(invoke).mockImplementation(async (name) => {
      if (name === "list_recent_projects") return { type: "success", data: [] };
      if (name === "inspect_project")
        return { type: "success", data: { type: "initialized", project: projectIndex.project } };
      if (name === "open_project") return { type: "success", data: projectIndex };
      throw new Error(`Unexpected command: ${String(name)}`);
    });
    const { result } = renderHook(() => useSourceGraph());
    await waitFor(() => expect(result.current.state.type).toBe("idle"));
    await act(async () => result.current.selectProject());
    expect(result.current.state).toEqual({ type: "open", index: projectIndex });
    expect(invoke).toHaveBeenCalledWith("open_project", {
      root: "C:\\project",
      forceReindex: false,
      additionalEntryPoints: [],
    });
  });
});
