#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Read at invocation time — token regenerates on every app start, so
// reading at module parse time would capture a stale value.
const HTTP_TOKEN = process.env.OPENFORGE_HTTP_TOKEN ?? '';
const HTTP_PORT = process.env.OPENFORGE_HTTP_PORT ?? '17422';
const BASE_URL = `http://127.0.0.1:${HTTP_PORT}`;

const server = new McpServer({
  name: 'openforge',
  version: '1.0.0',
});

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
