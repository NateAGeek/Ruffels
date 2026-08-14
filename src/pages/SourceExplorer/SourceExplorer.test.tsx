import { render, screen } from "@testing-library/react";
import { SourceExplorerRender, type SourceExplorerRenderProps } from "./SourceExplorer";

const actions: Omit<SourceExplorerRenderProps, "state"> = {
  selectProject: jest.fn(),
  confirmInitialization: jest.fn(),
  cancelInitialization: jest.fn(),
  openRecentProject: jest.fn(),
  forgetRecentProject: jest.fn(),
  reindexProject: jest.fn(),
  includeProjectFile: jest.fn(),
  closeProject: jest.fn(),
};

describe("SourceExplorerRender", () => {
  it("invites the user to select a project", () => {
    render(<SourceExplorerRender {...actions} state={{ type: "idle", recents: [] }} />);
    expect(screen.getByRole("heading", { name: "Select a project folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open project" })).toBeEnabled();
  });

  it("announces indexing", () => {
    render(<SourceExplorerRender {...actions} state={{ type: "indexing", projectName: "demo" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Indexing demo");
    expect(screen.getByRole("button", { name: "Open project" })).toBeDisabled();
  });

  it("displays typed project errors", () => {
    render(
      <SourceExplorerRender
        {...actions}
        state={{ type: "error", error: { type: "noEntryPoints" }, recents: [] }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No TypeScript entry points");
  });
});
