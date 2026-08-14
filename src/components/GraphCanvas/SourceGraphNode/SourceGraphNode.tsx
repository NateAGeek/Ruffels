import { Handle, Position, type NodeProps } from "@xyflow/react";
import type {
  SourceNode,
  SourceTypeKind,
} from "../../../pages/SourceExplorer/SourceExplorer.types";
import styles from "./SourceGraphNode.module.scss";
import { SourceGraphFlowNode } from "../GraphCanvas.types";

const typeKindLabels: Record<SourceTypeKind, string> = {
  primitive: "Primitive type",
  compound: "Compound type",
  declared: "Declared type",
};

const typeKindClasses: Record<SourceTypeKind, string> = {
  primitive: styles.primitiveType,
  compound: styles.compoundType,
  declared: styles.declaredType,
};

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
    case "invocation":
      return "function call";
    case "type":
      return "type";
    case "externalDependency":
      return `external · ${sourceNode.packageName}`;
  }
}

export function SourceGraphNode({ data }: NodeProps<SourceGraphFlowNode>): React.ReactElement {
  const { sourceNode } = data;
  const typeClass =
    sourceNode.category === "type" ? ` ${typeKindClasses[sourceNode.typeKind]}` : "";
  const location =
    sourceNode.category === "externalDependency"
      ? ""
      : ` · L${sourceNode.span.startLine}:${sourceNode.span.startColumn}`;
  return (
    <article className={`${styles.sourceGraphNode} ${styles[sourceNode.category]}${typeClass}`}>
      <Handle
        type="target"
        position={sourceNode.category === "type" ? Position.Bottom : Position.Top}
        isConnectable={false}
      />
      {sourceNode.category === "type" ? (
        <>
          <div className={styles.typeHeader}>
            <span className={styles.typeKind}>{typeKindLabels[sourceNode.typeKind]}</span>
            <span className={styles.astType}>{sourceNode.astType}</span>
          </div>
          <div className={styles.typeSignature}>
            <strong className={styles.typeName}>{sourceNode.typeName}</strong>
            <span className={styles.typeSeparator}>:</span>
            <code className={styles.typeValue}>{sourceNode.typeValue}</code>
          </div>
          <span className={styles.details}>{location.replace(" · ", "")}</span>
        </>
      ) : (
        <>
          <span className={styles.astType}>{sourceNode.astType}</span>
          <strong className={styles.label}>{sourceNode.label}</strong>
          <span className={styles.details}>
            {getNodeDetail(sourceNode)}
            {location}
          </span>
        </>
      )}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </article>
  );
}
