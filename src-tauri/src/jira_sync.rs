//! JIRA Sync Service
//!
//! Background Tokio task that polls JIRA every N seconds, refreshes JIRA info on tasks
//! that have JIRA links, and emits Tauri events to notify the frontend.
//!
//! ## Architecture
//! - Spawned as background task in main.rs setup hook
//! - Reads config from database (API token, username, base URL, poll interval)
//! - Queries database for tasks with JIRA links
//! - Fetches JIRA issue data for those specific keys
//! - Updates JIRA status and assignee fields in database (read-only display info)
//! - Emits `jira-sync-complete` event to frontend
//! - Sleeps for poll_interval seconds, then loops
//!
//! ## Error Handling
//! - Logs errors and continues (doesn't crash the sync loop)
//! - Individual ticket errors don't stop the batch
//! - Network errors trigger retry on next cycle

use crate::db::Database;
use crate::jira_client::JiraClient;
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{sleep, Duration};

/// Start the JIRA sync background task
///
/// This function spawns a Tokio task that runs indefinitely, polling JIRA
/// at the configured interval and syncing tickets to the database.
///
/// # Arguments
/// * `app` - Tauri AppHandle for accessing managed state and emitting events
///
/// # Example
/// ```no_run
/// // In main.rs setup hook:
/// tauri::async_runtime::spawn(start_jira_sync(app.handle().clone()));
/// ```
pub async fn start_jira_sync(app: AppHandle) {
    let jira_client = JiraClient::new();

    loop {
        let db = app.state::<Mutex<Database>>();
        let config = match read_sync_config(&db) {
            Ok(cfg) => cfg,
            Err(e) => {
                eprintln!("[JIRA Sync] Failed to read config: {}", e);
                sleep(Duration::from_secs(60)).await;
                continue;
            }
        };

        if config.jira_api_token.is_empty()
            || config.jira_username.is_empty()
            || config.jira_base_url.is_empty()
        {
            sleep(Duration::from_secs(config.poll_interval)).await;
            continue;
        }

        let tasks_result = {
            let db_lock = db.lock().unwrap();
            db_lock.get_tasks_with_jira_links()
        };

        let jira_keys: Vec<String> = match tasks_result {
            Ok(tasks) => tasks
                .into_iter()
                .filter_map(|t| t.jira_key)
                .collect::<HashSet<_>>()
                .into_iter()
                .collect(),
            Err(e) => {
                eprintln!("[JIRA Sync] Failed to get linked tasks: {}", e);
                sleep(Duration::from_secs(config.poll_interval)).await;
                continue;
            }
        };

        if jira_keys.is_empty() {
            println!("[JIRA Sync] No tasks with JIRA links, skipping");
            sleep(Duration::from_secs(config.poll_interval)).await;
            continue;
        }

        let jql = format!(
            "key IN ({}) ORDER BY updated DESC",
            jira_keys
                .iter()
                .map(|k| format!("\"{}\"", k))
                .collect::<Vec<_>>()
                .join(",")
        );
        println!("[JIRA Sync] Refreshing JIRA info with JQL: {}", jql);

        match jira_client
            .search_issues(
                &config.jira_base_url,
                &config.jira_username,
                &config.jira_api_token,
                &jql,
            )
            .await
        {
            Ok(issues) => {
                let mut updated = 0;
                for issue in issues {
                    let jira_status = issue
                        .fields
                        .status
                        .as_ref()
                        .map(|s| s.name.clone())
                        .unwrap_or_default();
                    let assignee = issue
                        .fields
                        .assignee
                        .as_ref()
                        .map(|u| u.display_name.clone())
                        .unwrap_or_default();

                    let db_lock = db.lock().unwrap();
                    match db_lock.update_task_jira_info(&issue.key, &jira_status, &assignee) {
                        Ok(count) => updated += count,
                        Err(e) => eprintln!("[JIRA Sync] Failed to update {}: {}", issue.key, e),
                    }
                    drop(db_lock);
                }

                println!("[JIRA Sync] Updated JIRA info for {} tasks", updated);
                if let Err(e) = app.emit("jira-sync-complete", ()) {
                    eprintln!("[JIRA Sync] Failed to emit event: {}", e);
                }
            }
            Err(e) => eprintln!("[JIRA Sync] Failed to fetch issues: {}", e),
        }

        sleep(Duration::from_secs(config.poll_interval)).await;
    }
}

/// Configuration for JIRA sync
#[derive(Debug)]
struct SyncConfig {
    jira_api_token: String,
    jira_base_url: String,
    jira_username: String,
    poll_interval: u64,
}

/// Read sync configuration from database
fn read_sync_config(db: &Mutex<Database>) -> Result<SyncConfig, String> {
    let db = db.lock().unwrap();

    let jira_api_token = db
        .get_config("jira_api_token")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let jira_base_url = db
        .get_config("jira_base_url")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let jira_username = db
        .get_config("jira_username")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let poll_interval = db
        .get_config("jira_poll_interval")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "60".to_string())
        .parse::<u64>()
        .unwrap_or(60);

    Ok(SyncConfig {
        jira_api_token,
        jira_base_url,
        jira_username,
        poll_interval,
    })
}
