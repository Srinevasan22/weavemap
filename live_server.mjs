import http from 'node:http';
import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import './core.js';

const { parseStateSource, validateState, mutateTask } = globalThis.WeaveMapCore;
const revision = source => createHash('sha256').update(source).digest('hex');

// Only the selected state file is accessible; this is not a general file server.
export function startLiveServer({ statePath, html, port = 4173 }) {
  const token = randomBytes(32).toString('hex');
  function read() {
    const source = fs.readFileSync(statePath, 'utf8');
    const state = parseStateSource(source);
    const errors = validateState(state);
    if (errors.length) throw new Error(errors.join('\n'));
    return { state, revision: revision(source) };
  }
  const server = http.createServer(async (req, res) => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "frame-ancestors 'none'" });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    // Reject cross-origin requests and DNS-rebinding hostnames, including reads.
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)
      || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'This HUD is local to this browser origin.' });
    try {
      if (req.method === 'GET' && req.url === '/') {
        const current = read();
        const config = `<script>window.WEAVEMAP_LIVE = ${JSON.stringify({ token })};</script>`;
        const page = html.replace(/<script>window\.WEAVEMAP = [\s\S]*?<\/script>/, () =>
          `<script>window.WEAVEMAP = ${JSON.stringify(current.state).replaceAll('<', '\\u003c')};</script>`);
        return send(200, page.replace('<head>', '<head>' + config), 'text/html');
      }
      if (req.headers['x-weavemap-token'] !== token) return send(403, { error: 'Missing HUD session token.' });
      if (req.method === 'GET' && req.url === '/api/state') return send(200, read());
      if (req.method !== 'POST' || req.url !== '/api/task') return send(404, { error: 'Not found.' });
      if (req.headers['content-type'] !== 'application/json') return send(415, { error: 'Expected JSON.' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 65536) return send(413, { error: 'Task edit is too large.' });
      }
      const { taskId, action, expectedRevision } = JSON.parse(body);
      const latest = read();
      if (expectedRevision !== latest.revision) return send(409, { error: 'Project state changed. Refresh the task and retry.' });
      mutateTask(latest.state, taskId, action);
      const errors = validateState(latest.state);
      if (errors.length) return send(400, { error: errors.join('\n') });
      const source = `window.WEAVEMAP = ${JSON.stringify(latest.state, null, 2)};\n`;
      const temporary = `${statePath}.${randomBytes(8).toString('hex')}.tmp`;
      try {
        fs.writeFileSync(temporary, source, { flag: 'wx' });
        if (revision(fs.readFileSync(statePath, 'utf8')) !== expectedRevision) return send(409, { error: 'Project state changed while saving. Retry your edit.' });
        fs.renameSync(temporary, statePath);
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
      return send(200, { state: latest.state, revision: revision(source) });
    } catch (error) { send(400, { error: error.message }); }
  });
  server.listen(port, '127.0.0.1', () => console.log(`Live WeaveMap HUD: http://127.0.0.1:${server.address().port}/`));
  server.on('error', error => { console.error(`Live HUD could not start: ${error.message}`); process.exitCode = 1; });
  return server;
}
