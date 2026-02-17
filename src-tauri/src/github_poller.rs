//! GitHub PR Comment Poller
//!
//! Background Tokio task that polls GitHub every 30-60s for new PR comments,
//! inserts them into SQLite, and emits Tauri events.
//!
//! ## Architecture
//! - Spawned as background task in main.rs setup hook
//! - Reads config from database (github_token, github_default_repo, github_poll_interval)
//! - Gets all open PRs from pull_requests table
//! - For each PR, fetches comments via GitHubClient::get_pr_comments()
//! - Inserts NEW comments only (checks if comment id exists)
//! - Emits `new-pr-comment` event with ticket_id and comment_id
//! - Sleeps for poll_interval seconds, then loops
//!
//! ## Error Handling
//! - Logs errors and continues (doesn't crash the polling loop)
//! - Individual PR errors don't stop the batch
//! - Network errors trigger retry on next cycle
//! - Skips polling when github_token is empty

use crate::db::{Database, PrRow};
use crate::github_client::GitHubClient;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{sleep, Duration};

/// Start the GitHub PR comment poller background task
///
/// This function spawns a Tokio task that runs indefinitely, polling GitHub
/// at the configured interval and syncing PR comments to the database.
///
/// # Arguments
/// * `app` - Tauri AppHandle for accessing managed state and emitting events
///
/// # Example
/// ```no_run
/// // In main.rs setup hook:
/// tauri::async_runtime::spawn(start_github_poller(app.handle().clone()));
/// ```
pub async fn start_github_poller(app: AppHandle) {
    let github_client = GitHubClient::new();

    loop {
        // Read config from database
        let db = app.state::<Mutex<Database>>();
        let config = match read_poller_config(&db) {
            Ok(cfg) => cfg,
            Err(e) => {
                eprintln!("[GitHub Poller] Failed to read config: {}", e);
                sleep(Duration::from_secs(60)).await; // Default fallback
                continue;
            }
        };

        // Skip polling if github_token is empty
        if config.github_token.is_empty() {
            eprintln!("[GitHub Poller] github_token is empty. Skipping poll.");
            sleep(Duration::from_secs(config.poll_interval)).await;
            continue;
        }

        println!("[GitHub Poller] Polling GitHub for PR comments...");

        // Sync open PRs from GitHub API into database
        if !config.github_default_repo.is_empty() {
            if let Err(e) = sync_open_prs(&github_client, &db, &config).await {
                eprintln!("[GitHub Poller] Failed to sync open PRs: {}", e);
            }
        } else {
            eprintln!("[GitHub Poller] github_default_repo not configured, skipping PR sync");
        }

        // Get all open PRs from database (now populated by sync)
        let open_prs = match get_open_prs(&db) {
            Ok(prs) => prs,
            Err(e) => {
                eprintln!("[GitHub Poller] Failed to get open PRs: {}", e);
                sleep(Duration::from_secs(config.poll_interval)).await;
                continue;
            }
        };

        println!("[GitHub Poller] Found {} open PRs", open_prs.len());

        // Poll each PR for new comments
        let mut new_comment_count = 0;
        let mut error_count = 0;

        for pr in open_prs {
            match poll_pr_comments(&github_client, &db, &app, &config, &pr).await {
                Ok(count) => new_comment_count += count,
                Err(e) => {
                    eprintln!(
                        "[GitHub Poller] Failed to poll PR {}/{} #{}: {}",
                        pr.repo_owner, pr.repo_name, pr.id, e
                    );
                    error_count += 1;
                }
            }
        }

        println!(
            "[GitHub Poller] Found {} new comments ({} errors)",
            new_comment_count, error_count
        );

        // Sleep for poll interval
        sleep(Duration::from_secs(config.poll_interval)).await;
    }
}

/// Configuration for GitHub poller
#[derive(Debug)]
struct PollerConfig {
    github_token: String,
    github_default_repo: String,
    poll_interval: u64,
}

/// Read poller configuration from database
fn read_poller_config(db: &Mutex<Database>) -> Result<PollerConfig, String> {
    let db = db.lock().unwrap();

    let github_token = db
        .get_config("github_token")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let github_default_repo = db
        .get_config("github_default_repo")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    let poll_interval = db
        .get_config("github_poll_interval")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "30".to_string())
        .parse::<u64>()
        .unwrap_or(30);

    Ok(PollerConfig {
        github_token,
        github_default_repo,
        poll_interval,
    })
}

fn get_open_prs(db: &Mutex<Database>) -> Result<Vec<PrRow>, String> {
    let db = db.lock().unwrap();
    db.get_open_prs().map_err(|e| e.to_string())
}

