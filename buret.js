// buret.js

const buret = (() => {
  const IW = 1024, IH = 1536;
  // Tube bounds calibrated from the buret image
  // TUBE_TOP=60: 0.00 mL mark (top of scale — burets read top-down)
  // TUBE_BOT=1050: lowest usable scale position (just above the taper)
  // LIQ_BOT=1058: bottom of the straight tube where the taper to the stopcock begins
  const TUBE_LEFT  = 478;
  const TUBE_RIGHT = 549;
  const TUBE_TOP   = 60;
  const TUBE_BOT   = 1050;
  const LIQ_BOT    = 1058;
  // Taper: straight tube narrows toward the stopcock barrel
  const TAPER_BOT   = 1096;
  const TAPER_LEFT  = 487;
  const TAPER_RIGHT = 536;

  let img = null;

  const canvas = document.getElementById('buret-canvas');
  const ctx    = canvas.getContext('2d');

  loadImageFromDataURI(BURET_IMG)
    .then(loaded => { img = loaded; draw(); })
    .catch(err => { console.error('Buret image failed:', err); draw(); });

  ['bu-max','bu-unit','bu-major','bu-subs','bu-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });

  bindSliderWithInput('bu-zoom-range',     'bu-zoom-num',     () => draw());
  bindSliderWithInput('bu-tick-range',     'bu-tick-num',     () => draw());
  bindSliderWithInput('bu-fontsize-range', 'bu-fontsize-num', () => draw());
  bindSliderWithInput('bu-lbl-x-range',    'bu-lbl-x-num',    () => draw());
  bindSliderWithInput('bu-lbl-y-range',    'bu-lbl-y-num',    () => draw());

  document.getElementById('bu-show-reading').addEventListener('change', draw);
  document.getElementById('bu-transparent').addEventListener('change', () => {
    updateBgClass('bu-checker', isChecked('bu-transparent'));
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
    const zoom       = getVal('bu-zoom-range',     'bu-zoom-num',     45) / 100;
    const pxPerMajor = getVal('bu-tick-range',     'bu-tick-num',     44);
    const fontSize   = getVal('bu-fontsize-range', 'bu-fontsize-num', 14);
    const maxV       = Math.max(0.01, numVal('bu-max', 50));
    const minV       = 0;
    const major      = Math.max(0.01, numVal('bu-major', 5));
    const subs       = Math.max(1, Math.round(numVal('bu-subs', 10)));
    const reading    = Math.min(maxV, Math.max(0, numVal('bu-reading', 12.5)));
    const unit       = strVal('bu-unit', 'mL');
    const showRead   = isChecked('bu-show-reading');
    const transparent = isChecked('bu-transparent');
    const lblOffX    = getVal('bu-lbl-x-range', 'bu-lbl-x-num', 0);
    const lblOffY    = getVal('bu-lbl-y-range', 'bu-lbl-y-num', 0);

    // Update "each minor tick =" info box
    const minorValEl  = document.getElementById('bu-minor-val');
    const minorUnitEl = document.getElementById('bu-minor-unit');
    if (minorValEl)  minorValEl.textContent  = parseFloat((major / subs).toPrecision(4));
    if (minorUnitEl) minorUnitEl.textContent = unit;

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
    const liqBot = LIQ_BOT    * zoom;
    const tW     = tRight - tLeft;
    const tCX    = (tLeft + tRight) / 2;
    const tpBot   = TAPER_BOT   * zoom;
    const tpLeft  = TAPER_LEFT  * zoom;
    const tpRight = TAPER_RIGHT * zoom;

    // ── Single Y mapping — TOP-DOWN ──
    // Burets read from the top: 0 mL at tTop, values increase downward.
    // Range-driven: minV→maxV spans the tube exactly at any zoom, so Max
    // Capacity, Major Division, and Subdivisions always render correctly.
    // The Scale Stretch slider acts as a multiplier relative to the exact
    // fit (its default value of 44 = 1.0× = scale fills the tube).
    const range   = Math.max(0.001, maxV - minV);
    const stretch = pxPerMajor / 44;
    function tickValToY(v) {
      return tTop + ((v - minV) / range) * (tBot - tTop) * stretch;
    }

    const fillY        = tickValToY(reading);
    const clampedFillY = Math.max(tTop + 1, Math.min(liqBot - 1, fillY));

    // ── Draw buret image FIRST ──
    // Source PNG already has a transparent background (RGBA), so a plain
    // drawImage preserves alpha — no white-pixel knockout needed.
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
      ctx.strokeRect(tLeft, tTop, tW, tBot - tTop);
    }

    // ── Liquid fill ON TOP of image, clipped to tube interior ──
    // Liquid runs from the meniscus DOWN through the tube and into the
    // taper above the stopcock (a real buret is full below the meniscus).
    if (clampedFillY < liqBot) {
      ctx.save();

      // Clip: straight tube body + taper trapezoid
      ctx.beginPath();
      ctx.moveTo(tLeft, clampedFillY);
      ctx.lineTo(tLeft, liqBot);
      ctx.lineTo(tpLeft, tpBot);
      ctx.lineTo(tpRight, tpBot);
      ctx.lineTo(tRight, liqBot);
      ctx.lineTo(tRight, clampedFillY);
      ctx.closePath();
      ctx.clip();

      const grad = ctx.createLinearGradient(tLeft, 0, tRight, 0);
      grad.addColorStop(0,    'rgba(80,170,225,0.75)');
      grad.addColorStop(0.18, 'rgba(130,205,245,0.60)');
      grad.addColorStop(0.82, 'rgba(130,205,245,0.60)');
      grad.addColorStop(1,    'rgba(70,155,215,0.75)');

      // Fill the full liquid body (clipped to tube + taper shape above)
      ctx.fillStyle = grad;
      ctx.fillRect(tLeft, clampedFillY, tW, tpBot - clampedFillY);

      // Concave meniscus: edges UP, center at clampedFillY
      const mDepth = tW * 0.10;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tLeft, clampedFillY - mDepth);
      ctx.bezierCurveTo(tLeft + tW*0.25, clampedFillY - mDepth*0.2, tCX - tW*0.05, clampedFillY, tCX, clampedFillY);
      ctx.bezierCurveTo(tCX + tW*0.05, clampedFillY, tRight - tW*0.25, clampedFillY - mDepth*0.2, tRight, clampedFillY - mDepth);
      ctx.lineTo(tRight, liqBot); ctx.lineTo(tLeft, liqBot); ctx.closePath(); ctx.fill();

      // Meniscus outline
      ctx.strokeStyle = 'rgba(20,110,175,0.95)';
      ctx.lineWidth   = Math.max(1.5, 2 * zoom);
      ctx.beginPath();
      ctx.moveTo(tLeft, clampedFillY - mDepth);
      ctx.bezierCurveTo(tLeft + tW*0.25, clampedFillY - mDepth*0.2, tCX - tW*0.05, clampedFillY, tCX, clampedFillY);
      ctx.bezierCurveTo(tCX + tW*0.05, clampedFillY, tRight - tW*0.25, clampedFillY - mDepth*0.2, tRight, clampedFillY - mDepth);
      ctx.stroke();

      // Glass glare highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(tLeft + tW*0.64, clampedFillY, tW*0.11, tpBot - clampedFillY);

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
    // Stop at max capacity OR the bottom of the usable tube, whichever first
    while (v <= maxV + 1e-9 && tickValToY(v) <= tBot + 2) {
      const y = tickValToY(v);
      if (y >= tTop - 2) {
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

    // ── Dashed reading line aligned with tick scale ──
    ctx.save();
    ctx.strokeStyle = '#c00';
    ctx.lineWidth   = Math.max(1.5, 2 * zoom);
    ctx.setLineDash([5 * zoom, 3 * zoom]);
    ctx.beginPath();
    ctx.moveTo(tLeft - 15 * zoom, clampedFillY);
    ctx.lineTo(tRight + tickMajW + 5, clampedFillY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (showRead) {
      // Burets are read one decimal past the smallest graduation
      // (the estimated digit), e.g. 12.35 mL on a 0.1 mL buret.
      const decP    = Math.max(0, -Math.floor(Math.log10(subVal))) + 1;
      const lblText = reading.toFixed(decP) + ' ' + unit;
      const lblX    = tRight + tickMajW + 8 + lblOffX;
      const lblBaseY = clampedFillY + lblOffY;
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
    link.download = 'buret_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
