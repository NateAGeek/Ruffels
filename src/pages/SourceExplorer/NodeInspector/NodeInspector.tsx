import type { SourceNode } from "../SourceExplorer.types";
import styles from "./NodeInspector.module.scss";

export interface NodeInspectorProps {
  readonly node: SourceNode;
  readonly onClose: () => void;
}

interface PropertyRow {
  readonly label: string;
  readonly value: string;
}

function getNodeProperties(node: SourceNode): ReadonlyArray<PropertyRow> {
  const properties: PropertyRow[] = [
    { label: "AST type", value: node.astType },
    { label: "Category", value: node.category },
    { label: "Source file", value: node.sourcePath },
    {
      label: "Location",
      value: `${node.span.startLine}:${node.span.startColumn}–${node.span.endLine}:${node.span.endColumn}`,
    },
  ];

  if (node.exported !== undefined) {
    properties.push({ label: "Exported", value: node.exported ? "Yes" : "No" });
  }

  switch (node.category) {
    case "file":
      properties.push({ label: "Program", value: "Program" });
      break;
    case "component":
      properties.push({ label: "Component kind", value: node.componentKind });
      break;
    case "declaration":
      properties.push({ label: "Declaration kind", value: node.declarationKind });
      break;
    case "jsx":
      if (node.elementKind !== undefined && node.tagName !== undefined) {
        properties.push(
          { label: "Element kind", value: node.elementKind },
          { label: "Tag", value: node.tagName },
        );
      }
      break;
    case "renderExpression":
      break;
    case "type":
      break;
  }

  if (node.parameters !== undefined) {
    properties.push(
      {
        label: "Parameters",
        value:
          node.parameters.length === 0
            ? "None"
            : node.parameters
                .map((parameter) =>
                  parameter.typeAnnotation === undefined
                    ? parameter.name
                    : `${parameter.name}: ${parameter.typeAnnotation}`,
                )
                .join(", "),
      },
      { label: "Async", value: node.isAsync ? "Yes" : "No" },
      { label: "Generator", value: node.isGenerator ? "Yes" : "No" },
    );
  }

  if (node.isStatic !== undefined) {
    properties.push({ label: "Static", value: node.isStatic ? "Yes" : "No" });
  }

  return properties;
}

export function NodeInspector({ node, onClose }: NodeInspectorProps): React.ReactElement {
  return (
    <aside className={styles.nodeInspector} aria-label={`${node.label} properties`}>
      <header className={styles.header}>
        <div>
          <span>Selected node</span>
          <h3>{node.label}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close node properties">
          ×
        </button>
      </header>
      <dl className={styles.properties}>
        {getNodeProperties(node).map((property) => (
          <div key={property.label}>
            <dt>{property.label}</dt>
            <dd>{property.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.nodeId}>
        <span>Node ID</span>
        <code>{node.id}</code>
      </div>
    </aside>
  );
}