async fn sync_open_prs(
    github_client: &GitHubClient,
    db: &Mutex<Database>,
    config: &PollerConfig,
) -> Result<usize, String> {
    let parts: Vec<&str> = config.github_default_repo.split('/').collect();
    if parts.len() != 2 {
        return Err("github_default_repo must be in format 'owner/repo'".to_string());
    }
    let (repo_owner, repo_name) = (parts[0], parts[1]);

    let github_prs = github_client
        .list_open_prs(repo_owner, repo_name, &config.github_token)
        .await
        .map_err(|e| format!("Failed to list open PRs: {}", e))?;

    let task_data: Vec<(String, Option<String>)> = {
        let db_lock = db.lock().unwrap();
        db_lock
            .get_task_ids_and_jira_keys()
            .map_err(|e| format!("Failed to get task data: {}", e))?
    };

    let mut jira_key_map: HashMap<String, Vec<String>> = HashMap::new();
    let task_ids: Vec<String> = task_data.iter().map(|(id, _)| id.clone()).collect();
    for (task_id, jira_key) in &task_data {
        if let Some(key) = jira_key {
            jira_key_map
                .entry(key.clone())
                .or_default()
                .push(task_id.clone());
        }
    }

    let open_pr_ids: Vec<i64> = github_prs.iter().map(|pr| pr.number).collect();

    {
        let db_lock = db.lock().unwrap();
        db_lock
            .close_stale_open_prs(repo_owner, repo_name, &open_pr_ids)
            .map_err(|e| format!("Failed to close stale PRs: {}", e))?;
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let mut synced = 0;
    for pr in &github_prs {
        let matched_tasks =
            find_matching_task_ids(&pr.title, &pr.head.ref_name, &task_ids, &jira_key_map);
        for task_id in matched_tasks {
            let db_lock = db.lock().unwrap();
            let _ = db_lock.insert_pull_request(
                pr.number,
                &task_id,
                repo_owner,
                repo_name,
                &pr.title,
                &pr.html_url,
                &pr.state,
                now,
                now,
            );
            drop(db_lock);
            synced += 1;
        }
    }

    println!(
        "[GitHub Poller] Synced {} PRs ({} open on GitHub, {} matched tickets)",
        synced,
        github_prs.len(),
        synced
    );

    Ok(synced)
}

pub fn find_matching_task_ids(
    pr_title: &str,
    pr_branch: &str,
    task_ids: &[String],
    jira_key_map: &HashMap<String, Vec<String>>,
) -> Vec<String> {
    let mut matched = Vec::new();
    let mut seen = HashSet::new();

    for task_id in task_ids {
        if pr_title.contains(task_id.as_str()) || pr_branch.contains(task_id.as_str()) {
            if seen.insert(task_id.clone()) {
                matched.push(task_id.clone());
            }
        }
    }

    let jira_keys_found = extract_jira_keys(pr_title)
        .into_iter()
        .chain(extract_jira_keys(pr_branch));
    for key in jira_keys_found {
        if let Some(task_ids_for_key) = jira_key_map.get(&key) {
            for task_id in task_ids_for_key {
                if seen.insert(task_id.clone()) {
                    matched.push(task_id.clone());
                }
            }
        }
    }

    matched
}

fn extract_jira_keys(text: &str) -> Vec<String> {
    let mut keys = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if chars[i].is_ascii_uppercase() {
            let start = i;
            while i < len && chars[i].is_ascii_uppercase() {
                i += 1;
            }
            if i < len && chars[i] == '-' && i > start {
                i += 1;
                let digit_start = i;
                while i < len && chars[i].is_ascii_digit() {
                    i += 1;
                }
                if i > digit_start {
                    let key: String = chars[start..i].iter().collect();
                    keys.push(key);
                }
            }
        } else {
            i += 1;
        }
    }

    keys
}

/// Poll a single PR for new comments
async fn poll_pr_comments(
    github_client: &GitHubClient,
    db: &Mutex<Database>,
    app: &AppHandle,
    config: &PollerConfig,
    pr: &PrRow,
) -> Result<usize, String> {
    // Fetch comments from GitHub
    let comments = github_client
        .get_pr_comments(&pr.repo_owner, &pr.repo_name, pr.id, &config.github_token)
        .await
        .map_err(|e| format!("Failed to fetch comments: {}", e))?;

    let mut new_count = 0;

    // Insert new comments
    for comment in comments {
        // Check if comment already exists
        let exists = {
            let db_lock = db.lock().unwrap();
            db_lock
                .comment_exists(comment.id)
                .map_err(|e| format!("Failed to check comment existence: {}", e))?
        };

        if exists {
            continue; // Skip existing comments
        }

        // Parse created_at timestamp (ISO 8601 format)
        let created_at = parse_github_timestamp(&comment.created_at).unwrap_or_else(|| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64
        });

        // Insert new comment
        {
            let db_lock = db.lock().unwrap();
            db_lock
                .insert_pr_comment(
                    comment.id,
                    pr.id,
                    &comment.user.login,
                    &comment.body,
                    &comment.comment_type,
                    comment.path.as_deref(),
                    comment.line,
                    created_at,
                )
                .map_err(|e| format!("Failed to insert comment: {}", e))?;
        }

        // Emit event to notify frontend
        if let Err(e) = app.emit(
            "new-pr-comment",
            serde_json::json!({
                "ticket_id": pr.ticket_id,
                "comment_id": comment.id
            }),
        ) {
            eprintln!("[GitHub Poller] Failed to emit event: {}", e);
        }

        new_count += 1;
    }

    Ok(new_count)
}

