use std::sync::{Mutex, Arc};
use tauri::State;
use crate::opencode_client::OpenCodeClient;
use crate::server_manager;
use crate::db;
use crate::command_discovery::{
    scan_skills_directory, scan_commands_directory,
    search_project_files, builtin_claude_commands,
};

/// Get list of available agents from OpenCode server
#[tauri::command]
pub async fn get_agents(
    client: State<'_, OpenCodeClient>,
) -> Result<Vec<crate::opencode_client::AgentInfo>, String> {
    client
        .list_agents()
        .await
        .map_err(|e| format!("Failed to get agents: {}", e))
}

/// Create a new OpenCode session
#[tauri::command]
pub async fn create_session(
    client: State<'_, OpenCodeClient>,
    title: String,
) -> Result<String, String> {
    client
        .create_session(title)
        .await
        .map_err(|e| format!("Failed to create session: {}", e))
}

/// Send a prompt to an OpenCode session
#[tauri::command]
pub async fn send_prompt(
    client: State<'_, OpenCodeClient>,
    session_id: String,
    text: String,
) -> Result<serde_json::Value, String> {
    client
        .send_prompt(&session_id, text)
        .await
        .map_err(|e| format!("Failed to send prompt: {}", e))
}

/// List available commands from a running OpenCode server for the project
#[tauri::command]
pub async fn list_opencode_commands(
    db: State<'_, Arc<Mutex<db::Database>>>,
    server_mgr: State<'_, server_manager::ServerManager>,
    project_id: String,
) -> Result<Vec<crate::opencode_client::CommandInfo>, String> {
    // Detect provider — branch to filesystem scanning for claude-code
    let provider = {
        let db = crate::db::acquire_db(&db);
        db.resolve_ai_provider(&project_id)
    };

    if provider == "claude-code" {
        let project_path = {
            let db = crate::db::acquire_db(&db);
            db.get_project(&project_id)
                .map_err(|e| format!("Failed to get project: {}", e))?
                .map(|p| p.path)
        };

        let mut commands_map = std::collections::HashMap::<String, crate::opencode_client::CommandInfo>::new();

        // 1. Start with built-in commands (lowest priority)
        for cmd in builtin_claude_commands() {
            commands_map.insert(cmd.name.clone(), cmd);
        }

        // 2. Scan .claude/commands/ directories (override built-ins)
        if let Some(ref proj_path) = project_path {
            let proj = std::path::Path::new(proj_path);
            for cmd in scan_commands_directory(&proj.join(".claude").join("commands")) {
                commands_map.insert(cmd.name.clone(), cmd);
            }
        }
        if let Some(home) = dirs::home_dir() {
            for cmd in scan_commands_directory(&home.join(".claude").join("commands")) {
                commands_map.entry(cmd.name.clone()).or_insert(cmd);
            }
        }

        // 3. Scan .claude/skills/ directories (highest priority - override commands)
        if let Some(ref proj_path) = project_path {
            let proj = std::path::Path::new(proj_path);
            for skill in scan_skills_directory(&proj.join(".claude").join("skills"), "project") {
                commands_map.insert(skill.name.clone(), crate::opencode_client::CommandInfo {
                    name: skill.name,
                    description: skill.description,
                    source: Some("skill".to_string()),
                    agent: skill.agent,
                    extra: serde_json::Map::new(),
                });
            }
        }
        if let Some(home) = dirs::home_dir() {
            for skill in scan_skills_directory(&home.join(".claude").join("skills"), "user") {
                commands_map.entry(skill.name.clone()).or_insert(crate::opencode_client::CommandInfo {
                    name: skill.name.clone(),
                    description: skill.description,
                    source: Some("skill".to_string()),
                    agent: skill.agent,
                    extra: serde_json::Map::new(),
                });
            }
        }

        let mut result: Vec<_> = commands_map.into_values().collect();
        result.sort_by(|a, b| a.name.cmp(&b.name));
        return Ok(result);
    }

    // Get task IDs for the project
    let task_ids: Vec<String> = {
        let db = crate::db::acquire_db(&db);
        db.get_tasks_for_project(&project_id)
            .map_err(|e| format!("Failed to get tasks: {}", e))?
            .into_iter()
            .map(|t| t.id)
            .collect()
    };

    // Find any running server
    let port = match server_mgr.get_any_server_port_for_project(&task_ids).await {
        Some(p) => p,
        None => return Ok(vec![]),  // Graceful degradation
    };

    // Query the server
    let client = OpenCodeClient::with_base_url(format!("http://127.0.0.1:{}", port));
    client.list_commands().await
        .map_err(|e| format!("Failed to list commands: {}", e))
}

