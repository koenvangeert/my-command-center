import { request } from 'node:http';

// One connection and one attempt. A socket failure after writing has an unknown outcome.
export function requestAgent(config, path, options) {
  return new Promise((resolve, reject) => {
    let socket;
    const fail = () => reject(new Error(socket?.bytesWritten > 0
      ? 'OpenForge forwarded request outcome unknown; do not automatically retry. Inspect current state before another mutation.'
      : 'OpenForge gateway unavailable; request not executed. Retry after availability returns.'));
    const req = request({
      hostname: '127.0.0.1', port: config.port, path,
      method: options.method ?? 'GET', agent: false,
      headers: { 'Content-Type': 'application/json', ...options.headers, Authorization: `Bearer ${config.token}` },
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) { req.destroy(); fail(); return; }
        chunks.push(chunk);
      });
      res.on('error', fail);
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: async () => Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('socket', (value) => { socket = value; });
    req.on('error', fail);
    const deadline = setTimeout(() => { req.destroy(); fail(); }, 35_000);
    req.on('close', () => clearTimeout(deadline));
    req.end(options.body);
  });
}
