
## 2026-02-26: HTTP Server Integration Tests

### JSON test data in Rust
When using raw string literals (`r#"..."#`) for JSON test data in Rust, keep the JSON on a single line. Multi-line raw strings include literal newlines which cause JSON parsing errors ("control character found").

**Bad:**
```rust
let json = r#"{
    "title": "Test",
    "description": "Details"
}"#;
```

**Good:**
```rust
let json = r#"{"title": "Test", "description": "Details"}"#;
```

### Tauri test compilation requirements
Tauri's `generate_context!()` macro requires the `frontendDist` directory to exist at compile time. Create an empty `dist/` directory when running `cargo test` in a Tauri project without a built frontend.

### Pre-existing test errors in db modules
The `create_task` method signature requires 5 arguments (title, status, jira_key, project_id, plan_text). Several test files in `db/projects.rs` and `db/tasks.rs` were calling it with only 4 arguments, missing the `plan_text` parameter. This is a pre-existing issue that needs to be fixed separately.
