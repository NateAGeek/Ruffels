import type { Edge, Node } from "@xyflow/react";
import type { SourceNode } from "../SourceExplorer.types";

export type SourceGraphNodeData = {
  readonly sourceNode: SourceNode;
} & Record<string, unknown>;

export type SourceGraphFlowNode = Node<SourceGraphNodeData, "sourceGraph">;
export type SourceGraphFlowEdge = Edge<Record<string, never>, "smoothstep">;

export interface LayoutedSourceGraph {
  readonly nodes: ReadonlyArray<SourceGraphFlowNode>;
  readonly edges: ReadonlyArray<SourceGraphFlowEdge>;
}
