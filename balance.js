// balance.js

const balance = (() => {
  const BEAMS = [
    { railTopF: 0.10, railBotF: 0.28 },
    { railTopF: 0.37, railBotF: 0.55 },
    { railTopF: 0.64, railBotF: 0.85 },
  ];

  const SCALE_LEFT_F  = 0.04;
  const SCALE_RIGHT_F = 0.88;

  let img = null;

  const canvas = document.getElementById('balance-canvas');
  const ctx    = canvas.getContext('2d');

  loadImageFromDataURI(BALANCE_IMG)
    .then(loaded => { img = loaded; draw(); })
    .catch(err => { console.error('Balance image failed:', err); draw(); });

  ['b1-min','b1-max','b1-step','b1-reading',
   'b2-min','b2-max','b2-step','b2-reading',
   'b3-min','b3-max','b3-step','b3-reading','b3-subs'].forEach(id => {
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

  function draw() {
    const zoom        = numVal('b-zoom', 100) / 100;
    const fontSize    = numVal('b-fontsize', 13);
    const showRead    = isChecked('b-show-reading');
    const transparent = isChecked('b-transparent');

    const beamConfigs = [
      { min: numVal('b1-min',0), max: numVal('b1-max',100), step: Math.max(0.01,numVal('b1-step',10)),   reading: numVal('b1-reading',0),   subs: 1 },
      { min: numVal('b2-min',0), max: numVal('b2-max',500), step: Math.max(0.01,numVal('b2-step',100)),  reading: numVal('b2-reading',100), subs: 1 },
      { min: numVal('b3-min',0), max: numVal('b3-max',10),  step: Math.max(0.001,numVal('b3-step',1)),   reading: numVal('b3-reading',3.5), subs: Math.max(1, Math.round(numVal('b3-subs',10))) },
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

    if (img) {
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = '#b0b8c4';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    const scaleLeft  = canvasW * SCALE_LEFT_F;
    const scaleRight = canvasW * SCALE_RIGHT_F;
    const scaleWidth = scaleRight - scaleLeft;

    BEAMS.forEach((beam, idx) => {
      const cfg       = beamConfigs[idx];
      const railTopY  = canvasH * beam.railTopF;
      const railBotY  = canvasH * beam.railBotF;
      const beamBodyH = railBotY - railTopY;
      const range     = cfg.max - cfg.min;
      if (range <= 0) return;

      const numSteps = Math.round(range / cfg.step);
      const stepPx   = scaleWidth / numSteps;
      const subPx    = cfg.subs > 1 ? stepPx / cfg.subs : 0;

      ctx.save();
      ctx.strokeStyle  = '#111';
      ctx.fillStyle    = '#111';
      ctx.lineWidth    = Math.max(0.8, zoom * 0.9);
      ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';

      for (let i = 0; i <= numSteps; i++) {
        const val = cfg.min + i * cfg.step;
        if (val > cfg.max + cfg.step * 0.01) break;
        const x   = scaleLeft + i * stepPx;

        const majH = beamBodyH * 0.55;
        ctx.beginPath();
        ctx.moveTo(x, railTopY);
        ctx.lineTo(x, railTopY + majH);
        ctx.stroke();

        const decPlaces = String(cfg.step).includes('.')
          ? String(cfg.step).split('.')[1].length : 0;
        ctx.fillText(val.toFixed(decPlaces), x, railTopY + majH + 2);

        if (cfg.subs > 1 && i < numSteps) {
          for (let s = 1; s < cfg.subs; s++) {
            const subX = x + s * subPx;
            if (subX > scaleRight) break;
            const isMid = (cfg.subs % 2 === 0) && (s === cfg.subs / 2);
            const subH  = isMid ? beamBodyH * 0.38 : beamBodyH * 0.25;
            ctx.beginPath();
            ctx.moveTo(subX, railTopY);
            ctx.lineTo(subX, railTopY + subH);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // Reading label above beam
      const clampedReading = Math.max(cfg.min, Math.min(cfg.max, cfg.reading));
      const riderX = scaleLeft + ((clampedReading - cfg.min) / range) * scaleWidth;

      if (showRead) {
        const decPlaces = String(cfg.step).includes('.')
          ? String(cfg.step).split('.')[1].length : 0;
        ctx.save();
        ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.fillStyle    = '#c82020';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(clampedReading.toFixed(decPlaces), riderX, railTopY - fontSize * 0.5 - 6);
        ctx.restore();
      }

      drawRider(ctx, riderX, railTopY, railBotY, zoom);
    });
  }

  function drawRider(ctx, x, railTopY, railBotY, zoom) {
    const beamH   = railBotY - railTopY;
    const riderHW = Math.max(5, 7 * zoom);
    const arrowHW = Math.max(3, 4 * zoom);

    const arrowTipY  = railTopY;
    const arrowBaseY = arrowTipY - arrowHW * 1.8;
    const riderBotY  = arrowBaseY;
    const riderTopY  = riderBotY - beamH * 0.45;

    ctx.save();
    ctx.fillStyle   = 'rgba(50, 55, 65, 0.88)';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = Math.max(0.8, zoom * 0.7);
    ctx.beginPath();
    ctx.moveTo(x - riderHW,       riderTopY);
    ctx.lineTo(x + riderHW,       riderTopY);
    ctx.lineTo(x + riderHW * 0.55, riderBotY);
    ctx.lineTo(x - riderHW * 0.55, riderBotY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(200,200,200,0.7)';
    ctx.lineWidth   = Math.max(0.7, zoom * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, riderTopY + 2);
    ctx.lineTo(x, riderBotY - 2);
    ctx.stroke();

    ctx.fillStyle = '#e03030';
    ctx.beginPath();
    ctx.moveTo(x,           arrowTipY);
    ctx.lineTo(x - arrowHW, arrowBaseY);
    ctx.lineTo(x + arrowHW, arrowBaseY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'triple_beam_balance_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
