use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AnalysisError {
    InvalidExtension,
    NotAFile,
    ReadFailed { message: String },
    ParseFailed { message: String },
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SourceType {
    TypeScript,
    Tsx,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SourceNodeCategory {
    File,
    Component,
    Declaration,
    Jsx,
    RenderExpression,
    Type,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceSpan {
    pub start_line: usize,
    pub start_column: usize,
    pub end_line: usize,
    pub end_column: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceParameter {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_annotation: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceNode {
    pub id: String,
    pub ast_type: String,
    pub category: SourceNodeCategory,
    pub label: String,
    pub span: SourceSpan,
    pub source_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub declaration_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub element_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exported: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Vec<SourceParameter>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_async: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_generator: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_static: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub edge_type: SourceEdgeType,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SourceEdgeType {
    Contains,
    Renders,
    Imports,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDiagnostic {
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub span: SourceSpan,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticSeverity {
    Error,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceGraph {
    pub source_path: String,
    pub source_type: SourceType,
    pub nodes: Vec<SourceNode>,
    pub edges: Vec<SourceEdge>,
    pub diagnostics: Vec<SourceDiagnostic>,
}
