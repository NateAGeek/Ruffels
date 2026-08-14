use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::Path,
};

use crate::source_graph::{
    SourceEdge, SourceEdgeType, SourceGraph, SourceNode, SourceNodeCategory, SourceSpan, SourceType,
};

use super::{
    cache::CachedFileAnalysis,
    paths::relative_path,
    typescript::{resolve_project_import, TsConfig},
};

pub(super) fn assemble_graph(
    root: &Path,
    entries: &[String],
    files: &BTreeMap<String, CachedFileAnalysis>,
    external_specifiers: &HashSet<String>,
    tsconfig: &TsConfig,
) -> SourceGraph {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut diagnostics = Vec::new();
    let roots = files
        .iter()
        .filter_map(|(path, file)| {
            file.graph
                .nodes
                .first()
                .map(|node| (path.clone(), node.id.clone()))
        })
        .collect::<HashMap<_, _>>();
    for (relative, file) in files {
        nodes.extend(file.graph.nodes.clone());
        edges.extend(file.graph.edges.clone());
        diagnostics.extend(file.graph.diagnostics.clone());
        let Some(source_root) = roots.get(relative) else {
            continue;
        };
        let source_path = root.join(relative);
        for specifier in &file.imports {
            if let Some(target) = resolve_project_import(root, &source_path, specifier, tsconfig)
                .and_then(|path| relative_path(root, &path).ok())
                .and_then(|path| roots.get(&path).cloned())
            {
                edges.push(SourceEdge {
                    id: format!("{source_root}->{target}:imports"),
                    source: source_root.clone(),
                    target,
                    edge_type: SourceEdgeType::Imports,
                });
            } else if external_specifiers.contains(specifier) {
                let target = external_id(specifier);
                edges.push(SourceEdge {
                    id: format!("{source_root}->{target}:imports"),
                    source: source_root.clone(),
                    target,
                    edge_type: SourceEdgeType::Imports,
                });
            }
        }
    }
    let mut externals = external_specifiers.iter().collect::<Vec<_>>();
    externals.sort();
    for specifier in externals {
        nodes.push(SourceNode {
            id: external_id(specifier),
            ast_type: "ExternalDependency".to_owned(),
            category: SourceNodeCategory::ExternalDependency,
            label: specifier.clone(),
            span: SourceSpan {
                start_line: 0,
                start_column: 0,
                end_line: 0,
                end_column: 0,
            },
            source_path: String::new(),
            component_kind: None,
            declaration_kind: None,
            element_kind: None,
            tag_name: None,
            type_name: None,
            type_value: None,
            type_kind: None,
            exported: None,
            parameters: None,
            is_async: None,
            is_generator: None,
            is_static: None,
            package_name: Some(package_name(specifier)),
            specifier: Some(specifier.clone()),
        });
    }
    let source_type = entries
        .first()
        .and_then(|entry| files.get(entry))
        .map(|file| file.source_type)
        .unwrap_or(SourceType::TypeScript);
    SourceGraph {
        source_path: root.to_string_lossy().into_owned(),
        source_type,
        nodes,
        edges,
        diagnostics,
    }
}

pub(super) fn stabilize_graph_ids(graph: &mut SourceGraph, relative: &str) {
    let mut ids = HashMap::new();
    for node in &mut graph.nodes {
        let old = node.id.clone();
        let new = if node.category == SourceNodeCategory::File {
            format!("file:{relative}")
        } else {
            format!(
                "ast:{relative}:{}:{}:{}",
                node.ast_type, node.span.start_line, node.span.start_column
            )
        };
        node.id = new.clone();
        node.source_path = relative.to_owned();
        ids.insert(old, new);
    }
    for edge in &mut graph.edges {
        if let Some(source) = ids.get(&edge.source) {
            edge.source = source.clone();
        }
        if let Some(target) = ids.get(&edge.target) {
            edge.target = target.clone();
        }
        edge.id = format!("{}->{}:{:?}", edge.source, edge.target, edge.edge_type).to_lowercase();
    }
    for diagnostic in &mut graph.diagnostics {
        diagnostic.source_path = Some(relative.to_owned());
    }
    graph.source_path = relative.to_owned();
}

fn package_name(specifier: &str) -> String {
    let mut parts = specifier.split('/');
    let first = parts.next().unwrap_or(specifier);
    if first.starts_with('@') {
        parts
            .next()
            .map(|second| format!("{first}/{second}"))
            .unwrap_or_else(|| first.to_owned())
    } else {
        first.to_owned()
    }
}

fn external_id(specifier: &str) -> String {
    format!("external:{specifier}")
}

#[cfg(test)]
mod tests {
    use super::package_name;

    #[test]
    fn package_names_preserve_scopes() {
        assert_eq!(package_name("react/jsx-runtime"), "react");
        assert_eq!(package_name("@scope/package/subpath"), "@scope/package");
    }
}
