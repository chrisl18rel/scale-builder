// cylinder.js

const cylinder = (() => {
  // ── Source image crop region (within full 1528×1453 image)
  // Cylinder inner tube: cols ~1273–1542, rows ~90–1453 (original full image coords)
  // The blank image IS the cylinder (full image), so we use the whole image
  // Inner tube bounds as fraction of the full image:
  const TUBE_LEFT_F   = 0.415;  // fraction of img width
  const TUBE_RIGHT_F  = 0.505;
  const TUBE_TOP_F    = 0.063;
  const TUBE_BOTTOM_F = 0.975;

  // Tick marks drawn to the LEFT of the tube's left edge
  const TICK_RIGHT_OFFSET = 0.010; // fraction of canvas width gap between tube and ticks

  let img = null;

  const canvas = document.getElementById('cylinder-canvas');
  const ctx    = canvas.getContext('2d');

  loadImage('blank_graduated_cylinder.png')
    .then(loaded => { img = loaded; draw(); })
    .catch(() => { draw(); });

  // ── Bind controls ──────────────────────────────────────
  ['c-max','c-unit','c-major','c-subs','c-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });

  bindSlider('c-zoom',     'c-zoom-val',     '%',  () => draw());
  bindSlider('c-tick',     'c-tick-val',     'px', () => draw());
  bindSlider('c-fontsize', 'c-fontsize-val', 'px', () => draw());

  document.getElementById('c-show-reading').addEventListener('change', draw);
  document.getElementById('c-transparent').addEventListener('change', () => {
    updateBgClass('c-checker', isChecked('c-transparent'));
    draw();
  });

  // ── Main Draw ─────────────────────────────────────────
  function draw() {
    const zoom       = numVal('c-zoom', 100) / 100;
    const tickPxMaj  = numVal('c-tick', 50);
    const maxCap     = Math.max(1, numVal('c-max', 100));
    const major      = Math.max(0.01, numVal('c-major', 10));
    const subs       = Math.max(1, Math.round(numVal('c-subs', 5)));
    const reading    = Math.min(maxCap, Math.max(0, numVal('c-reading', 42)));
    const unit       = strVal('c-unit', 'mL');
    const fontSize   = numVal('c-fontsize', 14);
    const showRead   = isChecked('c-show-reading');
    const transparent = isChecked('c-transparent');

    // Total scale height in canvas pixels
    const numMajors      = Math.ceil(maxCap / major);
    const totalScaleH    = numMajors * tickPxMaj;

    // Canvas dimensions
    const baseImgW   = img ? img.naturalWidth  : 400;
    const baseImgH   = img ? img.naturalHeight : 800;
    const imgAspect  = baseImgW / baseImgH;

    // Height: scale must fit inside tube.  Canvas height = totalScaleH / tubeFraction + padding
    const tubeFrac   = TUBE_BOTTOM_F - TUBE_TOP_F;  // ~0.912
    const canvasH    = Math.round((totalScaleH / tubeFrac) * zoom);
    const canvasW    = Math.round(canvasH * imgAspect * zoom);

    canvas.width  = canvasW;
    canvas.height = canvasH;

    ctx.clearRect(0, 0, canvasW, canvasH);

    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // ── Tube pixel bounds on canvas ──
    const tubeLeft   = canvasW * TUBE_LEFT_F;
    const tubeRight  = canvasW * TUBE_RIGHT_F;
    const tubeTop    = canvasH * TUBE_TOP_F;
    const tubeBottom = canvasH * TUBE_BOTTOM_F;
    const tubeW      = tubeRight - tubeLeft;
    const tubeH      = tubeBottom - tubeTop;

    // ── Value → Y mapping (0 at bottom, maxCap at top) ──
    function valToY(v) {
      const frac = v / maxCap;
      return tubeBottom - frac * tubeH;
    }

    // ── Fill liquid ──
    const fillY  = valToY(reading);
    const clampedFillY = Math.max(tubeTop + 2, Math.min(tubeBottom - 2, fillY));

    // Liquid rectangle (below meniscus center)
    ctx.fillStyle = 'rgba(100, 180, 230, 0.55)';
    ctx.fillRect(tubeLeft + 1, clampedFillY, tubeW - 2, tubeBottom - clampedFillY);

    // ── Meniscus (concave — edges curve UP, center stays at reading) ──
    // Proper concave meniscus: left and right edges are HIGHER than the center
    const meniscusDepth = Math.min(tubeW * 0.22, 12 * zoom); // how much edges rise above center
    const mCenterY = clampedFillY;
    const mEdgeY   = mCenterY - meniscusDepth; // edges are above center (smaller Y = higher)
    const cp1Y     = mEdgeY;   // control points pull the curve toward the edges
    const cp2Y     = mEdgeY;

    ctx.beginPath();
    ctx.moveTo(tubeLeft + 1, mEdgeY);
    // Cubic bezier: from left edge, curve down to center, then back up to right edge
    ctx.bezierCurveTo(
      tubeLeft  + tubeW * 0.3, mCenterY + meniscusDepth * 0.5,  // cp1: pull down toward center-left
      tubeRight - tubeW * 0.3, mCenterY + meniscusDepth * 0.5,  // cp2: pull down toward center-right
      tubeRight - 1, mEdgeY                                       // endpoint: right edge at same height
    );
    ctx.lineTo(tubeRight - 1, tubeBottom);
    ctx.lineTo(tubeLeft + 1,  tubeBottom);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100, 180, 230, 0.55)';
    ctx.fill();

    // Meniscus outline
    ctx.beginPath();
    ctx.moveTo(tubeLeft + 1, mEdgeY);
    ctx.bezierCurveTo(
      tubeLeft  + tubeW * 0.3, mCenterY + meniscusDepth * 0.5,
      tubeRight - tubeW * 0.3, mCenterY + meniscusDepth * 0.5,
      tubeRight - 1, mEdgeY
    );
    ctx.strokeStyle = 'rgba(40, 120, 180, 0.8)';
    ctx.lineWidth   = Math.max(1, 1.5 * zoom);
    ctx.stroke();

    // ── Draw cylinder image on top ──
    if (img) {
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
    } else {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(tubeLeft, tubeTop, tubeW, tubeH);
    }

    // ── Tick marks ── (to the left of the tube)
    const tickRightX  = tubeLeft - canvasW * TICK_RIGHT_OFFSET;
    const subPxMaj    = tickPxMaj / subs;

    ctx.save();
    ctx.strokeStyle = '#222';
    ctx.fillStyle   = '#222';
    ctx.lineWidth   = Math.max(1, zoom * 0.8);
    ctx.font        = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign   = 'right';

    // Draw ticks from 0 to maxCap
    // Number of sub-intervals total
    const totalSubIntervals = numMajors * subs;
    for (let i = 0; i <= totalSubIntervals; i++) {
      const val  = (i / subs) * major;
      if (val > maxCap + 0.0001) break;

      const y    = valToY(val);
      if (y < tubeTop - 2 || y > tubeBottom + 2) continue;

      const isMajor = (i % subs === 0);
      const isMid   = !isMajor && (subs % 2 === 0) && (i % subs === subs / 2);
      const tickLen = isMajor ? 18 * zoom : (isMid ? 12 * zoom : 8 * zoom);

      ctx.beginPath();
      ctx.moveTo(tickRightX, y);
      ctx.lineTo(tickRightX - tickLen, y);
      ctx.stroke();

      if (isMajor) {
        const labelVal = val;
        const label = labelVal % 1 === 0 ? labelVal.toString() : labelVal.toFixed(1);
        ctx.fillText(label, tickRightX - tickLen - 4, y + fontSize * 0.35);
      }
    }

    // Unit label at top
    ctx.textAlign = 'right';
    ctx.fillText(unit, tickRightX, tubeTop - 6);
    ctx.restore();

    // ── Dashed reading line ──
    const dashY = clampedFillY;
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 50, 50, 0.75)';
    ctx.lineWidth   = Math.max(1, zoom);
    ctx.setLineDash([4 * zoom, 3 * zoom]);
    ctx.beginPath();
    ctx.moveTo(tubeLeft - 30 * zoom, dashY);
    ctx.lineTo(tubeRight + 4, dashY);
    ctx.stroke();
    ctx.restore();

    // ── Reading label ──
    if (showRead) {
      ctx.save();
      ctx.font      = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = '#c82020';
      ctx.textAlign = 'right';
      ctx.fillText(`${reading} ${unit}`, tickRightX - 22 * zoom, dashY - 4);
      ctx.restore();
    }
  }

  // ── Export ────────────────────────────────────────────
  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'graduated_cylinder_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