/// Parse GitHub timestamp (ISO 8601) to Unix timestamp
///
/// Example: "2024-01-01T00:00:00Z" -> 1704067200
fn parse_github_timestamp(timestamp: &str) -> Option<i64> {
    use chrono::{DateTime, Utc};
    DateTime::parse_from_rfc3339(timestamp)
        .ok()
        .map(|dt| dt.with_timezone(&Utc).timestamp())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_github_timestamp() {
        let timestamp = "2024-01-01T00:00:00Z";
        let result = parse_github_timestamp(timestamp);
        assert!(result.is_some());
        assert_eq!(result.unwrap(), 1704067200);
    }

    #[test]
    fn test_parse_github_timestamp_invalid() {
        let timestamp = "invalid";
        let result = parse_github_timestamp(timestamp);
        assert!(result.is_none());
    }

    #[test]
    fn test_find_matching_task_ids_direct_match_in_title() {
        let pr_title = "Fix bug T-42";
        let pr_branch = "main";
        let task_ids = vec!["T-42".to_string(), "T-99".to_string()];
        let jira_map = HashMap::new();

        let matched = find_matching_task_ids(pr_title, pr_branch, &task_ids, &jira_map);
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0], "T-42");
    }

    #[test]
    fn test_find_matching_task_ids_direct_match_in_branch() {
        let pr_title = "Fix authentication";
        let pr_branch = "feature/T-99-auth";
        let task_ids = vec!["T-42".to_string(), "T-99".to_string()];
        let jira_map = HashMap::new();

        let matched = find_matching_task_ids(pr_title, pr_branch, &task_ids, &jira_map);
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0], "T-99");
    }

    #[test]
    fn test_find_matching_task_ids_jira_key_in_title_single_task() {
        let pr_title = "Implement PROJ-123 feature";
        let pr_branch = "main";
        let task_ids = vec!["T-1".to_string()];
        let mut jira_map = HashMap::new();
        jira_map.insert("PROJ-123".to_string(), vec!["T-1".to_string()]);

        let matched = find_matching_task_ids(pr_title, pr_branch, &task_ids, &jira_map);
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0], "T-1");
    }

    #[test]
    fn test_find_matching_task_ids_jira_key_multiple_tasks() {
        let pr_title = "Fix PROJ-456 issue";
        let pr_branch = "main";
        let task_ids = vec!["T-10".to_string(), "T-20".to_string(), "T-30".to_string()];
        let mut jira_map = HashMap::new();
        jira_map.insert(
            "PROJ-456".to_string(),
            vec!["T-10".to_string(), "T-20".to_string()],
        );

        let matched = find_matching_task_ids(pr_title, pr_branch, &task_ids, &jira_map);
        assert_eq!(matched.len(), 2);
        assert!(matched.contains(&"T-10".to_string()));
        assert!(matched.contains(&"T-20".to_string()));
    }

    #[test]
    fn test_find_matching_task_ids_deduplication() {
        let pr_title = "T-5 implements PROJ-789";
        let pr_branch = "feature/T-5";
        let task_ids = vec!["T-5".to_string()];
        let mut jira_map = HashMap::new();
        jira_map.insert("PROJ-789".to_string(), vec!["T-5".to_string()]);

        let matched = find_matching_task_ids(pr_title, pr_branch, &task_ids, &jira_map);
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0], "T-5");
    }

    #[test]
    fn test_find_matching_task_ids_no_matches() {
        let pr_title = "Update documentation";
        let pr_branch = "docs-update";
        let task_ids = vec!["T-100".to_string()];
        let jira_map = HashMap::new();

        let matched = find_matching_task_ids(pr_title, pr_branch, &task_ids, &jira_map);
        assert_eq!(matched.len(), 0);
    }

    #[test]
    fn test_find_matching_task_ids_jira_key_in_branch() {
        let pr_title = "Add feature";
        let pr_branch = "bugfix/JIRA-999";
        let task_ids = vec!["T-7".to_string()];
        let mut jira_map = HashMap::new();
        jira_map.insert("JIRA-999".to_string(), vec!["T-7".to_string()]);

        let matched = find_matching_task_ids(pr_title, pr_branch, &task_ids, &jira_map);
        assert_eq!(matched.len(), 1);
        assert_eq!(matched[0], "T-7");
    }
}
