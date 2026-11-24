import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initialState, runDemo } from '../demo.js';

test('compares three routes on identical reports and recovers after missed UDP updates', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'streetlight-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const state = initialState();
  let observedOffline = false;
  const monitor = setInterval(() => {
    if (state.lamps[11].status === 'offline') observedOffline = true;
  }, 5);
  t.after(() => clearInterval(monitor));
  const folder = await runDemo(state, { directory, interval: 70 });
  assert.equal(state.phase, 'done');
  assert.equal(state.received, 236);
  assert.equal(state.skipped, 4);
  assert.ok(observedOffline);
  assert.deepEqual(state.lamps[11], { id: 'SL-12', seq: 12, status: 'on', gaps: 4 });
  for (const [mode, stats] of Object.entries(state.stats)) {
    assert.equal(stats.roundBytes.reduce((sum, bytes) => sum + bytes, 0), stats.bytes);
    const log = await readFile(path.join(folder, mode + '.jsonl'), 'utf8');
    const saved = log.trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(saved, stats.faults);
    assert.deepEqual(stats.acks, [{ ack: 'SL-04', seq: 5 }, { ack: 'SL-17', seq: 9 }]);
  }
  assert.equal(state.stats.direct.messages, 236);
  assert.equal(state.stats.standalone.connections, 20);
  assert.equal(state.stats.direct.connections, 1);
  assert.equal(state.stats.aggregate.connections, 1);
  assert.equal(state.stats.standalone.bytes, state.stats.direct.bytes);
  const key = record => JSON.stringify(record);
  assert.deepEqual(state.stats.standalone.records.map(key).sort(), state.stats.direct.records.map(key).sort());
  assert.equal(state.stats.aggregate.messages, 5);
  assert.deepEqual(state.stats.aggregate.roundBytes.flatMap((bytes, i) => bytes ? [i + 1] : []), [4, 5, 8, 9, 12]);
  assert.ok(state.stats.aggregate.bytes < state.stats.direct.bytes);
});
