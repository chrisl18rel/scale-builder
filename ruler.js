// ruler.js

const ruler = (() => {
  // Original image dimensions (blank_ruler.png resized to 1600×872 in images.js)
  const IW = 1600, IH = 872;

  // Ruler body bounds in original image pixels
  // Ruler body: rows 605-947, cols 210-2620 — scaled proportionally to 1600×872
  // Original source was 2816×1536, scale factors: 1600/2816=0.568, 872/1536=0.568
  const SCALE = 1600 / 2816;
  const RULER_LEFT  = Math.round(210  * SCALE);   // ~119
  const RULER_RIGHT = Math.round(2620 * SCALE);   // ~1488
  const RULER_TOP   = Math.round(605  * SCALE);   // ~344
  const RULER_BOT   = Math.round(947  * SCALE);   // ~538

  let img        = null;
  let arrowStyle = 'pointer';

  const canvas = document.getElementById('ruler-canvas');
  const ctx    = canvas.getContext('2d');

  loadImageFromDataURI(RULER_IMG)
    .then(loaded => { img = loaded; draw(); })
    .catch(err => { console.error('Ruler image failed:', err); draw(); });

  ['r-unit','r-major','r-subs','r-start','r-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });
  bindSlider('r-zoom',     'r-zoom-val',     '%',  () => draw());
  bindSlider('r-tick',     'r-tick-val',     'px', () => draw());
  bindSlider('r-fontsize', 'r-fontsize-val', 'px', () => draw());
  document.getElementById('r-show-reading').addEventListener('change', draw);
  document.getElementById('r-transparent').addEventListener('change', () => {
    updateBgClass('r-checker', isChecked('r-transparent'));
    draw();
  });

  function setArrowStyle(style) {
    arrowStyle = style;
    document.getElementById('r-arrow-pointer').classList.toggle('active', style === 'pointer');
    document.getElementById('r-arrow-line').classList.toggle('active',   style === 'line');
    draw();
  }

  function nearMultiple(v, mult, tol) {
    if (mult <= 0) return false;
    return Math.abs(v - Math.round(v / mult) * mult) < tol;
  }

  function draw() {
    const zoom        = numVal('r-zoom', 100) / 100;
    const pxPerMajor  = numVal('r-tick', 120);      // canvas px between major ticks (independent of zoom)
    const major       = Math.max(0.001, numVal('r-major', 1));
    const subs        = Math.max(1, Math.round(numVal('r-subs', 10)));
    const startVal    = numVal('r-start', 0);
    const reading     = numVal('r-reading', 4.3);
    const unit        = strVal('r-unit', 'cm');
    const fontSize    = numVal('r-fontsize', 14);
    const showRead    = isChecked('r-show-reading');
    const transparent = isChecked('r-transparent');

    // Canvas = full image scaled by zoom
    canvas.width  = Math.round(IW * zoom);
    canvas.height = Math.round(IH * zoom);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw image at full zoomed size
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#c8a04a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Ruler geometry scaled by zoom
    const rLeft  = RULER_LEFT  * zoom;
    const rRight = RULER_RIGHT * zoom;
    const rTop   = RULER_TOP   * zoom;
    const rBot   = RULER_BOT   * zoom;
    const rH     = rBot - rTop;

    // Tick spacing is pxPerMajor pixels (not scaled by zoom — this is the independent control)
    const pxPerSub = pxPerMajor / subs;
    const subVal   = major / subs;
    const decPlaces = Math.max(0, -Math.floor(Math.log10(subVal)));

    const majorH = rH * 0.55;
    const medH   = rH * 0.36;
    const minH   = rH * 0.22;

    ctx.save();
    ctx.strokeStyle = '#111';
    ctx.fillStyle   = '#111';
    ctx.lineWidth   = Math.max(0.8, 1.2 * zoom);
    ctx.font        = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'top';

    let tickIdx = 0;
    let v = startVal;
    while (true) {
      const x = rLeft + tickIdx * pxPerSub;
      if (x > rRight + 1) break;
      const isMajor = (tickIdx % subs === 0);
      const isMid   = !isMajor && subs >= 4 && (tickIdx % Math.floor(subs / 2) === 0);
      const h = isMajor ? majorH : isMid ? medH : minH;

      ctx.beginPath();
      ctx.moveTo(x, rTop);
      ctx.lineTo(x, rTop + h);
      ctx.stroke();

      if (isMajor) {
        ctx.fillText(parseFloat(v.toFixed(decPlaces)) + ' ' + unit, x, rTop + majorH + 3);
      }

      tickIdx++;
      v = parseFloat((startVal + tickIdx * subVal).toFixed(10));
    }
    ctx.restore();

    // ── Arrow + reading ──
    const rulerWidthPx = rRight - rLeft;
    const numMajorFit  = rulerWidthPx / pxPerMajor;
    const readFrac     = (reading - startVal) / (major * numMajorFit);
    const readX        = rLeft + readFrac * rulerWidthPx;

    const arrowTipY = rTop - 4 * zoom;
    const aw = Math.max(5, 8 * zoom);
    const ah = Math.max(6, 10 * zoom);

    ctx.save();
    ctx.strokeStyle = '#c00';
    ctx.fillStyle   = '#c00';
    ctx.lineWidth   = Math.max(1.5, 2 * zoom);

    if (arrowStyle === 'line') {
      // Vertical line from arrow tip down through full ruler body
      ctx.beginPath();
      ctx.moveTo(readX, arrowTipY + ah);
      ctx.lineTo(readX, rBot);
      ctx.stroke();
      // Short stem above arrowhead
      ctx.beginPath();
      ctx.moveTo(readX, arrowTipY - ah * 1.5);
      ctx.lineTo(readX, arrowTipY);
      ctx.stroke();
    } else {
      // Pointer only: stem above arrowhead
      ctx.beginPath();
      ctx.moveTo(readX, arrowTipY - ah * 2);
      ctx.lineTo(readX, arrowTipY);
      ctx.stroke();
    }

    // Arrowhead pointing DOWN (tip at arrowTipY + ah)
    ctx.beginPath();
    ctx.moveTo(readX - aw, arrowTipY);
    ctx.lineTo(readX + aw, arrowTipY);
    ctx.lineTo(readX,      arrowTipY + ah);
    ctx.closePath();
    ctx.fill();

    // Reading label
    if (showRead) {
      const lfs = fontSize;
      ctx.font = `bold ${lfs}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const lblText = reading + ' ' + unit;
      const lblW = ctx.measureText(lblText).width + 14;
      const lblY = arrowTipY - ah * 1.5 - 4;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(readX - lblW / 2, lblY - lfs - 2, lblW, lfs + 6);
      ctx.fillStyle = '#c00';
      ctx.fillText(lblText, readX, lblY);
    }

    ctx.restore();
  }

  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'ruler_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, setArrowStyle, exportPNG };
})();
