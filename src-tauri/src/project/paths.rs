use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use super::util::io_error;
use super::{
    typescript::resolve_supported_path, ProjectError, ProjectFileContent, ProjectSummary,
    CONFIG_FILE,
};

pub fn resolve_source_file(root: &str, source_path: &str) -> Result<PathBuf, ProjectError> {
    let root = canonical_directory(root)?;
    if Path::new(source_path).is_absolute() || has_parent_component(Path::new(source_path)) {
        return Err(ProjectError::EntryOutsideRoot {
            path: source_path.to_owned(),
        });
    }
    canonical_file_in_root(&root, &root.join(source_path))
}

pub fn read_project_file(
    root: &str,
    source_path: &str,
) -> Result<ProjectFileContent, ProjectError> {
    let path = resolve_source_file(root, source_path)?;
    let bytes = fs::read(&path).map_err(|error| io_error(error.to_string()))?;
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let language = match extension.as_str() {
        "js" | "mjs" | "cjs" => "javascript",
        "ts" => "typescript",
        "tsx" => "tsx",
        "jsx" => "jsx",
        "md" | "mdx" => "markdown",
        "json" | "json5" => "json",
        "html" | "htm" => "html",
        "css" | "scss" | "sass" | "less" => extension.as_str(),
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "rs" => "rust",
        "py" => "python",
        "sh" | "bash" => "bash",
        _ => "text",
    };
    Ok(ProjectFileContent {
        path: source_path.replace('\\', "/"),
        content: String::from_utf8_lossy(&bytes).into_owned(),
        language: language.to_owned(),
    })
}

pub(super) fn canonical_directory(path: &str) -> Result<PathBuf, ProjectError> {
    let root = PathBuf::from(path)
        .canonicalize()
        .map_err(|_| ProjectError::InvalidRoot)?;
    root.is_dir()
        .then_some(root)
        .ok_or(ProjectError::InvalidRoot)
}

pub(super) fn resolve_entry(root: &Path, relative: &str) -> Result<PathBuf, ProjectError> {
    if Path::new(relative).is_absolute() || has_parent_component(Path::new(relative)) {
        return Err(ProjectError::EntryOutsideRoot {
            path: relative.to_owned(),
        });
    }
    resolve_supported_path(&root.join(relative)).ok_or_else(|| ProjectError::InvalidConfig {
        message: format!("Entry point does not exist or is not TypeScript: {relative}"),
    })
}

pub(super) fn canonical_file_in_root(root: &Path, path: &Path) -> Result<PathBuf, ProjectError> {
    let path = path
        .canonicalize()
        .map_err(|error| io_error(error.to_string()))?;
    if !path.is_file() || !path.starts_with(root) {
        return Err(ProjectError::EntryOutsideRoot {
            path: path.to_string_lossy().into_owned(),
        });
    }
    Ok(path)
}

pub(super) fn relative_path(root: &Path, path: &Path) -> Result<String, ProjectError> {
    path.strip_prefix(root)
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .map_err(|_| ProjectError::EntryOutsideRoot {
            path: path.to_string_lossy().into_owned(),
        })
}

pub(super) fn has_parent_component(path: &Path) -> bool {
    path.components()
        .any(|component| component == Component::ParentDir)
}

pub(super) fn project_summary(root: &Path) -> ProjectSummary {
    ProjectSummary {
        root: root.to_string_lossy().into_owned(),
        name: root
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Project")
            .to_owned(),
        config_path: root.join(CONFIG_FILE).to_string_lossy().into_owned(),
    }
}
