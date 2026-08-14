use oxc_diagnostics::LabeledSpan;

use super::text::source_span_from_offsets;
use crate::source_graph::model::{DiagnosticSeverity, SourceDiagnostic, SourceSpan};

pub(super) fn source_diagnostic(
    source_text: &str,
    message: String,
    label: Option<&LabeledSpan>,
) -> SourceDiagnostic {
    let span = label.map_or_else(
        || SourceSpan {
            start_line: 1,
            start_column: 1,
            end_line: 1,
            end_column: 1,
        },
        |label| {
            source_span_from_offsets(
                source_text,
                label.offset() as usize,
                (label.offset() + label.len()) as usize,
            )
        },
    );
    SourceDiagnostic {
        severity: DiagnosticSeverity::Error,
        message,
        span,
        source_path: None,
    }
}
