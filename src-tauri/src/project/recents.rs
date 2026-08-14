use std::{fs, path::Path};

use super::{
    util::{atomic_write, io_error, now_timestamp},
    ProjectError, ProjectSummary, RecentProject,
};

pub fn list_recent_projects(app_data: &Path) -> Result<Vec<RecentProject>, ProjectError> {
    let path = app_data.join("recent-projects.json");
    let mut projects = if path.is_file() {
        serde_json::from_slice::<Vec<RecentProject>>(
            &fs::read(&path).map_err(|error| io_error(error.to_string()))?,
        )
        .unwrap_or_default()
    } else {
        Vec::new()
    };
    for project in &mut projects {
        project.available = Path::new(&project.root).is_dir();
    }
    projects.sort_by_key(|project| std::cmp::Reverse(project.last_opened_at));
    Ok(projects)
}

pub fn record_recent_project(
    app_data: &Path,
    project: &ProjectSummary,
) -> Result<(), ProjectError> {
    let mut projects = list_recent_projects(app_data)?;
    projects.retain(|recent| recent.root != project.root);
    projects.push(RecentProject {
        root: project.root.clone(),
        name: project.name.clone(),
        last_opened_at: now_timestamp(),
        available: true,
    });
    projects.sort_by_key(|recent| std::cmp::Reverse(recent.last_opened_at));
    projects.truncate(20);
    write_recents(app_data, &projects)
}

pub fn forget_recent_project(app_data: &Path, root: &str) -> Result<(), ProjectError> {
    let mut projects = list_recent_projects(app_data)?;
    projects.retain(|project| project.root != root);
    write_recents(app_data, &projects)
}

fn write_recents(app_data: &Path, projects: &[RecentProject]) -> Result<(), ProjectError> {
    fs::create_dir_all(app_data).map_err(|error| io_error(error.to_string()))?;
    let bytes = serde_json::to_vec_pretty(projects).map_err(|error| io_error(error.to_string()))?;
    atomic_write(&app_data.join("recent-projects.json"), &bytes)
}
