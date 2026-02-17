# Learnings & Conventions

This file accumulates knowledge about the codebase patterns, naming conventions, and best practices discovered during implementation.

---

## Task 1.1: Tauri 2.0 + Svelte + TypeScript Scaffold

### Key Learnings

1. **Tauri 2.0 Configuration**
   - `identifier` field must be at top level of `tauri.conf.json`, not in bundle section
   - `frontendDist` path is validated at compile time via `tauri::generate_context!()` macro
   - Icon files must exist and be valid PNG/ICO/ICNS files (created minimal 1x1 PNGs for scaffold)

2. **Rust Version Compatibility**
   - Tauri 2.10.2 requires Rust 1.88.0+ due to `time` crate dependency
   - Updated from Rust 1.86.0 to 1.93.1 via `rustup update`
   - Removed `shell-open` feature from Tauri 2.0 (doesn't exist in this version)

3. **Svelte + TypeScript Setup**
   - Must install `svelte-preprocess` as dev dependency for TypeScript support in `.svelte` files
   - Vite config must explicitly pass `preprocess: sveltePreprocess()` to svelte plugin
   - `tsconfig.json` requires `verbatimModuleSyntax: true` when using TypeScript in Svelte

4. **Project Structure**
   - Frontend: `src/` (Svelte components, TypeScript)
   - Backend: `src-tauri/` (Rust, Cargo.toml)
   - Build output: `dist/` (Vite builds here, Tauri references it)
   - Config: `vite.config.ts`, `tsconfig.json`, `src-tauri/tauri.conf.json`

5. **Build Process**
   - Frontend: `npm run build` → Vite bundles to `dist/`
   - Backend: `cargo check` validates Rust code
   - Dev: `npm run tauri:dev` runs both frontend dev server and Tauri app

### Conventions Established

- Package name: `ai-command-center` (kebab-case)
- Identifier: `com.opencode.ai-command-center` (reverse domain notation)
- Frontend entry: `src/main.ts` → mounts `App.svelte` to `#app` div
- Tauri entry: `src-tauri/src/main.rs` → minimal boilerplate with `tauri::generate_context!()`


## Task 1.2: SQLite Database Setup (2026-02-17)

### Database Module Implementation
- Created `src-tauri/src/db.rs` with complete schema for all 6 tables
- Used `rusqlite` v0.32 with "bundled" feature (includes SQLite statically)
- Database stored in Tauri app data directory via `app.path().app_data_dir()`
- Thread-safe access via `Arc<Mutex<Connection>>` wrapper

### Schema Details
- All tables use `CREATE TABLE IF NOT EXISTS` for idempotent migrations
- Foreign keys enabled via `PRAGMA foreign_keys = ON`
- Boolean fields stored as INTEGER (0/1) per SQLite convention
- Timestamps stored as INTEGER (Unix epoch)
- Default config values inserted with `INSERT OR IGNORE` to prevent duplicates

### Tauri Integration Patterns
- Database initialized in `.setup()` hook before app runs
- Database stored in Tauri managed state via `app.manage(Mutex::new(database))`
- This allows access from Tauri commands later via `State<Mutex<Database>>`

### Testing
- Added unit tests for database initialization and config operations
- Tests use temp directory and clean up after themselves
- All tests pass: `cargo test` shows 2 passed

### Dependencies Added
- `rusqlite = { version = "0.32", features = ["bundled"] }`
- "bundled" feature includes SQLite library (no system dependency needed)

### Database Location
- macOS: `~/Library/Application Support/com.opencode.ai-command-center/ai_command_center.db`
- Linux: `~/.local/share/ai-command-center/ai_command_center.db`
- Windows: `%APPDATA%\com.opencode.ai-command-center\ai_command_center.db`

### Public API Exposed
- `Database::new(db_path)` - Initialize database with migrations
- `Database::connection()` - Get Arc<Mutex<Connection>> for queries
- `Database::get_config(key)` - Get config value
- `Database::set_config(key, value)` - Set config value

### Next Steps
- CRUD operations for tickets, sessions, logs, PRs will be added in later tasks
- Tauri commands will access database via managed state
- JIRA sync service (Task 2.2) will use this database
- GitHub poller (Task 3.2) will use this database
