mod source_graph;

use source_graph::{analyze_source_path, AnalysisError, SourceGraph};

#[derive(serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum AnalyzeSourceResponse {
    Success { graph: SourceGraph },
    Error { error: AnalysisError },
}

#[tauri::command]
async fn analyze_typescript_file(path: String) -> AnalyzeSourceResponse {
    match tauri::async_runtime::spawn_blocking(move || analyze_source_path(path)).await {
        Ok(Ok(graph)) => AnalyzeSourceResponse::Success { graph },
        Ok(Err(error)) => AnalyzeSourceResponse::Error { error },
        Err(join_error) => AnalyzeSourceResponse::Error {
            error: AnalysisError::ParseFailed {
                message: format!("The parser task could not complete: {join_error}"),
            },
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![analyze_typescript_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
