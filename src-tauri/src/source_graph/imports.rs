use std::path::Path;

use super::model::{AnalysisError, SourceType};

pub(crate) fn source_type_for_path(path: &Path) -> Result<SourceType, AnalysisError> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("ts") => Ok(SourceType::TypeScript),
        Some("tsx") => Ok(SourceType::Tsx),
        _ => Err(AnalysisError::InvalidExtension),
    }
}
