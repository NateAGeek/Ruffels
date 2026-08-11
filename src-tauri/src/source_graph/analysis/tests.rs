use std::{fs, path::PathBuf};

use super::orchestrator::{analyze_source_path, analyze_source_text};
use crate::source_graph::model::{AnalysisError, SourceEdgeType, SourceGraph, SourceNodeCategory};

fn analyze_fixture(file_name: &str, source_text: &str) -> SourceGraph {
    analyze_source_text(PathBuf::from(file_name), source_text.to_owned(), 0)
        .expect("fixture should parse")
        .graph
}

#[test]
fn should_project_oxc_types_and_typed_parameters() {
    let graph = analyze_fixture(
        "types.ts",
        "export interface User { name: string } export function load(id: string | number): User { return {} as User; }",
    );
    let function = graph
        .nodes
        .iter()
        .find(|node| node.label == "load")
        .expect("function should exist");
    let parameter = function
        .parameters
        .as_ref()
        .and_then(|parameters| parameters.first())
        .expect("typed parameter should exist");
    assert_eq!(parameter.name, "id");
    assert_eq!(
        parameter.type_annotation.as_deref(),
        Some("string | number")
    );
    assert!(graph
        .nodes
        .iter()
        .any(|node| node.ast_type == "TSUnionType"));
    assert!(graph
        .nodes
        .iter()
        .any(|node| node.ast_type == "TSTypeReference"));
}

#[test]
fn should_build_a_component_render_tree() {
    let graph = analyze_fixture(
        "Dashboard.tsx",
        "export function Dashboard() { return <main>{ready && <Panel />}</main>; }",
    );
    assert!(graph.nodes.iter().any(|node| {
        node.label == "Dashboard" && node.category == SourceNodeCategory::Component
    }));
    assert_eq!(
        graph
            .nodes
            .iter()
            .filter(|node| node.ast_type == "JSXElement")
            .count(),
        2
    );
    assert!(graph
        .nodes
        .iter()
        .any(|node| node.ast_type == "LogicalExpression"));
}

#[test]
fn should_follow_relative_imports_without_packages() {
    let fixture_directory = std::env::temp_dir().join(format!(
        "ruffels-oxc-import-test-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    fs::create_dir_all(&fixture_directory).expect("fixture directory should be created");
    let entry_path = fixture_directory.join("entry.ts");
    let model_path = fixture_directory.join("model.ts");
    fs::write(
        &entry_path,
        "import type { User } from './model'; import React from 'react'; const user: User = { name: 'Ada' };",
    )
    .expect("entry should be written");
    fs::write(&model_path, "export interface User { name: string }")
        .expect("model should be written");

    let graph =
        analyze_source_path(entry_path.to_string_lossy().into_owned()).expect("graph should parse");
    assert_eq!(
        graph
            .nodes
            .iter()
            .filter(|node| node.category == SourceNodeCategory::File)
            .count(),
        2
    );
    assert!(graph
        .edges
        .iter()
        .any(|edge| edge.edge_type == SourceEdgeType::Imports));

    fs::remove_file(entry_path).expect("entry should be removed");
    fs::remove_file(model_path).expect("model should be removed");
    fs::remove_dir(fixture_directory).expect("fixture directory should be removed");
}

#[test]
fn should_reject_invalid_paths_and_fatal_syntax() {
    let invalid = analyze_source_text(
        PathBuf::from("broken.tsx"),
        "export function Broken( {".to_owned(),
        0,
    );
    assert!(matches!(invalid, Err(AnalysisError::ParseFailed { .. })));
}
