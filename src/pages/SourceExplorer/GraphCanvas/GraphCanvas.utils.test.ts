import type { SourceGraph } from "../SourceExplorer.types";
import { layoutSourceGraph } from "./GraphCanvas.utils";

describe("layoutSourceGraph", () => {
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
});
