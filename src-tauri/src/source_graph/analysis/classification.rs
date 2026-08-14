use oxc_ast::AstKind;

use crate::source_graph::model::SourceNodeCategory;

pub(super) fn classify_node(kind: AstKind<'_>) -> Option<SourceNodeCategory> {
    match kind {
        AstKind::Program(_) => Some(SourceNodeCategory::File),
        AstKind::JSXElement(_) | AstKind::JSXFragment(_) => Some(SourceNodeCategory::Jsx),
        AstKind::ConditionalExpression(_) | AstKind::LogicalExpression(_) => {
            Some(SourceNodeCategory::RenderExpression)
        }
        AstKind::CallExpression(_) => Some(SourceNodeCategory::Invocation),
        AstKind::TSTypeAliasDeclaration(_)
        | AstKind::TSInterfaceDeclaration(_)
        | AstKind::TSEnumDeclaration(_)
        | AstKind::Class(_) => Some(SourceNodeCategory::Type),
        AstKind::Function(_)
        | AstKind::ArrowFunctionExpression(_)
        | AstKind::VariableDeclarator(_) => Some(SourceNodeCategory::Declaration),
        AstKind::MethodDefinition(_)
        | AstKind::PropertyDefinition(_)
        | AstKind::TSEnumMember(_)
        | AstKind::TSPropertySignature(_)
        | AstKind::TSMethodSignature(_)
        | AstKind::TSCallSignatureDeclaration(_)
        | AstKind::TSConstructSignatureDeclaration(_)
        | AstKind::TSIndexSignature(_) => Some(SourceNodeCategory::Declaration),
        _ if kind.is_type() => Some(SourceNodeCategory::Type),
        _ if kind.is_declaration() => Some(SourceNodeCategory::Declaration),
        _ => None,
    }
}
