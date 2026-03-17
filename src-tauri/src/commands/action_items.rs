use crate::db::action_items::ActionItemRow;
use crate::db::Database;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn get_action_items(
    db: State<'_, Arc<Mutex<Database>>>,
    project_id: String,
    limit: i64,
) -> Result<Vec<ActionItemRow>, String> {
    if !(1..=100).contains(&limit) {
        return Err("limit must be between 1 and 100".to_string());
    }
    let db = db.lock().await;
    db.get_active_action_items(&project_id, limit)
        .map_err(|e| format!("failed to get action items: {}", e))
}

#[tauri::command]
pub async fn dismiss_action_item(
    db: State<'_, Arc<Mutex<Database>>>,
    id: i64,
) -> Result<(), String> {
    let db = db.lock().await;
    db.dismiss_action_item(id)
        .map_err(|e| format!("failed to dismiss action item: {}", e))
}

#[tauri::command]
pub async fn get_action_item_count(
    db: State<'_, Arc<Mutex<Database>>>,
    project_id: String,
) -> Result<i64, String> {
    let db = db.lock().await;
    db.get_active_action_item_count(&project_id)
        .map_err(|e| format!("failed to get action item count: {}", e))
}

#[cfg(test)]
mod tests {
    use crate::db::test_helpers::*;

    #[test]
    fn test_action_items_database_operations() {
        let (db, _path) = make_test_db("action_items_ops");

        let project = db
            .create_project("Test Project", "/tmp/test")
            .expect("Failed to create project");

        let item1 = db
            .insert_action_item(
                &project.id,
                "shepherd",
                "Fix bug",
                "There is a bug in the code",
                None,
            )
            .expect("Failed to insert item");

        assert_eq!(item1.title, "Fix bug");
        assert_eq!(item1.status, "active");

        let items = db
            .get_active_action_items(&project.id, 10)
            .expect("Failed to get items");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Fix bug");

        let count = db
            .get_active_action_item_count(&project.id)
            .expect("Failed to get count");
        assert_eq!(count, 1);

        db.dismiss_action_item(item1.id)
            .expect("Failed to dismiss item");

        let items_after = db
            .get_active_action_items(&project.id, 10)
            .expect("Failed to get items after dismiss");
        assert_eq!(items_after.len(), 0);

        let count_after = db
            .get_active_action_item_count(&project.id)
            .expect("Failed to get count after dismiss");
        assert_eq!(count_after, 0);
    }
}
