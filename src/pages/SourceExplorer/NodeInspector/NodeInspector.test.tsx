import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import type { SourceNode } from "../SourceExplorer.types";
import { NodeInspector } from "./NodeInspector";

jest.mock("@tauri-apps/api/core", () => ({ invoke: jest.fn() }));

describe("NodeInspector", () => {
  it("should display function properties and open its source location", async () => {
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

    jest.mocked(invoke).mockResolvedValue({ type: "success", data: undefined });
    const user = userEvent.setup();
    render(<NodeInspector node={functionNode} projectRoot="C:\\project" onClose={jest.fn()} />);

    expect(screen.getByRole("complementary", { name: "loadUser properties" })).toBeInTheDocument();
    expect(screen.getByText("id: UserId")).toBeInTheDocument();
    expect(screen.getByText("Async").nextElementSibling).toHaveTextContent("Yes");
    expect(screen.getByRole("button", { name: "Close node properties" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Open service\.ts at 1:1/ })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /Open service\.ts at 1:1/ }));
    expect(invoke).toHaveBeenCalledWith(
      "open_source_file",
      expect.objectContaining({
        sourcePath: "service.ts",
        startLine: 1,
        startColumn: 1,
      }),
    );
  });
});
