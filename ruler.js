// ruler.js

const ruler = (() => {
  const IW = 1600, IH = 872;
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

  // Linked slider + number inputs
  bindSliderWithInput('r-zoom-range',     'r-zoom-num',     () => draw());
  bindSliderWithInput('r-tick-range',     'r-tick-num',     () => draw());
  bindSliderWithInput('r-fontsize-range', 'r-fontsize-num', () => draw());
  bindSliderWithInput('r-lbl-x-range',    'r-lbl-x-num',    () => draw());
  bindSliderWithInput('r-lbl-y-range',    'r-lbl-y-num',    () => draw());

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

  function getSliderVal(rangeId, numId, fallback) {
    // Prefer the number input if it has a valid value, else use range slider
    const numEl   = document.getElementById(numId);
    const rangeEl = document.getElementById(rangeId);
    if (numEl) {
      const v = parseFloat(numEl.value);
      if (!isNaN(v)) return v;
    }
    if (rangeEl) {
      const v = parseFloat(rangeEl.value);
      if (!isNaN(v)) return v;
    }
    return fallback;
  }

  function draw() {
    const zoom        = getSliderVal('r-zoom-range',     'r-zoom-num',     100) / 100;
    const pxPerMajor  = getSliderVal('r-tick-range',     'r-tick-num',     120);
    const fontSize    = getSliderVal('r-fontsize-range', 'r-fontsize-num', 14);
    const major       = Math.max(0.001, numVal('r-major', 1));
    const subs        = Math.max(1, Math.round(numVal('r-subs', 10)));
    const startVal    = Math.max(0, numVal('r-start', 0));
    const reading     = Math.max(0, numVal('r-reading', 4.3));
    const unit        = strVal('r-unit', 'cm');
    const showRead    = isChecked('r-show-reading');
    const transparent = isChecked('r-transparent');
    const lblOffX     = getSliderVal('r-lbl-x-range', 'r-lbl-x-num', 0);
    const lblOffY     = getSliderVal('r-lbl-y-range', 'r-lbl-y-num', 0);

    // Canvas is cropped to just the ruler body + padding for label above
    // Source crop: ruler body rows RULER_TOP–RULER_BOT, cols RULER_LEFT–RULER_RIGHT
    const labelPad = Math.round(fontSize * 4 + 20);  // space above ruler for arrow + label
    const botPad   = 16;
    const sidePad  = 24;  // left + right breathing room

    const rulerBodyW = Math.round((RULER_RIGHT - RULER_LEFT) * zoom);
    const rulerBodyH = Math.round((RULER_BOT   - RULER_TOP)  * zoom);

    canvas.width  = rulerBodyW + sidePad * 2;
    canvas.height = rulerBodyH + labelPad + botPad;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw only the ruler body portion of the source image, offset by sidePad
    if (img) {
      ctx.drawImage(
        img,
        RULER_LEFT, RULER_TOP, RULER_RIGHT - RULER_LEFT, RULER_BOT - RULER_TOP,
        sidePad, labelPad, rulerBodyW, rulerBodyH
      );
    } else {
      ctx.fillStyle = '#c8a04a';
      ctx.fillRect(sidePad, labelPad, rulerBodyW, rulerBodyH);
    }

    // Ruler geometry starts at x=sidePad, y=labelPad
    const rLeft  = sidePad;
    const rRight = sidePad + rulerBodyW;
    const rTop   = labelPad;
    const rBot   = labelPad + rulerBodyH;
    const rH     = rulerBodyH;

    const pxPerSub  = pxPerMajor / subs;
    const subVal    = major / subs;
    const decPlaces = Math.max(0, -Math.floor(Math.log10(subVal)));
    const majorH    = rH * 0.55;
    const medH      = rH * 0.36;
    const minH      = rH * 0.22;

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
      ctx.beginPath(); ctx.moveTo(x, rTop); ctx.lineTo(x, rTop + h); ctx.stroke();
      if (isMajor) {
        ctx.fillText(parseFloat(v.toFixed(decPlaces)) + ' ' + unit, x, rTop + majorH + 3);
      }
      tickIdx++;
      v = parseFloat((startVal + tickIdx * subVal).toFixed(10));
    }
    ctx.restore();

    // Arrow
    const rulerWidthPx = rRight - rLeft;
    const numMajorFit  = rulerWidthPx / pxPerMajor;
    const readFrac     = (reading - startVal) / (major * numMajorFit);
    const readX        = rLeft + readFrac * rulerWidthPx;
    const arrowTipY    = rTop - 4 * zoom;
    const aw           = Math.max(5, 8 * zoom);
    const ah           = Math.max(6, 10 * zoom);

    ctx.save();
    ctx.strokeStyle = '#c00';
    ctx.fillStyle   = '#c00';
    ctx.lineWidth   = Math.max(1.5, 2 * zoom);

    if (arrowStyle === 'line') {
      ctx.beginPath(); ctx.moveTo(readX, arrowTipY + ah); ctx.lineTo(readX, rBot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(readX, arrowTipY - ah * 1.5); ctx.lineTo(readX, arrowTipY); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(readX, arrowTipY - ah * 2); ctx.lineTo(readX, arrowTipY); ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(readX - aw, arrowTipY);
    ctx.lineTo(readX + aw, arrowTipY);
    ctx.lineTo(readX,      arrowTipY + ah);
    ctx.closePath();
    ctx.fill();

    if (showRead) {
      const lblText = reading + ' ' + unit;
      const lblW    = ctx.measureText(lblText).width + 14;
      const lblX    = readX + lblOffX;
      const lblY    = arrowTipY - ah * 1.5 - 4 + lblOffY;
      ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(lblX - lblW / 2, lblY - fontSize - 2, lblW, fontSize + 6);
      ctx.fillStyle = '#c00';
      ctx.fillText(lblText, lblX, lblY);
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
