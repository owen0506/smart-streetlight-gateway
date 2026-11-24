import net from 'node:net';
import { once } from 'node:events';
import { appendFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { finished } from 'node:stream/promises';

export const host = '127.0.0.1';
export const modes = ['standalone', 'direct', 'aggregate'];

// A newline delimits a JSON record even when TCP splits or combines writes.
export async function openChannel(logPath, stats, deviceIds = [], onRecord) {
  const server = net.createServer({ allowHalfOpen: true });
  const peers = new Set();
  const clients = new Map();
  let failure;
  const tasks = [];
  const fail = error => {
    failure ??= error;
    for (const socket of peers) socket.destroy();
    for (const socket of clients.values()) socket.destroy();
  };
  server.on('connection', socket => {
    peers.add(socket);
    socket.once('close', () => peers.delete(socket));
    stats.connections++;
    socket.on('error', fail);
    socket.on('data', chunk => { stats.bytes += chunk.length; });
    tasks.push((async () => {
      for await (const line of createInterface({ input: socket, crlfDelay: Infinity })) {
        const record = JSON.parse(line);
        stats.roundBytes[record.seq - 1] += Buffer.byteLength(line, 'utf8') + 1;
        stats.messages++;
        stats.records.push(record);
        onRecord?.(record);
        if (record.status === 'fault') {
          await appendFile(logPath, line + '\n');
          stats.faults.push(record);
          socket.write(JSON.stringify({ ack: record.id, seq: record.seq }) + '\n');
        }
      }
      socket.end();
    })().catch(fail));
  });
  function close() {
    for (const socket of clients.values()) socket.destroy();
    for (const socket of peers) socket.destroy();
    server.close();
  }
  try {
    server.listen(0, host);
    await once(server, 'listening');
    for (const id of deviceIds.length ? deviceIds : [null]) {
      const client = net.connect(server.address().port, host);
      clients.set(id, client);
      client.on('error', fail);
      await once(client, 'connect');
      tasks.push((async () => {
        for await (const line of createInterface({ input: client })) {
          stats.acks.push(JSON.parse(line));
        }
      })().catch(fail));
    }
    return {
      send(record) {
        if (failure) throw failure;
        clients.get(deviceIds.length ? record.id : null).write(JSON.stringify(record) + '\n');
      },
      async finish() {
        for (const client of clients.values()) client.end();
        await Promise.all(tasks);
        if (failure) throw failure;
        await Promise.all([...clients.values()].map(client => finished(client)));
      },
      close
    };
  } catch (error) {
    close();
    throw error;
  }
}
