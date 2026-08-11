import type { AnalysisError } from "../SourceExplorer.types";

/** Convert a typed backend analysis error into user-facing copy. */
export function getAnalysisErrorMessage(error: AnalysisError): string {
  switch (error.type) {
    case "invalidExtension":
      return "Choose a TypeScript or TSX file.";
    case "notAFile":
      return "The selected path is not a file.";
    case "readFailed":
    case "parseFailed":
      return error.message;
  }
}
