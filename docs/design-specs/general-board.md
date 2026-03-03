# General Board — Design Specification

## Overview

The General Board is the default landing page of the AI Command Center. It is a three-column kanban board for managing AI-driven development tasks. Tasks flow from **Backlog** through **Doing** to **Done**, with rich status indicators showing agent activity, CI pipeline status, PR review state, and Jira integration.

---

## Page Layout

The page is a full-height vertical layout:

1. **Top Navbar** (shared across all views)
2. **Search / Toolbar Bar**
3. **Three-Column Kanban Board** (fills remaining space)

---

## 1. Top Navbar

A horizontal navigation bar pinned to the top of the window.

### Left Section
- **App title**: "AI Command Center" — small, semibold text
- **DEV badge**: Yellow warning badge shown only in development mode, displays "DEV"
- **Project Switcher**: A dropdown component to switch between configured projects. Each project in the dropdown shows:
  - Project name
  - Attention indicators (colored dots for: needs input, running agents, CI failures, unaddressed comments)
  - A "+ New Project" option at the bottom
- **"+ Add Task" button**: Primary-colored button with keyboard shortcut hint "⌘T". Opens a modal dialog for creating a new task with:
  - Multi-line text input for the task title/prompt
  - Optional Jira key field
  - Submit and Cancel buttons

### Center Section — Navigation Tabs
A pill-style tab group with three buttons:
- **Board** (active by default): Shows the kanban board. Has status indicator dots when tasks are in the "Doing" column:
  - Yellow dot: An agent needs user input (paused/checkpoint)
  - Green pulsing dot: An agent is actively running
  - Blue dot: All agents have completed
  - Ghost badge with count of "Doing" tasks
- **PR Review**: Shows the cross-repo PR review interface. Displays a primary badge with the count of review requests when > 0
- **Settings**: Opens project/global settings

### Right Section
- **OpenCode status indicator**: A small status dot with text:
  - Green dot + "OpenCode Connected" when healthy
  - Red dot + "OpenCode Disconnected" or "OpenCode Unavailable" when not

---

## 2. Search / Toolbar Bar

A horizontal bar below the navbar, above the kanban columns.

### Left Side
- **Search input**: Bordered input field (264px wide) with:
  - Search icon (magnifying glass) on the left
  - Placeholder text "Search tasks..."
  - Clear button (✕) appears when text is entered
  - Keyboard shortcut hint "⌘/" shown to the right
  - Searches across: task ID, title, Jira key, Jira title, and Jira assignee
- **Result count**: Shows "X of Y tasks" when a search query is active

### Right Side
- **GitHub Refresh button**: Ghost square button with a refresh/sync icon. Shows a loading spinner while syncing. Tooltip: "Refresh GitHub data (⌘⇧R)"

---

## 3. Kanban Board

Three equal-width columns in a horizontal flex layout with a 16px gap. Each column has a header and a scrollable card area.

### Column Structure

Each column has:
- **Header row**: Contains the column label (uppercase, semibold, small text with wide tracking) and a ghost badge showing the task count
- **Card area**: Scrollable vertical list of task cards with 10px gap

### Columns

| Column | Label | Status Value | Special Features |
|--------|-------|-------------|------------------|
| Backlog | BACKLOG | `backlog` | — |
| Doing | DOING | `doing` | Status indicator dots on Board nav button |
| Done | DONE | `done` | "Clear" button to remove all done tasks |

The **Done** column header has an additional "Clear" ghost button (shown only when tasks exist) that removes all completed tasks. Shows a spinner while clearing.

Empty columns display centered text: "No tasks"

---

## 4. Task Cards

Each task is displayed as a clickable card. Clicking a card navigates to the Task Detail View.

### Card Layout (top to bottom)

