import type { Edge, Node } from "@xyflow/react";
import { SourceNode } from "../../pages/SourceExplorer";

export type SourceGraphNodeData = {
  readonly sourceNode: SourceNode;
} & Record<string, unknown>;

export type SourceGraphFlowNode = Node<SourceGraphNodeData, "sourceGraph">;
export type SourceGraphFlowEdge = Edge<Record<string, never>, "smoothstep">;

export interface GraphNodeTypeOption {
  readonly astType: SourceNode["astType"];
  readonly count: number;
}

export interface LayoutedSourceGraph {
  readonly nodes: ReadonlyArray<SourceGraphFlowNode>;
  readonly edges: ReadonlyArray<SourceGraphFlowEdge>;
}
