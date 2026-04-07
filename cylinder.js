// cylinder.js

const cylinder = (() => {
  const IW = 1600, IH = 872;
  // Exact inner tube bounds — TUBE_TOP calibrated by user click (y=76 in original image)
  const TUBE_LEFT  = 723;
  const TUBE_RIGHT = 876;
  const TUBE_TOP   = 76;
  const TUBE_BOT   = 718;

  let img = null;

  const canvas = document.getElementById('cylinder-canvas');
  const ctx    = canvas.getContext('2d');

  loadImageFromDataURI(CYLINDER_IMG)
    .then(loaded => { img = loaded; draw(); })
    .catch(err => { console.error('Cylinder image failed:', err); draw(); });

  ['c-max','c-unit','c-major','c-subs','c-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });

  bindSliderWithInput('c-zoom-range',     'c-zoom-num',     () => draw());
  bindSliderWithInput('c-tick-range',     'c-tick-num',     () => draw());
  bindSliderWithInput('c-fontsize-range', 'c-fontsize-num', () => draw());
  bindSliderWithInput('c-lbl-x-range',    'c-lbl-x-num',    () => draw());
  bindSliderWithInput('c-lbl-y-range',    'c-lbl-y-num',    () => draw());

  document.getElementById('c-show-reading').addEventListener('change', draw);
  document.getElementById('c-transparent').addEventListener('change', () => {
    updateBgClass('c-checker', isChecked('c-transparent'));
    draw();
  });

  function getVal(rangeId, numId, fallback) {
    const numEl   = document.getElementById(numId);
    const rangeEl = document.getElementById(rangeId);
    if (numEl)   { const v = parseFloat(numEl.value);   if (!isNaN(v)) return v; }
    if (rangeEl) { const v = parseFloat(rangeEl.value); if (!isNaN(v)) return v; }
    return fallback;
  }

  function draw() {
    const zoom       = getVal('c-zoom-range',     'c-zoom-num',     100) / 100;
    const pxPerMajor = getVal('c-tick-range',     'c-tick-num',     50);
    const fontSize   = getVal('c-fontsize-range', 'c-fontsize-num', 14);
    const maxV       = Math.max(1, numVal('c-max', 100));
    const minV       = 0;
    const major      = Math.max(0.01, numVal('c-major', 10));
    const subs       = Math.max(1, Math.round(numVal('c-subs', 5)));
    const reading    = Math.min(maxV, Math.max(0, numVal('c-reading', 42)));
    const unit       = strVal('c-unit', 'mL');
    const showRead   = isChecked('c-show-reading');
    const transparent = isChecked('c-transparent');
    const lblOffX    = getVal('c-lbl-x-range', 'c-lbl-x-num', 0);
    const lblOffY    = getVal('c-lbl-y-range', 'c-lbl-y-num', 0);

    canvas.width  = Math.round(IW * zoom);
    canvas.height = Math.round(IH * zoom);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Tube pixel bounds
    const tLeft  = TUBE_LEFT  * zoom;
    const tRight = TUBE_RIGHT * zoom;
    const tTop   = TUBE_TOP   * zoom;
    const tBot   = TUBE_BOT   * zoom;
    const tW     = tRight - tLeft;
    const tH     = tBot   - tTop;
    const tCX    = (tLeft + tRight) / 2;

    // ── Two separate Y mappings ──
    // 1. Liquid fill Y: always maps to actual tube pixel height (so liquid is always visible)
    function readingToY(v) {
      const frac = Math.max(0, Math.min(1, (v - minV) / (maxV - minV)));
      return tBot - frac * tH;
    }

    // 2. Tick Y: driven by pxPerMajor (scale stretch slider), bottom of tube = minV
    function tickValToY(v) {
      return tBot - (v - minV) * (pxPerMajor / major);
    }

    const fillY        = readingToY(reading);
    const clampedFillY = Math.max(tTop + 1, Math.min(tBot - 1, fillY));

    // ── Draw cylinder image FIRST ──
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
      ctx.strokeRect(tLeft, tTop, tW, tH);
    }

    // ── Liquid fill ON TOP of image, clipped to tube interior ──
    if (clampedFillY < tBot) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(tLeft, tTop, tW, tH);
      ctx.clip();

      const grad = ctx.createLinearGradient(tLeft, 0, tRight, 0);
      grad.addColorStop(0,    'rgba(80,170,225,0.75)');
      grad.addColorStop(0.18, 'rgba(130,205,245,0.60)');
      grad.addColorStop(0.82, 'rgba(130,205,245,0.60)');
      grad.addColorStop(1,    'rgba(70,155,215,0.75)');

      ctx.fillStyle = grad;
      ctx.fillRect(tLeft, clampedFillY, tW, tBot - clampedFillY);

      // Concave meniscus: edges UP, center at clampedFillY
      const mDepth = tW * 0.10;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tLeft, clampedFillY - mDepth);
      ctx.bezierCurveTo(tLeft + tW*0.25, clampedFillY - mDepth*0.2, tCX - tW*0.05, clampedFillY, tCX, clampedFillY);
      ctx.bezierCurveTo(tCX + tW*0.05, clampedFillY, tRight - tW*0.25, clampedFillY - mDepth*0.2, tRight, clampedFillY - mDepth);
      ctx.lineTo(tRight, tBot); ctx.lineTo(tLeft, tBot); ctx.closePath(); ctx.fill();

      // Meniscus outline
      ctx.strokeStyle = 'rgba(20,110,175,0.95)';
      ctx.lineWidth   = Math.max(1.5, 2 * zoom);
      ctx.beginPath();
      ctx.moveTo(tLeft, clampedFillY - mDepth);
      ctx.bezierCurveTo(tLeft + tW*0.25, clampedFillY - mDepth*0.2, tCX - tW*0.05, clampedFillY, tCX, clampedFillY);
      ctx.bezierCurveTo(tCX + tW*0.05, clampedFillY, tRight - tW*0.25, clampedFillY - mDepth*0.2, tRight, clampedFillY - mDepth);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(tLeft + tW*0.64, clampedFillY, tW*0.11, tBot - clampedFillY);
      ctx.restore();
    }

    // ── Ticks on RIGHT side using tickValToY ──
    const tickMajW = tW * 0.60;
    const tickMedW = tW * 0.40;
    const tickMinW = tW * 0.25;
    const subVal    = major / subs;
    const decPlaces = Math.max(0, -Math.floor(Math.log10(subVal)));

    ctx.save();
    ctx.strokeStyle  = '#111';
    ctx.fillStyle    = '#111';
    ctx.lineWidth    = Math.max(0.8, 1.2 * zoom);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    let tickIdx = 0;
    let v = minV;
    while (tickValToY(v) >= tTop - 2) {
      const y = tickValToY(v);
      if (y <= tBot + 2) {
        const isMajor = (tickIdx % subs === 0);
        const isMid   = !isMajor && subs >= 4 && (tickIdx % Math.floor(subs / 2) === 0);
        const tw      = isMajor ? tickMajW : isMid ? tickMedW : tickMinW;
        ctx.beginPath(); ctx.moveTo(tRight, y); ctx.lineTo(tRight + tw, y); ctx.stroke();
        if (isMajor) {
          ctx.fillText(parseFloat(v.toFixed(decPlaces)) + ' ' + unit, tRight + tickMajW + 5, y);
        }
      }
      tickIdx++;
      v = parseFloat((minV + tickIdx * subVal).toFixed(10));
    }
    ctx.restore();

    // ── Dashed reading line: positioned by tickValToY so it aligns with the scale ──
    // clampedFillY is still used for the liquid visual; the dashed line uses the tick system
    const tickReadY       = tickValToY(reading);
    const clampedTickReadY = Math.max(tTop + 1, Math.min(tBot - 1, tickReadY));

    ctx.save();
    ctx.strokeStyle = '#c00';
    ctx.lineWidth   = Math.max(1.5, 2 * zoom);
    ctx.setLineDash([5 * zoom, 3 * zoom]);
    ctx.beginPath();
    ctx.moveTo(tLeft - 15 * zoom, clampedTickReadY);
    ctx.lineTo(tRight + tickMajW + 5, clampedTickReadY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (showRead) {
      const decP    = Math.max(0, -Math.floor(Math.log10(subVal)));
      const lblText = reading.toFixed(decP) + ' ' + unit;
      const lblX    = tRight + tickMajW + 8 + lblOffX;
      const lblBaseY = clampedTickReadY + lblOffY;
      const lblW    = ctx.measureText(lblText).width + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(lblX - 4, lblBaseY - fontSize - 2, lblW, fontSize + 8);
      ctx.fillStyle    = '#c00';
      ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(lblText, lblX, lblBaseY + 2);
    }
    ctx.restore();
  }

  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'graduated_cylinder_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
