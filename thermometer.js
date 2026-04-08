// thermometer.js

const thermometer = (() => {
  // Image dimensions: 158×872
  const IW = 158, IH = 872;

  // Tube/bulb bounds — calibrated from pixel scan of 158×872 image
  const TUBE_LEFT  = 51;   // inner left wall
  const TUBE_RIGHT = 110;  // inner right wall
  const TUBE_TOP   = 40;   // top of mercury column
  const TUBE_BOT   = 725;  // where tube meets bulb

  // Bulb geometry — center x=80, widest inner radius at y=800
  const BULB_CX    = 80;
  const BULB_CY    = 800;
  const BULB_R     = 72;   // fills full bulb interior

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

  bindSliderWithInput('t-zoom-range',     't-zoom-num',     () => draw());
  bindSliderWithInput('t-tick-range',     't-tick-num',     () => draw());
  bindSliderWithInput('t-fontsize-range', 't-fontsize-num', () => draw());
  bindSliderWithInput('t-lbl-x-range',    't-lbl-x-num',    () => draw());
  bindSliderWithInput('t-lbl-y-range',    't-lbl-y-num',    () => draw());
  bindSliderWithInput('t-tick-len-range', 't-tick-len-num', () => draw());
  bindSliderWithInput('t-dash-thick-range', 't-dash-thick-num', () => draw());
  bindSliderWithInput('t-dash-len-range',   't-dash-len-num',   () => draw());
  document.getElementById('t-dash-color').addEventListener('input', draw);

  document.getElementById('t-show-reading').addEventListener('change', draw);
  document.getElementById('t-transparent').addEventListener('change', () => {
    updateBgClass('t-checker', isChecked('t-transparent'));
    draw();
  });

  // Unit presets: when user picks a unit preset, set sensible min/max
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
      minEl.value = 0; maxEl.value = 220; unitEl.value = '°F'; majEl.value = 20; readEl.value = 77;
    } else if (preset === 'K') {
      minEl.value = 263; maxEl.value = 373; unitEl.value = 'K'; majEl.value = 10; readEl.value = 298;
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
    const reading     = Math.min(maxV, Math.max(minV, numVal('t-reading', 25)));
    const unit        = strVal('t-unit', '°C');
    const showRead    = isChecked('t-show-reading');
    const transparent = isChecked('t-transparent');
    const lblOffX     = getVal('t-lbl-x-range', 't-lbl-x-num', 0);
    const lblOffY     = getVal('t-lbl-y-range', 't-lbl-y-num', 0);

    // Add right padding for tick labels
    const labelPad = Math.round(fontSize * 5 + 60);
    canvas.width  = Math.round(IW * zoom) + labelPad;
    canvas.height = Math.round(IH * zoom);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Scaled geometry
    const tLeft  = TUBE_LEFT  * zoom;
    const tRight = TUBE_RIGHT * zoom;
    const tTop   = TUBE_TOP   * zoom;
    const tBot   = TUBE_BOT   * zoom;
    const tW     = tRight - tLeft;
    const tH     = tBot - tTop;
    const tCX    = (tLeft + tRight) / 2;
    const bCX    = BULB_CX * zoom;
    const bCY    = BULB_CY * zoom;
    const bR     = BULB_R  * zoom;

    // Value → Y: pxPerMajor drives spacing, tBot = minV
    function tickValToY(v) {
      return tBot - (v - minV) * (pxPerMajor / major);
    }

    const fillY        = tickValToY(reading);
    const clampedFillY = Math.max(tTop + 1, Math.min(tBot, fillY));

    const dashColor  = strVal('t-dash-color', '#222222');
    const dashThick  = getVal('t-dash-thick-range', 't-dash-thick-num', 1.5);
    const dashLenMult = getVal('t-dash-len-range', 't-dash-len-num', 1.0);

    // Solution: draw image first, then multiply-blend red CLIPPED to tube+bulb shape.
    if (img) {
      ctx.drawImage(img, 0, 0, Math.round(IW * zoom), Math.round(IH * zoom));
    }

    const liquidGrad = ctx.createLinearGradient(tLeft, 0, tRight, 0);
    liquidGrad.addColorStop(0,    'rgb(200, 30,  30)');
    liquidGrad.addColorStop(0.25, 'rgb(235, 65,  65)');
    liquidGrad.addColorStop(0.75, 'rgb(235, 65,  65)');
    liquidGrad.addColorStop(1,    'rgb(200, 30,  30)');

    ctx.save();

    // Clip region: tube rect + full-width bulb bounding box + bulb circle
    // Using a wide rect from bulb top to canvas bottom to cover the neck+bulb fully
    const neckBot   = 775 * zoom;
    const bulbLeft  = (BULB_CX - BULB_R) * zoom;
    const bulbTop   = (BULB_CY - BULB_R) * zoom;
    const bulbDiam  = BULB_R * 2 * zoom;
    ctx.beginPath();
    // Tube rect (narrow, top portion of liquid)
    ctx.rect(tLeft, clampedFillY, tW, neckBot - clampedFillY);
    // Wide rect covering neck + bulb area (let the arc clip the actual shape)
    ctx.rect(bulbLeft, neckBot, bulbDiam, canvas.height - neckBot);
    // Bulb circle
    ctx.arc(bCX, bCY, bR, 0, Math.PI * 2);
    ctx.clip();

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(bulbLeft, clampedFillY, bulbDiam, canvas.height - clampedFillY);

    ctx.restore();

    const tickLenMult = getVal('t-tick-len-range', 't-tick-len-num', 1.0);

    // ── Ticks on RIGHT side of tube ──
    // Base widths as fraction of tube width, scaled by user tick length multiplier
    // Clamped so ticks never extend past the right glass wall at tRight
    const maxTickW  = Math.round(IW * zoom) - tRight - 2;  // space available to right of tube
    const tickMajW  = Math.min(tW * 0.90 * tickLenMult, maxTickW);
    const tickMedW  = Math.min(tW * 0.60 * tickLenMult, maxTickW);
    const tickMinW  = Math.min(tW * 0.38 * tickLenMult, maxTickW);
    const range     = maxV - minV;
    const subVal    = major / subs;
    const decPlaces = Math.max(0, -Math.floor(Math.log10(Math.abs(subVal) || 1)));

    ctx.save();
    ctx.strokeStyle  = '#222';
    ctx.fillStyle    = '#222';
    ctx.lineWidth    = Math.max(0.7, 1.0 * zoom);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    let tickIdx = 0;
    let v = minV;
    // Draw ticks as long as they are within tube bounds
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
        if (isMajor) {
          ctx.fillText(parseFloat(v.toFixed(decPlaces)) + ' ' + unit, tRight + tickMajW + 4, y);
        }
      }
      tickIdx++;
      v = parseFloat((minV + tickIdx * subVal).toFixed(10));
      if (v > maxV + subVal * 0.001) break;
    }
    ctx.restore();

    // ── Dashed reading line ──
    ctx.save();
    const dashLineW   = Math.round(IW * zoom) + labelPad;  // full canvas width
    const dashExtentL = tLeft - 8 * zoom;                   // left start
    const dashExtentR = dashExtentL + (dashLineW - dashExtentL) * dashLenMult;
    ctx.strokeStyle = dashColor;
    ctx.lineWidth   = Math.max(0.5, dashThick * zoom);
    ctx.setLineDash([5 * zoom, 3 * zoom]);
    ctx.beginPath();
    ctx.moveTo(dashExtentL, clampedFillY);
    ctx.lineTo(dashExtentR, clampedFillY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (showRead) {
      const lblText  = reading.toFixed(decPlaces) + ' ' + unit;
      const lblX     = tRight + tickMajW + 6 + lblOffX;
      const lblBaseY = clampedFillY + lblOffY;
      const lblW     = ctx.measureText(lblText).width + 14;
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
    link.download = 'thermometer_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
