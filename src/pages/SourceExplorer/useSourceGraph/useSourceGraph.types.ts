import type { AnalysisError, SourceGraph } from "../SourceExplorer.types";

export type SourceGraphState =
  | { readonly type: "idle" }
  | { readonly type: "loading" }
  | { readonly type: "success"; readonly graph: SourceGraph }
  | { readonly type: "error"; readonly error: AnalysisError };

export interface SourceGraphController {
  readonly state: SourceGraphState;
  readonly selectSourceFile: () => Promise<void>;
}
