import dagre from "@dagrejs/dagre";
import { MarkerType, Position } from "@xyflow/react";
import type { SourceGraph, SourceNode } from "../../pages/SourceExplorer/SourceExplorer.types";
import {
  GRAPH_MARGIN,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_SEPARATION,
  GRAPH_NODE_WIDTH,
  GRAPH_RANK_SEPARATION,
  TYPE_GRAPH_NODE_HEIGHTS,
  TYPE_GRAPH_NODE_WIDTHS,
  TYPE_GRAPH_SEPARATION,
  TYPE_KIND_ORDER,
  TYPE_LANE_SEPARATION,
} from "./GraphCanvas.constants";
import type {
  GraphNodeTypeOption,
  LayoutedSourceGraph,
  SourceGraphFlowEdge,
  SourceGraphFlowNode,
} from "./GraphCanvas.types";

/** List the AST types present in a graph with their node counts. */
export function getGraphNodeTypeOptions(
  graph: SourceGraph,
  sourcePath: string | null,
): ReadonlyArray<GraphNodeTypeOption> {
  const nodeTypeCounts = new Map<GraphNodeTypeOption["astType"], number>();
  for (const sourceNode of graph.nodes) {
    if (sourcePath !== null && sourceNode.sourcePath !== sourcePath) {
      continue;
    }
    nodeTypeCounts.set(sourceNode.astType, (nodeTypeCounts.get(sourceNode.astType) ?? 0) + 1);
  }

  return [...nodeTypeCounts.entries()]
    .map(([astType, count]) => ({ astType, count }))
    .sort((left, right) => left.astType.localeCompare(right.astType));
}

/** Convert a semantic source graph into positioned React Flow nodes and edges. */
export function layoutSourceGraph(graph: SourceGraph): LayoutedSourceGraph {
  const layoutGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const typeNodes = graph.nodes.filter((sourceNode) => sourceNode.category === "type");
  const typeLanes = TYPE_KIND_ORDER.map((typeKind) => ({
    typeKind,
    nodes: typeNodes.filter((sourceNode) => sourceNode.typeKind === typeKind),
  })).filter((typeLane) => typeLane.nodes.length > 0);
  const typeLaneOffsets = new Map<string, number>();
  let nextTypeLaneOffset = GRAPH_MARGIN;
  for (const typeLane of typeLanes) {
    typeLaneOffsets.set(typeLane.typeKind, nextTypeLaneOffset);
    nextTypeLaneOffset += TYPE_GRAPH_NODE_HEIGHTS[typeLane.typeKind] + TYPE_LANE_SEPARATION;
  }
  const astNodes = graph.nodes.filter((sourceNode) => sourceNode.category !== "type");
  const astNodeIds = new Set(astNodes.map((sourceNode) => sourceNode.id));
  const astMarginTop =
    typeNodes.length === 0
      ? GRAPH_MARGIN
      : nextTypeLaneOffset - TYPE_LANE_SEPARATION + TYPE_GRAPH_SEPARATION;
  layoutGraph.setGraph({
    rankdir: "TB",
    nodesep: GRAPH_NODE_SEPARATION,
    ranksep: GRAPH_RANK_SEPARATION,
    marginx: GRAPH_MARGIN,
    marginy: astMarginTop,
  });

  for (const sourceNode of astNodes) {
    layoutGraph.setNode(sourceNode.id, {
      width: GRAPH_NODE_WIDTH,
      height: GRAPH_NODE_HEIGHT,
    });
  }
  for (const sourceEdge of graph.edges) {
    if (astNodeIds.has(sourceEdge.source) && astNodeIds.has(sourceEdge.target)) {
      layoutGraph.setEdge(sourceEdge.source, sourceEdge.target);
    }
  }
  dagre.layout(layoutGraph);

  const nodes: SourceGraphFlowNode[] = graph.nodes.map((sourceNode) => {
    if (sourceNode.category === "type") {
      const typeLane = typeLanes.find((lane) => lane.typeKind === sourceNode.typeKind);
      const typeIndex = typeLane?.nodes.findIndex((typeNode) => typeNode.id === sourceNode.id) ?? 0;
      return {
        id: sourceNode.id,
        type: "sourceGraph",
        data: { sourceNode },
        position: {
          x:
            GRAPH_MARGIN +
            typeIndex * (TYPE_GRAPH_NODE_WIDTHS[sourceNode.typeKind] + GRAPH_NODE_SEPARATION),
          y: typeLaneOffsets.get(sourceNode.typeKind) ?? GRAPH_MARGIN,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Bottom,
        draggable: true,
        selectable: true,
      };
    }

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
      draggable: true,
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

/** Return the self-contained AST/render graph for one project file. */
export function filterSourceGraphByFile(graph: SourceGraph, sourcePath: string): SourceGraph {
  const nodes = graph.nodes.filter(
    (node) => node.category !== "externalDependency" && node.sourcePath === sourcePath,
  );
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    diagnostics: graph.diagnostics.filter((diagnostic) => diagnostic.sourcePath === sourcePath),
  };
}

/** Return the graph nodes matching the selected AST types. */
export function filterSourceGraphByNodeTypes(
  graph: SourceGraph,
  astTypes: ReadonlySet<SourceNode["astType"]>,
): SourceGraph {
  const nodes = graph.nodes.filter((sourceNode) => astTypes.has(sourceNode.astType));
  const nodeIds = new Set(nodes.map((sourceNode) => sourceNode.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter(
      (sourceEdge) => nodeIds.has(sourceEdge.source) && nodeIds.has(sourceEdge.target),
    ),
  };
}

/** Return graph nodes whose visible identity matches a case-insensitive query. */
export function filterSourceGraphByQuery(graph: SourceGraph, query: string): SourceGraph {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery === "") {
    return graph;
  }

  const nodes = graph.nodes.filter((sourceNode) =>
    [sourceNode.label, sourceNode.astType, sourceNode.sourcePath].some((searchValue) =>
      searchValue.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
  const nodeIds = new Set(nodes.map((sourceNode) => sourceNode.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter(
      (sourceEdge) => nodeIds.has(sourceEdge.source) && nodeIds.has(sourceEdge.target),
    ),
  };
}
