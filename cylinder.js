// cylinder.js

const cylinder = (() => {
  // Original image dimensions (resized to 1600×872 in images.js)
  const IW = 1600, IH = 872;

  // Cylinder inner tube bounds in original image pixels
  // From old code: original was 2816×1536, tube left=1285, right=1530, top=130, bot=1420
  // But our resized image is 1600×872 (scale = 1600/2816 = 0.568)
  // These will be refined once pixel coords are confirmed
  const SCALE = 1600 / 2816;
  const TUBE_LEFT_O  = Math.round(1285 * SCALE);   // ~460
  const TUBE_RIGHT_O = Math.round(1530 * SCALE);   // ~548
  const TUBE_TOP_O   = Math.round(130  * SCALE);   // ~47
  const TUBE_BOT_O   = Math.round(1420 * SCALE);   // ~508

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
    const pxPerMajor  = numVal('c-tick', 50);      // canvas px per major division (independent of zoom)
    const maxV        = Math.max(1, numVal('c-max', 100));
    const minV        = 0;
    const major       = Math.max(0.01, numVal('c-major', 10));
    const subs        = Math.max(1, Math.round(numVal('c-subs', 5)));
    const reading     = Math.min(maxV, Math.max(minV, numVal('c-reading', 42)));
    const unit        = strVal('c-unit', 'mL');
    const fontSize    = numVal('c-fontsize', 14);
    const showRead    = isChecked('c-show-reading');
    const transparent = isChecked('c-transparent');

    // Canvas = full image scaled by zoom
    canvas.width  = Math.round(IW * zoom);
    canvas.height = Math.round(IH * zoom);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Tube bounds scaled by zoom
    const tLeft  = TUBE_LEFT_O  * zoom;
    const tRight = TUBE_RIGHT_O * zoom;
    const tTop   = TUBE_TOP_O   * zoom;
    const tBot   = TUBE_BOT_O   * zoom;
    const tW     = tRight - tLeft;
    const tH     = tBot - tTop;
    const tCX    = (tLeft + tRight) / 2;

    // Value → Y: pxPerMajor pixels per major division, going upward
    // Bottom of tube = minV, top = determined by scale
    function valToY(v) {
      return tBot - (v - minV) * (pxPerMajor / major);
    }

    const fillY        = valToY(reading);
    const clampedFillY = Math.max(tTop, Math.min(tBot, fillY));

    // ── Liquid fill (drawn before image so glass overlays it) ──
    if (clampedFillY < tBot) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(tLeft, tTop, tW, tH);
      ctx.clip();

      // Liquid body with gradient
      const grad = ctx.createLinearGradient(tLeft, 0, tRight, 0);
      grad.addColorStop(0,    'rgba(80,170,225,0.88)');
      grad.addColorStop(0.18, 'rgba(130,205,245,0.70)');
      grad.addColorStop(0.82, 'rgba(130,205,245,0.70)');
      grad.addColorStop(1,    'rgba(70,155,215,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(tLeft, clampedFillY, tW, tBot - clampedFillY);

      // Concave meniscus: edges curve UP, center is at clampedFillY (the reading)
      const mDepth = tW * 0.10;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tLeft, clampedFillY - mDepth);
      ctx.bezierCurveTo(
        tLeft + tW * 0.25, clampedFillY - mDepth * 0.2,
        tCX   - tW * 0.05, clampedFillY,
        tCX,               clampedFillY
      );
      ctx.bezierCurveTo(
        tCX   + tW * 0.05, clampedFillY,
        tRight - tW * 0.25, clampedFillY - mDepth * 0.2,
        tRight, clampedFillY - mDepth
      );
      ctx.lineTo(tRight, tBot);
      ctx.lineTo(tLeft,  tBot);
      ctx.closePath();
      ctx.fill();

      // Meniscus outline
      ctx.strokeStyle = 'rgba(20,110,175,0.95)';
      ctx.lineWidth = Math.max(1.5, 2.2 * zoom);
      ctx.beginPath();
      ctx.moveTo(tLeft, clampedFillY - mDepth);
      ctx.bezierCurveTo(
        tLeft + tW * 0.25, clampedFillY - mDepth * 0.2,
        tCX   - tW * 0.05, clampedFillY,
        tCX,               clampedFillY
      );
      ctx.bezierCurveTo(
        tCX   + tW * 0.05, clampedFillY,
        tRight - tW * 0.25, clampedFillY - mDepth * 0.2,
        tRight, clampedFillY - mDepth
      );
      ctx.stroke();

      // Glass glare highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(tLeft + tW * 0.64, clampedFillY, tW * 0.11, tBot - clampedFillY);

      ctx.restore();
    }

    // ── Draw cylinder image over liquid ──
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.strokeRect(tLeft, tTop, tW, tH);
    }

    // ── Tick marks to the RIGHT of tube ──
    const tickMajW = tW * 0.60;
    const tickMedW = tW * 0.40;
    const tickMinW = tW * 0.25;

    const subVal    = major / subs;
    const decPlaces = Math.max(0, -Math.floor(Math.log10(subVal)));

    ctx.save();
    ctx.strokeStyle  = '#111';
    ctx.fillStyle    = '#111';
    ctx.lineWidth    = Math.max(0.8, 1.2 * zoom);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    let tickIdx = 0;
    let v = minV;
    while (valToY(v) >= tTop - 2) {
      const y = valToY(v);
      if (y <= tBot + 2) {
        const isMajor = (tickIdx % subs === 0);
        const isMid   = !isMajor && subs >= 4 && (tickIdx % Math.floor(subs / 2) === 0);
        const tw = isMajor ? tickMajW : isMid ? tickMedW : tickMinW;

        ctx.beginPath();
        ctx.moveTo(tRight, y);
        ctx.lineTo(tRight + tw, y);
        ctx.stroke();

        if (isMajor) {
          ctx.fillText(parseFloat(v.toFixed(decPlaces)) + ' ' + unit, tRight + tickMajW + 5, y);
        }
      }
      tickIdx++;
      v = parseFloat((minV + tickIdx * subVal).toFixed(10));
    }
    ctx.restore();

    // ── Dashed reading line ──
    if (fillY >= tTop - 30 && fillY <= tBot + 10) {
      ctx.save();
      ctx.strokeStyle = '#c00';
      ctx.fillStyle   = '#c00';
      ctx.lineWidth   = Math.max(1.5, 2 * zoom);
      ctx.setLineDash([5 * zoom, 3 * zoom]);
      ctx.beginPath();
      ctx.moveTo(tLeft - 15 * zoom, clampedFillY);
      ctx.lineTo(tRight + tickMajW + 5, clampedFillY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Reading label to the right
      if (showRead) {
        const lfs = fontSize;
        ctx.font = `bold ${lfs}px 'Segoe UI', sans-serif`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'bottom';
        const lblText = reading + ' ' + unit;
        const lblX = tRight + tickMajW + 8;
        const lblW = ctx.measureText(lblText).width + 14;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(lblX - 4, clampedFillY - lfs - 2, lblW, lfs + 8);
        ctx.fillStyle = '#c00';
        ctx.fillText(lblText, lblX, clampedFillY + 2);
      }
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
