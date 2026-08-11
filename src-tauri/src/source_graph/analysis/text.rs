use oxc_span::Span;

use crate::source_graph::model::SourceSpan;

pub(super) fn compact_source_label(source_text: &str, span: Span, fallback: &str) -> String {
    let value = source_slice(source_text, span)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if value.is_empty() {
        return fallback.to_owned();
    }
    let mut characters = value.chars();
    let shortened = characters.by_ref().take(64).collect::<String>();
    if characters.next().is_some() {
        format!("{shortened}…")
    } else {
        shortened
    }
}

pub(super) fn source_slice(source_text: &str, span: Span) -> String {
    source_text
        .get(span.start as usize..span.end as usize)
        .unwrap_or_default()
        .to_owned()
}

pub(super) fn source_span(source_text: &str, span: Span) -> SourceSpan {
    source_span_from_offsets(source_text, span.start as usize, span.end as usize)
}

pub(super) fn source_span_from_offsets(source_text: &str, start: usize, end: usize) -> SourceSpan {
    let (start_line, start_column) = line_column(source_text, start);
    let (end_line, end_column) = line_column(source_text, end);
    SourceSpan {
        start_line,
        start_column,
        end_line,
        end_column,
    }
}

fn line_column(source_text: &str, offset: usize) -> (usize, usize) {
    let prefix = source_text.get(..offset).unwrap_or(source_text);
    let line = prefix.bytes().filter(|byte| *byte == b'\n').count() + 1;
    let column = prefix
        .rsplit_once('\n')
        .map_or(prefix, |(_, current_line)| current_line)
        .chars()
        .count()
        + 1;
    (line, column)
}
