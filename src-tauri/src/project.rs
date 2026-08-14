mod cache;
mod config;
mod graph;
mod indexer;
mod model;
mod paths;
mod recents;
mod typescript;
mod util;

pub use config::{initialize_project, inspect_project};
pub use indexer::open_project;
#[allow(unused_imports)]
pub use model::{
    FileSummary, IndexStats, InitializationProposal, ProjectConfig, ProjectError, ProjectFeatures,
    ProjectFileContent, ProjectIndex, ProjectInspection, ProjectSummary, RecentProject,
};
pub use paths::{read_project_file, resolve_source_file};
pub use recents::{forget_recent_project, list_recent_projects, record_recent_project};

const CONFIG_FILE: &str = "ruffels.config.json";
const CACHE_DIRECTORY: &str = ".ruffels";
const CACHE_FILE: &str = "index-v1.json";

#[cfg(test)]
mod tests {
    use std::fs;

    use crate::source_graph::SourceNodeCategory;

    use super::util::now_timestamp;
    use super::{
        initialize_project, open_project, read_project_file, resolve_source_file, ProjectConfig,
        ProjectError,
    };

    #[test]
    fn initializes_indexes_and_reuses_unchanged_files() {
        let root = std::env::temp_dir().join(format!(
            "ruffels-project-test-{}-{}",
            std::process::id(),
            now_timestamp()
        ));
        fs::create_dir_all(root.join("src/models")).expect("fixture directory should exist");
        fs::write(
            root.join("src/main.ts"),
            "import type { User } from '@/models/user'; import React from 'react'; const user: User = { name: 'Ada' };",
        )
        .expect("entry should be written");
        fs::write(
            root.join("src/models/user.ts"),
            "export interface User { name: string }",
        )
        .expect("model should be written");
        fs::write(
            root.join("tsconfig.json"),
            r#"{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}"#,
        )
        .expect("tsconfig should be written");

        let config = ProjectConfig {
            entry_points: vec!["src/main.ts".to_owned()],
            ..ProjectConfig::default()
        };
        initialize_project(root.to_string_lossy().into_owned(), config)
            .expect("project should initialize");
        let first = open_project(root.to_string_lossy().into_owned(), false, Vec::new())
            .expect("project should index");
        assert_eq!(first.stats.file_count, 2);
        assert_eq!(first.stats.parsed_files, 2);
        assert_eq!(first.stats.external_dependency_count, 1);
        assert!(first.graph.nodes.iter().any(|node| {
            node.category == SourceNodeCategory::ExternalDependency && node.label == "react"
        }));

        let second = open_project(root.to_string_lossy().into_owned(), false, Vec::new())
            .expect("project should reopen");
        assert_eq!(second.stats.reused_files, 2);
        assert_eq!(second.stats.parsed_files, 0);
        assert_eq!(
            first
                .graph
                .nodes
                .iter()
                .map(|node| &node.id)
                .collect::<Vec<_>>(),
            second
                .graph
                .nodes
                .iter()
                .map(|node| &node.id)
                .collect::<Vec<_>>()
        );

        fs::remove_dir_all(root).expect("fixture should be removed");
    }

    #[test]
    fn lists_unreferenced_and_unsupported_project_files_for_optional_opening() {
        let root = std::env::temp_dir().join(format!(
            "ruffels-project-files-test-{}-{}",
            std::process::id(),
            now_timestamp()
        ));
        fs::create_dir_all(root.join("src")).expect("fixture directory should exist");
        fs::write(root.join("src/main.ts"), "export const main = true;")
            .expect("entry should be written");
        fs::write(root.join("src/orphan.ts"), "export const orphan = true;")
            .expect("optional source should be written");
        fs::write(root.join("README.md"), "# Demo project")
            .expect("unsupported file should be written");

        initialize_project(
            root.to_string_lossy().into_owned(),
            ProjectConfig {
                entry_points: vec!["src/main.ts".to_owned()],
                ..ProjectConfig::default()
            },
        )
        .expect("project should initialize");

        let index = open_project(root.to_string_lossy().into_owned(), false, Vec::new())
            .expect("project should index");
        let optional_source = index
            .files
            .iter()
            .find(|file| file.path == "src/orphan.ts")
            .expect("optional source should be listed");
        assert!(!optional_source.is_indexed);
        assert!(optional_source.source_type.is_some());
        let unsupported = index
            .files
            .iter()
            .find(|file| file.path == "README.md")
            .expect("unsupported file should be listed");
        assert!(!unsupported.is_indexed);
        assert!(unsupported.source_type.is_none());

        let included = open_project(
            root.to_string_lossy().into_owned(),
            false,
            vec!["src/orphan.ts".to_owned()],
        )
        .expect("optional source should be included");
        assert!(
            included
                .files
                .iter()
                .find(|file| file.path == "src/orphan.ts")
                .expect("optional source should remain listed")
                .is_indexed
        );

        fs::remove_dir_all(root).expect("fixture should be removed");
    }

    #[test]
    fn reads_project_files_for_read_only_previews() {
        let root = std::env::temp_dir().join(format!(
            "ruffels-preview-test-{}-{}",
            std::process::id(),
            now_timestamp()
        ));
        fs::create_dir_all(&root).expect("fixture directory should exist");
        fs::write(root.join("README.md"), "# Preview").expect("preview should be written");

        let preview = read_project_file(&root.to_string_lossy(), "README.md")
            .expect("project file should be readable");
        assert_eq!(preview.content, "# Preview");
        assert_eq!(preview.language, "markdown");
        assert!(matches!(
            read_project_file(&root.to_string_lossy(), "../outside.md"),
            Err(ProjectError::EntryOutsideRoot { .. })
        ));

        fs::remove_dir_all(root).expect("fixture should be removed");
    }

    #[test]
    fn source_file_resolution_stays_inside_the_project() {
        let root = std::env::temp_dir().join(format!(
            "ruffels-open-file-test-{}-{}",
            std::process::id(),
            now_timestamp()
        ));
        fs::create_dir_all(root.join("src")).expect("fixture directory should exist");
        let source = root.join("src/main.ts");
        fs::write(&source, "export const value = 1;").expect("source should be written");

        assert_eq!(
            resolve_source_file(&root.to_string_lossy(), "src/main.ts")
                .expect("project source should resolve"),
            source.canonicalize().expect("source should canonicalize")
        );
        assert!(matches!(
            resolve_source_file(&root.to_string_lossy(), "../outside.ts"),
            Err(ProjectError::EntryOutsideRoot { .. })
        ));

        fs::remove_dir_all(root).expect("fixture should be removed");
    }
}
