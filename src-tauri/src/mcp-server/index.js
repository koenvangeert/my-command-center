#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

// Read at invocation time — token regenerates on every app start, so
// reading at module parse time would capture a stale value.
const HTTP_TOKEN = process.env.OPENFORGE_HTTP_TOKEN ?? '';
const HTTP_PORT = process.env.OPENFORGE_HTTP_PORT ?? '17422';
const BASE_URL = `http://127.0.0.1:${HTTP_PORT}`;

const server = new McpServer({
  name: 'openforge',
  version: '1.0.0',
});

server.tool(
  'create_task',
  'Create a new task in Open Forge. Use this when you need to create follow-up work or break a task into subtasks. The task will be added to the backlog.',
  {
    title: z.string().describe('Short, descriptive title for the new task'),
    project_id: z.string().optional().describe('Project ID to associate with (optional, e.g. "P-1")'),
  },
  async ({ title, project_id }) => {
    try {
      const res = await fetch(`${BASE_URL}/create_task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HTTP_TOKEN}`,
        },
        body: JSON.stringify({ title, project_id }),
      });

      if (!res.ok) {
        const error = await res.text();
        return { content: [{ type: 'text', text: `Failed to create task: HTTP ${res.status} — ${error}` }] };
      }

      const data = await res.json();
      return { content: [{ type: 'text', text: `Task created successfully: ${data.task_id}` }] };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { content: [{ type: 'text', text: `Error creating task: ${message}. Is Open Forge running?` }] };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Open Forge MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in Open Forge MCP server:', error);
  process.exit(1);
});

export { HTTP_TOKEN, HTTP_PORT, BASE_URL };
