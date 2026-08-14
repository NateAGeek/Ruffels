mod analysis;
mod imports;
mod model;
mod parser;

use std::{fs, path::PathBuf};

pub(crate) use analysis::orchestrator::analyze_source_text;
pub use model::{AnalysisError, SourceGraph};
pub(crate) use model::{
    SourceEdge, SourceEdgeType, SourceNode, SourceNodeCategory, SourceSpan, SourceType,
};

pub(crate) fn analyze_project_file(
    path: PathBuf,
) -> Result<(SourceGraph, Vec<String>), AnalysisError> {
    let source = fs::read_to_string(&path).map_err(|error| AnalysisError::ReadFailed {
        message: error.to_string(),
    })?;
    let parsed = analyze_source_text(path, source, 0)?;
    Ok((parsed.graph, parsed.imports))
}
