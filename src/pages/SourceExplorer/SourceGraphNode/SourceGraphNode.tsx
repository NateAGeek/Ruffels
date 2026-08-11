import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { SourceGraphFlowNode } from "../GraphCanvas/GraphCanvas.types";
import type { SourceNode } from "../SourceExplorer.types";
import styles from "./SourceGraphNode.module.scss";

function getNodeDetail(sourceNode: SourceNode): string {
  switch (sourceNode.category) {
    case "file":
      return "program";
    case "component":
      return `${sourceNode.componentKind} component`;
    case "declaration":
      return sourceNode.declarationKind;
    case "jsx":
      return sourceNode.elementKind ?? "fragment";
    case "renderExpression":
      return "render control";
    case "type":
      return "type";
  }
}

export function SourceGraphNode({ data }: NodeProps<SourceGraphFlowNode>): React.ReactElement {
  const { sourceNode } = data;

  return (
    <article className={`${styles.sourceGraphNode} ${styles[sourceNode.category]}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span className={styles.astType}>{sourceNode.astType}</span>
      <strong className={styles.label}>{sourceNode.label}</strong>
      <span className={styles.details}>
        {getNodeDetail(sourceNode)} · L{sourceNode.span.startLine}:{sourceNode.span.startColumn}
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </article>
  );
}
