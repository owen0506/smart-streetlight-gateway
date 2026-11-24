const canvas = document.getElementById('movement');
const context = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let view = { mode: null, reports: [], output: [], selected: null };
const sources = new Map();
let started = 0;
let animation;
let key;

export function showMessages(mode, round, reports, output, selected) {
  const next = [mode, round, reports.length, output.length, selected].join('/');
  view = { mode, reports, output, selected };
  if (key !== next) {
    key = next;
    replayMessages();
  }
}

export function replayMessages() {
  started = performance.now();
  cancelAnimationFrame(animation);
  locateLights();
  draw(started);
}

function locateLights() {
  const bounds = canvas.getBoundingClientRect();
  sources.clear();
  for (const button of document.querySelectorAll('#lamps .lamp')) {
    const marker = button.querySelector('.dot').getBoundingClientRect();
    sources.set(button.dataset.id, {
      x: marker.left + marker.width / 2 - bounds.left,
      y: marker.top + marker.height / 2 - bounds.top
    });
  }
}

function draw(now) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const scale = devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * scale) || canvas.height !== Math.round(h * scale)) {
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
  }
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, w, h);
  const grouped = view.mode === 'aggregate';
  const stacked = matchMedia('(max-width: 650px)').matches;
  const gateway = stacked ? { x: w * .40, y: h - 65 } : { x: w * .75, y: h * .5 };
  const server = stacked ? { x: w * .84, y: h - 65 } : { x: w * .94, y: h * .5 };
  const sink = grouped ? gateway : server;
  function line(a, b, active = true) {
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
    context.strokeStyle = active ? '#91cfc9' : '#79929a';
    context.lineWidth = active ? 1.7 : 1;
    context.setLineDash(active ? [] : [4, 5]); context.stroke(); context.setLineDash([]);
  }
  function dot(x, y, radius, color) {
    context.beginPath(); context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = color; context.fill();
  }
  function label(text, x, y, color = '#e5f4f5') {
    context.fillStyle = color; context.textAlign = 'center';
    context.font = '600 13px system-ui'; context.fillText(text, x, y);
  }
  function node(point, name) {
    const {x,y} = point;
    context.fillStyle = '#225160';
    context.fillRect(x - 17, y - 19, 34, 38);
    for (let i = -1; i <= 1; i++) {
      context.fillStyle = '#94cecb'; context.fillRect(x - 10, y + i * 9, 20, 3);
    }
    label(name, x, y + 40);
  }
  const origin = sources.get(view.selected);
  if (view.mode && origin) line(origin, sink, view.reports.some(r => r.id === view.selected));
  if (grouped) { line(gateway, server); node(gateway, 'Gateway'); }
  node(server, 'Server');
  if (view.mode) label(grouped ? 'UDP in' : 'TCP in', sink.x, sink.y - 31, '#b3dbde');
  if (grouped) label('TCP in', server.x, server.y - 31, '#b3dbde');
  const progress = reduced.matches ? .52 : Math.min(1, (now - started) / 950);
  function message(a, b, t, fault, summary) {
    if (t < 0 || t > 1) return;
    dot(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t,
      summary ? 8 : 4, fault ? '#ffb650' : summary ? '#adee85' : '#73e6e4');
  }
  view.reports.forEach((record, index) => {
    const offset = index * .006;
    const t = reduced.matches ? .5 : (progress - offset) / (grouped ? .44 : .82);
    const source = sources.get(record.id);
    if (source) message(source, sink, t, record.status === 'fault', false);
  });
  if (grouped) view.output.forEach(record => {
    message(gateway, server, reduced.matches ? .5 : (progress - .57) / .42,
      record.status === 'fault', record.type === 'summary');
  });
  if (!reduced.matches && progress < 1 && view.reports.length) animation = requestAnimationFrame(draw);
}

new ResizeObserver(() => {
  cancelAnimationFrame(animation);
  locateLights();
  draw(performance.now());
}).observe(canvas);
