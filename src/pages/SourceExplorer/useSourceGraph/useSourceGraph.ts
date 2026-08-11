import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AnalyzeSourceResponse } from "../SourceExplorer.types";
import type { SourceGraphController, SourceGraphState } from "./useSourceGraph.types";

/**
 * Coordinate native source selection and typed analysis state.
 *
 * @example
 * ```tsx
 * const { state, selectSourceFile } = useSourceGraph();
 * ```
 */
export function useSourceGraph(): SourceGraphController {
  const [state, setState] = React.useState<SourceGraphState>({ type: "idle" });

  const selectSourceFile = React.useCallback(async (): Promise<void> => {
    const selectedPath = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "TypeScript", extensions: ["ts", "tsx"] }],
    });

    if (selectedPath === null) {
      return;
    }

    setState({ type: "loading" });
    try {
      const response = await invoke<AnalyzeSourceResponse>("analyze_typescript_file", {
        path: selectedPath,
      });
      if (response.type === "success") {
        setState({ type: "success", graph: response.graph });
      } else {
        setState({ type: "error", error: response.error });
      }
    } catch (error: unknown) {
      setState({
        type: "error",
        error: {
          type: "parseFailed",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }, []);

  return { state, selectSourceFile };
}
