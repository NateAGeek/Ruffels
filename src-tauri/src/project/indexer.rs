use std::{
    collections::{BTreeMap, HashSet, VecDeque},
    fs,
};

use ignore::gitignore::{Gitignore, GitignoreBuilder};

use crate::source_graph::analyze_project_file;

use super::{
    cache::{read_cache, write_cache, CachedFileAnalysis, IndexCache},
    config::{detect_entry_points, read_config, validate_config},
    graph::{assemble_graph, stabilize_graph_ids},
    paths::{
        canonical_directory, canonical_file_in_root, project_summary, relative_path, resolve_entry,
    },
    typescript::{is_bare_specifier, read_tsconfig, resolve_project_import, source_type_for_path},
    util::{analysis_error, io_error, now_timestamp, sha256},
    FileSummary, IndexStats, ProjectError, ProjectIndex,
};

pub fn open_project(
    root: String,
    force_reindex: bool,
    additional_entry_points: Vec<String>,
) -> Result<ProjectIndex, ProjectError> {
    let root = canonical_directory(&root)?;
    let config = read_config(&root)?;
    validate_config(&root, &config)?;
    let mut requested_entries = if config.entry_points.is_empty() {
        detect_entry_points(&root)
    } else {
        config.entry_points.clone()
    };
    for additional_entry in additional_entry_points {
        if !requested_entries.contains(&additional_entry) {
            requested_entries.push(additional_entry);
        }
    }
    if requested_entries.is_empty() {
        return Err(ProjectError::NoEntryPoints);
    }
    let resolved_entries = requested_entries
        .iter()
        .map(|entry| resolve_entry(&root, entry))
        .collect::<Result<Vec<_>, _>>()?;
    let entries = resolved_entries
        .iter()
        .map(|path| relative_path(&root, path))
        .collect::<Result<Vec<_>, _>>()?;

    let config_bytes = serde_json::to_vec(&config).map_err(|error| io_error(error.to_string()))?;
    let config_fingerprint = sha256(&config_bytes);
    let old_cache = (!force_reindex)
        .then(|| read_cache(&root, &config_fingerprint))
        .flatten();
    let tsconfig = read_tsconfig(&root);
    let entry_set = entries.iter().cloned().collect::<HashSet<_>>();
    let mut queue = VecDeque::from(resolved_entries);

    let mut visited = HashSet::new();
    let mut files = BTreeMap::new();
    let mut external_specifiers = HashSet::new();
    let mut reused_files = 0;
    let mut parsed_files = 0;
    let ignore_matcher = build_ignore_matcher(&root, &config.ignore)?;

    while let Some(path) = queue.pop_front() {
        let canonical = canonical_file_in_root(&root, &path)?;
        let relative = relative_path(&root, &canonical)?;
        if !visited.insert(relative.clone()) || is_ignored(&relative, &ignore_matcher) {
            continue;
        }
        if visited.len() > config.max_files {
            return Err(ProjectError::FileLimitExceeded {
                limit: config.max_files,
            });
        }
        let source = fs::read(&canonical).map_err(|error| io_error(error.to_string()))?;
        let fingerprint = sha256(&source);
        let cached = old_cache
            .as_ref()
            .and_then(|cache| cache.files.get(&relative))
            .filter(|file| file.fingerprint == fingerprint)
            .cloned();
        let analysis = if let Some(cached) = cached {
            reused_files += 1;
            cached
        } else {
            parsed_files += 1;
            let (mut graph, imports) = analyze_project_file(canonical.clone())
                .map_err(|error| analysis_error(&relative, error))?;
            stabilize_graph_ids(&mut graph, &relative);
            CachedFileAnalysis {
                fingerprint,
                source_type: graph.source_type,
                graph,
                imports,
            }
        };

        for specifier in &analysis.imports {
            if let Some(imported) = resolve_project_import(&root, &canonical, specifier, &tsconfig)
            {
                queue.push_back(imported);
            } else if is_bare_specifier(specifier) && config.features.external_dependencies {
                external_specifiers.insert(specifier.clone());
            }
        }
        files.insert(relative, analysis);
    }

    let mut graph = assemble_graph(&root, &entries, &files, &external_specifiers, &tsconfig);
    graph.source_path = root.to_string_lossy().into_owned();
    let file_summaries = list_project_files(&root, &ignore_matcher)?
        .into_iter()
        .map(|path| {
            let analysis = files.get(&path);
            FileSummary {
                source_type: analysis
                    .map(|file| file.source_type)
                    .or_else(|| source_type_for_path(std::path::Path::new(&path))),
                fingerprint: analysis.map(|file| file.fingerprint.clone()),
                diagnostic_count: analysis
                    .map(|file| file.graph.diagnostics.len())
                    .unwrap_or_default(),
                is_entry_point: entry_set.contains(&path),
                is_indexed: analysis.is_some(),
                path,
            }
        })
        .collect::<Vec<_>>();
    let cache = IndexCache::new(config_fingerprint, files, now_timestamp());
    write_cache(&root, &cache)?;

    Ok(ProjectIndex {
        project: project_summary(&root),
        entry_points: entries,
        files: file_summaries,
        stats: IndexStats {
            file_count: cache.files.len(),
            reused_files,
            parsed_files,
            external_dependency_count: external_specifiers.len(),
        },
        graph,
    })
}

fn build_ignore_matcher(
    root: &std::path::Path,
    patterns: &[String],
) -> Result<Gitignore, ProjectError> {
    let mut builder = GitignoreBuilder::new(root);
    for pattern in patterns {
        builder
            .add_line(None, pattern)
            .map_err(|error| ProjectError::InvalidConfig {
                message: format!("Invalid ignore pattern '{pattern}': {error}"),
            })?;
    }
    builder
        .build()
        .map_err(|error| ProjectError::InvalidConfig {
            message: format!("Could not compile ignore patterns: {error}"),
        })
}

fn is_ignored(relative: &str, matcher: &Gitignore) -> bool {
    matcher
        .matched_path_or_any_parents(std::path::Path::new(relative), false)
        .is_ignore()
}

fn list_project_files(
    root: &std::path::Path,
    matcher: &Gitignore,
) -> Result<Vec<String>, ProjectError> {
    let mut directories = vec![root.to_path_buf()];
    let mut paths = Vec::new();
    while let Some(directory) = directories.pop() {
        let entries = fs::read_dir(&directory).map_err(|error| io_error(error.to_string()))?;
        for entry in entries {
            let entry = entry.map_err(|error| io_error(error.to_string()))?;
            let file_type = entry
                .file_type()
                .map_err(|error| io_error(error.to_string()))?;
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            let relative = relative_path(root, &path)?;
            if matcher
                .matched_path_or_any_parents(std::path::Path::new(&relative), file_type.is_dir())
                .is_ignore()
            {
                continue;
            }
            if file_type.is_dir() {
                directories.push(path);
            } else if file_type.is_file() {
                paths.push(relative);
            }
        }
    }
    paths.sort();
    Ok(paths)
}
