import { writable } from "svelte/store";
import type { Ticket, AgentSession } from "./types";

export const tickets = writable<Ticket[]>([]);
export const selectedTicketId = writable<string | null>(null);
export const activeSessions = writable<Map<string, AgentSession>>(new Map());
export const isLoading = writable(false);
export const error = writable<string | null>(null);
