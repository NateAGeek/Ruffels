import { render, screen } from "@testing-library/react";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

describe("DiagnosticsPanel", () => {
  it("should render nothing when parsing has no diagnostics", () => {
    const { container } = render(<DiagnosticsPanel diagnostics={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("should display messages with accessible source locations", () => {
    render(
      <DiagnosticsPanel
        diagnostics={[
          {
            severity: "error",
            message: "Unexpected token",
            span: { startLine: 4, startColumn: 9, endLine: 4, endColumn: 10 },
          },
        ]}
      />,
    );

    expect(screen.getByRole("complementary", { name: "Parser diagnostics" })).toHaveTextContent(
      "L4:9",
    );
    expect(screen.getByText("Unexpected token")).toBeInTheDocument();
  });
});
