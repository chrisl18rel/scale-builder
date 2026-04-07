// ruler.js

const ruler = (() => {
  // Image dimensions in images.js (resized to 1600×872)
  const IW = 1600, IH = 872;

  // Ruler body bounds in 1600×872 image (scaled from original 2816×1536)
  const RULER_LEFT  = 119;
  const RULER_RIGHT = 1489;
  const RULER_TOP   = 343;
  const RULER_BOT   = 538;

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

  function draw() {
    const zoom        = numVal('r-zoom', 100) / 100;
    const pxPerMajor  = numVal('r-tick', 120);
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

    const pxPerSub  = pxPerMajor / subs;
    const subVal    = major / subs;
    const decPlaces = Math.max(0, -Math.floor(Math.log10(subVal)));

    const majorH = rH * 0.55;
    const medH   = rH * 0.36;
    const minH   = rH * 0.22;

    ctx.save();
    ctx.strokeStyle  = '#111';
    ctx.fillStyle    = '#111';
    ctx.lineWidth    = Math.max(0.8, 1.2 * zoom);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign    = 'center';
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

    // Arrow + reading
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
      // Vertical line from tip downward through the full ruler body
      ctx.beginPath();
      ctx.moveTo(readX, arrowTipY + ah);
      ctx.lineTo(readX, rBot);
      ctx.stroke();
      // Stem above arrowhead
      ctx.beginPath();
      ctx.moveTo(readX, arrowTipY - ah * 1.5);
      ctx.lineTo(readX, arrowTipY);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(readX, arrowTipY - ah * 2);
      ctx.lineTo(readX, arrowTipY);
      ctx.stroke();
    }

    // Arrowhead pointing down
    ctx.beginPath();
    ctx.moveTo(readX - aw, arrowTipY);
    ctx.lineTo(readX + aw, arrowTipY);
    ctx.lineTo(readX,      arrowTipY + ah);
    ctx.closePath();
    ctx.fill();

    if (showRead) {
      const lblText = reading + ' ' + unit;
      const lblW    = ctx.measureText(lblText).width + 14;
      const lblY    = arrowTipY - ah * 1.5 - 4;
      ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(readX - lblW / 2, lblY - fontSize - 2, lblW, fontSize + 6);
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
