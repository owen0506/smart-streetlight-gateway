// An offline streetscape for the exhibit entrance. The live socket map is below.
const canvas = document.getElementById('night');
const ctx = canvas.getContext('2d');
function paint() {
  const { width: w, height: h } = canvas.getBoundingClientRect();
  const ratio = devicePixelRatio || 1;
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  ctx.scale(ratio, ratio);
  const sky = ctx.createLinearGradient(0, 0, w, h);
  sky.addColorStop(0, '#071c29'); sky.addColorStop(.65, '#12333f'); sky.addColorStop(1, '#375864');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 48; i++) {
    const x = i * w / 46, width = w / 48;
    const top = h * (.32 + .29 * Math.abs(Math.sin(i * 12.63)));
    ctx.fillStyle = i % 2 ? '#18353f' : '#132c36';
    ctx.fillRect(x, top, width, h - top);
    ctx.fillStyle = '#517175';
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 3) ctx.fillRect(x + width * .22, top + 8 + j * 9, width * .18, 2);
    }
  }
  ctx.fillStyle = '#122932'; ctx.fillRect(0, h * .74, w, h * .26);
  ctx.strokeStyle = '#526365'; ctx.setLineDash([18, 26]); ctx.beginPath();
  ctx.moveTo(0, h * .96); ctx.lineTo(w, h * .8); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 4; i >= 0; i--) {
    const x = w * (.57 + i * .098), y = h * (.16 + i * .094);
    const base = h * (.96 - i * .045), arm = (base - y) * .26;
    const light = ctx.createRadialGradient(x + arm, y, 0, x + arm, y, base - y);
    light.addColorStop(0, '#fff1b1a8'); light.addColorStop(.5, '#ffcf712a'); light.addColorStop(1, '#ffcf7100');
    ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(x + arm - 5, y);
    ctx.lineTo(x + arm - arm * 1.55, base); ctx.lineTo(x + arm * 2.55, base);
    ctx.lineTo(x + arm + 5, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a2b3af'; ctx.lineWidth = 3 - i * .38;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, y + arm * .24);
    ctx.quadraticCurveTo(x, y, x + arm, y); ctx.stroke();
    ctx.fillStyle = '#fff2b6'; ctx.fillRect(x + arm - 6, y, 12, 3);
  }
}
new ResizeObserver(paint).observe(canvas);
