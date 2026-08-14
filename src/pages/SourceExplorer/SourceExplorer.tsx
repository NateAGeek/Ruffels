import { DiagnosticsPanel } from "../../components/DiagnosticsPanel";
import { GraphCanvas } from "../../components/GraphCanvas";
import { SourceGraphController, useSourceGraph } from "../../hooks/useSourceGraph";

import styles from "./SourceExplorer.module.scss";
import type { ProjectError } from "./SourceExplorer.types";

function getProjectErrorMessage(error: ProjectError): string {
  switch (error.type) {
    case "invalidRoot":
      return "The selected project folder is unavailable.";
    case "notInitialized":
      return "This folder has not been initialized as a Ruffels project.";
    case "invalidConfig":
      return `The project configuration is invalid: ${error.message}`;
    case "noEntryPoints":
      return "No TypeScript entry points could be found.";
    case "entryOutsideRoot":
      return `A project entry resolves outside the project root: ${error.path}`;
    case "fileLimitExceeded":
      return `The project exceeds its configured ${error.limit.toLocaleString()} file limit.`;
    case "ioFailed":
      return error.message;
    case "analysisFailed":
      return `${error.path}: ${error.message}`;
  }
}

export function SourceExplorer(): React.ReactElement {
  return <SourceExplorerRender {...useSourceGraph()} />;
}

export type SourceExplorerRenderProps = SourceGraphController;

export function SourceExplorerRender({
  state,
  selectProject,
  confirmInitialization,
  cancelInitialization,
  openRecentProject,
  forgetRecentProject,
  reindexProject,
  includeProjectFile,
  closeProject,
}: SourceExplorerRenderProps): React.ReactElement {
  const index = state.type === "open" ? state.index : null;
  const isBusy = ["loadingRecents", "inspecting", "indexing"].includes(state.type);
  return (
    <main className={styles.sourceExplorer}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Local TypeScript explorer</p>
          <h1>{index?.project.name ?? "Ruffels projects"}</h1>
          <p className={styles.description}>
            Index a project locally, follow its internal imports, and inspect its typed source
            graph.
          </p>
        </div>
        <div className={styles.headerActions}>
          {index !== null && (
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void closeProject()}
            >
              Projects
            </button>
          )}
          <button
            className={styles.openButton}
            type="button"
            disabled={isBusy}
            onClick={() => void selectProject()}
          >
            {state.type === "inspecting" ? "Inspecting…" : "Open project"}
          </button>
        </div>
      </header>
      {state.type === "loadingRecents" && <Status>Loading recent projects…</Status>}
      {state.type === "inspecting" && <Status>Inspecting the selected folder…</Status>}
      {state.type === "indexing" && (
        <Status>Indexing {state.projectName} and updating its cache…</Status>
      )}
      {state.type === "idle" && (
        <section className={styles.projectLanding} aria-label="Projects">
          <div className={styles.emptyState}>
            <span className={styles.emptyGlyph} aria-hidden="true">
              {"</>"}
            </span>
            <h2>Select a project folder</h2>
            <p>Ruffels will detect TypeScript entry points before creating any files.</p>
          </div>
          {state.recents.length > 0 && (
            <div className={styles.recents}>
              <h2>Recent projects</h2>
              <ul>
                {state.recents.map((project) => (
                  <li key={project.root}>
                    <button
                      type="button"
                      disabled={!project.available}
                      onClick={() => void openRecentProject(project.root)}
                    >
                      <strong>{project.name}</strong>
                      <span>{project.root}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Forget ${project.name}`}
                      onClick={() => void forgetRecentProject(project.root)}
                    >
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      {state.type === "needsInitialization" && (
        <section className={styles.initialization} aria-label="Initialize project">
          <p className={styles.eyebrow}>New Ruffels project</p>
          <h2>Initialize {state.proposal.project.name}?</h2>
          <p>Ruffels will create project configuration and an ignored local cache.</p>
          <dl>
            <div>
              <dt>Entry points</dt>
              <dd>
                {state.proposal.requiresEntrySelection
                  ? "Choose after confirmation"
                  : state.proposal.detectedEntryPoints.join(", ")}
              </dd>
            </div>
            <div>
              <dt>Created files</dt>
              <dd>{state.proposal.filesToCreate.join(", ")}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <button
              className={styles.openButton}
              type="button"
              onClick={() => void confirmInitialization()}
            >
              {state.proposal.requiresEntrySelection
                ? "Choose entries and initialize"
                : "Initialize project"}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={cancelInitialization}>
              Cancel
            </button>
          </div>
        </section>
      )}
      {state.type === "error" && (
        <section className={styles.errorState} role="alert">
          <h2>Could not open this project</h2>
          <p>{getProjectErrorMessage(state.error)}</p>
        </section>
      )}
      {index !== null && (
        <section className={styles.workspace} aria-label="Source graph workspace">
          <div className={styles.fileSummary}>
            <div>
              <span className={styles.fileType}>PROJECT</span>
              <h2>{index.project.root}</h2>
            </div>
            <span>
              {index.stats.fileCount} files · {index.graph.nodes.length} nodes ·{" "}
              {index.stats.reusedFiles} cached
            </span>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void reindexProject()}
            >
              Reindex
            </button>
          </div>
          <GraphCanvas
            graph={index.graph}
            files={index.files}
            projectName={index.project.name}
            onIncludeProjectFile={includeProjectFile}
          />
          <DiagnosticsPanel diagnostics={index.graph.diagnostics} />
        </section>
      )}
    </main>
  );
}

function Status({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return (
    <section className={styles.statusState} role="status">
      {children}
    </section>
  );
}
