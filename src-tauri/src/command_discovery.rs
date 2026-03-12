use std::path::Path;

/// Parse SKILL.md frontmatter to extract name and description.
/// Frontmatter is YAML between `---` delimiters at the start of the file.
pub fn parse_skill_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (None, None);
    }
    // Find the closing ---
    let after_first = &trimmed[3..];
    let end_idx = match after_first.find("\n---") {
        Some(idx) => idx,
        None => return (None, None),
    };
    let frontmatter = &after_first[..end_idx];

    let mut name: Option<String> = None;
    let mut description = String::new();
    let mut in_description = false;

    for line in frontmatter.lines() {
        let trimmed_line = line.trim();
        if trimmed_line.starts_with("name:") {
            name = Some(trimmed_line.trim_start_matches("name:").trim().to_string());
            in_description = false;
        } else if trimmed_line.starts_with("description:") {
            let val = trimmed_line.trim_start_matches("description:").trim();
            if val == "|" || val == ">" || val.is_empty() {
                // Multi-line description follows
                in_description = true;
            } else {
                description = val.to_string();
            }
        } else if in_description {
            if !trimmed_line.is_empty() && (line.starts_with(' ') || line.starts_with('\t')) {
                if !description.is_empty() {
                    description.push(' ');
                }
                description.push_str(trimmed_line);
            } else {
                in_description = false;
            }
        }
    }

    let desc = if description.is_empty() {
        None
    } else {
        Some(description)
    };
    (name, desc)
}

/// Scan a skills directory (e.g. `.claude/skills/` or `.opencode/skills/`) for SKILL.md files.
/// Returns a Vec of SkillInfo with the given level.
pub fn scan_skills_directory(dir: &Path, level: &str) -> Vec<crate::opencode_client::SkillInfo> {
    let mut skills = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return skills,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let skill_file = path.join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }
        let content = match std::fs::read_to_string(&skill_file) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let dir_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let (fm_name, fm_desc) = parse_skill_frontmatter(&content);
        let name = fm_name.unwrap_or(dir_name);
        skills.push(crate::opencode_client::SkillInfo {
            name,
            description: fm_desc,
            agent: None,
            template: Some(content),
            level: level.to_string(),
        });
    }
    skills
}

/// Scan a commands directory (e.g. `.claude/commands/`) for `.md` files.
/// Each `.md` file is a Claude Code custom command.
/// Returns a Vec of CommandInfo with source="command".
pub fn scan_commands_directory(dir: &Path) -> Vec<crate::opencode_client::CommandInfo> {
    let mut commands = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return commands,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or_default();
        if ext != "md" {
            continue;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let file_stem = match path.file_stem().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let (fm_name, fm_desc) = parse_skill_frontmatter(&content);
        let name = fm_name.unwrap_or(file_stem);
        commands.push(crate::opencode_client::CommandInfo {
            name,
            description: fm_desc,
            source: Some("command".to_string()),
            agent: None,
            extra: serde_json::Map::new(),
        });
    }
    commands
}

/// Search tracked files in a git repository by path substring (case-insensitive).
/// Returns up to `limit` matching file paths.
pub fn search_project_files(project_path: &str, query: &str, limit: usize) -> Vec<String> {
    let repo = match git2::Repository::open(project_path) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let index = match repo.index() {
        Ok(i) => i,
        Err(_) => return vec![],
    };
    let lower_query = query.to_lowercase();
    let mut results = Vec::new();
    for entry in index.iter() {
        if results.len() >= limit {
            break;
        }
        let path = std::str::from_utf8(&entry.path).unwrap_or_default();
        if path.to_lowercase().contains(&lower_query) {
            results.push(path.to_string());
        }
    }
    results
}

