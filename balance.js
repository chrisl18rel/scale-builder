// balance.js

const balance = (() => {
  // Image dimensions in images.js (1600×872)
  const IW = 1600, IH = 872;

  // Beam geometry in 1600×872 image (scaled from original 2816×1536)
  const BEAM_DEFS = [
    { topRail:  97, botRail: 233 },
    { topRail: 341, botRail: 528 },
    { topRail: 624, botRail: 778 },
  ];
  const B_LEFT  = 116;
  const B_RIGHT = 1446;

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

  // When beam 1 or 2 step size changes, update the reading input's step attribute
  ['b1','b2'].forEach(prefix => {
    const stepEl    = document.getElementById(`${prefix}-step`);
    const readingEl = document.getElementById(`${prefix}-reading`);
    if (stepEl && readingEl) {
      stepEl.addEventListener('input', () => {
        readingEl.step = stepEl.value;
      });
    }
  });

  bindSlider('b-zoom',     'b-zoom-val',     '%',  () => draw());
  bindSlider('b-fontsize', 'b-fontsize-val', 'px', () => draw());
  document.getElementById('b-show-reading').addEventListener('change', draw);
  document.getElementById('b-transparent').addEventListener('change', () => {
    updateBgClass('b-checker', isChecked('b-transparent'));
    draw();
  });

  function nearMultiple(v, mult, tol) {
    if (mult <= 0) return false;
    return Math.abs(v - Math.round(v / mult) * mult) < tol;
  }

  function draw() {
    const zoom        = numVal('b-zoom', 100) / 100;
    const fontSize    = numVal('b-fontsize', 13);
    const showRead    = isChecked('b-show-reading');
    const transparent = isChecked('b-transparent');

    const b1step = Math.max(0.01,  numVal('b1-step', 10));
    const b2step = Math.max(0.01,  numVal('b2-step', 100));
    const b3step = Math.max(0.001, numVal('b3-step', 1));

    const beamConfigs = [
      { min: numVal('b1-min',0),   max: numVal('b1-max',100), step: b1step, reading: numVal('b1-reading',0),   subs: 5 },
      { min: numVal('b2-min',0),   max: numVal('b2-max',500), step: b2step, reading: numVal('b2-reading',100), subs: 5 },
      { min: numVal('b3-min',0),   max: numVal('b3-max',10),  step: b3step, reading: numVal('b3-reading',3.5), subs: Math.max(1, Math.round(numVal('b3-subs',10))) },
    ];

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
      ctx.fillStyle = '#b0b8c4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const bLeft  = B_LEFT  * zoom;
    const bRight = B_RIGHT * zoom;
    const bWidth = bRight - bLeft;

    BEAM_DEFS.forEach((bd, idx) => {
      const cfg    = beamConfigs[idx];
      const topY   = bd.topRail * zoom;
      const botY   = bd.botRail * zoom;
      const beamH  = botY - topY;
      const range  = cfg.max - cfg.min;
      if (range <= 0) return;

      const pxPerUnit  = bWidth / range;
      const subStep    = cfg.step / cfg.subs;
      const decPlaces  = Math.max(0, -Math.floor(Math.log10(subStep)));

      const majorTickH = beamH * 0.55;
      const medTickH   = beamH * 0.36;
      const minTickH   = beamH * 0.22;

      ctx.save();
      ctx.strokeStyle  = '#111';
      ctx.fillStyle    = '#111';
      ctx.lineWidth    = Math.max(0.8, 1.1 * zoom);
      ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';

      let tickIdx = 0;
      let v = cfg.min;
      while (v <= cfg.max + subStep * 0.001) {
        const x = bLeft + (v - cfg.min) * pxPerUnit;
        if (x > bRight + 1) break;

        const isMajor = nearMultiple(v, cfg.step,      subStep * 0.01);
        const isMid   = !isMajor && nearMultiple(v, cfg.step / 2, subStep * 0.01);
        const tH      = isMajor ? majorTickH : isMid ? medTickH : minTickH;

        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, topY + tH);
        ctx.stroke();

        if (isMajor) {
          ctx.fillText(parseFloat(v.toFixed(decPlaces)), x, topY + majorTickH + 2);
        }

        tickIdx++;
        v = parseFloat((cfg.min + tickIdx * subStep).toFixed(10));
      }
      ctx.restore();

      // Rider
      const clampedReading = Math.max(cfg.min, Math.min(cfg.max, cfg.reading));
      const riderX = bLeft + (clampedReading - cfg.min) * pxPerUnit;

      if (riderX >= bLeft - 5 && riderX <= bRight + 5) {
        const rW = Math.max(14, 22 * zoom);
        const rH = beamH * 0.75;
        const rY = topY + beamH * 0.12;

        ctx.save();
        const rg = ctx.createLinearGradient(riderX - rW/2, 0, riderX + rW/2, 0);
        rg.addColorStop(0,   '#888');
        rg.addColorStop(0.3, '#ddd');
        rg.addColorStop(0.7, '#ddd');
        rg.addColorStop(1,   '#777');
        ctx.fillStyle   = rg;
        ctx.strokeStyle = '#333';
        ctx.lineWidth   = Math.max(0.8, 1.2 * zoom);
        ctx.beginPath();
        ctx.roundRect(riderX - rW/2, rY, rW, rH, 2 * zoom);
        ctx.fill();
        ctx.stroke();

        // Center notch
        ctx.strokeStyle = '#222';
        ctx.lineWidth   = Math.max(0.8, 1.5 * zoom);
        ctx.beginPath();
        ctx.moveTo(riderX, rY + 2);
        ctx.lineTo(riderX, rY + rH - 2);
        ctx.stroke();

        // Downward arrow from rider bottom to top rail
        const arrowBaseY = rY;
        const arrowTipY  = topY - 3 * zoom;
        const aw = Math.max(5, 7 * zoom);
        ctx.fillStyle   = '#c00';
        ctx.strokeStyle = '#c00';
        ctx.lineWidth   = Math.max(1, 1.5 * zoom);
        ctx.beginPath();
        ctx.moveTo(riderX, arrowBaseY);
        ctx.lineTo(riderX, arrowTipY + aw);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(riderX - aw, arrowTipY + aw);
        ctx.lineTo(riderX + aw, arrowTipY + aw);
        ctx.lineTo(riderX,      arrowTipY + aw * 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // Reading label above rider arrow
      if (showRead) {
        ctx.save();
        ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.fillStyle    = '#c00';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          parseFloat(clampedReading.toFixed(decPlaces)),
          riderX,
          bd.topRail * zoom - 3 * zoom - fontSize * 0.5 - 4
        );
        ctx.restore();
      }
    });
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
