// balance.js

const balance = (() => {
  const IW = 1600, IH = 872;

  // Beam geometry in 1600×872 image
  // topRail / botRail = the dark rail lines bounding each beam
  // The silvery label area is the LOWER portion of each beam body
  // Shift labels down by using a labelOffsetFrac of the beam height
  const BEAM_DEFS = [
    { topRail:  97, botRail: 233, labelFrac: 0.55 },
    { topRail: 341, botRail: 528, labelFrac: 0.65 },  // shifted down into silver area
    { topRail: 624, botRail: 778, labelFrac: 0.65 },  // shifted down into silver area
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

  bindSliderWithInput('b-zoom-range',     'b-zoom-num',     () => draw());
  bindSliderWithInput('b-fontsize-range', 'b-fontsize-num', () => draw());
  bindSlider('b3-subs', 'b3-subs-val', '', () => draw());
  // Per-beam reading label offsets
  ['b1-lbl-x','b1-lbl-y','b2-lbl-x','b2-lbl-y','b3-lbl-x','b3-lbl-y'].forEach(base => {
    bindSliderWithInput(base + '-range', base + '-num', () => draw());
  });
  // Per-beam scale number Y shift
  ['b1-scale-y','b2-scale-y','b3-scale-y'].forEach(base => {
    bindSliderWithInput(base + '-range', base + '-num', () => draw());
  });

  document.getElementById('b-show-reading').addEventListener('change', draw);
  document.getElementById('b-transparent').addEventListener('change', () => {
    updateBgClass('b-checker', isChecked('b-transparent'));
    draw();
  });

  // Beam 1/2: reading step = step size
  ['b1','b2'].forEach(prefix => {
    const stepEl    = document.getElementById(`${prefix}-step`);
    const readingEl = document.getElementById(`${prefix}-reading`);
    if (stepEl && readingEl) {
      stepEl.addEventListener('input', () => { readingEl.step = stepEl.value; });
    }
  });

  function nearMultiple(v, mult, tol) {
    if (mult <= 0) return false;
    return Math.abs(v - Math.round(v / mult) * mult) < tol;
  }

  function getVal(rangeId, numId, fallback) {
    const numEl   = document.getElementById(numId);
    const rangeEl = document.getElementById(rangeId);
    if (numEl)   { const v = parseFloat(numEl.value);   if (!isNaN(v)) return v; }
    if (rangeEl) { const v = parseFloat(rangeEl.value); if (!isNaN(v)) return v; }
    return fallback;
  }

  function draw() {
    const zoom        = getVal('b-zoom-range',     'b-zoom-num',     100) / 100;
    const fontSize    = getVal('b-fontsize-range', 'b-fontsize-num', 13);
    const showRead    = isChecked('b-show-reading');
    const transparent = isChecked('b-transparent');

    const lblOffsets = [
      { x: getVal('b1-lbl-x-range','b1-lbl-x-num',0), y: getVal('b1-lbl-y-range','b1-lbl-y-num',0) },
      { x: getVal('b2-lbl-x-range','b2-lbl-x-num',0), y: getVal('b2-lbl-y-range','b2-lbl-y-num',0) },
      { x: getVal('b3-lbl-x-range','b3-lbl-x-num',0), y: getVal('b3-lbl-y-range','b3-lbl-y-num',0) },
    ];

    const scaleNumShift = [
      getVal('b1-scale-y-range','b1-scale-y-num', 0),
      getVal('b2-scale-y-range','b2-scale-y-num', 0),
      getVal('b3-scale-y-range','b3-scale-y-num', 0),
    ];

    // Debug: confirm scaleNumShift is being read (remove after testing)
    // console.log('scaleNumShift:', scaleNumShift);

    const b1step = Math.max(0.01,  numVal('b1-step', 10));
    const b2step = Math.max(0.01,  numVal('b2-step', 100));
    const b3step = Math.max(0.001, numVal('b3-step', 1));

    const beamConfigs = [
      {
        min:     Math.max(0, numVal('b1-min', 0)),
        max:     numVal('b1-max', 100),
        step:    b1step,
        reading: Math.max(0, numVal('b1-reading', 0)),
        subs:    1,          // NO subdivisions on beam 1
        noSubs:  true,
      },
      {
        min:     Math.max(0, numVal('b2-min', 0)),
        max:     numVal('b2-max', 500),
        step:    b2step,
        reading: Math.max(0, numVal('b2-reading', 100)),
        subs:    1,          // NO subdivisions on beam 2
        noSubs:  true,
      },
      {
        min:     Math.max(0, numVal('b3-min', 0)),
        max:     numVal('b3-max', 10),
        step:    b3step,
        reading: Math.max(0, numVal('b3-reading', 3.5)),
        subs:    Math.max(1, Math.round(numVal('b3-subs', 10))),
        noSubs:  false,
      },
    ];

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

      // Tick heights downward from topY
      const majorTickH = beamH * 0.55;
      const medTickH   = beamH * 0.36;
      const minTickH   = beamH * 0.22;

      // Label Y: shifted into the silver/lower area of beam + user-controlled Y offset
      const labelY = topY + beamH * bd.labelFrac + fontSize + scaleNumShift[idx];

      ctx.save();
      ctx.strokeStyle  = '#111';
      ctx.fillStyle    = '#111';
      ctx.lineWidth    = Math.max(0.8, 1.1 * zoom);
      ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';

      if (cfg.noSubs) {
        // Beams 1 & 2: only major ticks at each step, no subdivisions at all
        const numSteps  = Math.round(range / cfg.step);
        const decPlaces = Math.max(0, -Math.floor(Math.log10(cfg.step)));
        for (let i = 0; i <= numSteps; i++) {
          const v = cfg.min + i * cfg.step;
          if (v > cfg.max + cfg.step * 0.001) break;
          const x = bLeft + (v - cfg.min) * pxPerUnit;
          if (x > bRight + 1) break;
          ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, topY + majorTickH); ctx.stroke();
          ctx.fillText(parseFloat(v.toFixed(decPlaces)), x, labelY);
        }
      } else {
        // Beam 3: major ticks + subdivisions
        const subStep   = cfg.step / cfg.subs;
        const decPlaces = Math.max(0, -Math.floor(Math.log10(subStep)));
        let tickIdx = 0;
        let v = cfg.min;
        while (v <= cfg.max + subStep * 0.001) {
          const x = bLeft + (v - cfg.min) * pxPerUnit;
          if (x > bRight + 1) break;
          const isMajor = nearMultiple(v, cfg.step,      subStep * 0.01);
          const isMid   = !isMajor && nearMultiple(v, cfg.step / 2, subStep * 0.01);
          const tH      = isMajor ? majorTickH : isMid ? medTickH : minTickH;
          ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, topY + tH); ctx.stroke();
          if (isMajor) {
            ctx.fillText(parseFloat(v.toFixed(decPlaces)), x, labelY);
          }
          tickIdx++;
          v = parseFloat((cfg.min + tickIdx * subStep).toFixed(10));
        }
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
        rg.addColorStop(0, '#888'); rg.addColorStop(0.3, '#ddd');
        rg.addColorStop(0.7, '#ddd'); rg.addColorStop(1, '#777');
        ctx.fillStyle = rg; ctx.strokeStyle = '#333';
        ctx.lineWidth = Math.max(0.8, 1.2 * zoom);
        ctx.beginPath();
        ctx.roundRect(riderX - rW/2, rY, rW, rH, 2 * zoom);
        ctx.fill(); ctx.stroke();

        ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(0.8, 1.5 * zoom);
        ctx.beginPath(); ctx.moveTo(riderX, rY + 2); ctx.lineTo(riderX, rY + rH - 2); ctx.stroke();

        const arrowBaseY = rY;
        const arrowTipY  = topY - 3 * zoom;
        const aw = Math.max(5, 7 * zoom);
        ctx.fillStyle = '#c00'; ctx.strokeStyle = '#c00';
        ctx.lineWidth = Math.max(1, 1.5 * zoom);
        ctx.beginPath(); ctx.moveTo(riderX, arrowBaseY); ctx.lineTo(riderX, arrowTipY + aw); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(riderX - aw, arrowTipY + aw);
        ctx.lineTo(riderX + aw, arrowTipY + aw);
        ctx.lineTo(riderX,      arrowTipY + aw * 2);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Reading label above rider
      if (showRead) {
        const subStep   = cfg.noSubs ? cfg.step : cfg.step / cfg.subs;
        const decPlaces = Math.max(0, -Math.floor(Math.log10(subStep)));
        const off       = lblOffsets[idx];
        ctx.save();
        ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = '#c00'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(
          parseFloat(clampedReading.toFixed(decPlaces)),
          riderX + off.x,
          bd.topRail * zoom - 3 * zoom - 4 + off.y
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
