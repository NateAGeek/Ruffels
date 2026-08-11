import { render, screen } from "@testing-library/react";
import type { SourceNode } from "../SourceExplorer.types";
import { NodeInspector } from "./NodeInspector";

describe("NodeInspector", () => {
  it("should display function properties and expose an accessible close action", () => {
    const functionNode: SourceNode = {
      id: "functionDeclaration:1:60",
      astType: "Function",
      category: "declaration",
      label: "loadUser",
      declarationKind: "function",
      sourcePath: "service.ts",
      span: { startLine: 1, startColumn: 1, endLine: 3, endColumn: 2 },
      exported: true,
      parameters: [{ name: "id", typeAnnotation: "UserId" }],
      isAsync: true,
      isGenerator: false,
    };

    render(<NodeInspector node={functionNode} onClose={jest.fn()} />);

    expect(screen.getByRole("complementary", { name: "loadUser properties" })).toBeInTheDocument();
    expect(screen.getByText("id: UserId")).toBeInTheDocument();
    expect(screen.getByText("Async").nextElementSibling).toHaveTextContent("Yes");
    expect(screen.getByRole("button", { name: "Close node properties" })).toBeEnabled();
  });
});
