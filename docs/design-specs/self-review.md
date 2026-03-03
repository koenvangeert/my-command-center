# Self-Review — Design Specification

## Overview

The Self-Review page is the "Review" tab within the Task Detail View. It provides a full code review interface for reviewing changes made by the AI agent on the task's branch. The view includes a diff viewer with syntax highlighting, a file tree navigator, a comments sidebar (PR comments + personal notes), and a bottom bar for sending collected feedback back to the agent.

---

## Page Layout

Full-height vertical layout within the Task Detail View body (below the shared header):

1. **Main Content Area** (fills available space, horizontal split)
   - File Tree (left, collapsible)
   - Diff Viewer (center, fills remaining width)
   - Comments Sidebar (right, toggleable, 480px wide)
2. **Status Footer Bar** (fixed at bottom, conditional)
3. **Send to Agent Bar** (fixed at bottom)

---

## 1. Main Content Area

### Loading State
- Centered spinner with "Loading diff..." text

### Error State
- Centered warning icon (⚠) with error message text in red

### Empty State (no changes on branch)
- Large folder icon (📂)
- "No changes on this branch yet" heading
- "Make some changes and they will appear here automatically." helper text

### Normal State
Three-panel horizontal layout when data is loaded:

---

## 2. File Tree (Left Panel)

A collapsible sidebar showing the changed files organized as a directory tree. Shown by default, toggled via a button in the Diff Viewer toolbar.

### Header
- **File count**: "N files" in medium-weight text
- **Change statistics**: Green "+N" additions count, red "−N" deletions count

### Tree Structure
- Hierarchical directory structure built from file paths
- Directories are collapsible/expandable (all expanded by default)
- Directory items show:
  - Expand/collapse triangle icon (▼/▶)
  - Directory name with trailing "/"
  - Muted/secondary color
- File items show:
  - File status icon (colored by type: added, modified, deleted, renamed)
  - File name
  - Change stats: green "+N" and red "−N" counts
- Directories sort before files, both alphabetically
- Clicking a file scrolls the diff viewer to that file
- Selected file has a primary-colored left border and highlighted background

### Layout
- 200px width
- Full-height with vertical scroll
- Base-200 background with right border

---

## 3. Diff Viewer (Center Panel)

The main diff viewing area with a toolbar and scrollable diff content.

### 3.1 Toolbar

A horizontal bar at the top of the diff viewer:

**Left section:**
- **File tree toggle button**: Shows "◧" when tree is visible, "☰" when hidden. Active state has primary color with background
- **Separator**: Thin vertical line
- **Split/Unified toggle**: Two buttons:
  - "Split" — side-by-side diff view (default)
  - "Unified" — combined diff view
  - Active button has primary color with background and border
- **Separator**
- **Wrap toggle**: Button labeled "Wrap" — toggles line wrapping in the diff
- **Separator**
- **Search button**: "🔍" — opens an inline search bar
- **Search bar** (conditional, when search is open):
  - Small text input (160px wide), placeholder "Search diff..."
  - Match counter: "X of Y" or "0 results"
  - Previous match button (▲) with Shift+Enter shortcut
  - Next match button (▼) with Enter shortcut
  - Close button (✕) with Escape shortcut

**Right section (pushed to the right with ml-auto):**
- **Comments toggle button**: "Comments" text with active/inactive styling. Shows an error badge with unaddressed count when sidebar is hidden and comments exist.

### 3.2 Large Diff Warning (conditional)

Shown when total changes exceed 5000 lines:
- Warning alert banner: "Large diff — N files, N total changes. N files auto-collapsed for performance."

### 3.3 File Diff Sections

Each changed file is rendered as a collapsible card:

#### File Header (clickable to collapse/expand)
- **Collapse indicator**: ▶ (collapsed) or ▼ (expanded)
- **File status icon**: Colored symbol indicating the change type (added, modified, deleted, renamed)
- **File path**: Monospace text. For renames, shows old name with strikethrough, arrow "→", and new name
- **Status label**: Uppercase text (ADDED, MODIFIED, DELETED, RENAMED) in status color
- **Change counts**: Green "+N" additions, red "−N" deletions

#### Truncation Warning (conditional)
- Info alert: "Diff truncated — N lines total, showing first N"

#### Diff Content
- Rendered using `@git-diff-view` library with syntax highlighting
- Supports both split (side-by-side) and unified view modes
- Line numbers on both sides
- Color-coded diff: green for additions, red for deletions
- Hover-over "+" button on lines to add inline comments

#### Inline Comments (rendered between diff lines)

Three types of inline comments displayed in the diff:

1. **Existing review comments** (from GitHub PR reviews):
   - Primary/blue left border (4px)
   - Shows author name (bold) and timestamp
   - Comment body text

2. **Pending user comments** (added during self-review):
   - Warning/yellow left border (4px)
   - "Pending" badge in warning color
   - Delete button (✕)
   - Comment body text

3. **AI review comments** (from agent-powered reviews):
   - Success/green left border (4px)
   - "AI Review" badge in success color
   - "Approved" badge (if approved)
   - Approve button (✓) — adds to pending comments
   - Dismiss button (✕)
   - Comment body text

#### Add Comment Widget (shown when clicking the "+" on a diff line)
- Textarea with placeholder "Leave a comment..." (3 rows, resizable)
- Auto-focused when opened
- "Cancel" ghost button and "Add Comment" primary button
- Comment is added to pending comments collection

### 3.4 Auto-Collapse Behavior
- Files with more than 500 total changes are auto-collapsed on initial load
- Truncated files are also auto-collapsed

