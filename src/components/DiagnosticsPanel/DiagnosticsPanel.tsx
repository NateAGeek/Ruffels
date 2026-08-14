import type { SourceDiagnostic } from "../../pages/SourceExplorer/SourceExplorer.types";
import styles from "./DiagnosticsPanel.module.scss";

export interface DiagnosticsPanelProps {
  /** Recoverable SWC diagnostics associated with the rendered graph. */
  readonly diagnostics: ReadonlyArray<SourceDiagnostic>;
}

export function DiagnosticsPanel({
  diagnostics,
}: DiagnosticsPanelProps): React.ReactElement | null {
  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <aside className={styles.diagnosticsPanel} aria-label="Parser diagnostics">
      <h2>Parser diagnostics</h2>
      <ul>
        {diagnostics.map((diagnostic, diagnosticIndex) => (
          <li
            key={`${diagnostic.span.startLine}:${diagnostic.span.startColumn}:${diagnosticIndex}`}
          >
            <span>
              {diagnostic.sourcePath !== undefined && `${diagnostic.sourcePath} · `}L
              {diagnostic.span.startLine}:{diagnostic.span.startColumn}
            </span>
            {diagnostic.message}
          </li>
        ))}
      </ul>
    </aside>
  );
}
