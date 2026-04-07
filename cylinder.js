// cylinder.js

const cylinder = (() => {
  // Inner tube bounds as fractions of image — will refine after images load
  const TUBE_LEFT_F   = 0.415;
  const TUBE_RIGHT_F  = 0.505;
  const TUBE_TOP_F    = 0.063;
  const TUBE_BOTTOM_F = 0.975;

  let img = null;

  const canvas = document.getElementById('cylinder-canvas');
  const ctx    = canvas.getContext('2d');

  loadImageFromDataURI(CYLINDER_IMG)
    .then(loaded => { img = loaded; draw(); })
    .catch(err => { console.error('Cylinder image failed:', err); draw(); });

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

  function draw() {
    const zoom        = numVal('c-zoom', 100) / 100;
    const tickPxMaj   = numVal('c-tick', 50);    // pixels per major division (scale stretch)
    const maxCap      = Math.max(1, numVal('c-max', 100));
    const major       = Math.max(0.01, numVal('c-major', 10));
    const subs        = Math.max(1, Math.round(numVal('c-subs', 5)));
    const reading     = Math.min(maxCap, Math.max(0, numVal('c-reading', 42)));
    const unit        = strVal('c-unit', 'mL');
    const fontSize    = numVal('c-fontsize', 14);
    const showRead    = isChecked('c-show-reading');
    const transparent = isChecked('c-transparent');

    // ── Sizing strategy ──
    // Scale stretch (tickPxMaj) controls how many pixels per major division.
    // Total scale height = numMajors * tickPxMaj.
    // The IMAGE height is set so that the tube region exactly fits the scale height.
    // Zoom then scales the entire canvas up/down uniformly.
    const numMajors   = Math.ceil(maxCap / major);
    const totalScaleH = numMajors * tickPxMaj;   // px height of the scale (before zoom)
    const tubeFrac    = TUBE_BOTTOM_F - TUBE_TOP_F;

    const srcW = img ? img.naturalWidth  : 300;
    const srcH = img ? img.naturalHeight : 900;
    const imgAspect = srcW / srcH;

    // Image height needed so tube height = totalScaleH
    const baseImgH = Math.round(totalScaleH / tubeFrac);
    const baseImgW = Math.round(baseImgH * imgAspect);

    // Apply zoom uniformly
    const canvasH = Math.round(baseImgH * zoom);
    const canvasW = Math.round(baseImgW * zoom);

    canvas.width  = canvasW;
    canvas.height = canvasH;

    ctx.clearRect(0, 0, canvasW, canvasH);
    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Tube bounds in canvas pixels
    const tubeLeft   = canvasW * TUBE_LEFT_F;
    const tubeRight  = canvasW * TUBE_RIGHT_F;
    const tubeTop    = canvasH * TUBE_TOP_F;
    const tubeBottom = canvasH * TUBE_BOTTOM_F;
    const tubeW      = tubeRight - tubeLeft;
    const tubeH      = tubeBottom - tubeTop;

    // Value → Y mapping
    function valToY(v) {
      const frac = Math.max(0, Math.min(1, v / maxCap));
      return tubeBottom - frac * tubeH;
    }

    // ── Liquid fill ──
    const fillY = Math.max(tubeTop + 1, Math.min(tubeBottom - 1, valToY(reading)));

    ctx.fillStyle = 'rgba(100, 180, 230, 0.55)';
    ctx.fillRect(tubeLeft + 1, fillY, tubeW - 2, tubeBottom - fillY);

    // Concave meniscus: edges higher than center
    const menDepth = Math.min(tubeW * 0.22, 10 * zoom);
    const mEdgeY   = fillY - menDepth;

    ctx.beginPath();
    ctx.moveTo(tubeLeft + 1, mEdgeY);
    ctx.bezierCurveTo(
      tubeLeft  + tubeW * 0.30, fillY + menDepth * 0.6,
      tubeRight - tubeW * 0.30, fillY + menDepth * 0.6,
      tubeRight - 1, mEdgeY
    );
    ctx.lineTo(tubeRight - 1, tubeBottom);
    ctx.lineTo(tubeLeft  + 1, tubeBottom);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100, 180, 230, 0.55)';
    ctx.fill();

    // Meniscus outline
    ctx.beginPath();
    ctx.moveTo(tubeLeft + 1, mEdgeY);
    ctx.bezierCurveTo(
      tubeLeft  + tubeW * 0.30, fillY + menDepth * 0.6,
      tubeRight - tubeW * 0.30, fillY + menDepth * 0.6,
      tubeRight - 1, mEdgeY
    );
    ctx.strokeStyle = 'rgba(40, 120, 180, 0.85)';
    ctx.lineWidth   = Math.max(1, 1.5 * zoom);
    ctx.stroke();

    // ── Draw cylinder image over liquid ──
    if (img) {
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
    } else {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.strokeRect(tubeLeft, tubeTop, tubeW, tubeH);
    }

    // ── Ticks on RIGHT side of tube ──
    const tickStartX = tubeRight + canvasW * 0.008;
    const subPxMaj   = (tickPxMaj * zoom) / subs;
    const totalSubs  = numMajors * subs;

    ctx.save();
    ctx.strokeStyle  = '#222';
    ctx.fillStyle    = '#222';
    ctx.lineWidth    = Math.max(0.8, zoom * 0.8);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= totalSubs; i++) {
      const val = (i / subs) * major;
      if (val > maxCap + 0.0001) break;

      const y = valToY(val);
      if (y < tubeTop - 2 || y > tubeBottom + 2) continue;

      const isMajor = (i % subs === 0);
      const isMid   = !isMajor && (subs % 2 === 0) && (i % subs === subs / 2);
      const tickLen = isMajor ? 16 * zoom : (isMid ? 10 * zoom : 6 * zoom);

      ctx.beginPath();
      ctx.moveTo(tickStartX, y);
      ctx.lineTo(tickStartX + tickLen, y);
      ctx.stroke();

      if (isMajor) {
        const decPlaces = String(major).includes('.')
          ? String(major).split('.')[1].length : 0;
        ctx.fillText(val.toFixed(decPlaces), tickStartX + tickLen + 4, y);
      }
    }

    // Unit label at top
    ctx.textBaseline = 'bottom';
    ctx.fillText(unit, tickStartX, tubeTop - 4);
    ctx.restore();

    // ── Dashed reading line ──
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 50, 50, 0.75)';
    ctx.lineWidth   = Math.max(1, zoom);
    ctx.setLineDash([4 * zoom, 3 * zoom]);
    ctx.beginPath();
    ctx.moveTo(tubeLeft - 4, fillY);
    ctx.lineTo(tubeRight + 20 * zoom, fillY);
    ctx.stroke();
    ctx.restore();

    // ── Reading label ──
    if (showRead) {
      const decPlaces = String(major).includes('.')
        ? String(major).split('.')[1].length : 0;
      ctx.save();
      ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.fillStyle    = '#c82020';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${reading.toFixed(decPlaces)} ${unit}`, tickStartX + 22 * zoom, fillY - 2);
      ctx.restore();
    }
  }

  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'graduated_cylinder_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, exportPNG };
})();
