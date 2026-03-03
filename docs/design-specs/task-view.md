# Task View — Design Specification

## Overview

The Task View is the detailed view for a single task. It opens when clicking a task card on the General Board and replaces the board content. The view is split into a header area and a two-panel body. A "Code/Review" toggle switches the body between the **Code Tab** (agent terminal + task info) and the **Review Tab** (self-review diff view). The Review Tab is documented separately in `self-review.md`.

---

## Page Layout

Full-height vertical layout filling the main content area:

1. **Header** (fixed, does not scroll)
2. **Body** (fills remaining space, two-panel layout for Code tab)

---

## 1. Header

A compact header bar with a secondary subtitle row for Jira context.

### Primary Row

All items are horizontally aligned with 12px gaps:

- **Back button**: Soft-styled small button with "← Back" text. Navigates to the previous view (board or wherever the user came from). If no navigation history, deselects the task and returns to the board.
- **Separator**: Thin vertical pipe character "│" in muted color
- **Task identifier**: Monospace semibold text showing the Jira key (if linked) or the task ID (e.g., "T-448"). Muted/secondary color.
- **Jira external link button** (conditional): Small ghost button with "↗" icon, shown only when Jira key and Jira base URL are configured. Opens the Jira ticket in the system browser.
- **Task title**: Large bold text (18px), single-line truncated with ellipsis. Shows only the first line of the title if multiline. Full title shown on hover tooltip.
- **Code/Review toggle** (conditional): A pill-shaped toggle with two buttons, only shown when a worktree exists for the task:
  - "Code" — active by default, primary-colored when selected
  - "Review" — switches to the Self-Review view
  - Both buttons are rounded-full with a base-300 background container
- **"Move to Done" button** (conditional): Success-colored small button, hidden when the task is already in the "done" status. Moves the task to the Done column and navigates back to the board.
- **Action buttons**: One button per enabled project action (e.g., "Start Implementation", "Plan/Design"). Each is a soft-styled small button that becomes primary on hover. Disabled with tooltip when the agent is busy (running or paused).

### Subtitle Row (conditional)

- **Jira title**: Shown only when both a Jira key and Jira title exist. Muted text that truncates with ellipsis. Clickable — opens the Jira ticket in the system browser. Transitions to primary color on hover.

---

## 2. Body — Code Tab (Default)

A horizontal two-panel split layout:
- **Left panel (70%)**: Agent Panel
- **Divider**: 1px vertical line in base-300
- **Right panel (30%)**: Task Info Panel

On narrow screens (< 800px), the panels stack vertically.

---

## 3. Agent Panel (Left Panel)

The agent panel shows the AI agent's terminal interface. The specific panel depends on the configured AI provider (Claude Code or OpenCode). The Claude Code variant is the primary one.

### Claude Agent Panel

#### Status Bar

A horizontal bar at the top with a bordered background:

**Left side:**
- **Status dot**: Colored circle indicating the current state:
  - Neutral/gray: Idle (no session)
  - Green: Running
  - Primary/blue: Complete
  - Red: Error
- **Status text**: Bold text description:
  - "No active implementation"
  - "Claude agent running..."
  - "Implementation complete"
  - "Error occurred"
- **Session details** (shown when a session exists):
  - **Stage label**: Small muted text showing the current workflow stage:
    - "Reading Ticket"
    - "Implementing"
    - "Creating PR"
    - "Addressing Comments"
  - **Status badge**: Small colored badge showing the session status ("running", "completed", "failed", "interrupted", "paused")
  - **Session ID**: Monospace truncated text (max 180px) showing the Claude session ID

**Right side:**
- **Voice Input button**: Microphone toggle for voice-to-text input (⌘D hotkey)
- **Abort button** (conditional): Red/error-colored small button with "ABORT" text, shown only when the agent is running. Kills the PTY and aborts the implementation.

#### Terminal Area

- A full-height xterm.js terminal embedded in a bordered container
- Displays real-time agent output via PTY connection
- Custom scrollbar styling (thin, subtle)
- **Empty state** (no session and no PTY active): Centered overlay with:
  - Decorative layered-diamond SVG icon (64x64, muted)
  - "No active agent session" bold text
  - "Use the action buttons in the header to get started" helper text (max 320px width)

---

## 4. Task Info Panel (Right Panel)

A scrollable vertical panel with a base-200 background showing all task metadata and PR information. Organized into labeled sections with consistent styling.

### Section Styling
- Each section has a small semibold primary-colored uppercase header with wide letter-spacing
- Sections are separated by 20px vertical gap
- 20px padding on all sides

### Sections (in order, all conditional based on data availability)

#### 4.1 Initial Prompt
- **Header**: "INITIAL PROMPT"
- **Content**: Full task title/description in pre-wrapped text, preserving newlines

#### 4.2 Worktree
- **Header**: "WORKTREE"
- **Content**: A bordered row showing:
  - Monospace truncated path text
  - Copy button — copies the worktree path to clipboard

#### 4.3 Merge Status (shown only if any PR is merged or ready to merge)
- **Header**: "MERGE STATUS"
- For each relevant PR:
  - **Merged PR**: Shows PR title, "✔ Merged" badge (secondary color), and merge date
  - **Ready to Merge PR**: Shows PR title and "● Ready to Merge" badge (success color, pulsing animation)

#### 4.4 Pull Requests (shown when PRs are linked)
- **Header**: "PULL REQUESTS"
- For each PR, a bordered card containing:
  - **State badge**: Colored uppercase badge:
    - Open: green background
    - Merged: secondary/purple background
    - Closed: error/red background
  - **PR title**: Medium-weight text
  - **PR URL**: Clickable link text that opens in system browser

#### 4.5 Pipeline Status (shown when any PR has CI status)
- **Header**: "PIPELINE STATUS"
- For each PR with CI data:
  - PR title (muted) with overall CI status badge:
    - "✓ Passing" (green)
    - "✗ Failing" (red)
    - "⏳ Running" (yellow)
    - "— No CI" (muted)
  - **Check runs list** (from parsed ci_check_runs JSON):
    - Each run shows a status icon (✓/✗/⏳/—) and the check name

#### 4.6 Review Status (shown when any PR has a review status other than "none")
- **Header**: "REVIEW STATUS"
- For each PR with review data:
  - PR title (muted) with review status badge:
    - "✓ Approved" (green)
    - "✗ Changes Requested" (yellow/warning)
    - "⏳ Review Required" (muted)

#### 4.7 PR Comments (shown when any linked PR has comments)
- **Header**: "PR COMMENTS" with a badge:
  - Error badge with count when unaddressed comments exist
  - Success badge "All addressed" when all are addressed
- For each comment, a bordered card with:
  - **Comment header row**: Author avatar circle (first letter, primary bg), @author name (bold), timestamp (relative, e.g., "2h ago")
  - **File path** (conditional): Monospace text showing file path and line number (e.g., "src/main.ts:42")
  - **Comment body**: Rendered as markdown
  - **Action footer**:
    - Unaddressed: "✓ Mark addressed" ghost button (turns green on hover)
    - Addressed: "✓ Addressed" green text label

---

## 5. Keyboard Shortcuts (inherited from App)

| Shortcut | Action |
|----------|--------|
| ⌘[ or Ctrl+[ | Navigate back to board |
| ⌘⇧R | Trigger GitHub sync |
| ⌘D | Toggle voice recording |
| ⌘T | Open "Add Task" dialog (global) |
