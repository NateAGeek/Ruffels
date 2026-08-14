use std::{collections::HashMap, path::PathBuf};

use oxc_allocator::Allocator;
use oxc_ast::{ast::Expression, AstKind};
use oxc_semantic::{NodeId, SemanticBuilder};

use super::{
    classification::classify_node,
    diagnostics::source_diagnostic,
    projection::{graph_node_id, project_node},
};
use crate::source_graph::{
    imports::source_type_for_path,
    model::{AnalysisError, SourceEdge, SourceEdgeType, SourceGraph, SourceNodeCategory},
    parser::parse_source,
};

pub(crate) struct ParsedSource {
    pub(crate) graph: SourceGraph,
    pub(crate) imports: Vec<String>,
}

pub(super) struct IncludedNode<'a> {
    pub(super) id: NodeId,
    pub(super) kind: AstKind<'a>,
    pub(super) category: SourceNodeCategory,
}

pub(crate) fn analyze_source_text(
    source_path: PathBuf,
    source_text: String,
    file_index: usize,
) -> Result<ParsedSource, AnalysisError> {
    let source_type = source_type_for_path(&source_path)?;
    let allocator = Allocator::default();
    let parsed = parse_source(&allocator, &source_text, &source_path)?;
    let mut diagnostics = parsed
        .diagnostics
        .iter()
        .map(|diagnostic| {
            source_diagnostic(
                &source_text,
                diagnostic.to_string(),
                diagnostic.labels.first(),
            )
        })
        .collect::<Vec<_>>();
    let semantic_return = SemanticBuilder::new_compiler()
        .with_build_nodes(true)
        .build(&parsed.program);
    diagnostics.extend(semantic_return.diagnostics.iter().map(|diagnostic| {
        source_diagnostic(
            &source_text,
            diagnostic.to_string(),
            diagnostic.labels.first(),
        )
    }));

    let semantic = semantic_return.semantic;
    let ast_nodes = semantic.nodes();
    let included = ast_nodes
        .iter_enumerated()
        .filter_map(|(id, node)| {
            let kind = node.kind();
            classify_node(kind).map(|category| IncludedNode { id, kind, category })
        })
        .collect::<Vec<_>>();
    let included_ids = included
        .iter()
        .map(|node| (node.id, graph_node_id(file_index, node.kind)))
        .collect::<HashMap<_, _>>();
    let source_path_text = source_path.to_string_lossy().into_owned();
    let nodes = included
        .iter()
        .map(|node| {
            project_node(
                node,
                ast_nodes,
                &included_ids,
                &source_text,
                &source_path_text,
                file_index,
            )
        })
        .collect();
    let edges = build_ast_edges(&included, ast_nodes, &included_ids);
    let imports = ast_nodes
        .iter()
        .filter_map(|node| match node.kind() {
            AstKind::ImportDeclaration(import) => {
                let specifier = import.source.value.as_str();
                Some(specifier.to_owned())
            }
            AstKind::ExportFromDeclaration(export) => Some(export.source.value.as_str().to_owned()),
            AstKind::ExportAllDeclaration(export) => Some(export.source.value.as_str().to_owned()),
            AstKind::ImportExpression(import) => match &import.source {
                Expression::StringLiteral(source) => Some(source.value.as_str().to_owned()),
                _ => None,
            },
            _ => None,
        })
        .collect();

    Ok(ParsedSource {
        graph: SourceGraph {
            source_path: source_path_text,
            source_type,
            nodes,
            edges,
            diagnostics,
        },
        imports,
    })
}

fn build_ast_edges(
    included: &[IncludedNode<'_>],
    ast_nodes: &oxc_semantic::AstNodes<'_>,
    included_ids: &HashMap<NodeId, String>,
) -> Vec<SourceEdge> {
    included
        .iter()
        .filter_map(|node| {
            let target = included_ids.get(&node.id)?.clone();
            let source = ast_nodes
                .ancestor_ids(node.id)
                .find_map(|ancestor_id| included_ids.get(&ancestor_id).cloned())?;
            let edge_type = if matches!(
                node.category,
                SourceNodeCategory::Jsx | SourceNodeCategory::RenderExpression
            ) {
                SourceEdgeType::Renders
            } else {
                SourceEdgeType::Contains
            };
            Some(SourceEdge {
                id: format!("{source}->{target}"),
                source,
                target,
                edge_type,
            })
        })
        .collect()
}
