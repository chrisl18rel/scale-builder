// ruler.js

const ruler = (() => {
  // ── Image source region (from original 2651×947 image)
  // Ruler body: rows 605–947, cols 181–2651
  const IMG_SRC_X = 181, IMG_SRC_Y = 605;
  const IMG_SRC_W = 2470, IMG_SRC_H = 342;

  // Ruler tick area within the cropped region (approx top 40% is the scale face)
  // Left edge of scale: ~10px into cropped region
  // Scale starts at x=0 of cropped, ticks drawn at y near top of ruler face
  const TICK_TOP_RATIO  = 0.05;  // fraction from top of ruler face where ticks start
  const RULER_FACE_FRAC = 0.85;  // fraction of ruler height that is the wooden face

  const SCALE_MARGIN_LEFT  = 0.04; // fraction of canvas width = left edge of scale
  const SCALE_MARGIN_RIGHT = 0.015;

  let img = null;
  let arrowStyle = 'pointer'; // 'pointer' | 'line'

  const canvas = document.getElementById('ruler-canvas');
  const ctx    = canvas.getContext('2d');

  // ── Load image then draw ──────────────────────────────
  loadImage('blank_ruler.png')
    .then(loaded => { img = loaded; draw(); })
    .catch(() => { draw(); }); // draw without image if missing

  // ── Bind all controls ─────────────────────────────────
  ['r-unit','r-major','r-subs','r-start','r-reading'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', draw);
  });

  bindSlider('r-zoom',     'r-zoom-val',     '%',  () => draw());
  bindSlider('r-tick',     'r-tick-val',     'px', () => draw());
  bindSlider('r-fontsize', 'r-fontsize-val', 'px', () => draw());

  document.getElementById('r-show-reading').addEventListener('change', draw);
  document.getElementById('r-transparent').addEventListener('change', () => {
    updateBgClass('r-checker', isChecked('r-transparent'));
    draw();
  });

  function setArrowStyle(style) {
    arrowStyle = style;
    document.getElementById('r-arrow-pointer').classList.toggle('active', style === 'pointer');
    document.getElementById('r-arrow-line').classList.toggle('active', style === 'line');
    draw();
  }

  // ── Main Draw ─────────────────────────────────────────
  function draw() {
    const zoom       = numVal('r-zoom', 100) / 100;
    const tickPxMaj  = numVal('r-tick', 120);
    const major      = Math.max(0.001, numVal('r-major', 1));
    const subs       = Math.max(1, Math.round(numVal('r-subs', 10)));
    const startVal   = numVal('r-start', 0);
    const reading    = numVal('r-reading', 4.3);
    const unit       = strVal('r-unit', 'cm');
    const fontSize   = numVal('r-fontsize', 14);
    const showRead   = isChecked('r-show-reading');
    const transparent = isChecked('r-transparent');

    // Original ruler image aspect
    const srcAspect = IMG_SRC_W / IMG_SRC_H;

    // Canvas height from zoom, width from tick count needed
    // Determine how many major divisions fit: we want enough to show reading + padding
    const visibleRange   = (reading - startVal) + major * 3;
    const numMajorNeeded = Math.ceil(visibleRange / major) + 2;

    const baseH = 160; // base ruler height in canvas px before zoom
    const rulerH = Math.round(baseH * zoom);
    const rulerW = Math.round(numMajorNeeded * tickPxMaj);

    // Total canvas size = ruler padded
    const padTop  = Math.round(fontSize * 3.5 + 20); // room for arrow/reading above ruler
    const padBot  = 20;
    const padLeft = 20;
    const padRight = 20;

    canvas.width  = rulerW + padLeft + padRight;
    canvas.height = rulerH + padTop + padBot;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ── Draw ruler image ──
    const imgX = padLeft;
    const imgY = padTop;
    if (img) {
      ctx.drawImage(img,
        IMG_SRC_X, IMG_SRC_Y, IMG_SRC_W, IMG_SRC_H,
        imgX, imgY, rulerW, rulerH
      );
    } else {
      // fallback rectangle
      ctx.fillStyle = '#d4a853';
      ctx.fillRect(imgX, imgY, rulerW, rulerH);
    }

    // ── Scale drawing ──
    // Scale starts at left edge of ruler + small inset
    const scaleLeft = imgX + rulerW * 0.015;
    // Tick top = near top of wooden face
    const tickAreaTop  = imgY + rulerH * 0.06;
    const tickAreaH    = rulerH * 0.75; // total tick area height

    const subPx = tickPxMaj / subs;

    ctx.save();
    ctx.strokeStyle = '#111';
    ctx.fillStyle   = '#111';
    ctx.lineWidth   = Math.max(1, zoom * 0.8);
    ctx.font        = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign   = 'center';

    const totalMajors = numMajorNeeded;
    for (let i = 0; i <= totalMajors; i++) {
      const majorX = scaleLeft + i * tickPxMaj;

      // Major tick — full height
      const majH = tickAreaH * 0.55;
      ctx.beginPath();
      ctx.moveTo(majorX, tickAreaTop);
      ctx.lineTo(majorX, tickAreaTop + majH);
      ctx.stroke();

      // Label
      const labelVal = startVal + i * major;
      ctx.fillText(
        labelVal % 1 === 0 ? labelVal.toString() : labelVal.toFixed(1),
        majorX,
        tickAreaTop + majH + fontSize + 2
      );

      // Subdivisions
      for (let s = 1; s < subs; s++) {
        const subX = majorX + s * subPx;
        const isMid = (subs % 2 === 0) && (s === subs / 2);
        const subH  = isMid ? tickAreaH * 0.40 : tickAreaH * 0.25;
        ctx.beginPath();
        ctx.moveTo(subX, tickAreaTop);
        ctx.lineTo(subX, tickAreaTop + subH);
        ctx.stroke();
      }
    }

    // Unit label at right end
    ctx.textAlign = 'left';
    ctx.fillText(unit, scaleLeft + totalMajors * tickPxMaj + 6, tickAreaTop + tickAreaH * 0.55 + fontSize + 2);
    ctx.restore();

    // ── Arrow / Reading ──
    const readingFrac = (reading - startVal) / major;
    const readingX    = scaleLeft + readingFrac * tickPxMaj;

    // Arrowhead pointing DOWN (tip at tickAreaTop)
    const arrowTipY   = tickAreaTop - 2;
    const arrowBaseY  = arrowTipY - fontSize * 1.4;
    const arrowHW     = Math.max(5, fontSize * 0.6);

    ctx.save();
    ctx.fillStyle   = '#e03030';
    ctx.strokeStyle = '#e03030';
    ctx.lineWidth   = Math.max(1.5, zoom);

    if (arrowStyle === 'line') {
      // Horizontal line across full ruler width at arrowTipY level, then stem + head
      const lineY = arrowBaseY - fontSize * 0.6;
      ctx.beginPath();
      ctx.moveTo(imgX, lineY);
      ctx.lineTo(imgX + rulerW, lineY);
      ctx.stroke();

      // Vertical stem from line down to arrowhead
      ctx.beginPath();
      ctx.moveTo(readingX, lineY);
      ctx.lineTo(readingX, arrowTipY - arrowHW);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(readingX, arrowTipY);
      ctx.lineTo(readingX - arrowHW, arrowTipY - arrowHW * 1.6);
      ctx.lineTo(readingX + arrowHW, arrowTipY - arrowHW * 1.6);
      ctx.closePath();
      ctx.fill();
    } else {
      // Pointer only: just stem + arrowhead
      ctx.beginPath();
      ctx.moveTo(readingX, arrowBaseY);
      ctx.lineTo(readingX, arrowTipY - arrowHW);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(readingX, arrowTipY);
      ctx.lineTo(readingX - arrowHW, arrowTipY - arrowHW * 1.6);
      ctx.lineTo(readingX + arrowHW, arrowTipY - arrowHW * 1.6);
      ctx.closePath();
      ctx.fill();
    }

    // Reading label above the arrow
    if (showRead) {
      ctx.font      = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = '#e03030';
      ctx.textAlign = 'center';
      const labelY  = arrowBaseY - fontSize * 0.3;
      ctx.fillText(`${reading} ${unit}`, readingX, labelY);
    }

    ctx.restore();
  }

  // ── Export ────────────────────────────────────────────
  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'ruler_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, setArrowStyle, exportPNG };
})();
