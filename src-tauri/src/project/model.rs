use serde::{Deserialize, Serialize};

use crate::source_graph::{SourceGraph, SourceType};

fn default_schema_version() -> u32 {
    1
}

fn default_ignores() -> Vec<String> {
    [
        ".git",
        ".ruffels",
        "node_modules",
        "dist",
        "build",
        "coverage",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect()
}

fn default_max_files() -> usize {
    10_000
}

fn default_external_dependencies() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFeatures {
    #[serde(default = "default_external_dependencies")]
    pub external_dependencies: bool,
}

impl Default for ProjectFeatures {
    fn default() -> Self {
        Self {
            external_dependencies: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub entry_points: Vec<String>,
    #[serde(default = "default_ignores")]
    pub ignore: Vec<String>,
    #[serde(default)]
    pub features: ProjectFeatures,
    #[serde(default = "default_max_files")]
    pub max_files: usize,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            schema_version: default_schema_version(),
            entry_points: Vec::new(),
            ignore: default_ignores(),
            features: ProjectFeatures::default(),
            max_files: default_max_files(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub root: String,
    pub name: String,
    pub config_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializationProposal {
    pub project: ProjectSummary,
    pub config: ProjectConfig,
    pub detected_entry_points: Vec<String>,
    pub files_to_create: Vec<String>,
    pub requires_entry_selection: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProjectInspection {
    Initialized { project: ProjectSummary },
    NeedsInitialization { proposal: InitializationProposal },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSummary {
    pub path: String,
    pub source_type: Option<SourceType>,
    pub fingerprint: Option<String>,
    pub diagnostic_count: usize,
    pub is_entry_point: bool,
    pub is_indexed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileContent {
    pub path: String,
    pub content: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStats {
    pub file_count: usize,
    pub reused_files: usize,
    pub parsed_files: usize,
    pub external_dependency_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIndex {
    pub project: ProjectSummary,
    pub entry_points: Vec<String>,
    pub files: Vec<FileSummary>,
    pub graph: SourceGraph,
    pub stats: IndexStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub root: String,
    pub name: String,
    pub last_opened_at: u64,
    #[serde(default)]
    pub available: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProjectError {
    InvalidRoot,
    NotInitialized,
    InvalidConfig { message: String },
    NoEntryPoints,
    EntryOutsideRoot { path: String },
    FileLimitExceeded { limit: usize },
    IoFailed { message: String },
    AnalysisFailed { path: String, message: String },
}
