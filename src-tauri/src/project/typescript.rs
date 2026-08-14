use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use serde::Deserialize;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(super) struct TsConfig {
    #[serde(default)]
    compiler_options: CompilerOptions,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CompilerOptions {
    base_url: Option<String>,
    #[serde(default)]
    paths: HashMap<String, Vec<String>>,
}

pub(super) fn read_tsconfig(root: &Path) -> TsConfig {
    fs::read_to_string(root.join("tsconfig.json"))
        .ok()
        .and_then(|text| json5::from_str(&text).ok())
        .unwrap_or_default()
}

pub(super) fn resolve_project_import(
    root: &Path,
    source: &Path,
    specifier: &str,
    tsconfig: &TsConfig,
) -> Option<PathBuf> {
    if specifier.starts_with('.') {
        return resolve_supported_path(&source.parent()?.join(specifier))
            .filter(|path| path.starts_with(root));
    }
    let base = root.join(tsconfig.compiler_options.base_url.as_deref().unwrap_or("."));
    for (pattern, replacements) in &tsconfig.compiler_options.paths {
        if let Some(capture) = match_alias(pattern, specifier) {
            for replacement in replacements {
                let target = replacement.replace('*', capture);
                if let Some(path) = resolve_supported_path(&base.join(target)) {
                    if path.starts_with(root) {
                        return Some(path);
                    }
                }
            }
        }
    }
    resolve_supported_path(&base.join(specifier)).filter(|path| path.starts_with(root))
}

fn match_alias<'a>(pattern: &str, specifier: &'a str) -> Option<&'a str> {
    match pattern.split_once('*') {
        Some((prefix, suffix)) => specifier.strip_prefix(prefix)?.strip_suffix(suffix),
        None => (pattern == specifier).then_some(""),
    }
}

pub(super) fn resolve_supported_path(path: &Path) -> Option<PathBuf> {
    let candidates = if path.extension().is_some() {
        vec![path.to_path_buf()]
    } else {
        vec![
            path.with_extension("ts"),
            path.with_extension("tsx"),
            path.join("index.ts"),
            path.join("index.tsx"),
        ]
    };
    candidates.into_iter().find_map(|candidate| {
        let canonical = candidate.canonicalize().ok()?;
        let extension = canonical.extension()?.to_str()?.to_ascii_lowercase();
        (canonical.is_file() && matches!(extension.as_str(), "ts" | "tsx")).then_some(canonical)
    })
}

pub(super) fn source_type_for_path(path: &Path) -> Option<crate::source_graph::SourceType> {
    match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "ts" => Some(crate::source_graph::SourceType::TypeScript),
        "tsx" => Some(crate::source_graph::SourceType::Tsx),
        _ => None,
    }
}

pub(super) fn is_bare_specifier(specifier: &str) -> bool {
    !specifier.starts_with('.') && !specifier.starts_with('/')
}

#[cfg(test)]
mod tests {
    use super::match_alias;

    #[test]
    fn alias_patterns_capture_wildcards() {
        assert_eq!(match_alias("@/*", "@/models/user"), Some("models/user"));
        assert_eq!(match_alias("exact", "exact"), Some(""));
        assert_eq!(match_alias("@/*", "other"), None);
    }
}
