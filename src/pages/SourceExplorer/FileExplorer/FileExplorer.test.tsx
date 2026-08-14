import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FileSummary } from "../SourceExplorer.types";
import { FileExplorer } from "./FileExplorer";

const files: ReadonlyArray<FileSummary> = [
  {
    path: "src/main.ts",
    sourceType: "typeScript",
    fingerprint: "a",
    diagnosticCount: 0,
    isEntryPoint: true,
    isIndexed: true,
  },
  {
    path: "src/models/user.ts",
    sourceType: "typeScript",
    fingerprint: "b",
    diagnosticCount: 1,
    isEntryPoint: false,
    isIndexed: true,
  },
  {
    path: "src/orphan.ts",
    sourceType: "typeScript",
    fingerprint: null,
    diagnosticCount: 0,
    isEntryPoint: false,
    isIndexed: false,
  },
  {
    path: "README.md",
    sourceType: null,
    fingerprint: null,
    diagnosticCount: 0,
    isEntryPoint: false,
    isIndexed: false,
  },
];

describe("FileExplorer", () => {
  it("selects the project root and individual files", async () => {
    const user = userEvent.setup();
    const onSelectPath = jest.fn();
    const onHide = jest.fn();
    render(
      <FileExplorer
        projectName="demo"
        files={files}
        selectedPath={null}
        onSelectPath={onSelectPath}
        onHide={onHide}
      />,
    );

    expect(screen.getByRole("button", { name: /demo/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /main\.ts/ }));
    expect(onSelectPath).toHaveBeenCalledWith("src/main.ts");
    expect(screen.getByRole("button", { name: /orphan\.ts/ })).toHaveAttribute(
      "data-indexed",
      "false",
    );
    expect(screen.getByRole("button", { name: /README\.md/ })).toHaveAttribute(
      "data-supported",
      "false",
    );
    await user.click(screen.getByRole("button", { name: /README\.md/ }));
    expect(onSelectPath).toHaveBeenCalledWith("README.md");
    await user.click(screen.getByRole("button", { name: /demo/ }));
    expect(onSelectPath).toHaveBeenCalledWith(null);
    await user.click(screen.getByRole("button", { name: "Hide file explorer" }));
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
