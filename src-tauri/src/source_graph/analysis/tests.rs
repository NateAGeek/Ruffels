use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_semantic::SemanticBuilder;

use super::{ast_kind::AstKindExt, orchestrator::analyze_source_text};
use crate::source_graph::model::{AnalysisError, SourceGraph, SourceNodeCategory};
use crate::source_graph::parser::parse_source;

fn analyze_fixture(file_name: &str, source_text: &str) -> SourceGraph {
    analyze_source_text(PathBuf::from(file_name), source_text.to_owned(), 0)
        .expect("fixture should parse")
        .graph
}

#[test]
fn should_expose_the_exact_oxc_ast_kind_name() {
    let allocator = Allocator::default();
    let source_path = PathBuf::from("kind.ts");
    let parsed =
        parse_source(&allocator, "const value = 1;", &source_path).expect("fixture should parse");
    let semantic = SemanticBuilder::new_compiler()
        .with_build_nodes(true)
        .build(&parsed.program)
        .semantic;
    let program = semantic
        .nodes()
        .iter()
        .find(|node| matches!(node.kind(), oxc_ast::AstKind::Program(_)))
        .expect("program kind should exist")
        .kind();

    assert_eq!(program.as_str(), "Program");
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
fn should_describe_named_types_with_their_declared_values() {
    let graph = analyze_fixture(
        "types.ts",
        "export type UserId = string | number; export interface User { name: string }",
    );
    let user_id = graph
        .nodes
        .iter()
        .find(|node| node.ast_type == "TSTypeAliasDeclaration")
        .expect("type alias should exist");
    let user = graph
        .nodes
        .iter()
        .find(|node| node.ast_type == "TSInterfaceDeclaration")
        .expect("interface should exist");

    assert_eq!(user_id.type_name.as_deref(), Some("UserId"));
    assert_eq!(user_id.type_value.as_deref(), Some("string | number"));
    assert_eq!(user.type_name.as_deref(), Some("User"));
    assert_eq!(user.type_value.as_deref(), Some("{ name: string }"));
}

#[test]
fn should_separate_primitive_compound_and_declared_types() {
    let graph = analyze_fixture(
        "types.ts",
        "type UserId = string | number; enum Status { Active } class Account { id: string = '' }",
    );
    let primitive = graph
        .nodes
        .iter()
        .find(|node| node.ast_type == "TSStringKeyword")
        .expect("string primitive should exist");
    let compound = graph
        .nodes
        .iter()
        .find(|node| node.ast_type == "TSUnionType")
        .expect("union type should exist");
    let alias = graph
        .nodes
        .iter()
        .find(|node| node.ast_type == "TSTypeAliasDeclaration")
        .expect("type alias should exist");
    let enumeration = graph
        .nodes
        .iter()
        .find(|node| node.ast_type == "TSEnumDeclaration")
        .expect("enum should exist");
    let class = graph
        .nodes
        .iter()
        .find(|node| node.ast_type == "Class")
        .expect("class should exist");

    assert_eq!(
        primitive.type_kind,
        Some(crate::source_graph::model::SourceTypeKind::Primitive)
    );
    assert_eq!(primitive.type_name.as_deref(), Some("primitive"));
    assert_eq!(primitive.type_value.as_deref(), Some("string"));
    assert_eq!(
        compound.type_kind,
        Some(crate::source_graph::model::SourceTypeKind::Compound)
    );
    assert_eq!(compound.type_name.as_deref(), Some("union"));
    assert_eq!(
        alias.type_kind,
        Some(crate::source_graph::model::SourceTypeKind::Declared)
    );
    assert_eq!(enumeration.category, SourceNodeCategory::Type);
    assert_eq!(
        enumeration.type_kind,
        Some(crate::source_graph::model::SourceTypeKind::Declared)
    );
    assert_eq!(enumeration.type_name.as_deref(), Some("Status"));
    assert_eq!(class.category, SourceNodeCategory::Type);
    assert_eq!(
        class.type_kind,
        Some(crate::source_graph::model::SourceTypeKind::Declared)
    );
    assert_eq!(class.type_name.as_deref(), Some("Account"));
}

#[test]
fn should_classify_ast_kinds_without_contextual_special_cases() {
    let graph = analyze_fixture(
        "Dashboard.tsx",
        "export function Dashboard() { const value = ready && fallback; return <main><Panel /></main>; }",
    );
    assert!(graph.nodes.iter().any(|node| {
        node.label == "Dashboard" && node.category == SourceNodeCategory::Declaration
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
        .any(|node| node.ast_type == "LogicalExpression"
            && node.category == SourceNodeCategory::RenderExpression));
}

#[test]
fn should_classify_every_call_as_an_invocation() {
    let graph = analyze_fixture(
        "Dashboard.tsx",
        "export function Dashboard() { const user = loadUser(); return <main>{format(user)}<Button onClick={() => save(user)} /></main>; }",
    );
    assert_eq!(
        graph
            .nodes
            .iter()
            .filter(|node| node.ast_type == "CallExpression"
                && node.category == SourceNodeCategory::RenderExpression)
            .count(),
        0
    );
    assert_eq!(
        graph
            .nodes
            .iter()
            .filter(|node| node.ast_type == "CallExpression"
                && node.category == SourceNodeCategory::Invocation)
            .count(),
        3
    );
}

#[test]
fn should_discover_re_exports_and_static_dynamic_imports() {
    let parsed = analyze_source_text(
        PathBuf::from("index.ts"),
        "export { User } from './user'; export * from './models'; const lazy = import('./lazy');"
            .to_owned(),
        0,
    )
    .expect("fixture should parse");
    assert_eq!(parsed.imports, vec!["./user", "./models", "./lazy"]);
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
