import { render, screen } from "@testing-library/react";
import { SourceExplorerRender } from "./SourceExplorer";

describe("SourceExplorerRender", () => {
  it("should invite the user to select a source file", () => {
    render(<SourceExplorerRender state={{ type: "idle" }} onSelectSourceFile={jest.fn()} />);

    expect(screen.getByRole("heading", { name: "Select a source file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open TS or TSX" })).toBeEnabled();
  });

  it("should disable selection and announce parsing while loading", () => {
    render(<SourceExplorerRender state={{ type: "loading" }} onSelectSourceFile={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("building its typed graph");
  });

  it("should display typed analysis errors", () => {
    render(
      <SourceExplorerRender
        state={{ type: "error", error: { type: "invalidExtension" } }}
        onSelectSourceFile={jest.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a TypeScript or TSX file");
  });
});
