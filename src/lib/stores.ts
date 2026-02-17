import { writable } from "svelte/store";
import type { Task, AgentSession, PullRequestInfo } from "./types";

export const tasks = writable<Task[]>([]);
// selectedTaskId serves as both selection state and navigation:
// - null = show Kanban board
// - non-null = show full-page detail view for that task
export const selectedTaskId = writable<string | null>(null);
export const activeSessions = writable<Map<string, AgentSession>>(new Map());
export const ticketPrs = writable<Map<string, PullRequestInfo[]>>(new Map());
export const isLoading = writable(false);
export const error = writable<string | null>(null);
