use oxc_ast::{ast::Expression, AstKind};
use oxc_semantic::{AstNodes, NodeId};

use crate::source_graph::model::SourceNodeCategory;

pub(super) fn classify_node(
    kind: AstKind<'_>,
    ast_nodes: &AstNodes<'_>,
    node_id: NodeId,
) -> Option<SourceNodeCategory> {
    if matches!(kind, AstKind::Program(_)) {
        return Some(SourceNodeCategory::File);
    }
    if kind.is_type() {
        return Some(SourceNodeCategory::Type);
    }
    if matches!(kind, AstKind::JSXElement(_) | AstKind::JSXFragment(_)) {
        return Some(SourceNodeCategory::Jsx);
    }
    if matches!(
        kind,
        AstKind::ConditionalExpression(_)
            | AstKind::LogicalExpression(_)
            | AstKind::CallExpression(_)
    ) {
        return Some(SourceNodeCategory::RenderExpression);
    }
    if is_nested_function_wrapper(kind, ast_nodes, node_id) {
        return None;
    }
    if matches!(
        kind,
        AstKind::Function(_)
            | AstKind::ArrowFunctionExpression(_)
            | AstKind::Class(_)
            | AstKind::VariableDeclarator(_)
    ) {
        return Some(if is_component_node(kind, ast_nodes, node_id) {
            SourceNodeCategory::Component
        } else {
            SourceNodeCategory::Declaration
        });
    }
    if is_visualized_declaration(kind) {
        return Some(SourceNodeCategory::Declaration);
    }
    None
}

fn is_nested_function_wrapper(
    kind: AstKind<'_>,
    ast_nodes: &AstNodes<'_>,
    node_id: NodeId,
) -> bool {
    matches!(
        kind,
        AstKind::Function(_) | AstKind::ArrowFunctionExpression(_)
    ) && ast_nodes
        .ancestor_kinds(node_id)
        .next()
        .is_some_and(|parent| {
            matches!(
                parent,
                AstKind::MethodDefinition(_) | AstKind::VariableDeclarator(_)
            )
        })
}

fn is_visualized_declaration(kind: AstKind<'_>) -> bool {
    kind.is_declaration()
        || matches!(
            kind,
            AstKind::MethodDefinition(_)
                | AstKind::PropertyDefinition(_)
                | AstKind::TSEnumMember(_)
                | AstKind::TSPropertySignature(_)
                | AstKind::TSMethodSignature(_)
                | AstKind::TSCallSignatureDeclaration(_)
                | AstKind::TSConstructSignatureDeclaration(_)
                | AstKind::TSIndexSignature(_)
        )
}

fn is_component_node(kind: AstKind<'_>, ast_nodes: &AstNodes<'_>, node_id: NodeId) -> bool {
    match kind {
        AstKind::Function(function) => function
            .id
            .as_ref()
            .is_some_and(|identifier| is_component_name(identifier.name.as_str())),
        AstKind::Class(class) => class
            .id
            .as_ref()
            .is_some_and(|identifier| is_component_name(identifier.name.as_str())),
        AstKind::VariableDeclarator(variable) => {
            variable_name(variable).is_some_and(|name| is_component_name(&name))
                && variable.init.as_ref().is_some_and(|expression| {
                    matches!(
                        expression,
                        Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)
                    )
                })
        }
        AstKind::ArrowFunctionExpression(_) => ast_nodes
            .ancestor_kinds(node_id)
            .find_map(|ancestor| match ancestor {
                AstKind::VariableDeclarator(variable) => variable_name(variable),
                _ => None,
            })
            .is_some_and(|name| is_component_name(&name)),
        _ => false,
    }
}

pub(super) fn variable_name(variable: &oxc_ast::ast::VariableDeclarator<'_>) -> Option<String> {
    variable
        .id
        .get_binding_identifier()
        .map(|identifier| identifier.name.to_string())
}

fn is_component_name(name: &str) -> bool {
    name.chars().next().is_some_and(char::is_uppercase)
}
