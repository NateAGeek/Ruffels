use std::{collections::HashMap, path::Path};

use oxc_ast::{
    ast::{BindingPattern, Expression, FormalParameters, PropertyKey},
    AstKind,
};
use oxc_semantic::{AstNodes, NodeId};
use oxc_span::GetSpan;

use super::{
    ast_kind::AstKindExt,
    orchestrator::IncludedNode,
    text::{compact_source_label, source_slice, source_span},
};
use crate::source_graph::model::{SourceNode, SourceNodeCategory, SourceParameter, SourceTypeKind};

pub(super) fn project_node(
    node: &IncludedNode<'_>,
    ast_nodes: &AstNodes<'_>,
    included_ids: &HashMap<NodeId, String>,
    source_text: &str,
    source_path: &str,
    file_index: usize,
) -> SourceNode {
    let kind = node.kind;
    let mut source_node = SourceNode {
        id: included_ids
            .get(&node.id)
            .cloned()
            .unwrap_or_else(|| graph_node_id(file_index, kind)),
        ast_type: kind.as_str().to_owned(),
        category: node.category,
        label: node_label(kind, source_text, source_path),
        span: source_span(source_text, kind.span()),
        source_path: source_path.to_owned(),
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
        package_name: None,
        specifier: None,
    };

    source_node.exported = Some(is_exported(ast_nodes, node.id));
    apply_node_metadata(&mut source_node, node, source_text);
    source_node
}

pub(super) fn graph_node_id(file_index: usize, kind: AstKind<'_>) -> String {
    let span = kind.span();
    format!("{}:{file_index}:{}:{}", kind.as_str(), span.start, span.end)
}

fn is_exported(ast_nodes: &AstNodes<'_>, node_id: NodeId) -> bool {
    ast_nodes.ancestor_kinds(node_id).any(|ancestor| {
        matches!(
            ancestor,
            AstKind::ExportNamedDeclaration(_) | AstKind::ExportDefaultDeclaration(_)
        )
    })
}

