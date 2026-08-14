use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use sha2::{Digest, Sha256};

use crate::source_graph::AnalysisError;

use super::ProjectError;

pub(super) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), ProjectError> {
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes).map_err(|error| io_error(error.to_string()))?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| io_error(error.to_string()))?;
    }
    fs::rename(temporary, path).map_err(|error| io_error(error.to_string()))
}

pub(super) fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub(super) fn now_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub(super) fn io_error(message: String) -> ProjectError {
    ProjectError::IoFailed { message }
}

pub(super) fn analysis_error(path: &str, error: AnalysisError) -> ProjectError {
    ProjectError::AnalysisFailed {
        path: path.to_owned(),
        message: format!("{error:?}"),
    }
}
