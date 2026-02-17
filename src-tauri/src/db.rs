use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Database connection wrapper for thread-safe access
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Initialize the database at the given path
    /// Creates the database file if it doesn't exist and runs all migrations
    pub fn new(db_path: PathBuf) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        }

        let conn = Connection::open(&db_path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };

        db.run_migrations()?;

        Ok(db)
    }

    /// Run all database migrations
    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Create tickets table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL,
                jira_status TEXT,
                assignee TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
            [],
        )?;

        // Create agent_sessions table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS agent_sessions (
                id TEXT PRIMARY KEY,
                ticket_id TEXT NOT NULL,
                opencode_session_id TEXT,
                stage TEXT NOT NULL,
                status TEXT NOT NULL,
                checkpoint_data TEXT,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id)
            )",
            [],
        )?;

        // Create agent_logs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                log_type TEXT NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES agent_sessions(id)
            )",
            [],
        )?;

        // Create pull_requests table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS pull_requests (
                id INTEGER PRIMARY KEY,
                ticket_id TEXT NOT NULL,
                repo_owner TEXT NOT NULL,
                repo_name TEXT NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                state TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id)
            )",
            [],
        )?;

        // Create pr_comments table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS pr_comments (
                id INTEGER PRIMARY KEY,
                pr_id INTEGER NOT NULL,
                author TEXT NOT NULL,
                body TEXT NOT NULL,
                comment_type TEXT NOT NULL,
                file_path TEXT,
                line_number INTEGER,
                addressed INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (pr_id) REFERENCES pull_requests(id)
            )",
            [],
        )?;

        // Create config table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // Insert default config values (using INSERT OR IGNORE to avoid duplicates)
        let default_configs = [
            ("jira_api_token", ""),
            ("jira_board_id", ""),
            ("jira_username", ""),
            ("filter_assigned_to_me", "true"),
            ("exclude_done_tickets", "true"),
            ("custom_jql", ""),
            ("github_token", ""),
            ("github_default_repo", ""),
            ("opencode_port", "4096"),
            ("opencode_auto_start", "true"),
            ("jira_poll_interval", "60"),
            ("github_poll_interval", "30"),
        ];

        for (key, value) in &default_configs {
            conn.execute(
                "INSERT OR IGNORE INTO config (key, value) VALUES (?1, ?2)",
                [key, value],
            )?;
        }

        Ok(())
    }

    /// Get a reference to the connection for executing queries
    pub fn connection(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.conn)
    }

    /// Get a config value by key
    pub fn get_config(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM config WHERE key = ?1")?;
        let mut rows = stmt.query([key])?;

        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    /// Set a config value
    pub fn set_config(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            [key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_database_initialization() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_ai_command_center.db");

        // Clean up if exists
        let _ = fs::remove_file(&db_path);

        // Create database
        let db = Database::new(db_path.clone()).expect("Failed to create database");

        // Verify tables exist by querying sqlite_master
        let conn = db.connection();
        let conn = conn.lock().unwrap();

        let table_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('tickets', 'agent_sessions', 'agent_logs', 'pull_requests', 'pr_comments', 'config')",
                [],
                |row| row.get(0),
            )
            .expect("Failed to count tables");

        assert_eq!(table_count, 6, "All 6 tables should be created");

        // Verify default config values
        let config_count: i32 = conn
            .query_row("SELECT COUNT(*) FROM config", [], |row| row.get(0))
            .expect("Failed to count config rows");

        assert_eq!(
            config_count, 12,
            "All 12 default config values should be inserted"
        );

        // Clean up
        drop(conn);
        drop(db);
        let _ = fs::remove_file(&db_path);
    }

    #[test]
    fn test_config_operations() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join("test_config_ops.db");

        // Clean up if exists
        let _ = fs::remove_file(&db_path);

        let db = Database::new(db_path.clone()).expect("Failed to create database");

        // Test getting default config
        let port = db
            .get_config("opencode_port")
            .expect("Failed to get config");
        assert_eq!(port, Some("4096".to_string()));

        // Test setting config
        db.set_config("opencode_port", "8080")
            .expect("Failed to set config");
        let port = db
            .get_config("opencode_port")
            .expect("Failed to get config");
        assert_eq!(port, Some("8080".to_string()));

        // Test non-existent key
        let result = db.get_config("nonexistent").expect("Failed to query");
        assert_eq!(result, None);

        // Clean up
        drop(db);
        let _ = fs::remove_file(&db_path);
    }
}
