export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  jira_status: string | null;
  assignee: string | null;
  created_at: number;
  updated_at: number;
}

export interface AgentSession {
  id: string;
  ticket_id: string;
  opencode_session_id: string | null;
  stage: string;
  status: string;
  checkpoint_data: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

export interface AgentLog {
  id: number;
  session_id: string;
  timestamp: number;
  log_type: string;
  content: string;
}

export interface PrComment {
  id: number;
  pr_id: number;
  author: string;
  body: string;
  comment_type: string;
  file_path: string | null;
  line_number: number | null;
  addressed: number;
  created_at: number;
}

export interface OpenCodeStatus {
  api_url: string;
  healthy: boolean;
  version: string | null;
}

export type KanbanColumn = "todo" | "in_progress" | "in_review" | "testing" | "done";

export const COLUMN_LABELS: Record<KanbanColumn, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  testing: "Testing",
  done: "Done",
};

export const COLUMNS: KanbanColumn[] = ["todo", "in_progress", "in_review", "testing", "done"];
