use std::path::{Path, PathBuf};

use super::model::{AnalysisError, SourceType};

pub(crate) const MAX_LOCAL_FILES: usize = 100;

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

pub(crate) fn resolve_local_import(source_path: &Path, specifier: &str) -> Option<PathBuf> {
    let parent = source_path.parent()?;
    let unresolved = parent.join(specifier);
    let candidates = if unresolved.extension().is_some() {
        vec![unresolved]
    } else {
        vec![
            unresolved.with_extension("ts"),
            unresolved.with_extension("tsx"),
            unresolved.join("index.ts"),
            unresolved.join("index.tsx"),
        ]
    };

    candidates.into_iter().find_map(|candidate| {
        let canonical = candidate.canonicalize().ok()?;
        let is_dependency = canonical.components().any(|component| {
            component
                .as_os_str()
                .to_str()
                .is_some_and(|name| name.eq_ignore_ascii_case("node_modules"))
        });
        (!is_dependency && canonical.is_file() && source_type_for_path(&canonical).is_ok())
            .then_some(canonical)
    })
}
