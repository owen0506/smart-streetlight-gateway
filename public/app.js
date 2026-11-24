import { showMessages, replayMessages } from './motion.js';
import './exhibit.js';
import { updateChart } from './chart.js';
import { sites, mapPoint } from './sites.js';
const el = id => document.getElementById(id);
const labels = { waiting: 'Waiting', on: 'On', off: 'Off', fault: 'Fault', offline: 'Offline' };
const names = { standalone: 'Individual transmission', aggregate: 'Gateway aggregation' };
const buttons = ['paired', ...Object.keys(names)].map(el);
const settingsPanel = document.querySelector('.settings');
document.addEventListener('click', event => {
  if (!settingsPanel.contains(event.target)) settingsPanel.open = false;
});
settingsPanel.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    settingsPanel.open = false;
    settingsPanel.querySelector('summary').focus();
  }
});
for (let i = 1; i <= 20; i++) {
  const id = 'SL-' + String(i).padStart(2, '0');
  el('faultLamp').add(new Option(id, id, id === 'SL-17', id === 'SL-17'));
}
el('screen').hidden = !document.fullscreenEnabled;
el('screen').onclick = async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
};
document.addEventListener('fullscreenchange', () => {
  el('screen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
});
const phases = { ready: 'Ready to run', running: 'Running', done: 'Experiment complete', error: 'Experiment failed' };
const fmt = n => n.toLocaleString('en-US');

let latest, heldRun, selected = 'SL-12', cursor = null, starting = false;
let replayTimer;
let previous = '';
let loadedSettings;
const dot = '<i class="dot"></i>';
el('legend').innerHTML = Object.entries(labels).map(([key, label]) =>
  '<span class="' + key + '">' + dot + label + '</span>').join('');

function drawStreets() {
  const canvas = el('streets');
  const w = canvas.clientWidth, h = canvas.clientHeight, ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#213c40'; ctx.fillRect(0, 0, w, h);
  // Follow the order of observed lamp positions; the road bands are schematic.
  for (const road of new Set(sites.map(site => site.road))) {
    const points = sites.filter(site => site.road === road).map(mapPoint);
    const first = points[0], last = points.at(-1);
    ctx.beginPath();
    ctx.moveTo(w * (2 * first.x - points[1].x), h * (2 * first.y - points[1].y));
    for (const point of points) ctx.lineTo(w * point.x, h * point.y);
    ctx.lineTo(w * (2 * last.x - points.at(-2).x), h * (2 * last.y - points.at(-2).y));
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#496466'; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = '#8ca29c'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.font = '600 13px system-ui'; ctx.fillStyle = '#d4e6cf'; ctx.textAlign = 'center';
  ctx.fillText('Sejong University', w * .49, h * .44);
  ctx.font = '11px system-ui'; ctx.fillStyle = '#becfca';
  ctx.fillText('Gunja-ro', w * .13, h * .43);
  ctx.fillText('Neungdong-ro', w * .856, h * .55);
  ctx.fillText('Gwangnaru-ro', w * .46, h * .92);
  ctx.fillText('↑ N', 19, 18);
}
new ResizeObserver(drawStreets).observe(el('streets'));

function selectRound(tick, id = selected) {
  clearTimeout(replayTimer);
  replayTimer = undefined;
  if (tick === null) heldRun = undefined;
  else tick = Math.min(tick, (heldRun ?? latest).rounds.length);
  cursor = tick || null; selected = id; render();
}
function render() {
  const state = heldRun ?? latest;
  if (!state) return;
  const rounds = state.rounds;
  const frame = cursor === null ? rounds.at(-1) : rounds[cursor - 1];
  const lamps = frame?.lamps ?? state.lamps;
  const tick = frame?.tick ?? 0;
  const lamp = lamps.find(item => item.id === selected);
  for (const button of buttons) button.disabled = starting || latest.phase === 'running';
  const settingsKey = JSON.stringify(state.settings);
  if (settingsKey !== loadedSettings) {
    el('window').value = state.settings.window;
    el('faultLamp').value = state.settings.faultLamp;
    loadedSettings = settingsKey;
  }
  el('window').disabled = el('faultLamp').disabled = starting || latest.phase === 'running';
  const grouped = state.mode === 'aggregate';
  el('protocol').textContent = state.mode ? grouped ? 'UDP' : 'TCP' : 'Device reports';
  el('phase').textContent = state.error || (cursor === null ? phases[state.phase] :
    (replayTimer ? 'Replaying round ' : 'Reviewing round ') + tick);
  if (state.paired && state.phase === 'running' && cursor === null) {
    el('phase').textContent = grouped ? 'Comparing · 2 of 2' : 'Comparing · 1 of 2';
  }
  el('step').textContent = tick + ' / ' + state.ticks;
  el('seek').max = state.ticks;
  el('seek').value = Math.max(1, tick);
  el('seek').setAttribute('aria-valuetext', 'Round ' + tick + ', ' + rounds.length + ' recorded');
  el('seek').title = rounds.length + ' of ' + state.ticks + ' rounds available';
  el('seek').disabled = !rounds.length; el('live').disabled = cursor === null;
  const metric = (label, value) => '<div class="metric"><span>' + label + '</span><b>' + fmt(value) + '</b></div>';
  el('metrics').innerHTML = metric('Streetlights', lamps.length) + metric('Lights on', lamps.filter(l => l.status === 'on').length) +
    metric('Fault or offline', lamps.filter(l => ['fault','offline'].includes(l.status)).length) + metric('Device reports received', frame?.received ?? 0);
  if (!el('lamps').childElementCount) {
    lamps.forEach(item => {
      const site = sites.find(site => site.id === item.id);
      const point = mapPoint(site);
      const button = document.createElement('button');
      button.dataset.id = item.id;
      button.style.left = point.x * 100 + '%';
      button.style.top = point.y * 100 + '%';
      button.title = item.id + ' · ' + site.road;
      button.innerHTML = dot + '<span>' + item.id.slice(3) + '</span>';
      button.onclick = () => {
        selected = item.id;
        el('inspection').open = true;
        render();
      };
      el('lamps').append(button);
    });
  }
  lamps.forEach((item, i) => {
    const button = el('lamps').children[i];
    button.className = 'lamp ' + item.status;
    button.setAttribute('aria-label', item.id + ' ' + labels[item.status]);
    button.setAttribute('aria-pressed', item.id === selected);
  });
  el('selectedId').textContent = lamp.id;
  const site = sites.find(site => site.id === lamp.id);
  el('siteDetails').textContent = site.road + ' · ' + site.asset + ' · ' + site.lat.toFixed(7) + '° N, ' + site.lon.toFixed(7) + '° E';
  el('device').innerHTML = '<div class="device-title"><b>' + lamp.id + '</b><span class="status ' + lamp.status + '">' +
    dot + labels[lamp.status] + '</span></div><dl><dt>Last sequence received</dt><dd>' + (lamp.seq || '—') +
    '</dd><dt>Missing sequence numbers</dt><dd>' + lamp.gaps + '</dd></dl>';
  el('history').innerHTML = Array.from({ length: state.ticks }, (_, index) => {
    const status = rounds[index]?.lamps.find(l => l.id === selected).status;
    return '<button title="' + (index + 1) + ' · ' + (labels[status] || 'Pending') +
      '" class="' + (status || 'waiting') + (tick === index + 1 ? ' active' : '') + '" ' +
      (status ? '' : 'disabled') + '>' + (index + 1) + '</button>';
  }).join('');
  const output = state.stats[state.mode]?.records.filter(record => record.seq === tick) ?? [];
  const reports = grouped ? lamps.filter(item => tick && item.seq === tick) : output;
  showMessages(state.mode, tick, reports, output, selected);
  const observed = reports.some(report => report.id === selected);
  el('selectedReport').textContent = !tick ? 'Run an experiment to inspect this light.' :
    observed ? selected + ' reported ' + labels[lamp.status].toLowerCase() + ' in round ' + tick + '.' :
      'No report from ' + selected + ' in round ' + tick + '. Last received sequence: ' + lamp.seq + '.';
  el('replay').disabled = !tick;
  el('replay').textContent = replayTimer ? 'Replaying…' : 'Replay round';
  el('flowTitle').textContent = state.mode ? names[state.mode] + ' · Round ' + tick : 'Streetlight network';
  let caption = 'Choose a transmission mode above to watch a run.';
  if (tick && grouped) {
    const forwarded = output.map(record => record.type === 'summary' ? 'one fleet summary' : 'a fault from ' + record.id);
    caption = reports.length + ' UDP reports reached the gateway. ' + (forwarded.length
      ? 'The server received ' + forwarded.join(' and ') + ' over TCP.'
      : 'No TCP message reached the server this round.');
  } else if (tick) {
    caption = output.length + ' individual reports reached the server over separate streetlight TCP connections.';
  }
  el('motionText').textContent = caption;
  const results = state.results;
  const current = state.stats[state.mode];
  const reviewing = cursor !== null;
  const roundBytes = reviewing && current ? current.roundBytes.slice(0, tick).reduce((sum, n) => sum + n, 0) : current?.bytes;
  updateChart(state, tick, reviewing);
  const volumes = Object.keys(names).map(key => key === state.mode ? roundBytes :
    reviewing ? undefined : results[key]?.bytes);
  const max = Math.max(1, ...volumes.map(bytes => bytes ?? 0));
  Object.keys(names).forEach((key, i) => {
    el(key + 'Bytes').textContent = volumes[i] === undefined ? '—' : fmt(volumes[i]) + ' B';
    el(key + 'Bar').style.width = 100 * (volumes[i] ?? 0) / max + '%';
  });
  el('scope').textContent = current ? (reviewing ? 'Through round ' + tick : 'Run totals') +
    ' · ' + names[state.mode] : 'Waiting for a run';
  const confirmations = current?.acks.filter(ack => !reviewing || ack.seq <= tick);
  el('confirmed').textContent = current ? confirmations.length + ' / 2' : '—';
  el('rule').textContent = 'Fault schedule: SL-04 at round 5, ' + state.settings.faultLamp + ' at round 9.';
  el('resultSettings').textContent = state.settings.window + '-round summaries · ' + state.settings.faultLamp;
  el('traffic').innerHTML = '<table><thead><tr><th>Experiment</th><th>TCP links</th><th>Payload</th><th>Messages</th><th>Fault ACKs</th></tr></thead><tbody>' +
    Object.entries(names).map(([key, name]) => {
      const result = results[key];
      return '<tr><th>' + name + '</th><td>' + (result?.connections ?? '—') + '</td><td>' + (result ? fmt(result.bytes) + ' B' : '—') +
        '</td><td>' + (result?.messages ?? '—') + '</td><td>' + (result?.faults ?? '—') + '</td></tr>';
    }).join('') + '</tbody></table>';
  el('saving').hidden = reviewing || state.phase !== 'done' || !(results.standalone && results.aggregate);
  el('saving').textContent = results.standalone && results.aggregate
    ? 'Aggregation saved ' + fmt(results.standalone.bytes - results.aggregate.bytes) + ' B (' +
      (100 * (1 - results.aggregate.bytes / results.standalone.bytes)).toFixed(2) + '%). The server received ' +
      (12 / state.settings.window) + ' fleet summaries and confirmed both faults on each route.'
    : 'Complete both experiments to measure the reduction in server payload.';
  el('events').innerHTML = Object.entries(state.stats).flatMap(([key, stats]) => stats.faults.filter(f => f.seq <= tick).map(f =>
    '<button class="event" data-id="' + f.id + '" data-tick="' + f.seq + '"><b>' + f.id + '</b> · ' + f.seq +
    ' · ' + names[key] + ' · ' + (stats.acks.some(a => a.ack === f.id && a.seq === f.seq) ? 'Storage ACK received' : 'Saved') + ' ↗</button>'
  )).join('') || '<p class="hint">No faults recorded through this round.</p>';
}

el('history').onclick = e => { if (e.target.matches('button')) selectRound(Number(e.target.textContent)); };
el('events').onclick = e => {
  const button = e.target.closest('button');
  if (button) {
    el('inspection').open = true;
    selectRound(Number(button.dataset.tick), button.dataset.id);
    el('device').scrollIntoView({ block:'center' });
  }
};
el('seek').oninput = e => selectRound(Number(e.target.value));
el('live').onclick = () => selectRound(null);
el('replay').onclick = () => {
  const tick = cursor ?? latest.rounds.at(-1)?.tick;
  if (!tick) return;
  selectRound(tick);
  replayMessages();
  replayTimer = setTimeout(() => { replayTimer = undefined; render(); }, 950);
  render();
};
for (const button of buttons) button.onclick = async () => {
  starting = true; buttons.forEach(item => { item.disabled = true; });
  try {
    const response = await fetch('/api/run', { method:'POST', headers: { 'X-Experiment-Mode': button.id,
      'X-Summary-Rounds': el('window').value, 'X-Fault-Lamp': el('faultLamp').value } });
    if (!response.ok && response.status !== 409) throw new Error('Could not start the experiment');
    selectRound(null); previous = '';
    el('flowTitle').scrollIntoView({ block:'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  } catch (error) { previous = ''; el('phase').textContent = error.message; }
  finally { starting = false; }
};

async function poll() {
  try {
    const response = await fetch('/api/state');
    if (!response.ok) throw new Error();
    const payload = await response.text();
    if (payload !== previous) {
      const next = JSON.parse(payload);
      if (next.results && next.settings) {
        if (cursor !== null && !heldRun && latest &&
            (latest.mode !== next.mode || latest.rounds.length > next.rounds.length)) {
          heldRun = latest;
        }
        latest = next;
        render();
      } else {
        buttons.forEach(button => { button.disabled = true; });
        el('phase').textContent = 'Waiting for the updated server. Restart it with npm start.';
      }
      previous = payload;
    }
  } catch {
    previous = '';
    buttons.forEach(button => { button.disabled = true; });
    el('phase').textContent = 'Reconnecting to the server…';
  }
  setTimeout(poll, latest?.phase === 'running' ? 200 : 600);
}
poll();