fn apply_node_metadata(source_node: &mut SourceNode, node: &IncludedNode<'_>, source_text: &str) {
    if node.category == SourceNodeCategory::Type {
        apply_type_metadata(source_node, node.kind, source_text);
    }

    match node.kind {
        AstKind::Function(function) => {
            apply_function_metadata(
                source_node,
                &function.params,
                function.r#async,
                function.generator,
                source_text,
            );
            source_node.component_kind = is_component(node).then(|| "function".to_owned());
            source_node.declaration_kind = is_declaration(node).then(|| "function".to_owned());
        }
        AstKind::ArrowFunctionExpression(arrow) => {
            apply_function_metadata(
                source_node,
                &arrow.params,
                arrow.r#async,
                false,
                source_text,
            );
            source_node.component_kind = is_component(node).then(|| "arrow".to_owned());
        }
        AstKind::VariableDeclarator(variable) => {
            apply_variable_metadata(source_node, variable, node, source_text);
        }
        AstKind::MethodDefinition(method) => {
            apply_function_metadata(
                source_node,
                &method.value.params,
                method.value.r#async,
                method.value.generator,
                source_text,
            );
            source_node.is_static = Some(method.r#static);
            source_node.declaration_kind = Some(format!("{:?}", method.kind).to_lowercase());
        }
        AstKind::PropertyDefinition(property) => {
            source_node.is_static = Some(property.r#static);
            source_node.declaration_kind = Some("class property".to_owned());
        }
        AstKind::JSXElement(element) => {
            let tag_name = source_slice(source_text, element.opening_element.name.span());
            source_node.element_kind = Some(
                if tag_name.chars().next().is_some_and(char::is_uppercase) {
                    "component"
                } else {
                    "intrinsic"
                }
                .to_owned(),
            );
            source_node.tag_name = Some(tag_name);
        }
        _ if is_declaration(node) => {
            source_node.declaration_kind = Some(source_node.ast_type.clone());
        }
        _ => {}
    }
}

fn apply_type_metadata(source_node: &mut SourceNode, kind: AstKind<'_>, source_text: &str) {
    let (type_kind, type_name, type_value) = match kind {
        AstKind::TSTypeAliasDeclaration(declaration) => (
            SourceTypeKind::Declared,
            declaration.id.name.to_string(),
            source_slice(source_text, declaration.type_annotation.span()),
        ),
        AstKind::TSInterfaceDeclaration(declaration) => (
            SourceTypeKind::Declared,
            declaration.id.name.to_string(),
            source_slice(source_text, declaration.body.span),
        ),
        AstKind::TSEnumDeclaration(declaration) => (
            SourceTypeKind::Declared,
            declaration.id.name.to_string(),
            source_slice(source_text, declaration.body.span),
        ),
        AstKind::Class(class) => (
            SourceTypeKind::Declared,
            class
                .id
                .as_ref()
                .map(|identifier| identifier.name.to_string())
                .unwrap_or_else(|| "anonymous class".to_owned()),
            source_slice(source_text, class.body.span),
        ),
        _ if is_primitive_type(kind) => (
            SourceTypeKind::Primitive,
            "primitive".to_owned(),
            source_slice(source_text, kind.span()).trim().to_owned(),
        ),
        _ => (
            SourceTypeKind::Compound,
            compound_type_name(kind).to_owned(),
            source_slice(source_text, kind.span())
                .trim_start_matches(':')
                .trim()
                .to_owned(),
        ),
    };
    source_node.type_kind = Some(type_kind);
    source_node.type_name = Some(type_name);
    source_node.type_value = Some(type_value);
}

fn is_primitive_type(kind: AstKind<'_>) -> bool {
    matches!(
        kind,
        AstKind::TSAnyKeyword(_)
            | AstKind::TSStringKeyword(_)
            | AstKind::TSBooleanKeyword(_)
            | AstKind::TSNumberKeyword(_)
            | AstKind::TSNeverKeyword(_)
            | AstKind::TSIntrinsicKeyword(_)
            | AstKind::TSUnknownKeyword(_)
            | AstKind::TSNullKeyword(_)
            | AstKind::TSUndefinedKeyword(_)
            | AstKind::TSVoidKeyword(_)
            | AstKind::TSSymbolKeyword(_)
            | AstKind::TSThisType(_)
            | AstKind::TSObjectKeyword(_)
            | AstKind::TSBigIntKeyword(_)
    )
}

fn compound_type_name(kind: AstKind<'_>) -> &'static str {
    match kind {
        AstKind::TSUnionType(_) => "union",
        AstKind::TSIntersectionType(_) => "intersection",
        AstKind::TSArrayType(_) => "array",
        AstKind::TSTupleType(_) => "tuple",
        AstKind::TSFunctionType(_) | AstKind::TSConstructorType(_) => "function",
        AstKind::TSTypeLiteral(_) => "object",
        AstKind::TSTypeReference(_) => "reference",
        AstKind::TSLiteralType(_) => "literal",
        AstKind::TSTypeAnnotation(_) => "annotation",
        _ => "type expression",
    }
}

fn apply_variable_metadata(
    source_node: &mut SourceNode,
    variable: &oxc_ast::ast::VariableDeclarator<'_>,
    node: &IncludedNode<'_>,
    source_text: &str,
) {
    match variable.init.as_ref() {
        Some(Expression::ArrowFunctionExpression(arrow)) => {
            apply_function_metadata(
                source_node,
                &arrow.params,
                arrow.r#async,
                false,
                source_text,
            );
            source_node.component_kind = is_component(node).then(|| "arrow".to_owned());
        }
        Some(Expression::FunctionExpression(function)) => {
            apply_function_metadata(
                source_node,
                &function.params,
                function.r#async,
                function.generator,
                source_text,
            );
            source_node.component_kind = is_component(node).then(|| "function".to_owned());
        }
        _ => {}
    }
    source_node.declaration_kind = is_declaration(node).then(|| "variable".to_owned());
}

fn apply_function_metadata(
    source_node: &mut SourceNode,
    parameters: &FormalParameters<'_>,
    is_async: bool,
    is_generator: bool,
    source_text: &str,
) {
    source_node.parameters = Some(function_parameters(parameters, source_text));
    source_node.is_async = Some(is_async);
    source_node.is_generator = Some(is_generator);
}

fn is_component(node: &IncludedNode<'_>) -> bool {
    node.category == SourceNodeCategory::Component
}

fn is_declaration(node: &IncludedNode<'_>) -> bool {
    node.category == SourceNodeCategory::Declaration
}

fn node_label(kind: AstKind<'_>, source_text: &str, source_path: &str) -> String {
    match kind {
        AstKind::Program(_) => Path::new(source_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("source")
            .to_owned(),
        AstKind::Function(function) => function
            .id
            .as_ref()
            .map(|identifier| identifier.name.to_string())
            .unwrap_or_else(|| "anonymous function".to_owned()),
        AstKind::Class(class) => class
            .id
            .as_ref()
            .map(|identifier| identifier.name.to_string())
            .unwrap_or_else(|| "anonymous class".to_owned()),
        AstKind::VariableDeclarator(variable) => {
            variable_name(variable).unwrap_or_else(|| "variable".to_owned())
        }
        AstKind::MethodDefinition(method) => property_name(&method.key, source_text),
        AstKind::PropertyDefinition(property) => property_name(&property.key, source_text),
        AstKind::TSTypeAliasDeclaration(declaration) => declaration.id.name.to_string(),
        AstKind::TSInterfaceDeclaration(declaration) => declaration.id.name.to_string(),
        AstKind::TSEnumDeclaration(declaration) => declaration.id.name.to_string(),
        AstKind::JSXElement(element) => format!(
            "<{}>",
            source_slice(source_text, element.opening_element.name.span())
        ),
        AstKind::JSXFragment(_) => "<> fragment".to_owned(),
        AstKind::ConditionalExpression(_) => "conditional".to_owned(),
        AstKind::LogicalExpression(expression) => format!("{:?}", expression.operator),
        AstKind::CallExpression(_) => "call".to_owned(),
        _ => compact_source_label(source_text, kind.span(), kind.as_str()),
    }
}

fn function_parameters(
    parameters: &FormalParameters<'_>,
    source_text: &str,
) -> Vec<SourceParameter> {
    let mut values = parameters
        .items
        .iter()
        .map(|parameter| SourceParameter {
            name: binding_pattern_name(&parameter.pattern, source_text),
            type_annotation: parameter.type_annotation.as_ref().map(|annotation| {
                source_slice(source_text, annotation.span)
                    .trim_start_matches(':')
                    .trim()
                    .to_owned()
            }),
        })
        .collect::<Vec<_>>();
    if let Some(rest) = &parameters.rest {
        values.push(SourceParameter {
            name: format!(
                "...{}",
                binding_pattern_name(&rest.rest.argument, source_text)
            ),
            type_annotation: rest.type_annotation.as_ref().map(|annotation| {
                source_slice(source_text, annotation.span)
                    .trim_start_matches(':')
                    .trim()
                    .to_owned()
            }),
        });
    }
    values
}

fn binding_pattern_name(pattern: &BindingPattern<'_>, source_text: &str) -> String {
    pattern
        .get_binding_identifier()
        .map(|identifier| identifier.name.to_string())
        .unwrap_or_else(|| source_slice(source_text, pattern.span()))
}

fn property_name(property: &PropertyKey<'_>, source_text: &str) -> String {
    source_slice(source_text, property.span())
}

fn variable_name(variable: &oxc_ast::ast::VariableDeclarator<'_>) -> Option<String> {
    variable
        .id
        .get_binding_identifier()
        .map(|identifier| identifier.name.to_string())
}
