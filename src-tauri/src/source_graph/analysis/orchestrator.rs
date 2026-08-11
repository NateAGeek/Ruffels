use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs,
    path::{Path, PathBuf},
};

use oxc_allocator::Allocator;
use oxc_ast::AstKind;
use oxc_semantic::{NodeId, SemanticBuilder};

use super::{
    classification::classify_node,
    diagnostics::source_diagnostic,
    projection::{graph_node_id, project_node},
};
use crate::source_graph::{
    imports::{resolve_local_import, source_type_for_path, MAX_LOCAL_FILES},
    model::{AnalysisError, SourceEdge, SourceEdgeType, SourceGraph, SourceNodeCategory},
    parser::parse_source,
};

pub(super) struct ParsedSource {
    pub(super) graph: SourceGraph,
    local_imports: Vec<String>,
}

pub(super) struct IncludedNode<'a> {
    pub(super) id: NodeId,
    pub(super) kind: AstKind<'a>,
    pub(super) category: SourceNodeCategory,
}

pub fn analyze_source_path(path: String) -> Result<SourceGraph, AnalysisError> {
    let canonical_path =
        PathBuf::from(path)
            .canonicalize()
            .map_err(|error| AnalysisError::ReadFailed {
                message: error.to_string(),
            })?;

    if !canonical_path.is_file() {
        return Err(AnalysisError::NotAFile);
    }

    let root_source_type = source_type_for_path(&canonical_path)?;
    let mut queue = VecDeque::from([canonical_path.clone()]);
    let mut visited = HashSet::new();
    let mut roots_by_path = HashMap::new();
    let mut pending_imports = Vec::new();
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut diagnostics = Vec::new();

    while let Some(source_path) = queue.pop_front() {
        if visited.len() >= MAX_LOCAL_FILES || !visited.insert(source_path.clone()) {
            continue;
        }

        let source_text =
            fs::read_to_string(&source_path).map_err(|error| AnalysisError::ReadFailed {
                message: error.to_string(),
            })?;
        let parsed = analyze_source_text(source_path.clone(), source_text, roots_by_path.len())?;
        let source_root = parsed
            .graph
            .nodes
            .first()
            .expect("an Oxc source graph always has a Program root")
            .id
            .clone();
        roots_by_path.insert(source_path.clone(), source_root.clone());

        queue_local_imports(
            &source_path,
            &source_root,
            parsed.local_imports,
            &visited,
            &mut queue,
            &mut pending_imports,
        );
        nodes.extend(parsed.graph.nodes);
        edges.extend(parsed.graph.edges);
        diagnostics.extend(parsed.graph.diagnostics);
    }

    add_import_edges(&roots_by_path, pending_imports, &mut edges);

    Ok(SourceGraph {
        source_path: canonical_path.to_string_lossy().into_owned(),
        source_type: root_source_type,
        nodes,
        edges,
        diagnostics,
    })
}

pub(super) fn analyze_source_text(
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
            classify_node(kind, ast_nodes, id).map(|category| IncludedNode { id, kind, category })
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
    let local_imports = ast_nodes
        .iter()
        .filter_map(|node| match node.kind() {
            AstKind::ImportDeclaration(import) => {
                let specifier = import.source.value.as_str();
                specifier.starts_with('.').then(|| specifier.to_owned())
            }
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
        local_imports,
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

fn queue_local_imports(
    source_path: &Path,
    source_root: &str,
    local_imports: Vec<String>,
    visited: &HashSet<PathBuf>,
    queue: &mut VecDeque<PathBuf>,
    pending_imports: &mut Vec<(String, PathBuf)>,
) {
    for specifier in local_imports {
        if let Some(imported_path) = resolve_local_import(source_path, &specifier) {
            pending_imports.push((source_root.to_owned(), imported_path.clone()));
            if !visited.contains(&imported_path) {
                queue.push_back(imported_path);
            }
        }
    }
}

fn add_import_edges(
    roots_by_path: &HashMap<PathBuf, String>,
    pending_imports: Vec<(String, PathBuf)>,
    edges: &mut Vec<SourceEdge>,
) {
    for (source_root, imported_path) in pending_imports {
        if let Some(target_root) = roots_by_path.get(&imported_path) {
            edges.push(SourceEdge {
                id: format!("{source_root}->{target_root}:imports"),
                source: source_root,
                target: target_root.clone(),
                edge_type: SourceEdgeType::Imports,
            });
        }
    }
}
