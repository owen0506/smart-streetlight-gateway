const canvas = document.getElementById('payloadChart');
const panel = canvas.closest('section');
const scope = document.getElementById('chartScope');
const readout = document.getElementById('chartReadout');
const routes = {
  standalone: { name: 'Individual', color: '#446f92' },
  aggregate: { name: 'Aggregated', color: '#167659' }
};
let lines = {}, round = 0, count = 12, hover = null;

export function updateChart(state, tick, reviewing) {
  count = state.ticks;
  round = tick;
  lines = {};
  for (const key of Object.keys(routes)) {
    const active = key === state.mode;
    const bytes = active ? state.stats[key]?.roundBytes : state.results[key]?.roundBytes;
    if (!bytes || (active && !tick)) continue;
    const values = [0];
    for (const n of bytes.slice(0, active || reviewing ? tick : count)) {
      values.push(values.at(-1) + n);
    }
    lines[key] = values;
  }
  panel.hidden = Object.keys(lines).length === 0;
  for (const option of scope.options) option.disabled = option.value !== 'both' && !lines[option.value];
  if (scope.selectedOptions[0]?.disabled) scope.value = 'both';
  draw();
}

const left = 52, right = 17;
function draw() {
  if (panel.hidden) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const keys = Object.keys(lines).filter(key => scope.value === 'both' || key === scope.value);
  panel.querySelector('.individual-key').hidden = !keys.includes('standalone');
  panel.querySelector('.aggregated-key').hidden = !keys.includes('aggregate');
  const peak = Math.max(1, ...keys.map(key => lines[key].at(-1)));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const ceiling = [1, 2, 4, 6, 8, 10].map(n => n * magnitude).find(n => n >= peak);
  const x = i => left + i * (w - left - right) / count;
  const y = bytes => h - 38 - bytes / ceiling * (h - 62);
  const last = Math.max(0, ...keys.map(key => lines[key].length - 1));
  const focus = Math.min(hover ?? round, last);
  ctx.font = '12px system-ui'; ctx.fillStyle = '#465f5c'; ctx.textAlign = 'left';
  ctx.fillText('Bytes', 6, 15);
  for (let i = 0; i <= 4; i++) {
    const value = ceiling * i / 4;
    const py = y(value);
    ctx.strokeStyle = '#dbe4df'; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(w - right, py); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(value.toLocaleString('en-US'), left - 7, py + 4);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i <= count; i += w < 440 ? 2 : 1) ctx.fillText(String(i), x(i), h - 21);
  ctx.fillText('Round', x(count / 2), h - 4);
  ctx.setLineDash([2, 3]); ctx.strokeStyle = '#82938d';
  ctx.beginPath(); ctx.moveTo(x(focus), y(ceiling)); ctx.lineTo(x(focus), y(0)); ctx.stroke();
  for (const key of keys) {
    const values = lines[key];
    ctx.strokeStyle = ctx.fillStyle = routes[key].color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(key === 'aggregate' ? [6, 3] : []);
    ctx.beginPath(); ctx.moveTo(x(0), y(0));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(x(i), y(values[i - 1])); ctx.lineTo(x(i), y(values[i]));
    }
    ctx.stroke();
    if (focus < values.length) {
      ctx.beginPath(); ctx.arc(x(focus), y(values[focus]), 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  const text = 'Round ' + focus + ' · ' + keys.map(key => routes[key].name + ' ' +
    (lines[key][focus] === undefined ? 'pending' : lines[key][focus].toLocaleString('en-US') + ' B')).join(' · ');
  readout.textContent = text;
  canvas.setAttribute('aria-label', 'Cumulative server payload by round. ' + text);
}

scope.addEventListener('change', draw);
canvas.addEventListener('pointermove', e => {
  const rect = canvas.getBoundingClientRect();
  hover = Math.max(0, Math.min(count, Math.round((e.clientX - rect.left - left) * count / (rect.width - left - right))));
  draw();
});
canvas.addEventListener('pointerleave', () => { hover = null; draw(); });
new ResizeObserver(draw).observe(canvas);
