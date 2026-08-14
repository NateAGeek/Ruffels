use std::{fs, path::Path};

use super::{
    paths::{
        canonical_directory, has_parent_component, project_summary, relative_path, resolve_entry,
    },
    typescript::resolve_supported_path,
    util::{atomic_write, io_error},
    InitializationProposal, ProjectConfig, ProjectError, ProjectInspection, ProjectSummary,
    CACHE_DIRECTORY, CACHE_FILE, CONFIG_FILE,
};

pub fn inspect_project(path: String) -> Result<ProjectInspection, ProjectError> {
    let root = canonical_directory(&path)?;
    let project = project_summary(&root);
    if root.join(CONFIG_FILE).is_file() {
        read_config(&root)?;
        return Ok(ProjectInspection::Initialized { project });
    }

    let detected_entry_points = detect_entry_points(&root);
    let config = ProjectConfig {
        entry_points: detected_entry_points.clone(),
        ..ProjectConfig::default()
    };
    Ok(ProjectInspection::NeedsInitialization {
        proposal: InitializationProposal {
            project,
            config,
            requires_entry_selection: detected_entry_points.is_empty(),
            detected_entry_points,
            files_to_create: vec![
                CONFIG_FILE.to_owned(),
                format!("{CACHE_DIRECTORY}/.gitignore"),
                format!("{CACHE_DIRECTORY}/{CACHE_FILE}"),
            ],
        },
    })
}

pub fn initialize_project(
    root: String,
    config: ProjectConfig,
) -> Result<ProjectSummary, ProjectError> {
    let root = canonical_directory(&root)?;
    validate_config(&root, &config)?;
    let config_text =
        serde_json::to_string_pretty(&config).map_err(|error| io_error(error.to_string()))?;
    atomic_write(
        &root.join(CONFIG_FILE),
        format!("{config_text}\n").as_bytes(),
    )?;
    let cache_dir = root.join(CACHE_DIRECTORY);
    fs::create_dir_all(&cache_dir).map_err(|error| io_error(error.to_string()))?;
    atomic_write(&cache_dir.join(".gitignore"), b"*\n!.gitignore\n")?;
    Ok(project_summary(&root))
}

pub(super) fn read_config(root: &Path) -> Result<ProjectConfig, ProjectError> {
    let path = root.join(CONFIG_FILE);
    if !path.is_file() {
        return Err(ProjectError::NotInitialized);
    }
    serde_json::from_slice(&fs::read(path).map_err(|error| io_error(error.to_string()))?).map_err(
        |error| ProjectError::InvalidConfig {
            message: error.to_string(),
        },
    )
}

pub(super) fn validate_config(root: &Path, config: &ProjectConfig) -> Result<(), ProjectError> {
    if config.schema_version != 1 {
        return Err(ProjectError::InvalidConfig {
            message: "Only schemaVersion 1 is supported".to_owned(),
        });
    }
    if config.max_files == 0 {
        return Err(ProjectError::InvalidConfig {
            message: "maxFiles must be greater than zero".to_owned(),
        });
    }
    for entry in &config.entry_points {
        if Path::new(entry).is_absolute() || has_parent_component(Path::new(entry)) {
            return Err(ProjectError::EntryOutsideRoot {
                path: entry.clone(),
            });
        }
        let _ = resolve_entry(root, entry)?;
    }
    Ok(())
}

pub(super) fn detect_entry_points(root: &Path) -> Vec<String> {
    let mut candidates = Vec::new();
    let package_path = root.join("package.json");
    if let Ok(value) = fs::read(&package_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
        .ok_or(())
    {
        for field in ["source", "module", "main"] {
            if let Some(value) = value.get(field).and_then(serde_json::Value::as_str) {
                candidates.push(value.to_owned());
            }
        }
    }
    candidates.extend(
        [
            "src/main.tsx",
            "src/main.ts",
            "src/index.tsx",
            "src/index.ts",
            "index.tsx",
            "index.ts",
        ]
        .into_iter()
        .map(str::to_owned),
    );
    let mut found = Vec::new();
    for candidate in candidates {
        if let Some(path) = resolve_supported_path(&root.join(&candidate)) {
            if let Ok(relative) = relative_path(root, &path) {
                if !found.contains(&relative) {
                    found.push(relative);
                }
            }
        }
    }
    found
}
