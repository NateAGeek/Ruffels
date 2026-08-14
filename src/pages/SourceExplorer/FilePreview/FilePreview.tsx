import * as React from "react";
import { invoke } from "@tauri-apps/api/core";
import ShikiHighlighter from "react-shiki";
import type {
  FileSummary,
  ProjectCommandResponse,
  ProjectFileContent,
} from "../SourceExplorer.types";
import styles from "./FilePreview.module.scss";

export interface FilePreviewProps {
  /** Absolute root of the open project. */
  readonly projectRoot: string;
  /** Project file to display. */
  readonly file: FileSummary;
  /** Closes the preview pane. */
  readonly onClose: () => void;
  /** Adds a supported optional file to the project graph. */
  readonly onInclude: (path: string) => Promise<void>;
}

export function FilePreview({
  projectRoot,
  file,
  onClose,
  onInclude,
}: FilePreviewProps): React.ReactElement {
  const [content, setContent] = React.useState<ProjectFileContent | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isIncluding, setIncluding] = React.useState(false);

  const includeFile = React.useCallback(async (): Promise<void> => {
    setIncluding(true);
    try {
      await onInclude(file.path);
    } finally {
      setIncluding(false);
    }
  }, [file.path, onInclude]);

  React.useEffect(() => {
    let isCurrent = true;
    setContent(null);
    setError(null);
    void invoke<ProjectCommandResponse<ProjectFileContent>>("read_project_file", {
      root: projectRoot,
      sourcePath: file.path,
    })
      .then((response) => {
        if (!isCurrent) return;
        if (response.type === "success") {
          setContent(response.data);
        } else {
          setError(
            response.error.type === "ioFailed"
              ? response.error.message
              : "The project file could not be previewed.",
          );
        }
      })
      .catch((previewError: unknown) => {
        if (isCurrent)
          setError(previewError instanceof Error ? previewError.message : String(previewError));
      });
    return () => {
      isCurrent = false;
    };
  }, [file.path, projectRoot]);

  return (
    <FilePreviewRender
      file={file}
      content={content}
      error={error}
      isIncluding={isIncluding}
      onClose={onClose}
      onInclude={() => void includeFile()}
    />
  );
}

export interface FilePreviewRenderProps {
  /** Project file being displayed. */
  readonly file: FileSummary;
  /** Loaded file contents, or null while loading. */
  readonly content: ProjectFileContent | null;
  /** Preview loading failure, when present. */
  readonly error: string | null;
  /** Whether graph inclusion is in progress. */
  readonly isIncluding: boolean;
  /** Closes the preview pane. */
  readonly onClose: () => void;
  /** Requests graph inclusion for the current file. */
  readonly onInclude: () => void;
}

export function FilePreviewRender({
  file,
  content,
  error,
  isIncluding,
  onClose,
  onInclude,
}: FilePreviewRenderProps): React.ReactElement {
  return (
    <aside className={styles.filePreview} aria-label={`${file.path} preview`}>
      <header className={styles.header}>
        <div>
          <span>Read-only preview</span>
          <h3>{file.path}</h3>
        </div>
        <div className={styles.actions}>
          {file.sourceType !== null && !file.isIndexed && (
            <button type="button" disabled={isIncluding} onClick={onInclude}>
              {isIncluding ? "Including…" : "Include in graph"}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close file preview">
            ×
          </button>
        </div>
      </header>
      {content === null && error === null && (
        <div className={styles.status} role="status">
          Loading preview…
        </div>
      )}
      {error !== null && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {content !== null && (
        <div className={styles.code} aria-label="Read-only file contents">
          <ShikiHighlighter
            language={content.language}
            theme="github-dark"
            engine="javascript"
            showLanguage={false}
            showLineNumbers
          >
            {content.content}
          </ShikiHighlighter>
        </div>
      )}
    </aside>
  );
}
