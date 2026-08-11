export type SourceNodeCategory =
  | "file"
  | "component"
  | "declaration"
  | "jsx"
  | "renderExpression"
  | "type";

export interface SourceParameter {
  readonly name: string;
  readonly typeAnnotation?: string;
}

export interface SourceSpan {
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

export interface SourceNodeBase {
  readonly id: string;
  /** The exact Oxc `AstType` debug name produced by `AstKind::ty()`. */
  readonly astType: string;
  readonly category: SourceNodeCategory;
  readonly label: string;
  readonly span: SourceSpan;
  readonly sourcePath: string;
  readonly exported?: boolean;
  readonly parameters?: ReadonlyArray<SourceParameter>;
  readonly isAsync?: boolean;
  readonly isGenerator?: boolean;
  readonly isStatic?: boolean;
}

export type FileNode = SourceNodeBase & {
  readonly category: "file";
};

export type ComponentNode = SourceNodeBase & {
  readonly category: "component";
  readonly componentKind: "function" | "class" | "arrow";
};

export type DeclarationNode = SourceNodeBase & {
  readonly category: "declaration";
  readonly declarationKind: string;
};

export type JsxNode = SourceNodeBase & {
  readonly category: "jsx";
  readonly elementKind?: "intrinsic" | "component";
  readonly tagName?: string;
};

export type RenderExpressionNode = SourceNodeBase & {
  readonly category: "renderExpression";
};

export type TypeNode = SourceNodeBase & {
  readonly category: "type";
};

export type SourceNode =
  | FileNode
  | ComponentNode
  | DeclarationNode
  | JsxNode
  | RenderExpressionNode
  | TypeNode;

export interface SourceEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: "contains" | "renders" | "imports";
}

export interface SourceDiagnostic {
  readonly severity: "error";
  readonly message: string;
  readonly span: SourceSpan;
}

export interface SourceGraph {
  readonly sourcePath: string;
  readonly sourceType: "typeScript" | "tsx";
  readonly nodes: ReadonlyArray<SourceNode>;
  readonly edges: ReadonlyArray<SourceEdge>;
  readonly diagnostics: ReadonlyArray<SourceDiagnostic>;
}

export type AnalysisError =
  | { readonly type: "invalidExtension" }
  | { readonly type: "notAFile" }
  | { readonly type: "readFailed"; readonly message: string }
  | { readonly type: "parseFailed"; readonly message: string };

export type AnalyzeSourceResponse =
  | { readonly type: "success"; readonly graph: SourceGraph }
  | { readonly type: "error"; readonly error: AnalysisError };
