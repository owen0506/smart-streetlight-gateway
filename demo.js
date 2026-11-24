import dgram from 'node:dgram';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { host, modes, openChannel } from './network.js';

const ids = Array.from({ length: 20 }, (_, i) => 'SL-' + String(i + 1).padStart(2, '0'));
const ticks = 12;
export function initialState(mode = null, settings = { window: 4, faultLamp: 'SL-17' }) {
  return {
    mode, settings, phase: 'ready', tick: 0, ticks, received: 0, skipped: 0, reduction: null,
    lamps: ids.map(id => ({ id, seq: 0, status: 'waiting', gaps: 0 })),
    rounds: [],
    stats: Object.fromEntries((mode ? [mode] : modes).map(mode => [mode, {
      connections: 0, bytes: 0, messages: 0, faults: [], acks: [], records: [],
      roundBytes: Array(ticks).fill(0)
    }]))
  };
}

function scenario(id, seq, faultLamp) {
  if (id === 'SL-12' && seq >= 4 && seq <= 7) return null;
  const fault = (id === 'SL-04' && seq === 5) || (id === faultLamp && seq === 9);
  return { id, seq, status: fault ? 'fault' : id === 'SL-08' ? 'off' : 'on' };
}

export async function runDemo(state, { interval = 700, directory = 'data' } = {}) {
  state.phase = 'running';
  const folder = path.join(directory, randomUUID());
  const channels = {};
  const useUdp = state.mode !== 'standalone';
  const receiver = useUdp ? dgram.createSocket('udp4') : null;
  const sender = useUdp ? dgram.createSocket('udp4') : null;
  const lastSeen = new Map();
  let socketError;
  let expected = 0;
  function observe(record) {
    const lamp = state.lamps.find(item => item.id === record.id);
    if (!lamp || record.seq <= lamp.seq) return false;
    lamp.gaps += record.seq - lamp.seq - 1;
    Object.assign(lamp, record);
    lastSeen.set(lamp.id, performance.now());
    state.received++;
    return true;
  }
  try {
    await mkdir(folder, { recursive: true });
    for (const mode of Object.keys(state.stats)) {
      channels[mode] = await openChannel(
        path.join(folder, mode + '.jsonl'), state.stats[mode], mode === 'standalone' ? ids : [],
        useUdp ? undefined : observe
      );
    }
    if (useUdp) {
      receiver.on('error', error => { socketError = error; });
      sender.on('error', error => { socketError = error; });
      receiver.bind(0, host);
      await once(receiver, 'listening');
      sender.bind(0, host);
      await once(sender, 'listening');
      receiver.on('message', (buffer, remote) => {
        if (remote.port !== sender.address().port || remote.address !== host) return;
        try {
          const record = JSON.parse(buffer);
          if (!observe(record)) return;
          channels.direct?.send(record);
          if (record.status === 'fault') channels.aggregate.send(record);
        } catch (error) { socketError = error; }
      });
    }
    for (let seq = 1; seq <= ticks; seq++) {
      state.tick = seq;
      for (const id of ids) {
        const record = scenario(id, seq, state.settings.faultLamp);
        if (!record) { state.skipped++; continue; }
        expected++;
        channels.standalone?.send(record);
        sender?.send(Buffer.from(JSON.stringify(record)), receiver.address().port, host);
      }
      // Do not compare an incomplete replay if unexpected loopback loss occurs.
      const deadline = performance.now() + 3000;
      while (state.received < expected) {
        if (socketError) throw socketError;
        if (performance.now() > deadline) throw new Error('Timed out waiting for device reports');
        await sleep(2);
      }
      if (socketError) throw socketError;
      for (const lamp of state.lamps) {
        if (performance.now() - lastSeen.get(lamp.id) >= interval * 3) lamp.status = 'offline';
      }
      if (channels.aggregate && seq % state.settings.window === 0) {
        const counts = { on: 0, off: 0, offline: 0, fault: 0 };
        for (const lamp of state.lamps) counts[lamp.status]++;
        channels.aggregate.send({ type: 'summary', seq, counts });
      }
      state.rounds.push({ tick: seq, received: state.received, skipped: state.skipped,
        lamps: state.lamps.map(lamp => ({ ...lamp })) });
      if (seq < ticks) await sleep(interval);
    }
    await Promise.all(Object.values(channels).map(channel => channel.finish()));
    const expectedFaults = ['SL-04/5', state.settings.faultLamp + '/9'].sort();
    for (const stats of Object.values(state.stats)) {
      const stored = stats.faults.map(f => f.id + '/' + f.seq);
      const confirmed = stats.acks.map(a => a.ack + '/' + a.seq);
      if (![stored, confirmed].every(keys => keys.sort().join() === expectedFaults.join())) {
        throw new Error('Fault records or storage acknowledgments did not match the scenario');
      }
    }
    if (!state.mode) state.reduction = 100 * (1 - state.stats.aggregate.bytes / state.stats.direct.bytes);
    await writeFile(path.join(folder, 'result.json'), JSON.stringify({ ...state, phase: 'done' }, null, 2));
    state.phase = 'done';
    return folder;
  } catch (error) {
    state.phase = 'error';
    state.error = error.message;
    throw error;
  } finally {
    receiver?.close();
    sender?.close();
    for (const channel of Object.values(channels)) channel.close();
  }
}
