import type { FileSummary } from "../SourceExplorer.types";
import styles from "./FileExplorer.module.scss";

interface DirectoryNode {
  readonly name: string;
  readonly path: string;
  readonly directories: ReadonlyArray<DirectoryNode>;
  readonly files: ReadonlyArray<FileSummary>;
}

interface MutableDirectoryNode {
  name: string;
  path: string;
  directories: Map<string, MutableDirectoryNode>;
  files: FileSummary[];
}

export interface FileExplorerProps {
  readonly projectName: string;
  readonly files: ReadonlyArray<FileSummary>;
  readonly selectedPath: string | null;
  readonly onSelectPath: (path: string | null) => void;
  readonly onHide: () => void;
}

export function buildFileTree(files: ReadonlyArray<FileSummary>): DirectoryNode {
  const root: MutableDirectoryNode = { name: "", path: "", directories: new Map(), files: [] };
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    const parts = file.path.replace(/\\/g, "/").split("/");
    let directory = root;
    for (const part of parts.slice(0, -1)) {
      const path = directory.path === "" ? part : `${directory.path}/${part}`;
      let child = directory.directories.get(part);
      if (child === undefined) {
        child = { name: part, path, directories: new Map(), files: [] };
        directory.directories.set(part, child);
      }
      directory = child;
    }
    directory.files.push(file);
  }
  return freezeDirectory(root);
}

function freezeDirectory(directory: MutableDirectoryNode): DirectoryNode {
  return {
    name: directory.name,
    path: directory.path,
    directories: [...directory.directories.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(freezeDirectory),
    files: directory.files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function FileExplorer({
  projectName,
  files,
  selectedPath,
  onSelectPath,
  onHide,
}: FileExplorerProps): React.ReactElement {
  const tree = buildFileTree(files);
  return (
    <aside className={styles.fileExplorer} aria-label="Project files">
      <header>
        <span>Explorer</span>
        <button type="button" onClick={onHide} aria-label="Hide file explorer">
          Hide
        </button>
      </header>
      <nav aria-label="Source files">
        <button
          type="button"
          className={`${styles.root} ${selectedPath === null ? styles.selected : ""}`}
          aria-pressed={selectedPath === null}
          onClick={() => onSelectPath(null)}
        >
          <span aria-hidden="true">▾</span>
          <strong>{projectName}</strong>
        </button>
        <div className={styles.tree}>
          {tree.directories.map((directory) => (
            <Directory
              key={directory.path}
              directory={directory}
              selectedPath={selectedPath}
              onSelectPath={onSelectPath}
            />
          ))}
          {tree.files.map((file) => (
            <File
              key={file.path}
              file={file}
              selectedPath={selectedPath}
              onSelectPath={onSelectPath}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}

function Directory({
  directory,
  selectedPath,
  onSelectPath,
}: {
  readonly directory: DirectoryNode;
  readonly selectedPath: string | null;
  readonly onSelectPath: (path: string) => void;
}): React.ReactElement {
  return (
    <details open className={styles.directory}>
      <summary>
        <span aria-hidden="true">▸</span>
        {directory.name}
      </summary>
      <div>
        {directory.directories.map((child) => (
          <Directory
            key={child.path}
            directory={child}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        ))}
        {directory.files.map((file) => (
          <File
            key={file.path}
            file={file}
            selectedPath={selectedPath}
            onSelectPath={onSelectPath}
          />
        ))}
      </div>
    </details>
  );
}

function File({
  file,
  selectedPath,
  onSelectPath,
}: {
  readonly file: FileSummary;
  readonly selectedPath: string | null;
  readonly onSelectPath: (path: string) => void;
}): React.ReactElement {
  const name = file.path.split("/").slice(-1)[0];
  const extension = name?.split(".").slice(-1)[0]?.slice(0, 3).toUpperCase() ?? "FILE";
  return (
    <button
      type="button"
      className={`${styles.file} ${!file.isIndexed ? styles.optionalFile : ""} ${selectedPath === file.path ? styles.selected : ""}`}
      aria-pressed={selectedPath === file.path}
      data-indexed={file.isIndexed}
      data-supported={file.sourceType !== null}
      title={
        file.isIndexed
          ? file.path
          : file.sourceType === null
            ? `${file.path} · read-only preview`
            : `${file.path} · not included in graph`
      }
      onClick={() => onSelectPath(file.path)}
    >
      <span className={styles.extension}>
        {file.sourceType === "tsx" ? "TX" : file.sourceType === "typeScript" ? "TS" : extension}
      </span>
      <span className={styles.file_name}>{name}</span>
      {file.isEntryPoint && (
        <span className={styles.entry} title="Entry point">
          ●
        </span>
      )}
      {file.diagnosticCount > 0 && (
        <span className={styles.diagnostic} title={`${file.diagnosticCount} diagnostics`}>
          {file.diagnosticCount}
        </span>
      )}
    </button>
  );
}
