import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { GraphCanvas } from "./GraphCanvas";
import styles from "./SourceExplorer.module.scss";
import { useSourceGraph } from "./useSourceGraph";
import { getAnalysisErrorMessage } from "./useSourceGraph/useSourceGraph.utils";
import type { SourceGraphState } from "./useSourceGraph";

export interface SourceExplorerProps {}

export function SourceExplorer({}: SourceExplorerProps): React.ReactElement {
  const { state, selectSourceFile } = useSourceGraph();

  return <SourceExplorerRender state={state} onSelectSourceFile={selectSourceFile} />;
}

export interface SourceExplorerRenderProps {
  /** Current source-analysis state displayed by the page. */
  readonly state: SourceGraphState;
  /** Open the native picker and analyze the selected source file. */
  readonly onSelectSourceFile: () => Promise<void>;
}

export function SourceExplorerRender({
  state,
  onSelectSourceFile,
}: SourceExplorerRenderProps): React.ReactElement {
  const graph = state.type === "success" ? state.graph : null;
  const sourceFileName = graph?.sourcePath.split(/[\\/]/).slice(-1)[0];

  return (
    <main className={styles.sourceExplorer}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SWC frontend explorer</p>
          <h1>TypeScript render tree</h1>
          <p className={styles.description}>
            Inspect typed declarations and React JSX structure without sending source code outside
            this app.
          </p>
        </div>
        <button
          className={styles.openButton}
          type="button"
          disabled={state.type === "loading"}
          onClick={() => void onSelectSourceFile()}
        >
          {state.type === "loading" ? "Analyzing…" : "Open TS or TSX"}
        </button>
      </header>

      {state.type === "idle" && (
        <section className={styles.emptyState} aria-label="No source selected">
          <span className={styles.emptyGlyph} aria-hidden="true">{"</>"}</span>
          <h2>Select a source file</h2>
          <p>The parsed AST will appear here as a navigable tree.</p>
        </section>
      )}

      {state.type === "loading" && (
        <section className={styles.statusState} role="status">
          Parsing the source file and building its typed graph…
        </section>
      )}

      {state.type === "error" && (
        <section className={styles.errorState} role="alert">
          <h2>Could not analyze this file</h2>
          <p>{getAnalysisErrorMessage(state.error)}</p>
        </section>
      )}

      {graph !== null && (
        <section className={styles.workspace} aria-label="Source graph workspace">
          <div className={styles.fileSummary}>
            <div>
              <span className={styles.fileType}>{graph.sourceType === "tsx" ? "TSX" : "TS"}</span>
              <h2>{sourceFileName}</h2>
            </div>
            <span>{graph.nodes.length} typed nodes</span>
          </div>
          <GraphCanvas graph={graph} />
          <DiagnosticsPanel diagnostics={graph.diagnostics} />
        </section>
      )}
    </main>
  );
}
