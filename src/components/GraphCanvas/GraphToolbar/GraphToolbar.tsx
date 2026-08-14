import * as React from "react";
import type { FileSummary, SourceNode } from "../../../pages/SourceExplorer/SourceExplorer.types";
import type { GraphNodeTypeOption } from "../GraphCanvas.types";
import styles from "./GraphToolbar.module.scss";

export interface GraphToolbarProps {
  /** Project files available as graph focus scopes. */
  readonly files: ReadonlyArray<FileSummary>;
  /** AST types present in the unfiltered graph and their counts. */
  readonly nodeTypeOptions: ReadonlyArray<GraphNodeTypeOption>;
  /** Current free-text graph search. */
  readonly query: string;
  /** File path currently used to focus the graph, or null for all files. */
  readonly selectedSourcePath: string | null;
  /** AST types currently visible in the graph. */
  readonly selectedAstTypes: ReadonlySet<SourceNode["astType"]>;
  /** Number of nodes visible after applying every control. */
  readonly visibleNodeCount: number;
  /** Number of nodes in the unfiltered graph. */
  readonly totalNodeCount: number;
  /** Called whenever the search text changes. */
  readonly onQueryChange: (query: string) => void;
  /** Called when an AST type checkbox is toggled. */
  readonly onNodeTypeToggle: (astType: SourceNode["astType"]) => void;
  /** Called to show or hide every available AST type. */
  readonly onNodeTypesVisibilityChange: (
    astTypes: ReadonlyArray<SourceNode["astType"]>,
    isVisible: boolean,
  ) => void;
  /** Called when the focused file changes. */
  readonly onSourcePathChange: (sourcePath: string | null) => void;
  /** Called when the user clears all active controls. */
  readonly onReset: () => void;
}

export function GraphToolbar({
  files,
  nodeTypeOptions,
  query,
  selectedSourcePath,
  selectedAstTypes,
  visibleNodeCount,
  totalNodeCount,
  onQueryChange,
  onNodeTypeToggle,
  onNodeTypesVisibilityChange,
  onSourcePathChange,
  onReset,
}: GraphToolbarProps): React.ReactElement {
  const [nodeTypeQuery, setNodeTypeQuery] = React.useState("");
  const availableNodeTypeOptions = React.useMemo(
    () => nodeTypeOptions.filter((nodeTypeOption) => nodeTypeOption.count > 0),
    [nodeTypeOptions],
  );
  const filteredNodeTypeOptions = React.useMemo(() => {
    const normalizedQuery = nodeTypeQuery.trim().toLocaleLowerCase();
    return normalizedQuery === ""
      ? availableNodeTypeOptions
      : availableNodeTypeOptions.filter((nodeTypeOption) =>
          nodeTypeOption.astType.toLocaleLowerCase().includes(normalizedQuery),
        );
  }, [availableNodeTypeOptions, nodeTypeQuery]);
  const selectedAvailableTypeCount = availableNodeTypeOptions.filter((nodeTypeOption) =>
    selectedAstTypes.has(nodeTypeOption.astType),
  ).length;
  const areAllNodeTypesSelected =
    availableNodeTypeOptions.length > 0 &&
    selectedAvailableTypeCount === availableNodeTypeOptions.length;
  const hasActiveFilters =
    query !== "" ||
    selectedSourcePath !== null ||
    selectedAvailableTypeCount !== availableNodeTypeOptions.length;

  return (
    <div className={styles.graphToolbar} aria-label="Graph controls">
      <label className={styles.searchControl}>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          aria-label="Search graph"
          placeholder="Search nodes, types, or files"
          value={query}
          onChange={(changeEvent) => onQueryChange(changeEvent.currentTarget.value)}
        />
      </label>

      <details className={styles.typeControl}>
        <summary>
          Types
          <span>
            {selectedAvailableTypeCount}/{availableNodeTypeOptions.length}
          </span>
        </summary>
        <fieldset>
          <legend>Visible node types</legend>
          <div className={styles.typeMenuHeader}>
            <input
              type="search"
              aria-label="Search node types"
              placeholder="Search types"
              value={nodeTypeQuery}
              onChange={(changeEvent) => setNodeTypeQuery(changeEvent.currentTarget.value)}
            />
            <button
              type="button"
              disabled={availableNodeTypeOptions.length === 0}
              aria-label={
                areAllNodeTypesSelected ? "Uncheck all node types" : "Check all node types"
              }
              onClick={() =>
                onNodeTypesVisibilityChange(
                  availableNodeTypeOptions.map((nodeTypeOption) => nodeTypeOption.astType),
                  !areAllNodeTypesSelected,
                )
              }
            >
              {areAllNodeTypesSelected ? "Uncheck all" : "Check all"}
            </button>
          </div>
          {filteredNodeTypeOptions.map((nodeTypeOption) => (
            <label key={nodeTypeOption.astType}>
              <input
                type="checkbox"
                aria-label={`${nodeTypeOption.astType} (${nodeTypeOption.count})`}
                checked={selectedAstTypes.has(nodeTypeOption.astType)}
                onChange={() => onNodeTypeToggle(nodeTypeOption.astType)}
              />
              <span>{nodeTypeOption.astType}</span>
              <strong>{nodeTypeOption.count}</strong>
            </label>
          ))}
        </fieldset>
      </details>

      <label className={styles.fileControl}>
        <span>Focus</span>
        <select
          aria-label="Focus file"
          value={selectedSourcePath ?? ""}
          onChange={(changeEvent) => onSourcePathChange(changeEvent.currentTarget.value || null)}
        >
          <option value="">All files</option>
          {files.map((file) => (
            <option key={file.path} value={file.path}>
              {file.path}
            </option>
          ))}
        </select>
      </label>

      <output className={styles.nodeCount}>
        {visibleNodeCount} of {totalNodeCount} nodes
      </output>
      <button type="button" disabled={!hasActiveFilters} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
