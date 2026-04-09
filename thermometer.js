// thermometer.js

const thermometer = (() => {
  // Image dimensions: 158×872
  const IW = 158, IH = 872;

  // Tube/bulb bounds — calibrated from pixel scan of 158×872 image
  const TUBE_LEFT  = 51;   // inner left wall
  const TUBE_RIGHT = 110;  // inner right wall
  const TUBE_TOP   = 78;   // top of scale — calibrated by user click (y=78 in original image)
  const TUBE_BOT   = 725;  // where tube meets bulb

  // Bulb center shifted up 6px from scanned 800 to sit inside glass top
  const BULB_CX    = 80;
  const BULB_CY    = 794;
  const BULB_R     = 68;   // fits inside glass without bleeding

  let img = null;

  const canvas = document.getElementById('therm-canvas');
  const ctx    = canvas.getContext('2d');

  loadImageFromDataURI(THERM_IMG)
    .then(loaded => { img = loaded; draw(); })
    .catch(err => { console.error('Thermometer image failed:', err); draw(); });

  ['t-max','t-min','t-unit','t-major','t-subs','t-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });

  bindSliderWithInput('t-zoom-range',       't-zoom-num',       () => draw());
  bindSliderWithInput('t-tick-range',       't-tick-num',       () => draw());
  bindSliderWithInput('t-fontsize-range',   't-fontsize-num',   () => draw());
  bindSliderWithInput('t-lbl-x-range',      't-lbl-x-num',      () => draw());
  bindSliderWithInput('t-lbl-y-range',      't-lbl-y-num',      () => draw());
  bindSliderWithInput('t-tick-len-range',   't-tick-len-num',   () => draw());
  bindSliderWithInput('t-dash-thick-range', 't-dash-thick-num', () => draw());
  bindSliderWithInput('t-dash-len-range',   't-dash-len-num',   () => draw());

  document.getElementById('t-dash-color').addEventListener('input', draw);
  document.getElementById('t-show-reading').addEventListener('change', draw);
  document.getElementById('t-label-all-ticks').addEventListener('change', draw);
  document.getElementById('t-transparent').addEventListener('change', () => {
    updateBgClass('t-checker', isChecked('t-transparent'));
    draw();
  });

  // Unit presets
  document.getElementById('t-unit-preset').addEventListener('change', function() {
    const preset = this.value;
    const minEl  = document.getElementById('t-min');
    const maxEl  = document.getElementById('t-max');
    const unitEl = document.getElementById('t-unit');
    const majEl  = document.getElementById('t-major');
    const readEl = document.getElementById('t-reading');
    if (preset === 'C') {
      minEl.value = -10; maxEl.value = 110; unitEl.value = '°C'; majEl.value = 10; readEl.value = 25;
    } else if (preset === 'F') {
      minEl.value = 0;   maxEl.value = 220; unitEl.value = '°F'; majEl.value = 20; readEl.value = 77;
    } else if (preset === 'K') {
      minEl.value = 263; maxEl.value = 373; unitEl.value = 'K';  majEl.value = 10; readEl.value = 298;
    }
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
    const zoom        = getVal('t-zoom-range',     't-zoom-num',     100) / 100;
    const pxPerMajor  = getVal('t-tick-range',     't-tick-num',     40);
    const fontSize    = getVal('t-fontsize-range', 't-fontsize-num', 12);
    const maxV        = numVal('t-max', 110);
    const minV        = numVal('t-min', -10);
    const major       = Math.max(0.01, numVal('t-major', 10));
    const subs        = Math.max(1, Math.round(numVal('t-subs', 5)));
    const unit        = strVal('t-unit', '°C');
    const showRead    = isChecked('t-show-reading');
    const labelAllTicks = isChecked('t-label-all-ticks');
    const transparent = isChecked('t-transparent');
    const lblOffX     = getVal('t-lbl-x-range', 't-lbl-x-num', 0);
    const lblOffY     = getVal('t-lbl-y-range', 't-lbl-y-num', 0);
    const tickLenMult = getVal('t-tick-len-range',   't-tick-len-num',   1.0);
    const dashColor   = strVal('t-dash-color', '#222222');
    const dashThick   = getVal('t-dash-thick-range', 't-dash-thick-num', 1.5);
    const dashLenMult = getVal('t-dash-len-range',   't-dash-len-num',   1.0);

    // Reading: use exact string from input to preserve user-entered decimals
    const readingEl  = document.getElementById('t-reading');
    const readingRaw = readingEl ? readingEl.value : '25';
    const reading    = Math.max(minV, parseFloat(readingRaw) || 0);
    // Count decimal places as typed by the user
    const dotIdx     = readingRaw.indexOf('.');
    const userDecPlaces = dotIdx >= 0 ? readingRaw.length - dotIdx - 1 : 0;

    // Update minor tick info box
    const subVal     = major / subs;
    const minorEl    = document.getElementById('t-minor-val');
    const minorUnitEl = document.getElementById('t-minor-unit');
    const subDecPlaces = Math.max(0, -Math.floor(Math.log10(Math.abs(subVal) || 1)));
    if (minorEl)    minorEl.textContent    = parseFloat(subVal.toFixed(subDecPlaces));
    if (minorUnitEl) minorUnitEl.textContent = unit;

    // Right padding for tick labels
    const labelPad = Math.round(fontSize * 5 + 60);
    canvas.width  = Math.round(IW * zoom) + labelPad;
    canvas.height = Math.round(IH * zoom);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Always fill white — multiply blend needs white pixels to show red liquid.
    // In transparent mode we strip the background AFTER all drawing via a mask.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scaled geometry
    const tLeft  = TUBE_LEFT  * zoom;
    const tRight = TUBE_RIGHT * zoom;
    const tTop   = TUBE_TOP   * zoom;
    const tBot   = TUBE_BOT   * zoom;
    const tW     = tRight - tLeft;
    const bCX    = BULB_CX * zoom;
    const bCY    = BULB_CY * zoom;
    const bR     = BULB_R  * zoom;

    function tickValToY(v) {
      return tBot - (v - minV) * (pxPerMajor / major);
    }

    const fillY        = tickValToY(reading);
    // Clamp liquid to tube bounds — never above tTop, never below tBot
    const clampedFillY = Math.max(tTop, Math.min(tBot, fillY));
    // Is the reading off the visible scale (above the top tick)?
    const isOffScale   = fillY < tTop;

    // Update off-scale warning
    const warnEl = document.getElementById('t-offscale-warning');
    if (warnEl) warnEl.style.display = isOffScale ? 'block' : 'none';

    // ── Draw image first ──
    if (img) {
      ctx.drawImage(img, 0, 0, Math.round(IW * zoom), Math.round(IH * zoom));
    }

    // ── Red liquid: two separate clipped regions ──
    const liquidGrad = ctx.createLinearGradient(tLeft, 0, tRight + 2 * zoom, 0);
    liquidGrad.addColorStop(0,    'rgb(200, 30,  30)');
    liquidGrad.addColorStop(0.25, 'rgb(235, 65,  65)');
    liquidGrad.addColorStop(0.75, 'rgb(235, 65,  65)');
    liquidGrad.addColorStop(1,    'rgb(200, 30,  30)');

    // Tube rect (+2px right as requested, clamped to tTop so liquid never escapes top)
    const tubeRight = tRight + 2 * zoom;
    const tubeW     = tubeRight - tLeft;

    ctx.save();
    ctx.beginPath();
    ctx.rect(tLeft, clampedFillY, tubeW, (tBot + 20 * zoom) - clampedFillY);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(tLeft, clampedFillY, tubeW, (tBot + 20 * zoom) - clampedFillY);
    ctx.restore();

    // Bulb arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(bCX, bCY, bR, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(bCX - bR, bCY - bR, bR * 2, bR * 2);
    ctx.restore();

    // ── Ticks ──
    const maxTickW  = Math.round(IW * zoom) - tRight - 2;
    const tickMajW  = Math.min(tW * 0.90 * tickLenMult, maxTickW);
    const tickMedW  = Math.min(tW * 0.60 * tickLenMult, maxTickW);
    const tickMinW  = Math.min(tW * 0.38 * tickLenMult, maxTickW);
    const decPlaces = subDecPlaces;

    ctx.save();
    ctx.strokeStyle  = '#222';
    ctx.fillStyle    = '#222';
    ctx.lineWidth    = Math.max(0.7, 1.0 * zoom);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    let tickIdx = 0;
    let v = minV;
    while (true) {
      const y = tickValToY(v);
      if (y < tTop - 2) break;
      if (y <= tBot + 2) {
        const isMajor = (tickIdx % subs === 0);
        const isMid   = !isMajor && subs >= 4 && (tickIdx % Math.floor(subs / 2) === 0);
        const tw      = isMajor ? tickMajW : isMid ? tickMedW : tickMinW;
        ctx.beginPath();
        ctx.moveTo(tRight, y);
        ctx.lineTo(tRight + tw, y);
        ctx.stroke();
        // Label: always on major ticks; or every tick if labelAllTicks is checked
        if (isMajor || labelAllTicks) {
          ctx.fillText(parseFloat(v.toFixed(decPlaces)) + ' ' + unit, tRight + tickMajW + 4, y);
        }
      }
      tickIdx++;
      v = parseFloat((minV + tickIdx * subVal).toFixed(10));
      if (v > maxV + subVal * 0.001) break;
    }
    ctx.restore();

    // ── Dashed reading line — only if NOT off scale ──
    if (!isOffScale) {
      ctx.save();
      const fullW     = Math.round(IW * zoom) + labelPad;
      const dashStart = tLeft - 8 * zoom;
      const dashEnd   = dashStart + (fullW - dashStart) * dashLenMult;
      ctx.strokeStyle = dashColor;
      ctx.lineWidth   = Math.max(0.5, dashThick * zoom);
      ctx.setLineDash([5 * zoom, 3 * zoom]);
      ctx.beginPath();
      ctx.moveTo(dashStart, clampedFillY);
      ctx.lineTo(dashEnd,   clampedFillY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (showRead) {
        // Use exact user-entered decimal places for the label
        const lblText  = reading.toFixed(userDecPlaces) + ' ' + unit;
        ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        const lblW     = ctx.measureText(lblText).width + 14;
        // Place label centered at midpoint of the dashed line
        const midX     = (dashStart + dashEnd) / 2;
        const lblX     = midX - lblW / 2 + lblOffX;
        const lblBaseY = clampedFillY + lblOffY;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(lblX - 4, lblBaseY - fontSize - 2, lblW, fontSize + 8);
        ctx.fillStyle    = '#c00';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(lblText, lblX, lblBaseY + 2);
      }
      ctx.restore();
    }
  }

    // ── Transparent mode: flood-fill mask punches out background ──
    // Flood fill starts from image border edges, fills through connected
    // white/near-white pixels, stops at the dark glass outline.
    // This correctly leaves the glass interior opaque while removing outside background.
    if (transparent && img) {
      const imgW = Math.round(IW * zoom);
      const imgH = Math.round(IH * zoom);

      // Build mask canvas
      const mask  = document.createElement('canvas');
      mask.width  = canvas.width;
      mask.height = canvas.height;
      const mctx  = mask.getContext('2d');

      // Thermometer body: flood-fill removes only the connected background
      const thermMask = createOutlineMask(img, imgW, imgH, 220);
      mctx.drawImage(thermMask, 0, 0);

      // Label/tick area to the right: keep fully opaque
      mctx.fillStyle = '#000';
      mctx.fillRect(imgW, 0, canvas.width - imgW, canvas.height);

      // Apply mask to main canvas
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

  }  // end draw()

  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'thermometer_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
