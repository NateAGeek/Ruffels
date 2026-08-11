import dagre from "@dagrejs/dagre";
import { MarkerType, Position } from "@xyflow/react";
import type { SourceGraph } from "../SourceExplorer.types";
import { GRAPH_NODE_HEIGHT, GRAPH_NODE_WIDTH } from "./GraphCanvas.constants";
import type { LayoutedSourceGraph, SourceGraphFlowEdge, SourceGraphFlowNode } from "./GraphCanvas.types";

/** Convert a semantic source graph into positioned React Flow nodes and edges. */
export function layoutSourceGraph(graph: SourceGraph): LayoutedSourceGraph {
  const layoutGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  layoutGraph.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 68, marginx: 28, marginy: 28 });

  for (const sourceNode of graph.nodes) {
    layoutGraph.setNode(sourceNode.id, {
      width: GRAPH_NODE_WIDTH,
      height: GRAPH_NODE_HEIGHT,
    });
  }
  for (const sourceEdge of graph.edges) {
    layoutGraph.setEdge(sourceEdge.source, sourceEdge.target);
  }
  dagre.layout(layoutGraph);

  const nodes: SourceGraphFlowNode[] = graph.nodes.map((sourceNode) => {
    const position = layoutGraph.node(sourceNode.id) as { readonly x: number; readonly y: number };
    return {
      id: sourceNode.id,
      type: "sourceGraph",
      data: { sourceNode },
      position: {
        x: position.x - GRAPH_NODE_WIDTH / 2,
        y: position.y - GRAPH_NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: false,
      selectable: true,
    };
  });
  const edges: SourceGraphFlowEdge[] = graph.edges.map((sourceEdge) => ({
    id: sourceEdge.id,
    source: sourceEdge.source,
    target: sourceEdge.target,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    className:
      sourceEdge.type === "renders"
        ? "renderEdge"
        : sourceEdge.type === "imports"
          ? "importEdge"
          : "containsEdge",
  }));

  return { nodes, edges };
}
