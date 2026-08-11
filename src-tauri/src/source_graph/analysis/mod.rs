mod classification;
mod diagnostics;
mod orchestrator;
mod projection;
mod text;

pub use orchestrator::analyze_source_path;

#[cfg(test)]
mod tests;
