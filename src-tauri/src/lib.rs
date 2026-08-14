mod project;
mod source_graph;

use project::{
    forget_recent_project as forget_recent, initialize_project as initialize,
    inspect_project as inspect, list_recent_projects as list_recents,
    open_project as open_project_index, ProjectConfig, ProjectError, ProjectFileContent,
    ProjectIndex, ProjectInspection, ProjectSummary, RecentProject,
};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

#[derive(serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum CommandResponse<T> {
    Success { data: T },
    Error { error: ProjectError },
}

#[tauri::command]
async fn inspect_project(path: String) -> CommandResponse<ProjectInspection> {
    blocking_project_call(move || inspect(path)).await
}

#[tauri::command]
async fn initialize_project(
    root: String,
    config: ProjectConfig,
) -> CommandResponse<ProjectSummary> {
    blocking_project_call(move || initialize(root, config)).await
}

#[tauri::command]
async fn open_project(
    app: tauri::AppHandle,
    root: String,
    force_reindex: bool,
    additional_entry_points: Vec<String>,
) -> CommandResponse<ProjectIndex> {
    let app_data = match app.path().app_data_dir() {
        Ok(path) => path,
        Err(error) => {
            return CommandResponse::Error {
                error: ProjectError::IoFailed {
                    message: error.to_string(),
                },
            }
        }
    };
    match tauri::async_runtime::spawn_blocking(move || {
        open_project_index(root, force_reindex, additional_entry_points)
    })
    .await
    {
        Ok(Ok(index)) => {
            if let Err(error) = project::record_recent_project(&app_data, &index.project) {
                return CommandResponse::Error { error };
            }
            CommandResponse::Success { data: index }
        }
        Ok(Err(error)) => CommandResponse::Error { error },
        Err(error) => CommandResponse::Error {
            error: ProjectError::IoFailed {
                message: error.to_string(),
            },
        },
    }
}

#[tauri::command]
fn list_recent_projects(app: tauri::AppHandle) -> CommandResponse<Vec<RecentProject>> {
    let result = app
        .path()
        .app_data_dir()
        .map_err(|error| ProjectError::IoFailed {
            message: error.to_string(),
        })
        .and_then(|path| list_recents(&path));
    project_response(result)
}

#[tauri::command]
fn forget_recent_project(app: tauri::AppHandle, root: String) -> CommandResponse<()> {
    let result = app
        .path()
        .app_data_dir()
        .map_err(|error| ProjectError::IoFailed {
            message: error.to_string(),
        })
        .and_then(|path| forget_recent(&path, &root));
    project_response(result)
}

#[tauri::command]
fn read_project_file(root: String, source_path: String) -> CommandResponse<ProjectFileContent> {
    project_response(project::read_project_file(&root, &source_path))
}

#[tauri::command]
fn open_source_file(
    app: tauri::AppHandle,
    root: String,
    source_path: String,
    start_line: usize,
    start_column: usize,
) -> CommandResponse<()> {
    let path = match project::resolve_source_file(&root, &source_path) {
        Ok(path) => path,
        Err(error) => return CommandResponse::Error { error },
    };

    #[cfg(target_os = "windows")]
    let result = {
        let location = format!("{}:{start_line}:{start_column}", path.to_string_lossy());
        match std::process::Command::new("code")
            .arg("--goto")
            .arg(location)
            .spawn()
        {
            Ok(_) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => app
                .opener()
                .open_path(path.to_string_lossy(), None::<&str>)
                .map_err(|open_error| ProjectError::IoFailed {
                    message: open_error.to_string(),
                }),
            Err(error) => Err(ProjectError::IoFailed {
                message: error.to_string(),
            }),
        }
    };

    #[cfg(not(target_os = "windows"))]
    let result = app
        .opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|error| ProjectError::IoFailed {
            message: error.to_string(),
        });

    project_response(result)
}

async fn blocking_project_call<T, F>(operation: F) -> CommandResponse<T>
where
    T: serde::Serialize + Send + 'static,
    F: FnOnce() -> Result<T, ProjectError> + Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(operation).await {
        Ok(result) => project_response(result),
        Err(error) => CommandResponse::Error {
            error: ProjectError::IoFailed {
                message: error.to_string(),
            },
        },
    }
}

fn project_response<T>(result: Result<T, ProjectError>) -> CommandResponse<T> {
    match result {
        Ok(data) => CommandResponse::Success { data },
        Err(error) => CommandResponse::Error { error },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            inspect_project,
            initialize_project,
            open_project,
            list_recent_projects,
            forget_recent_project,
            open_source_file,
            read_project_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