---

## 4. Comments Sidebar (Right Panel)

A 480px-wide toggleable panel on the right side. Contains two tabs.

### Tab Bar
- Two equal-width tab buttons:
  - **"PR Comments"**: Shows review comments from the linked GitHub PR
    - Error badge with unaddressed count (when > 0)
  - **"Notes"**: Shows personal review notes/comments
    - Ghost badge with note count (when > 0)
- Active tab has primary text, bottom border, and lighter background

### 4.1 PR Comments Tab

#### Controls Row (shown when a linked PR exists)
- **Selection controls**:
  - When comments are selected: "N selected" text + "Clear" button
  - When unaddressed comments exist: "Select all" button
- **Addressed toggle**: "Show N addressed" / "Hide addressed" button (when addressed comments exist)
- **GitHub link**: "GitHub ↗" — opens the PR on GitHub

#### Empty States
- No linked PR: "No linked PR found"
- No comments: Chat bubble icon + "No review comments on this PR yet"
- All addressed: Checkmark icon + "All comments addressed"

#### Comment List
Each comment card contains:
- **Checkbox** (for unaddressed comments only): Selects the comment for sending to agent
- **Author row**: Avatar circle (initial letter, primary bg), @author name, "Addressed" badge (if addressed), relative timestamp
- **File path** (conditional): Monospace text showing "file_path:line_number"
- **Comment body**: Rendered as markdown
- **Action button**:
  - Unaddressed: "✓ Mark addressed" ghost button (green on hover)
  - Addressed: "✓ Addressed" green text

### 4.2 Notes Tab

A vertical layout for managing personal review notes.

#### Archived Comments Section (collapsible, shown when archived notes exist)
- Collapse header: "Previous Round (N)" with expand/collapse triangle
- When expanded: List of archived comments (max 220px height, scrollable):
  - Each shows: comment ID, timestamp, body text
  - All displayed at 50% opacity

#### Active Comments List
- **Empty state**: Pencil icon (📝) + "No comments yet. Add notes from manual testing."
- **Comment cards**: Each shows:
  - Comment number (#1, #2, ...)
  - Relative timestamp
  - Delete button (✕, turns red on hover)
  - Comment body in pre-wrapped text

#### Add Comment Form (pinned at bottom)
- **Textarea**: Bordered, 3 rows, placeholder "Add a testing note... (Cmd+Enter to submit)"
- **Bottom row**:
  - Voice Input button (microphone icon for voice-to-text)
  - "Add" primary button (disabled when textarea is empty)
- Submit shortcut: Cmd+Enter

---

## 5. Status Footer Bar

Shown below the diff viewer when loading/error states are cleared and diff data is available:

- **"Include uncommitted changes" checkbox**: Toggles whether uncommitted working directory changes are included in the diff. Refreshes the diff when toggled.

---

## 6. Send to Agent Bar

A horizontal bar pinned to the very bottom of the Self-Review page.

### Agent Busy Warning (conditional)
When the agent is running or paused, a warning banner appears above the bar:
- Yellow/warning background with lightning icon
- "Agent is working — diff may be stale. Refresh when ready."

### Main Bar Content

**Left section — Comment summary pills:**
Shows colored pills summarizing collected feedback:
- **Inline comments**: Primary/blue pill — "N inline comment(s)" with a small dot
- **General comments**: Warning/yellow pill — "N general comment(s)" with a small dot
- **PR comments**: Error/red pill — "N PR comment(s)" with a small dot (from selected PR comments)
- **Empty state**: Italic muted text "No feedback collected yet"

**Right section — Action buttons:**
- **Error message** (conditional): Red text with warning icon
- **Success message** (conditional): Green text with checkmark, auto-dismisses after 3 seconds
- **"↻ Refresh Diff" button**: Soft-styled, reloads the diff data
- **"→ Send to Agent" button**: Primary-colored, bold. Sends all collected feedback (inline comments + general notes + selected PR comments) to the agent as a compiled prompt. Disabled when:
  - No comments have been collected
  - Agent is busy (running or paused)
  - Currently sending

### Send to Agent Flow
When "Send to Agent" is clicked:
1. All self-review comments (inline + general) are archived in the database
2. Pending inline comments are cleared from the store
3. Archived comments store is refreshed
4. Active comments store is refreshed
5. A compiled review prompt is generated from all collected feedback
6. The prompt is sent to the agent as a new action
7. Selected PR comments are deselected
8. Success message is shown for 3 seconds

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘F | Open diff search |
| Enter | Next search match |
| Shift+Enter | Previous search match |
| Escape | Close search / clear search query |
| ⌘Enter / Ctrl+Enter | Submit comment in Notes tab textarea |
| ⌘D | Toggle voice recording |

---

## 8. Data Flow Summary

| Data Source | What It Shows |
|-------------|--------------|
| `get_task_diff(taskId, includeUncommitted)` | File list and diff data for the branch |
| `get_task_file_contents(...)` | Old/new file content for diff rendering |
| `get_task_batch_file_contents(...)` | Batch file content for performance |
| PR Comments (via `getPrComments`) | GitHub review comments on linked PRs |
| Self-review comments (via `getActiveSelfReviewComments`) | User's own review notes |
| Archived comments (via `getArchivedSelfReviewComments`) | Previously sent feedback rounds |
| `archiveSelfReviewComments(taskId)` | Archives current comments before sending |
| `compileReviewPrompt(...)` | Compiles all feedback into an agent prompt |