/// Returns a static curated list of built-in Claude Code slash commands.
pub fn builtin_claude_commands() -> Vec<crate::opencode_client::CommandInfo> {
    let commands = [
        ("compact", "Compact conversation to reduce context usage"),
        ("init", "Initialize project with CLAUDE.md"),
        ("review", "Review current changes"),
        ("bug", "Report a bug in Claude Code"),
        ("config", "Open Claude Code configuration"),
        ("cost", "Show token usage and cost"),
        ("clear", "Clear conversation history"),
        ("help", "Show available commands"),
        ("vim", "Toggle vim mode"),
        ("model", "Switch AI model"),
        ("permissions", "View and manage tool permissions"),
        ("memory", "Edit CLAUDE.md memory file"),
        ("doctor", "Check health of your Claude Code installation"),
        (
            "terminal-setup",
            "Install shift+enter key binding for terminal",
        ),
        ("login", "Login to your Anthropic account"),
        ("logout", "Logout from your Anthropic account"),
    ];
    commands
        .iter()
        .map(|(name, desc)| crate::opencode_client::CommandInfo {
            name: name.to_string(),
            description: Some(desc.to_string()),
            source: Some("builtin".to_string()),
            agent: None,
            extra: serde_json::Map::new(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── scan_commands_directory ──────────────────────────────────────────────

    #[test]
    fn test_scan_commands_directory_happy_path() {
        let dir = tempfile::tempdir().unwrap();

        // File 1: frontmatter with name + description
        let file1 = dir.path().join("my-command.md");
        std::fs::write(
            &file1,
            "---\nname: custom-name\ndescription: A custom description\n---\n# Body",
        )
        .unwrap();

        // File 2: frontmatter with only description (name falls back to filename)
        let file2 = dir.path().join("another-cmd.md");
        std::fs::write(&file2, "---\ndescription: Another description\n---\n# Body").unwrap();

        let mut commands = scan_commands_directory(dir.path());
        commands.sort_by(|a, b| a.name.cmp(&b.name));

        assert_eq!(commands.len(), 2);

        // "another-cmd" (filename fallback)
        assert_eq!(commands[0].name, "another-cmd");
        assert_eq!(
            commands[0].description,
            Some("Another description".to_string())
        );
        assert_eq!(commands[0].source, Some("command".to_string()));

        // "custom-name" (from frontmatter)
        assert_eq!(commands[1].name, "custom-name");
        assert_eq!(
            commands[1].description,
            Some("A custom description".to_string())
        );
        assert_eq!(commands[1].source, Some("command".to_string()));
    }

    #[test]
    fn test_scan_commands_directory_nonexistent() {
        let result = scan_commands_directory(Path::new("/nonexistent/path/that/does/not/exist"));
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_commands_frontmatter_name_fallback() {
        let dir = tempfile::tempdir().unwrap();

        // File with no `name:` in frontmatter — should use filename stem
        let file = dir.path().join("fallback-name.md");
        std::fs::write(&file, "---\ndescription: Some desc\n---\n# Content").unwrap();

        let commands = scan_commands_directory(dir.path());
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].name, "fallback-name");
        assert_eq!(commands[0].description, Some("Some desc".to_string()));
        assert_eq!(commands[0].source, Some("command".to_string()));
    }

    // ── search_project_files ─────────────────────────────────────────────────

    #[test]
    fn test_search_project_files_happy_path() {
        let dir = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        // Create a file and add it to the index
        let file_path = dir.path().join("src").join("main.rs");
        std::fs::create_dir_all(file_path.parent().unwrap()).unwrap();
        std::fs::write(&file_path, "fn main() {}").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("src/main.rs")).unwrap();
        index.write().unwrap();

        let results = search_project_files(dir.path().to_str().unwrap(), "main", 10);
        assert!(!results.is_empty());
        assert!(results.iter().any(|p| p.contains("main.rs")));
    }

    #[test]
    fn test_search_project_files_limit() {
        let dir = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        // Add 5 matching files
        let mut index = repo.index().unwrap();
        for i in 0..5 {
            let file_path = dir.path().join(format!("file_{}.rs", i));
            std::fs::write(&file_path, "// content").unwrap();
            index
                .add_path(Path::new(&format!("file_{}.rs", i)))
                .unwrap();
        }
        index.write().unwrap();

        let results = search_project_files(dir.path().to_str().unwrap(), "file_", 2);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_project_files_nonexistent() {
        let results = search_project_files("/nonexistent/path/that/does/not/exist", "query", 10);
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_project_files_case_insensitive() {
        let dir = tempfile::tempdir().unwrap();
        let repo = git2::Repository::init(dir.path()).unwrap();

        // File with uppercase letters in name
        let file_path = dir.path().join("MyComponent.tsx");
        std::fs::write(&file_path, "// component").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("MyComponent.tsx")).unwrap();
        index.write().unwrap();

        // Query with lowercase — should still find it
        let results = search_project_files(dir.path().to_str().unwrap(), "mycomponent", 10);
        assert!(!results.is_empty());
        assert!(results.iter().any(|p| p.contains("MyComponent.tsx")));
    }

    // ── builtin_claude_commands ──────────────────────────────────────────────

    #[test]
    fn test_builtin_claude_commands() {
        let commands = builtin_claude_commands();

        // Count is between 10 and 20
        assert!(
            commands.len() >= 10,
            "Expected at least 10 commands, got {}",
            commands.len()
        );
        assert!(
            commands.len() <= 20,
            "Expected at most 20 commands, got {}",
            commands.len()
        );

        for cmd in &commands {
            // All have non-empty name
            assert!(!cmd.name.is_empty(), "Command name should not be empty");
            // No slash prefix
            assert!(
                !cmd.name.starts_with('/'),
                "Command name should not start with '/': {}",
                cmd.name
            );
            // All have Some(description)
            assert!(
                cmd.description.is_some(),
                "Command '{}' should have a description",
                cmd.name
            );
            assert!(
                !cmd.description.as_ref().unwrap().is_empty(),
                "Command '{}' description should not be empty",
                cmd.name
            );
            // All have source=Some("builtin")
            assert_eq!(
                cmd.source,
                Some("builtin".to_string()),
                "Command '{}' should have source='builtin'",
                cmd.name
            );
        }
    }
}
