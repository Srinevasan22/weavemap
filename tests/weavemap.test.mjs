import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import '../core.js';
import { startLiveServer } from '../live_server.mjs';

const { parseStateSource: parse, validateState: validate, mutateTask: mutate, taskState } = globalThis.WeaveMapCore;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = () => ({ schemaVersion: 4, initialized: true, project: { name: 'Test', phase: 'Planning', entryMode: 'new' }, agents: [], requirements: [], decisions: [], tasks: [
  { id: 'A', title: 'First', status: 'todo', priority: 'P1', effort: 1, dependsOn: [], notes: [] },
  { id: 'B', title: 'Second', status: 'todo', priority: 'P2', effort: 2, dependsOn: ['A'], notes: [] }
] });
const serialize = state => `window.WEAVEMAP = ${JSON.stringify(state)};\n`;

test('parses repository and blank states without executing JavaScript', () => {
  for (const file of ['state.js', 'state.template.js']) assert.deepEqual(validate(parse(fs.readFileSync(path.join(root, file), 'utf8'))), []);
  assert.equal(parse("// prefix\nwindow.WEAVEMAP = { name: 'a\\\'b', list: [1, true, null,], /* ok */ };").name, "a'b");
  for (const source of ['window.WEAVEMAP = (() => ({}))();', 'window.WEAVEMAP = {}; globalThis.executed = true;', 'window.WEAVEMAP = {a:1,a:2};']) assert.throws(() => parse(source));
  assert.equal(globalThis.executed, undefined);
});

test('rejects invalid schemas, entries, metadata, references, and cycles', () => {
  const cases = [state => state.schemaVersion = 5, state => state.tasks.push(null), state => state.tasks[0].priority = 'urgent', state => state.tasks[0].effort = 9,
    state => state.tasks[0].dependsOn = ['missing'], state => state.tasks[0].dependsOn = ['B'], state => state.tasks[0].requirementIds = ['missing'],
    state => state.tasks[0].humanApproval = { required: true, status: 'other' }];
  for (const change of cases) { const state = fixture(); change(state); assert.ok(validate(state).length); }
});

test('approval gates, active work and dependency waiting stay in their proper queues', () => {
  const state = fixture(); const [a, b] = state.tasks;
  b.humanApproval = { required: true, status: 'pending' };
  assert.equal(taskState(a, state.tasks), 'ready'); assert.equal(taskState(b, state.tasks), 'waiting');
  a.status = 'active'; assert.equal(taskState(a, state.tasks), 'active');
  a.status = 'skipped'; assert.equal(taskState(b, state.tasks), 'approval');
  b.humanApproval.status = 'rejected'; assert.equal(taskState(b, state.tasks), 'approval');
  b.humanApproval.status = 'approved'; assert.equal(taskState(b, state.tasks), 'ready');
});

test('mutations enforce latest approval state and clear obsolete completion evidence', () => {
  const state = fixture(); const task = state.tasks[0];
  task.humanApproval = { required: true, status: 'rejected' };
  assert.throws(() => mutate(state, 'A', { type: 'status', status: 'done' }), /Approve/);
  mutate(state, 'A', { type: 'approve' }); mutate(state, 'A', { type: 'status', status: 'done' });
  assert.equal(task.completion.verification.result, 'human-override');
  mutate(state, 'A', { type: 'status', status: 'blocked', note: 'Needs access' });
  assert.equal(task.completedAt, undefined); assert.equal(task.completion, undefined);
  assert.throws(() => mutate(state, 'A', { type: 'priority', priority: 'P9' }));
});

test('generated snapshot embeds data safely and all scripts parse', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'weavemap-snapshot-'));
  try {
    for (const file of ['index.html', 'style.css', 'app.js', 'core.js']) fs.copyFileSync(path.join(root, file), path.join(directory, file));
    const state = fixture(); state.tasks[0].title = '</script><img onerror="bad()"> $& $\' $`';
    state.tasks[0].verification = { command: 'node -e "console.log(\'hello\')"' };
    fs.writeFileSync(path.join(directory, 'state.js'), serialize(state));
    const out = path.join(directory, 'hud.html');
    execFileSync(process.execPath, [path.join(root, 'generate_hud.mjs'), '-p', directory, '-a', out]);
    const html = fs.readFileSync(out, 'utf8');
    assert.ok(!html.includes('<script src=')); assert.ok(!html.includes('</script><img'));
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 4); for (const [, code] of scripts) new vm.Script(code);
    const invalid = fixture(); invalid.schemaVersion = 999; fs.writeFileSync(path.join(directory, 'state.js'), serialize(invalid));
    assert.equal(spawnSync(process.execPath, [path.join(root, 'generate_hud.mjs'), '-p', directory, '--check-only']).status, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('live server persists edits, detects external changes, and rejects foreign or stale writes', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'weavemap-live-'));
  const statePath = path.join(directory, 'state.js'); fs.writeFileSync(statePath, serialize(fixture()));
  const server = startLiveServer({ statePath, html: '<head></head><script>window.WEAVEMAP = {};</script>', port: 0 });
  await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await (await fetch(base)).text();
    const token = JSON.parse(page.match(/window.WEAVEMAP_LIVE = (.*?);/)[1]).token;
    const headers = { 'X-WeaveMap-Token': token, 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/api/state')).status, 403);
    assert.equal((await fetch(base + '/api/state', { headers: { ...headers, Origin: 'https://foreign.invalid' } })).status, 403);
    const before = await (await fetch(base + '/api/state', { headers })).json();
    const post = body => fetch(base + '/api/task', { method: 'POST', headers, body: JSON.stringify(body) });
    const action = { taskId: 'A', action: { type: 'note', note: 'Human: reviewed' }, expectedRevision: before.revision };
    assert.equal((await post(action)).status, 200);
    assert.deepEqual(parse(fs.readFileSync(statePath, 'utf8')).tasks[0].notes, ['Human: reviewed']);
    assert.equal((await post(action)).status, 409);
    const external = parse(fs.readFileSync(statePath, 'utf8')); external.project.name = 'Agent changed project'; fs.writeFileSync(statePath, serialize(external));
    const after = await (await fetch(base + '/api/state', { headers })).json();
    assert.equal(after.state.project.name, 'Agent changed project');
    assert.notEqual(after.revision, before.revision);
    assert.equal((await fetch(base + '/../state.js', { headers })).status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); }
});
