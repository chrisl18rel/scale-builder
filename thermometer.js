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
  const BULB_R     = 67;   // inner radius at widest point

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

    canvas.width  = Math.round(IW * zoom);
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

    // ── Draw liquid first, then image with white bg removed ──
    // This lets the red liquid show through the glass regardless of transparency mode.
    // The white canvas fill (if not transparent) provides the page background.

    // ── Red liquid ──
    // Neck profile: exact inner bounds from pixel scan (at zoom=1)
    // Left points going down, then right points going up = closed polygon
    const neckProfile = [
      [51,725],[51,726],[51,727],[51,728],[51,729],[50,730],[50,731],
      [49,732],[48,733],[47,734],[46,735],[45,736],[44,737],[42,738],
      [41,739],[39,740],[38,741],[37,742],[36,743],[35,744],[34,745],
      [33,746],[32,747],[31,748],[30,749],[29,750],[29,751],[28,752],
      [27,753],[26,754],[26,755],[25,756],[24,757],[24,758],[23,759],
      [23,760],[22,761],[21,762],[21,763],[20,764],[20,765],[20,766],
      [19,767],[19,768],[18,769],[18,770],[18,771],[17,772],[17,773],
      [17,774],[16,775]
    ];

    const liquidGrad = ctx.createLinearGradient(tLeft, 0, tRight, 0);
    liquidGrad.addColorStop(0,    'rgba(200, 30,  30, 0.95)');
    liquidGrad.addColorStop(0.2,  'rgba(230, 60,  60, 0.90)');
    liquidGrad.addColorStop(0.5,  'rgba(240, 80,  80, 0.88)');
    liquidGrad.addColorStop(0.8,  'rgba(230, 60,  60, 0.90)');
    liquidGrad.addColorStop(1,    'rgba(200, 30,  30, 0.95)');

    ctx.save();

    // Tube body with rounded bottom (down to TUBE_BOT)
    if (clampedFillY < tBot) {
      const cornerR = tW * 0.15;
      ctx.beginPath();
      ctx.moveTo(tLeft,  clampedFillY);
      ctx.lineTo(tLeft,  tBot - cornerR);
      ctx.quadraticCurveTo(tLeft,  tBot, tLeft  + cornerR, tBot);
      ctx.lineTo(tRight - cornerR, tBot);
      ctx.quadraticCurveTo(tRight, tBot, tRight, tBot - cornerR);
      ctx.lineTo(tRight, clampedFillY);
      ctx.closePath();
      ctx.fillStyle = liquidGrad;
      ctx.fill();
    }

    // Neck polygon: traces exact widening inner shape from TUBE_BOT down to bulb
    ctx.beginPath();
    // Left side going down
    ctx.moveTo(neckProfile[0][0] * zoom, neckProfile[0][1] * zoom);
    for (let i = 1; i < neckProfile.length; i++) {
      ctx.lineTo(neckProfile[i][0] * zoom, neckProfile[i][1] * zoom);
    }
    // Bottom of neck (across)
    const lastY = neckProfile[neckProfile.length - 1][1];
    ctx.lineTo((158 - neckProfile[neckProfile.length - 1][0]) * zoom, lastY * zoom);
    // Right side going back up (mirror of left)
    for (let i = neckProfile.length - 1; i >= 0; i--) {
      ctx.lineTo((158 - neckProfile[i][0]) * zoom, neckProfile[i][1] * zoom);
    }
    ctx.closePath();
    ctx.fillStyle = liquidGrad;
    ctx.fill();

    // Bulb circle — inner radius 67px, center (80, 800)
    ctx.beginPath();
    ctx.arc(bCX, bCY, bR, 0, Math.PI * 2);
    ctx.fillStyle = liquidGrad;
    ctx.fill();

    ctx.restore();

    // Draw thermometer image on top — strip white bg so liquid shows through
    if (img) {
      drawImageWithTransparentBg(ctx, img, 0, 0, canvas.width, canvas.height, 230);
    }

    // ── Ticks on RIGHT side of tube ──
    const tickMajW = tW * 0.90;
    const tickMedW = tW * 0.60;
    const tickMinW = tW * 0.38;
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

    // ── Dashed reading line (black) ──
    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.lineWidth   = Math.max(1, 1.5 * zoom);
    ctx.setLineDash([4 * zoom, 3 * zoom]);
    ctx.beginPath();
    ctx.moveTo(tLeft - 8 * zoom, clampedFillY);
    ctx.lineTo(tRight + tickMajW + 4, clampedFillY);
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
