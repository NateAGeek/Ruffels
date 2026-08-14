import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { FilePreview } from "./FilePreview";

jest.mock("@tauri-apps/api/core", () => ({ invoke: jest.fn() }));

describe("FilePreview", () => {
  it("renders unsupported project files read-only with Shiki", async () => {
    jest.mocked(invoke).mockResolvedValue({
      type: "success",
      data: { path: "README.md", content: "# Preview", language: "markdown" },
    });
    render(
      <FilePreview
        projectRoot="C:\\project"
        file={{
          path: "README.md",
          sourceType: null,
          fingerprint: null,
          diagnosticCount: 0,
          isEntryPoint: false,
          isIndexed: false,
        }}
        onClose={jest.fn()}
        onInclude={jest.fn()}
      />,
    );

    expect(await screen.findByText("# Preview")).toBeInTheDocument();
    expect(screen.getByText("Read-only preview")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Include in graph" })).not.toBeInTheDocument();
  });

  it("allows supported unindexed files to be included in the graph", async () => {
    jest.mocked(invoke).mockResolvedValue({
      type: "success",
      data: { path: "src/orphan.ts", content: "export {};", language: "typescript" },
    });
    const onInclude = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <FilePreview
        projectRoot="C:\\project"
        file={{
          path: "src/orphan.ts",
          sourceType: "typeScript",
          fingerprint: null,
          diagnosticCount: 0,
          isEntryPoint: false,
          isIndexed: false,
        }}
        onClose={jest.fn()}
        onInclude={onInclude}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Include in graph" }));
    await waitFor(() => expect(onInclude).toHaveBeenCalledWith("src/orphan.ts"));
  });
});
