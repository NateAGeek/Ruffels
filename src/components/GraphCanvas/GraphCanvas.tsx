import * as React from "react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import styles from "./GraphCanvas.module.scss";
import type { SourceGraphFlowEdge, SourceGraphFlowNode } from "./GraphCanvas.types";
import {
  filterSourceGraphByFile,
  filterSourceGraphByNodeTypes,
  filterSourceGraphByQuery,
  getGraphNodeTypeOptions,
  layoutSourceGraph,
} from "./GraphCanvas.utils";
import type { SourceGraph, SourceNode } from "../../pages/SourceExplorer";
import { FileExplorer } from "../../pages/SourceExplorer/FileExplorer";
import { FilePreview } from "../../pages/SourceExplorer/FilePreview";
import { NodeInspector } from "../../pages/SourceExplorer/NodeInspector";
import type { FileSummary } from "../../pages/SourceExplorer/SourceExplorer.types";
import { GraphToolbar } from "./GraphToolbar";
import { SourceGraphNode } from "./SourceGraphNode";

const nodeTypes = { sourceGraph: SourceGraphNode };

export interface GraphCanvasProps {
  /** Typed semantic graph returned by the Tauri analysis command. */
  readonly graph: SourceGraph;
  readonly files: ReadonlyArray<FileSummary>;
  readonly projectName: string;
  /** Adds an optional supported project file to the indexed graph. */
  readonly onIncludeProjectFile: (path: string) => Promise<void>;
}

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

