import type { AstType } from "./AstType";

export type SourceNodeCategory =
  | "file"
  | "component"
  | "declaration"
  | "jsx"
  | "renderExpression"
  | "invocation"
  | "type"
  | "externalDependency";

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

export interface SourceNodeBase<TAstType extends AstType | "ExternalDependency" = AstType> {
  readonly id: string;
  /** The exact name produced by the backend's exhaustive `AstKind` conversion. */
  readonly astType: TAstType;
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

export type InvocationNode = SourceNodeBase & {
  readonly category: "invocation";
};

export type SourceTypeKind = "primitive" | "compound" | "declared";

export type TypeNode = SourceNodeBase & {
  readonly category: "type";
  readonly typeKind: SourceTypeKind;
  readonly typeName: string;
  readonly typeValue: string;
};

export type ExternalDependencyNode = SourceNodeBase<"ExternalDependency"> & {
  readonly category: "externalDependency";
  readonly packageName: string;
  readonly specifier: string;
};

export type SourceNode =
  | FileNode
  | ComponentNode
  | DeclarationNode
  | JsxNode
  | RenderExpressionNode
  | InvocationNode
  | TypeNode
  | ExternalDependencyNode;

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
  readonly sourcePath?: string;
}

export interface SourceGraph {
  readonly sourcePath: string;
  readonly sourceType: "typeScript" | "tsx";
  readonly nodes: ReadonlyArray<SourceNode>;
  readonly edges: ReadonlyArray<SourceEdge>;
  readonly diagnostics: ReadonlyArray<SourceDiagnostic>;
}

export interface ProjectFeatures {
  readonly externalDependencies: boolean;
}

export interface ProjectConfig {
  readonly schemaVersion: number;
  readonly entryPoints: ReadonlyArray<string>;
  readonly ignore: ReadonlyArray<string>;
  readonly features: ProjectFeatures;
  readonly maxFiles: number;
}

export interface ProjectSummary {
  readonly root: string;
  readonly name: string;
  readonly configPath: string;
}

export interface InitializationProposal {
  readonly project: ProjectSummary;
  readonly config: ProjectConfig;
  readonly detectedEntryPoints: ReadonlyArray<string>;
  readonly filesToCreate: ReadonlyArray<string>;
  readonly requiresEntrySelection: boolean;
}

export type ProjectInspection =
  | { readonly type: "initialized"; readonly project: ProjectSummary }
  | { readonly type: "needsInitialization"; readonly proposal: InitializationProposal };

export interface FileSummary {
  readonly path: string;
  readonly sourceType: "typeScript" | "tsx" | null;
  readonly fingerprint: string | null;
  readonly diagnosticCount: number;
  readonly isEntryPoint: boolean;
  readonly isIndexed: boolean;
}

export interface ProjectFileContent {
  readonly path: string;
  readonly content: string;
  readonly language: string;
}

export interface IndexStats {
  readonly fileCount: number;
  readonly reusedFiles: number;
  readonly parsedFiles: number;
  readonly externalDependencyCount: number;
}

export interface ProjectIndex {
  readonly project: ProjectSummary;
  readonly entryPoints: ReadonlyArray<string>;
  readonly files: ReadonlyArray<FileSummary>;
  readonly graph: SourceGraph;
  readonly stats: IndexStats;
}

export interface RecentProject {
  readonly root: string;
  readonly name: string;
  readonly lastOpenedAt: number;
  readonly available: boolean;
}

export type ProjectError =
  | { readonly type: "invalidRoot" }
  | { readonly type: "notInitialized" }
  | { readonly type: "invalidConfig"; readonly message: string }
  | { readonly type: "noEntryPoints" }
  | { readonly type: "entryOutsideRoot"; readonly path: string }
  | { readonly type: "fileLimitExceeded"; readonly limit: number }
  | { readonly type: "ioFailed"; readonly message: string }
  | { readonly type: "analysisFailed"; readonly path: string; readonly message: string };

export type ProjectCommandResponse<T> =
  | { readonly type: "success"; readonly data: T }
  | { readonly type: "error"; readonly error: ProjectError };
