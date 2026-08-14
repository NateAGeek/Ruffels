use std::{collections::BTreeMap, fs, path::Path};

use serde::{Deserialize, Serialize};

use crate::source_graph::{SourceGraph, SourceType};

use super::{
    util::{atomic_write, io_error},
    ProjectError, CACHE_DIRECTORY, CACHE_FILE,
};

const CACHE_SCHEMA_VERSION: u32 = 1;
const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct CachedFileAnalysis {
    pub(super) fingerprint: String,
    pub(super) source_type: SourceType,
    pub(super) graph: SourceGraph,
    pub(super) imports: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct IndexCache {
    schema_version: u32,
    engine_version: String,
    config_fingerprint: String,
    pub(super) files: BTreeMap<String, CachedFileAnalysis>,
    indexed_at: u64,
}

impl IndexCache {
    pub(super) fn new(
        config_fingerprint: String,
        files: BTreeMap<String, CachedFileAnalysis>,
        indexed_at: u64,
    ) -> Self {
        Self {
            schema_version: CACHE_SCHEMA_VERSION,
            engine_version: ENGINE_VERSION.to_owned(),
            config_fingerprint,
            files,
            indexed_at,
        }
    }
}

pub(super) fn read_cache(root: &Path, config_fingerprint: &str) -> Option<IndexCache> {
    let bytes = fs::read(root.join(CACHE_DIRECTORY).join(CACHE_FILE)).ok()?;
    let cache = serde_json::from_slice::<IndexCache>(&bytes).ok()?;
    (cache.schema_version == CACHE_SCHEMA_VERSION
        && cache.engine_version == ENGINE_VERSION
        && cache.config_fingerprint == config_fingerprint)
        .then_some(cache)
}

pub(super) fn write_cache(root: &Path, cache: &IndexCache) -> Result<(), ProjectError> {
    let directory = root.join(CACHE_DIRECTORY);
    fs::create_dir_all(&directory).map_err(|error| io_error(error.to_string()))?;
    let bytes = serde_json::to_vec(cache).map_err(|error| io_error(error.to_string()))?;
    atomic_write(&directory.join(CACHE_FILE), &bytes)
}