#### Row 1: Header Row
- **Task ID**: Small semibold primary-colored text (e.g., "T-448")
- **Jira key badge**: Ghost badge showing the linked Jira ticket key (e.g., "PROJ-123"), shown only if linked
- **"Needs Input" badge**: Warning-colored, pulsing badge shown when the agent is paused waiting for user input
- **Agent status badge** (right-aligned): Shows the current agent session status:
  - "Running" — green background, pulsing opacity animation
  - "Done" — primary/blue background
  - "Paused" — warning/yellow background
  - "Error" — error/red background
  - "Stopped" — ghost/muted background

#### Row 2: Task Title
- Truncated to 80 characters with ellipsis
- Shows "+N lines" indicator if the title is multiline

#### Row 3: Jira Title (conditional)
- Muted/secondary text showing the linked Jira ticket title (truncated to 80 chars)
- Only shown if a Jira key is linked and Jira data has been fetched

#### Row 4: Pull Request Badges (conditional)
- One badge per linked PR, each showing:
  - "PR #123" — the PR number
  - CI status: "Passed" (green), "Failed" (red, pulsing), or "Pending" (yellow, pulsing)
  - Review status: "Approved" (green), "Changes req." (yellow), or "Needs review" (muted, pulsing)
- Clicking a PR badge opens the PR URL in the system browser
- Color-coded by state:
  - Open: green background
  - Merged: secondary/purple background
  - Ready to merge (open + CI success + approved): green with border
  - Closed: muted background

#### Row 5: Merge Status Banner (conditional)
- "Merged" — secondary-colored banner, shown for merged PRs
- "Ready to merge" — success-colored banner with border, shown for PRs that are open with passing CI and approved reviews

#### Row 6: Unaddressed Comments (conditional)
- Error badge showing "N unaddressed" when there are unaddressed PR review comments

#### Row 7: Jira Assignee (conditional)
- Small muted text showing the Jira assignee name

### Card Visual States (Border & Background Effects)

Cards have dynamic borders and gradient backgrounds based on state:

| State | Visual Treatment |
|-------|-----------------|
| **Running** | 2px solid green border, green gradient left edge, pulsing glow animation |
| **Completed** | 3px left border in primary/blue, blue gradient left edge |
| **Paused** | 3px left border in warning/yellow, yellow gradient left edge |
| **Failed** | 3px left border in error/red, red gradient left edge |
| **Interrupted** | 3px left border in muted color |
| **Needs Input** | 2px solid warning border, pulsing glow animation (overrides paused) |
| **CI Failed** | 2px solid error border, red gradient (shown when no agent is running/needing input) |

---

## 5. Context Menu

Right-clicking a task card opens a context menu at the cursor position.

### Menu Items

1. **Action buttons** (one per enabled project action, e.g., "Start Implementation", "Plan/Design", "Manual Testing"): Triggers the action for the task. Disabled with reduced opacity when agent is busy (running or paused), showing tooltip with reason
2. **Divider**
3. **"Move to..." submenu**: Expands to show all three column options (Backlog, Doing, Done)
4. **Divider**
5. **"Delete"**: Red/error-colored text, deletes the task

The context menu closes when clicking anywhere outside it.

---

## 6. Toast Notifications (Overlay)

Four toast notification types can appear overlaid on the board:

1. **Error Toast**: Generic error messages
2. **Checkpoint Toast**: "Agent needs input" — shown when an agent pauses for user permission/question, with the task ID/Jira key and stage info
3. **CI Failure Toast**: Shown when a PR's CI pipeline fails (suppressed while the task's agent is still running)
4. **Task Spawned Toast**: Shown when an agent creates a new task

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘T | Open "Add Task" dialog |
| ⌘/ | Focus the search input |
| Escape | Clear search query (when search is focused) |
| ⌘⇧R | Trigger GitHub sync/refresh |
| ⌘[ or Ctrl+[ | Navigate back |
| ⌘D | Toggle voice recording |

---

## 8. Add Task Modal

A centered modal dialog (max-width 640px) with:
- **Header**: "Create Task" or "Edit Task"
- **Body**: Contains the PromptInput component with:
  - Multi-line text area for the task title/description
  - Optional Jira key input field
  - Submit button
  - Cancel button
- The modal has an overlay backdrop and closes on cancel or backdrop click
