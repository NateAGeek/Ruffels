import { render, screen } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { SourceGraphNode } from "./SourceGraphNode";
import type { SourceGraphFlowNode } from "../GraphCanvas.types";

describe("SourceGraphNode", () => {
  it("should display a named type as type name colon type value", () => {
    const node = {
      id: "user-id",
      type: "sourceGraph",
      data: {
        sourceNode: {
          id: "user-id",
          astType: "TSTypeAliasDeclaration",
          category: "type",
          label: "UserId",
          typeKind: "declared",
          typeName: "UserId",
          typeValue: "string | number",
          sourcePath: "types.ts",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 37 },
        },
      },
      selected: false,
      dragging: false,
      draggable: true,
      selectable: true,
      deletable: false,
      isConnectable: false,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
      zIndex: 0,
    } satisfies NodeProps<SourceGraphFlowNode>;

    render(
      <ReactFlowProvider>
        <SourceGraphNode {...node} />
      </ReactFlowProvider>,
    );

    expect(screen.getByText("UserId")).toBeInTheDocument();
    expect(screen.getByText(":")).toBeInTheDocument();
    expect(screen.getByText("string | number")).toBeInTheDocument();
    expect(screen.getByText("Declared type")).toBeInTheDocument();
  });
});