/// Search files in a running OpenCode server for the project
#[tauri::command]
pub async fn search_opencode_files(
    db: State<'_, Arc<Mutex<db::Database>>>,
    server_mgr: State<'_, server_manager::ServerManager>,
    project_id: String,
    query: String,
) -> Result<Vec<String>, String> {
    // Detect provider — branch to git index search for claude-code
    let provider = {
        let db = crate::db::acquire_db(&db);
        db.resolve_ai_provider(&project_id)
    };

    if provider == "claude-code" {
        let project_path = {
            let db = crate::db::acquire_db(&db);
            db.get_project(&project_id)
                .map_err(|e| format!("Failed to get project: {}", e))?
                .map(|p| p.path)
        };

        if let Some(path) = project_path {
            return Ok(search_project_files(&path, &query, 10));
        }
        return Ok(vec![]);
    }

    // Get task IDs for the project
    let task_ids: Vec<String> = {
        let db = crate::db::acquire_db(&db);
        db.get_tasks_for_project(&project_id)
            .map_err(|e| format!("Failed to get tasks: {}", e))?
            .into_iter()
            .map(|t| t.id)
            .collect()
    };

    // Find any running server
    let port = match server_mgr.get_any_server_port_for_project(&task_ids).await {
        Some(p) => p,
        None => return Ok(vec![]),  // Graceful degradation
    };

    // Query the server
    let client = OpenCodeClient::with_base_url(format!("http://127.0.0.1:{}", port));
    client.find_files(&query, true, 10).await
        .map_err(|e| format!("Failed to search files: {}", e))
}

/// List available agents from a running OpenCode server for the project
#[tauri::command]
pub async fn list_opencode_agents(
    db: State<'_, Arc<Mutex<db::Database>>>,
    server_mgr: State<'_, server_manager::ServerManager>,
    project_id: String,
) -> Result<Vec<crate::opencode_client::AgentInfo>, String> {
    // Claude Code does not expose agents the same way — return empty
    let provider = {
        let db = crate::db::acquire_db(&db);
        db.resolve_ai_provider(&project_id)
    };
    if provider == "claude-code" {
        return Ok(vec![]);
    }

    // Get task IDs for the project
    let task_ids: Vec<String> = {
        let db = crate::db::acquire_db(&db);
        db.get_tasks_for_project(&project_id)
            .map_err(|e| format!("Failed to get tasks: {}", e))?
            .into_iter()
            .map(|t| t.id)
            .collect()
    };

    // Find any running server
    let port = match server_mgr.get_any_server_port_for_project(&task_ids).await {
        Some(p) => p,
        None => return Ok(vec![]),  // Graceful degradation
    };

    // Query the server
    let client = OpenCodeClient::with_base_url(format!("http://127.0.0.1:{}", port));
    client.list_agents().await
        .map_err(|e| format!("Failed to list agents: {}", e))
}



/// List skills from OpenCode API + filesystem (.opencode/skills/ and .claude/skills/).
/// Merges results, deduplicating by name (API skills take precedence).
#[tauri::command]
pub async fn list_opencode_skills(
    db: State<'_, Arc<Mutex<db::Database>>>,
    server_mgr: State<'_, server_manager::ServerManager>,
    project_id: String,
) -> Result<Vec<crate::opencode_client::SkillInfo>, String> {
    // Get the project path for filesystem scanning and level detection
    let project_path = {
        let db = crate::db::acquire_db(&db);
        db.get_project(&project_id)
            .map_err(|e| format!("Failed to get project: {}", e))?
            .map(|p| p.path)
    };

    // Get task IDs for the project
    let task_ids: Vec<String> = {
        let db = crate::db::acquire_db(&db);
        db.get_tasks_for_project(&project_id)
            .map_err(|e| format!("Failed to get tasks: {}", e))?
            .into_iter()
            .map(|t| t.id)
            .collect()
    };

    // Collect skills from OpenCode API (if server is running)
    let mut skills_map = std::collections::HashMap::<String, crate::opencode_client::SkillInfo>::new();

    if let Some(port) = server_mgr.get_any_server_port_for_project(&task_ids).await {
        let client = OpenCodeClient::with_base_url(format!("http://127.0.0.1:{}", port));
        if let Ok(commands) = client.list_commands().await {
            for cmd in commands {
                if cmd.source.as_deref() != Some("skill") {
                    continue;
                }
                let template = cmd.extra.get("template")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                let level = if let Some(ref proj_path) = project_path {
                    let project_skill_path = std::path::Path::new(proj_path)
                        .join(".opencode")
                        .join("skills")
                        .join(&cmd.name);
                    if project_skill_path.exists() {
                        "project".to_string()
                    } else {
                        "user".to_string()
                    }
                } else {
                    "user".to_string()
                };

                skills_map.insert(cmd.name.clone(), crate::opencode_client::SkillInfo {
                    name: cmd.name,
                    description: cmd.description,
                    agent: cmd.agent,
                    template,
                    level,
                });
            }
        }
    }

    // Scan .claude/skills/ and .opencode/skills/ on the filesystem
    // Project-level directories
    if let Some(ref proj_path) = project_path {
        let proj = std::path::Path::new(proj_path);
        for skills_dir in &[
            proj.join(".claude").join("skills"),
            proj.join(".opencode").join("skills"),
        ] {
            for skill in scan_skills_directory(skills_dir, "project") {
                skills_map.entry(skill.name.clone()).or_insert(skill);
            }
        }
    }

    // User-level directories
    if let Some(home) = dirs::home_dir() {
        for skills_dir in &[
            home.join(".claude").join("skills"),
            home.join(".opencode").join("skills"),
        ] {
            for skill in scan_skills_directory(skills_dir, "user") {
                skills_map.entry(skill.name.clone()).or_insert(skill);
            }
        }
    }

    // Collect and sort by name for stable ordering
    let mut skills: Vec<_> = skills_map.into_values().collect();
    skills.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(skills)
}







