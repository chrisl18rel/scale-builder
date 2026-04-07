// balance.js

const balance = (() => {
  // ── Source image analysis ──
  // The blank triple beam balance image: 3 beams, each with 2 rails.
  // We'll identify the 3 beam regions as fractions of the image height.
  // Beam layout (approximate fractions of total image height):
  // Beam 1 (top):    rows 0.08 – 0.30  → center ~0.19
  // Beam 2 (middle): rows 0.35 – 0.57  → center ~0.46
  // Beam 3 (bottom): rows 0.62 – 0.87  → center ~0.73
  //
  // Each beam has a top rail and bottom rail bounding the beam body.
  // Ticks draw DOWNWARD from the top rail into the beam body.
  // Rider sits on the top rail with arrow pointing DOWN to the tick.
  //
  // Scale runs from the left end (~col 0.04) to right end (~col 0.88) of image.

  const BEAMS = [
    { id: 1, topF: 0.08,  botF: 0.30, railTopF: 0.10, railBotF: 0.28 },
    { id: 2, topF: 0.35,  botF: 0.57, railTopF: 0.37, railBotF: 0.55 },
    { id: 3, topF: 0.62,  botF: 0.87, railTopF: 0.64, railBotF: 0.85 },
  ];

  const SCALE_LEFT_F  = 0.04;
  const SCALE_RIGHT_F = 0.88;

  let img = null;

  const canvas = document.getElementById('balance-canvas');
  const ctx    = canvas.getContext('2d');

  loadImage('blank_triple_beam_balance.png')
    .then(loaded => { img = loaded; draw(); })
    .catch(() => { draw(); });

  // ── Bind controls ──────────────────────────────────────
  ['b1-min','b1-max','b1-step','b1-reading',
   'b2-min','b2-max','b2-step','b2-reading',
   'b3-min','b3-max','b3-step','b3-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });

  bindSlider('b-zoom',     'b-zoom-val',     '%',  () => draw());
  bindSlider('b-fontsize', 'b-fontsize-val', 'px', () => draw());

  document.getElementById('b-show-reading').addEventListener('change', draw);
  document.getElementById('b-transparent').addEventListener('change', () => {
    updateBgClass('b-checker', isChecked('b-transparent'));
    draw();
  });

  // ── Main Draw ─────────────────────────────────────────
  function draw() {
    const zoom       = numVal('b-zoom', 100) / 100;
    const fontSize   = numVal('b-fontsize', 13);
    const showRead   = isChecked('b-show-reading');
    const transparent = isChecked('b-transparent');

    const beamConfigs = [
      { min: numVal('b1-min',0), max: numVal('b1-max',100), step: Math.max(0.01,numVal('b1-step',10)), reading: numVal('b1-reading',0) },
      { min: numVal('b2-min',0), max: numVal('b2-max',500), step: Math.max(0.01,numVal('b2-step',100)), reading: numVal('b2-reading',100) },
      { min: numVal('b3-min',0), max: numVal('b3-max',10),  step: Math.max(0.001,numVal('b3-step',1)), reading: numVal('b3-reading',3.5) },
    ];

    const srcW = img ? img.naturalWidth  : 800;
    const srcH = img ? img.naturalHeight : 500;

    const canvasW = Math.round(srcW * zoom);
    const canvasH = Math.round(srcH * zoom);

    canvas.width  = canvasW;
    canvas.height = canvasH;

    ctx.clearRect(0, 0, canvasW, canvasH);

    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Draw balance image first
    if (img) {
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = '#ccc';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // ── Draw each beam's scale + rider ──
    const scaleLeft  = canvasW * SCALE_LEFT_F;
    const scaleRight = canvasW * SCALE_RIGHT_F;
    const scaleWidth = scaleRight - scaleLeft;

    BEAMS.forEach((beam, idx) => {
      const cfg        = beamConfigs[idx];
      const railTopY   = canvasH * beam.railTopF;
      const railBotY   = canvasH * beam.railBotF;
      const beamBodyH  = railBotY - railTopY;

      const range    = cfg.max - cfg.min;
      if (range <= 0) return;

      const pxPerUnit = scaleWidth / range;

      // ── Ticks (downward from rail top) ──
      ctx.save();
      ctx.strokeStyle = '#111';
      ctx.fillStyle   = '#111';
      ctx.lineWidth   = Math.max(0.8, zoom * 0.9);
      ctx.font        = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign   = 'center';

      // Number of steps
      const numSteps = Math.round(range / cfg.step);

      for (let i = 0; i <= numSteps; i++) {
        const val = cfg.min + i * cfg.step;
        if (val > cfg.max + cfg.step * 0.01) break;

        const x       = scaleLeft + (val - cfg.min) / range * scaleWidth;
        // Determine if this is a major tick (every 5th subdivision or all if step is major)
        // Since user controls step directly, every step is "labeled" but we vary length
        // for readability: alternate shorter ticks if step is small
        const isMajor = (i % 5 === 0) || numSteps <= 10;
        const tickH   = isMajor
          ? beamBodyH * 0.55
          : beamBodyH * 0.30;

        ctx.beginPath();
        ctx.moveTo(x, railTopY);
        ctx.lineTo(x, railTopY + tickH);
        ctx.stroke();

        if (isMajor) {
          const label = val % 1 === 0 ? val.toString() : val.toFixed(
            String(cfg.step).includes('.') ? String(cfg.step).split('.')[1].length : 0
          );
          ctx.fillText(label, x, railTopY + tickH + fontSize + 2);
        }
      }
      ctx.restore();

      // ── Rider ──
      const clampedReading = Math.max(cfg.min, Math.min(cfg.max, cfg.reading));
      const riderX = scaleLeft + (clampedReading - cfg.min) / range * scaleWidth;

      drawRider(ctx, riderX, railTopY, railBotY, zoom, fontSize);

      // ── Reading label ──
      if (showRead) {
        const decimals = String(cfg.step).includes('.')
          ? String(cfg.step).split('.')[1].length : 0;
        const label = clampedReading % 1 === 0
          ? clampedReading.toString()
          : clampedReading.toFixed(decimals);

        ctx.save();
        ctx.font      = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = '#c82020';
        ctx.textAlign = 'center';
        // Place label above the rider (above the rail top)
        ctx.fillText(label, riderX, railTopY - fontSize * 0.5 - 4);
        ctx.restore();
      }
    });
  }

  // ── Draw a rider shape at (x, railTopY) pointing down ──
  function drawRider(ctx, x, railTopY, railBotY, zoom, fontSize) {
    const riderH   = (railBotY - railTopY) * 0.65;
    const riderHW  = Math.max(6, 8 * zoom);
    const arrowHW  = Math.max(4, 5 * zoom);
    const arrowTipY = railTopY;        // tip of arrow sits AT the rail top
    const arrowBaseY = arrowTipY - arrowHW * 1.8;
    const stemTopY   = arrowBaseY;
    const riderTopY  = arrowBaseY - riderH * 0.25;

    ctx.save();

    // Rider body (trapezoid straddling the rail)
    ctx.fillStyle   = 'rgba(50, 50, 50, 0.85)';
    ctx.strokeStyle = '#222';
    ctx.lineWidth   = Math.max(1, zoom * 0.8);

    ctx.beginPath();
    ctx.moveTo(x - riderHW,      riderTopY);
    ctx.lineTo(x + riderHW,      riderTopY);
    ctx.lineTo(x + riderHW * 0.6, railTopY + (railBotY - railTopY) * 0.4);
    ctx.lineTo(x - riderHW * 0.6, railTopY + (railBotY - railTopY) * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center notch
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth   = Math.max(1, zoom * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, riderTopY);
    ctx.lineTo(x, railTopY + (railBotY - railTopY) * 0.4);
    ctx.stroke();

    // Red stem from rider down to arrowhead
    ctx.strokeStyle = '#e03030';
    ctx.lineWidth   = Math.max(1.5, zoom);
    ctx.beginPath();
    ctx.moveTo(x, railTopY + (railBotY - railTopY) * 0.4);
    ctx.lineTo(x, arrowBaseY);
    ctx.stroke();

    // Arrow pointing DOWN toward the scale
    ctx.fillStyle = '#e03030';
    ctx.beginPath();
    ctx.moveTo(x, arrowTipY);
    ctx.lineTo(x - arrowHW, arrowTipY - arrowHW * 1.6);
    ctx.lineTo(x + arrowHW, arrowTipY - arrowHW * 1.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ── Export ────────────────────────────────────────────
  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'triple_beam_balance_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