export function GraphCanvas({
  graph,
  files,
  projectName,
  onIncludeProjectFile,
}: GraphCanvasProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const flowInstanceRef = React.useRef<ReactFlowInstance<
    SourceGraphFlowNode,
    SourceGraphFlowEdge
  > | null>(null);
  const [canvasSize, setCanvasSize] = React.useState<CanvasSize | null>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedSourcePath, setSelectedSourcePath] = React.useState<string | null>(null);
  const [selectedPreviewPath, setSelectedPreviewPath] = React.useState<string | null>(null);
  const [isFileExplorerVisible, setFileExplorerVisible] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const indexedFiles = React.useMemo(() => files.filter((file) => file.isIndexed), [files]);
  const selectedPreviewFile = React.useMemo(
    () => files.find((file) => file.path === selectedPreviewPath) ?? null,
    [files, selectedPreviewPath],
  );
  const focusedGraph = React.useMemo(
    () =>
      selectedSourcePath === null ? graph : filterSourceGraphByFile(graph, selectedSourcePath),
    [graph, selectedSourcePath],
  );
  const nodeTypeOptions = React.useMemo(
    () => getGraphNodeTypeOptions(graph, selectedSourcePath),
    [graph, selectedSourcePath],
  );
  const [selectedAstTypes, setSelectedAstTypes] = React.useState<
    ReadonlySet<SourceNode["astType"]>
  >(() => new Set(nodeTypeOptions.map((nodeTypeOption) => nodeTypeOption.astType)));
  const visibleGraph = React.useMemo(() => {
    const typedGraph = filterSourceGraphByNodeTypes(focusedGraph, selectedAstTypes);
    return filterSourceGraphByQuery(typedGraph, query);
  }, [focusedGraph, query, selectedAstTypes]);
  const layoutedGraph = React.useMemo(() => layoutSourceGraph(visibleGraph), [visibleGraph]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<SourceGraphFlowNode>([
    ...layoutedGraph.nodes,
  ]);
  const flowEdges = React.useMemo(() => [...layoutedGraph.edges], [layoutedGraph.edges]);
  const selectedNode = React.useMemo(
    () => visibleGraph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [visibleGraph.nodes, selectedNodeId],
  );

  React.useEffect(() => {
    setSelectedAstTypes(new Set(nodeTypeOptions.map((nodeTypeOption) => nodeTypeOption.astType)));
    setQuery("");
  }, [nodeTypeOptions]);

  React.useEffect(() => {
    if (selectedNodeId !== null && !visibleGraph.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, visibleGraph.nodes]);

  React.useEffect(() => {
    if (selectedSourcePath !== null && !files.some((file) => file.path === selectedSourcePath)) {
      setSelectedSourcePath(null);
    }
  }, [files, selectedSourcePath]);

  React.useEffect(() => {
    if (selectedPreviewPath !== null && !files.some((file) => file.path === selectedPreviewPath)) {
      setSelectedPreviewPath(null);
    }
  }, [files, selectedPreviewPath]);

  React.useEffect(() => {
    setFlowNodes((currentNodes) => {
      const currentPositions = new Map(
        currentNodes.map((currentNode) => [currentNode.id, currentNode.position]),
      );
      return layoutedGraph.nodes.map((layoutedNode) => ({
        ...layoutedNode,
        position: currentPositions.get(layoutedNode.id) ?? layoutedNode.position,
        selected: layoutedNode.id === selectedNodeId,
      }));
    });
  }, [layoutedGraph.nodes, selectedNodeId, setFlowNodes]);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return undefined;
    }

    const measureCanvas = (): void => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        return;
      }

      setCanvasSize((currentSize) =>
        currentSize?.width === width && currentSize.height === height
          ? currentSize
          : { width, height },
      );
    };

    measureCanvas();
    const resizeObserver = new ResizeObserver(measureCanvas);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  const handleInit = React.useCallback(
    (instance: ReactFlowInstance<SourceGraphFlowNode, SourceGraphFlowEdge>): void => {
      flowInstanceRef.current = instance;
      requestAnimationFrame(() => {
        void instance.fitView({ padding: 0.18 });
      });
    },
    [],
  );

  React.useEffect(() => {
    requestAnimationFrame(() => {
      void flowInstanceRef.current?.fitView({ padding: 0.18 });
    });
  }, [visibleGraph]);

  const handleNodeClick = React.useCallback<NodeMouseHandler<SourceGraphFlowNode>>(
    (_event, node) => {
      setSelectedPreviewPath(null);
      setSelectedNodeId(node.id);
    },
    [],
  );

  const handleFileSelect = React.useCallback(
    (path: string | null): void => {
      setSelectedNodeId(null);
      if (path === null) {
        setSelectedSourcePath(null);
        setSelectedPreviewPath(null);
        return;
      }
      const file = files.find((projectFile) => projectFile.path === path);
      if (file?.isIndexed) {
        setSelectedSourcePath(path);
        setSelectedPreviewPath(null);
      } else {
        setSelectedSourcePath(null);
        setSelectedPreviewPath(path);
      }
    },
    [files],
  );

  const handleNodeTypeToggle = React.useCallback((astType: SourceNode["astType"]): void => {
    setSelectedAstTypes((currentAstTypes) => {
      const nextAstTypes = new Set(currentAstTypes);
      if (nextAstTypes.has(astType)) {
        nextAstTypes.delete(astType);
      } else {
        nextAstTypes.add(astType);
      }
      return nextAstTypes;
    });
  }, []);

  const handleNodeTypesVisibilityChange = React.useCallback(
    (astTypes: ReadonlyArray<SourceNode["astType"]>, isVisible: boolean): void => {
      setSelectedAstTypes((currentAstTypes) => {
        const nextAstTypes = new Set(currentAstTypes);
        for (const astType of astTypes) {
          if (isVisible) {
            nextAstTypes.add(astType);
          } else {
            nextAstTypes.delete(astType);
          }
        }
        return nextAstTypes;
      });
    },
    [],
  );

  const handleResetFilters = React.useCallback((): void => {
    setQuery("");
    setSelectedSourcePath(null);
    setSelectedAstTypes(new Set(nodeTypeOptions.map((nodeTypeOption) => nodeTypeOption.astType)));
  }, [nodeTypeOptions]);

  return (
    <div className={styles.graphCanvas} aria-label="TypeScript AST tree">
      <Allotment separator>
        <Allotment.Pane
          minSize={180}
          preferredSize={250}
          maxSize={380}
          visible={isFileExplorerVisible}
        >
          <FileExplorer
            projectName={projectName}
            files={files}
            selectedPath={selectedPreviewPath ?? selectedSourcePath}
            onSelectPath={handleFileSelect}
            onHide={() => setFileExplorerVisible(false)}
          />
        </Allotment.Pane>
        <Allotment.Pane
          minSize={240}
          preferredSize={320}
          maxSize={480}
          visible={selectedNode !== null || selectedPreviewFile !== null}
        >
          {selectedPreviewFile !== null && (
            <FilePreview
              projectRoot={graph.sourcePath}
              file={selectedPreviewFile}
              onClose={() => setSelectedPreviewPath(null)}
              onInclude={onIncludeProjectFile}
            />
          )}
          {selectedNode !== null && (
            <NodeInspector
              node={selectedNode}
              projectRoot={visibleGraph.sourcePath}
              onClose={() => setSelectedNodeId(null)}
            />
          )}
        </Allotment.Pane>
        <Allotment.Pane minSize={320}>
          <div className={styles.flowCanvas}>
            <GraphToolbar
              files={indexedFiles}
              nodeTypeOptions={nodeTypeOptions}
              query={query}
              selectedSourcePath={selectedSourcePath}
              selectedAstTypes={selectedAstTypes}
              visibleNodeCount={visibleGraph.nodes.length}
              totalNodeCount={focusedGraph.nodes.length}
              onQueryChange={setQuery}
              onNodeTypeToggle={handleNodeTypeToggle}
              onNodeTypesVisibilityChange={handleNodeTypesVisibilityChange}
              onSourcePathChange={setSelectedSourcePath}
              onReset={handleResetFilters}
            />
            <div ref={canvasRef} className={styles.graphViewport}>
              {!isFileExplorerVisible && (
                <button
                  className={styles.showExplorerButton}
                  type="button"
                  onClick={() => setFileExplorerVisible(true)}
                >
                  Show files
                </button>
              )}
              {canvasSize === null ? (
                <div className={styles.preparingCanvas} role="status">
                  Preparing graph…
                </div>
              ) : (
                <ReactFlow
                  width={canvasSize.width}
                  height={canvasSize.height}
                  nodes={flowNodes}
                  edges={flowEdges}
                  nodeTypes={nodeTypes}
                  nodesConnectable={false}
                  nodesDraggable
                  elementsSelectable
                  fitView
                  fitViewOptions={{ padding: 0.18 }}
                  minZoom={0.2}
                  maxZoom={1.8}
                  proOptions={{ hideAttribution: true }}
                  onInit={handleInit}
                  onNodeClick={handleNodeClick}
                  onNodesChange={onNodesChange}
                >
                  <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              )}
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
