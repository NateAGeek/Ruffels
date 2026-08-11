import { act, renderHook } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AnalyzeSourceResponse, SourceGraph } from "../SourceExplorer.types";
import { useSourceGraph } from "./useSourceGraph";

jest.mock("@tauri-apps/api/core", () => ({ invoke: jest.fn() }));
jest.mock("@tauri-apps/plugin-dialog", () => ({ open: jest.fn() }));

const sourceGraph: SourceGraph = {
  sourcePath: "C:\\project\\Component.tsx",
  sourceType: "tsx",
  nodes: [],
  edges: [],
  diagnostics: [],
};

describe("useSourceGraph", () => {
  it("should leave state unchanged when file selection is cancelled", async () => {
    jest.mocked(open).mockResolvedValue(null);
    const { result } = renderHook(() => useSourceGraph());

    await act(async () => result.current.selectSourceFile());

    expect(result.current.state).toEqual({ type: "idle" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("should replace the graph after each successful selection", async () => {
    const secondGraph: SourceGraph = { ...sourceGraph, sourcePath: "C:\\project\\Other.tsx" };
    jest.mocked(open)
      .mockResolvedValueOnce("C:\\project\\Component.tsx")
      .mockResolvedValueOnce("C:\\project\\Other.tsx");
    jest.mocked(invoke)
      .mockResolvedValueOnce({ type: "success", graph: sourceGraph } satisfies AnalyzeSourceResponse)
      .mockResolvedValueOnce({ type: "success", graph: secondGraph } satisfies AnalyzeSourceResponse);
    const { result } = renderHook(() => useSourceGraph());

    await act(async () => result.current.selectSourceFile());
    expect(result.current.state).toEqual({ type: "success", graph: sourceGraph });

    await act(async () => result.current.selectSourceFile());
    expect(result.current.state).toEqual({ type: "success", graph: secondGraph });
  });
});
