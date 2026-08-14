import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphToolbar } from "./GraphToolbar";

describe("GraphToolbar", () => {
  it("should expose search node type and file controls", async () => {
    const handleQueryChange = jest.fn();
    const handleNodeTypeToggle = jest.fn();
    const handleSourcePathChange = jest.fn();
    const user = userEvent.setup();

    render(
      <GraphToolbar
        files={[
          {
            path: "src/App.tsx",
            sourceType: "tsx",
            fingerprint: "app",
            diagnosticCount: 0,
            isEntryPoint: true,
            isIndexed: true,
          },
        ]}
        nodeTypeOptions={[
          { astType: "JSXElement", count: 3 },
          { astType: "Program", count: 1 },
        ]}
        query=""
        selectedSourcePath={null}
        selectedAstTypes={new Set(["JSXElement", "Program"])}
        visibleNodeCount={4}
        totalNodeCount={4}
        onQueryChange={handleQueryChange}
        onNodeTypeToggle={handleNodeTypeToggle}
        onNodeTypesVisibilityChange={jest.fn()}
        onSourcePathChange={handleSourcePathChange}
        onReset={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("searchbox", { name: "Search graph" }));
    await user.paste("jsx");
    await user.selectOptions(screen.getByRole("combobox", { name: "Focus file" }), "src/App.tsx");
    await user.click(screen.getByRole("checkbox", { name: "JSXElement (3)" }));

    expect(handleQueryChange).toHaveBeenLastCalledWith("jsx");
    expect(handleSourcePathChange).toHaveBeenCalledWith("src/App.tsx");
    expect(handleNodeTypeToggle).toHaveBeenCalledWith("JSXElement");
    expect(screen.getByText("4 of 4 nodes")).toBeInTheDocument();
  });

  it("should search available node types and uncheck them all", async () => {
    const handleNodeTypesVisibilityChange = jest.fn();
    const user = userEvent.setup();

    render(
      <GraphToolbar
        files={[]}
        nodeTypeOptions={[
          { astType: "JSXElement", count: 3 },
          { astType: "Program", count: 1 },
          { astType: "TSTypeAnnotation", count: 0 },
        ]}
        query=""
        selectedSourcePath={null}
        selectedAstTypes={new Set(["JSXElement", "Program"])}
        visibleNodeCount={4}
        totalNodeCount={4}
        onQueryChange={jest.fn()}
        onNodeTypeToggle={jest.fn()}
        onNodeTypesVisibilityChange={handleNodeTypesVisibilityChange}
        onSourcePathChange={jest.fn()}
        onReset={jest.fn()}
      />,
    );

    await user.click(screen.getByText("Types"));
    await user.type(screen.getByRole("searchbox", { name: "Search node types" }), "program");

    expect(screen.getByRole("checkbox", { name: "Program (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "JSXElement (3)" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "TSTypeAnnotation (0)" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Uncheck all node types" }));

    expect(handleNodeTypesVisibilityChange).toHaveBeenCalledWith(["JSXElement", "Program"], false);
  });
});
