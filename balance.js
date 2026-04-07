// balance.js

const balance = (() => {
  // Original image dimensions (resized to 1600×872 in images.js)
  const IW = 1600, IH = 872;

  // Beam geometry from old code (original 2816×1536), scaled to 1600×872
  const SCALE = 1600 / 2816;
  const BEAM_DEFS = [
    { topRail: Math.round(170  * SCALE), botRail: Math.round(410  * SCALE) },  // ~97, ~233
    { topRail: Math.round(600  * SCALE), botRail: Math.round(930  * SCALE) },  // ~341, ~528
    { topRail: Math.round(1100 * SCALE), botRail: Math.round(1370 * SCALE) },  // ~625, ~779 — clamp to IH
  ];
  const B_LEFT_O  = Math.round(205  * SCALE);   // ~117
  const B_RIGHT_O = Math.round(2545 * SCALE);   // ~1446

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

  function nearMultiple(v, mult, tol) {
    if (mult <= 0) return false;
    return Math.abs(v - Math.round(v / mult) * mult) < tol;
  }

  function draw() {
    const zoom        = numVal('b-zoom', 100) / 100;
    const fontSize    = numVal('b-fontsize', 13);
    const showRead    = isChecked('b-show-reading');
    const transparent = isChecked('b-transparent');

    const beamConfigs = [
      { min: numVal('b1-min',0), max: numVal('b1-max',100), step: Math.max(0.01,numVal('b1-step',10)),   reading: numVal('b1-reading',0),   subs: 5 },
      { min: numVal('b2-min',0), max: numVal('b2-max',500), step: Math.max(0.01,numVal('b2-step',100)),  reading: numVal('b2-reading',100), subs: 5 },
      { min: numVal('b3-min',0), max: numVal('b3-max',10),  step: Math.max(0.001,numVal('b3-step',1)),   reading: numVal('b3-reading',3.5), subs: Math.max(1, Math.round(numVal('b3-subs',10))) },
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

    const bLeft  = B_LEFT_O  * zoom;
    const bRight = B_RIGHT_O * zoom;
    const bWidth = bRight - bLeft;

    BEAM_DEFS.forEach((bd, idx) => {
      const cfg      = beamConfigs[idx];
      const topY     = bd.topRail * zoom;
      const botY     = bd.botRail * zoom;
      const beamH    = botY - topY;
      const range    = cfg.max - cfg.min;
      if (range <= 0) return;

      const pxPerUnit = bWidth / range;
      const subStep   = cfg.step / cfg.subs;
      const decPlaces = Math.max(0, -Math.floor(Math.log10(subStep)));

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

        const isMajor = nearMultiple(v, cfg.step, subStep * 0.01);
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

      // ── Rider ──
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

        // Downward arrow from rider bottom to just above top rail
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

      // Reading label above rider
      if (showRead) {
        ctx.save();
        ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.fillStyle    = '#c00';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          parseFloat(clampedReading.toFixed(decPlaces)),
          riderX,
          topY - 3 * zoom - fontSize * 0.5 - 4
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
