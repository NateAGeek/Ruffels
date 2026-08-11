use std::path::Path;

use oxc_allocator::Allocator;
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType as OxcSourceType;

use super::model::AnalysisError;

pub(crate) fn parse_source<'a>(
    allocator: &'a Allocator,
    source_text: &'a str,
    source_path: &Path,
) -> Result<ParserReturn<'a>, AnalysisError> {
    let source_type =
        OxcSourceType::from_path(source_path).map_err(|_| AnalysisError::InvalidExtension)?;
    let parsed = Parser::new(allocator, source_text, source_type).parse();

    if parsed.panicked {
        let message = parsed
            .diagnostics
            .first()
            .map(ToString::to_string)
            .unwrap_or_else(|| "Oxc could not parse the selected source file".to_owned());
        return Err(AnalysisError::ParseFailed { message });
    }

    Ok(parsed)
}
