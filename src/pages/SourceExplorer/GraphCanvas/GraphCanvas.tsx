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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeInspector } from "../NodeInspector";
import { SourceGraphNode } from "../SourceGraphNode";
import type { SourceGraph } from "../SourceExplorer.types";
import styles from "./GraphCanvas.module.scss";
import type { SourceGraphFlowEdge, SourceGraphFlowNode } from "./GraphCanvas.types";
import { layoutSourceGraph } from "./GraphCanvas.utils";

const nodeTypes = { sourceGraph: SourceGraphNode };

export interface GraphCanvasProps {
  /** Typed semantic graph returned by the Tauri analysis command. */
  readonly graph: SourceGraph;
}

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

export function GraphCanvas({ graph }: GraphCanvasProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = React.useState<CanvasSize | null>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const layoutedGraph = React.useMemo(() => layoutSourceGraph(graph), [graph]);
  const flowNodes = React.useMemo<SourceGraphFlowNode[]>(
    () => layoutedGraph.nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [layoutedGraph.nodes, selectedNodeId],
  );
  const flowEdges = React.useMemo(() => [...layoutedGraph.edges], [layoutedGraph.edges]);
  const selectedNode = React.useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

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
        currentSize?.width === width && currentSize.height === height ? currentSize : { width, height },
      );
    };

    measureCanvas();
    const resizeObserver = new ResizeObserver(measureCanvas);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  const handleInit = React.useCallback(
    (instance: ReactFlowInstance<SourceGraphFlowNode, SourceGraphFlowEdge>): void => {
      requestAnimationFrame(() => {
        void instance.fitView({ padding: 0.18 });
      });
    },
    [],
  );

  const handleNodeClick = React.useCallback<NodeMouseHandler<SourceGraphFlowNode>>(
    (_event, node) => setSelectedNodeId(node.id),
    [],
  );

  return (
    <div className={styles.graphCanvas} aria-label="TypeScript AST tree">
      <Allotment separator>
        <Allotment.Pane minSize={240} preferredSize={320} maxSize={480} visible={selectedNode !== null}>
          {selectedNode !== null && (
            <NodeInspector node={selectedNode} onClose={() => setSelectedNodeId(null)} />
          )}
        </Allotment.Pane>
        <Allotment.Pane minSize={320}>
          <div ref={canvasRef} className={styles.flowCanvas}>
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
                nodesDraggable={false}
                elementsSelectable
                fitView
                fitViewOptions={{ padding: 0.18 }}
                minZoom={0.2}
                maxZoom={1.8}
                proOptions={{ hideAttribution: true }}
                onInit={handleInit}
                onNodeClick={handleNodeClick}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <Controls showInteractive={false} />
              </ReactFlow>
            )}
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
