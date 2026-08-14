import type { SourceGraph } from "../../pages/SourceExplorer/SourceExplorer.types";
import {
  filterSourceGraphByFile,
  filterSourceGraphByNodeTypes,
  filterSourceGraphByQuery,
  getGraphNodeTypeOptions,
  layoutSourceGraph,
} from "./GraphCanvas.utils";

describe("layoutSourceGraph", () => {
  it("should list each AST node type with its count", () => {
    const graph: SourceGraph = {
      sourcePath: "C:\\project",
      sourceType: "typeScript",
      nodes: [
        {
          id: "program-a",
          astType: "Program",
          category: "file",
          label: "a.ts",
          sourcePath: "src/a.ts",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        },
        {
          id: "program-b",
          astType: "Program",
          category: "file",
          label: "b.ts",
          sourcePath: "src/b.ts",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        },
        {
          id: "button",
          astType: "JSXElement",
          category: "jsx",
          label: "<button>",
          sourcePath: "src/a.ts",
          span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 10 },
        },
        {
          id: "b-variable",
          astType: "VariableDeclaration",
          category: "declaration",
          declarationKind: "variable",
          label: "onlyInB",
          sourcePath: "src/b.ts",
          span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 10 },
        },
      ],
      edges: [],
      diagnostics: [],
    };

    expect(getGraphNodeTypeOptions(graph, "src/a.ts")).toEqual([
      { astType: "JSXElement", count: 1 },
      { astType: "Program", count: 1 },
    ]);
  });

  it("should retain only the selected AST node types and their connecting edges", () => {
    const graph: SourceGraph = {
      sourcePath: "src/example.tsx",
      sourceType: "tsx",
      nodes: [
        {
          id: "program",
          astType: "Program",
          category: "file",
          label: "example.tsx",
          sourcePath: "src/example.tsx",
          span: { startLine: 1, startColumn: 1, endLine: 3, endColumn: 1 },
        },
        {
          id: "button",
          astType: "JSXElement",
          category: "jsx",
          label: "<button>",
          sourcePath: "src/example.tsx",
          span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 10 },
        },
      ],
      edges: [{ id: "program->button", source: "program", target: "button", type: "renders" }],
      diagnostics: [],
    };

    const filtered = filterSourceGraphByNodeTypes(graph, new Set(["JSXElement"]));

    expect(filtered.nodes.map((node) => node.id)).toEqual(["button"]);
    expect(filtered.edges).toEqual([]);
  });

  it("should search node labels AST types and source paths without case sensitivity", () => {
    const graph: SourceGraph = {
      sourcePath: "src",
      sourceType: "tsx",
      nodes: [
        {
          id: "button",
          astType: "JSXElement",
          category: "jsx",
          label: "<button>",
          sourcePath: "src/Actions.tsx",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
        },
        {
          id: "handler",
          astType: "Function",
          category: "declaration",
          declarationKind: "function",
          label: "handleSave",
          sourcePath: "src/Actions.tsx",
          span: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 10 },
        },
      ],
      edges: [],
      diagnostics: [],
    };

    expect(filterSourceGraphByQuery(graph, "jsxelement").nodes.map((node) => node.id)).toEqual([
      "button",
    ]);
    expect(filterSourceGraphByQuery(graph, "SAVE").nodes.map((node) => node.id)).toEqual([
      "handler",
    ]);
    expect(filterSourceGraphByQuery(graph, "actions.tsx").nodes).toHaveLength(2);
  });

  it("should preserve typed nodes and edges without mutating the source graph", () => {
    const graph: SourceGraph = {
      sourcePath: "Component.tsx",
      sourceType: "tsx",
      nodes: [
        {
          id: "module:1:40",
          astType: "Program",
          category: "file",
          label: "Component.tsx",
          sourcePath: "Component.tsx",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 40 },
        },
        {
          id: "jsxElement:20:35",
          astType: "JSXElement",
          category: "jsx",
          label: "<main>",
          elementKind: "intrinsic",
          tagName: "main",
          sourcePath: "Component.tsx",
          span: { startLine: 1, startColumn: 20, endLine: 1, endColumn: 35 },
        },
      ],
      edges: [
        {
          id: "module:1:40->jsxElement:20:35",
          source: "module:1:40",
          target: "jsxElement:20:35",
          type: "renders",
        },
      ],
      diagnostics: [],
    };
    const originalGraphJson = JSON.stringify(graph);

    const layoutedGraph = layoutSourceGraph(graph);

    expect(layoutedGraph.nodes).toHaveLength(2);
    expect(layoutedGraph.nodes[1].data.sourceNode.astType).toBe("JSXElement");
    expect(layoutedGraph.edges[0]).toEqual(
      expect.objectContaining({
        id: "module:1:40->jsxElement:20:35",
        source: "module:1:40",
        target: "jsxElement:20:35",
      }),
    );
    expect(JSON.stringify(graph)).toBe(originalGraphJson);
  });

  it("should isolate nodes and edges belonging to one file", () => {
    const graph: SourceGraph = {
      sourcePath: "C:\\project",
      sourceType: "typeScript",
      nodes: [
        {
          id: "a",
          astType: "Program",
          category: "file",
          label: "a.ts",
          sourcePath: "src/a.ts",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        },
        {
          id: "a-value",
          astType: "VariableDeclarator",
          category: "declaration",
          declarationKind: "variable",
          label: "a",
          sourcePath: "src/a.ts",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
        },
        {
          id: "b",
          astType: "Program",
          category: "file",
          label: "b.ts",
          sourcePath: "src/b.ts",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        },
      ],
      edges: [
        { id: "a-contained", source: "a", target: "a-value", type: "contains" },
        { id: "a-imports-b", source: "a", target: "b", type: "imports" },
      ],
      diagnostics: [],
    };

    const filtered = filterSourceGraphByFile(graph, "src/a.ts");

    expect(filtered.nodes.map((node) => node.id)).toEqual(["a", "a-value"]);
    expect(filtered.edges.map((edge) => edge.id)).toEqual(["a-contained"]);
    expect(graph.nodes).toHaveLength(3);
  });

  it("should place draggable type nodes above the runtime AST", () => {
    const graph: SourceGraph = {
      sourcePath: "types.ts",
      sourceType: "typeScript",
      nodes: [
        {
          id: "program",
          astType: "Program",
          category: "file",
          label: "types.ts",
          sourcePath: "types.ts",
          span: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 1 },
        },
        {
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
      ],
      edges: [{ id: "program->user-id", source: "program", target: "user-id", type: "contains" }],
      diagnostics: [],
    };

    const layoutedGraph = layoutSourceGraph(graph);
    const programNode = layoutedGraph.nodes.find((node) => node.id === "program");
    const typeNode = layoutedGraph.nodes.find((node) => node.id === "user-id");

    expect(typeNode?.position.y).toBeLessThan(programNode?.position.y ?? 0);
    expect(layoutedGraph.nodes.every((node) => node.draggable)).toBe(true);
  });

  it("should separate declared compound and primitive type lanes", () => {
    const typeNode = (
      id: string,
      typeKind: "declared" | "compound" | "primitive",
    ): SourceGraph["nodes"][number] => ({
      id,
      astType: "TSTypeAliasDeclaration",
      category: "type",
      label: id,
      typeKind,
      typeName: typeKind,
      typeValue: id,
      sourcePath: "types.ts",
      span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
    });
    const graph: SourceGraph = {
      sourcePath: "types.ts",
      sourceType: "typeScript",
      nodes: [
        typeNode("declared", "declared"),
        typeNode("compound", "compound"),
        typeNode("primitive", "primitive"),
        {
          id: "program",
          astType: "Program",
          category: "file",
          label: "types.ts",
          sourcePath: "types.ts",
          span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
        },
      ],
      edges: [],
      diagnostics: [],
    };

    const nodes = new Map(layoutSourceGraph(graph).nodes.map((node) => [node.id, node]));

    expect(nodes.get("declared")?.position.y).toBeLessThan(nodes.get("compound")?.position.y ?? 0);
    expect(nodes.get("compound")?.position.y).toBeLessThan(nodes.get("primitive")?.position.y ?? 0);
    expect(nodes.get("primitive")?.position.y).toBeLessThan(nodes.get("program")?.position.y ?? 0);
  });
});
