import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { initialState, runDemo } from './demo.js';
import { host } from './network.js';

let state = initialState();
let results = {};
async function conduct(mode, settings) {
  const paired = mode === 'paired';
  if (paired || settings.window !== state.settings.window || settings.faultLamp !== state.settings.faultLamp) results = {};
  for (const route of paired ? ['standalone', 'aggregate'] : [mode]) {
    state = initialState(route, settings);
    state.paired = paired;
    await runDemo(state, { interval: 1200 });
    const stats = state.stats[route];
    results[route] = { bytes: stats.bytes, messages: stats.messages, faults: stats.acks.length,
      connections: stats.connections, roundBytes: stats.roundBytes };
  }
}
const files = new Map([
  ['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']], ['/motion.js', ['motion.js', 'text/javascript']],
  ['/exhibit.js', ['exhibit.js', 'text/javascript']], ['/sites.js', ['sites.js', 'text/javascript']],
  ['/chart.js', ['chart.js', 'text/javascript']]
]);
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ...state, results }));
  }
  if (req.method === 'POST' && req.url === '/api/run') {
    if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) {
      res.writeHead(403); return res.end();
    }
    if (state.phase === 'running') { res.writeHead(409); return res.end(); }
    const mode = req.headers['x-experiment-mode'];
    const window = Number(req.headers['x-summary-rounds'] ?? 4);
    const faultLamp = req.headers['x-fault-lamp'] ?? 'SL-17';
    if (!['standalone', 'aggregate', 'paired'].includes(mode) || ![1, 2, 4, 6, 12].includes(window)
        || !state.lamps.some(lamp => lamp.id === faultLamp)) { res.writeHead(400); return res.end(); }
    conduct(mode, { window, faultLamp }).catch(error => console.error(error.message));
    res.writeHead(202); return res.end();
  }
  const file = files.get(req.url);
  if (req.method !== 'GET' || !file) { res.writeHead(404); return res.end(); }
  try {
    const body = await readFile(new URL('./public/' + file[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': file[1] + '; charset=utf-8' });
    res.end(body);
  } catch { res.writeHead(500); res.end(); }
});
server.listen(Number(process.env.PORT ?? 3000), host, () => {
  console.log('Streetlight Network Lab  http://' + host + ':' + server.address().port);
});
