// ruler.js

const ruler = (() => {
  const SCALE_LEFT_PAD_F = 0.018;
  const TICK_TOP_F       = 0.06;
  const TICK_AREA_H_F    = 0.70;

  let img        = null;
  let arrowStyle = 'pointer';

  const canvas = document.getElementById('ruler-canvas');
  const ctx    = canvas.getContext('2d');

  loadImage('blank_ruler.png')
    .then(loaded => { img = loaded; draw(); })
    .catch(() => { draw(); });

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
    document.getElementById('r-arrow-line').classList.toggle('active',   style === 'line');
    draw();
  }

  function draw() {
    const zoom        = numVal('r-zoom', 100) / 100;
    const tickPxMaj   = numVal('r-tick', 120);
    const major       = Math.max(0.001, numVal('r-major', 1));
    const subs        = Math.max(1, Math.round(numVal('r-subs', 10)));
    const startVal    = numVal('r-start', 0);
    const reading     = numVal('r-reading', 4.3);
    const unit        = strVal('r-unit', 'cm');
    const fontSize    = numVal('r-fontsize', 14);
    const showRead    = isChecked('r-show-reading');
    const transparent = isChecked('r-transparent');

    // How many major divisions to show
    const endVal    = Math.max(reading, startVal + major) + major * 2;
    const numMajors = Math.ceil((endVal - startVal) / major);
    const scalePixW = numMajors * tickPxMaj;

    // Ruler image height is set by zoom; width stretches to fit the scale
    const rulerH = Math.round(100 * zoom);
    const rulerW = scalePixW;

    // Padding around the ruler image
    const padLeft = Math.round(fontSize * 1.5);
    const padRight = Math.round(fontSize * 2.5);
    const padTop   = Math.round(fontSize * 3.5 + 14);
    const padBot   = 10;

    canvas.width  = rulerW + padLeft + padRight;
    canvas.height = rulerH + padTop + padBot;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw ruler image — stretch to exactly scalePixW wide so tick spacing matches
    const imgX = padLeft;
    const imgY = padTop;
    if (img) {
      ctx.drawImage(img, imgX, imgY, rulerW, rulerH);
    } else {
      ctx.fillStyle = '#c8a04a';
      ctx.fillRect(imgX, imgY, rulerW, rulerH);
    }

    // Tick geometry
    const scaleLeft = imgX + rulerW * SCALE_LEFT_PAD_F;
    const tickTopY  = imgY + rulerH * TICK_TOP_F;
    const tickAreaH = rulerH * TICK_AREA_H_F;
    const subPx     = tickPxMaj / subs;

    ctx.save();
    ctx.strokeStyle  = '#111';
    ctx.fillStyle    = '#111';
    ctx.lineWidth    = Math.max(0.8, zoom * 0.9);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i <= numMajors; i++) {
      const majorX = scaleLeft + i * tickPxMaj;
      if (majorX > imgX + rulerW - 1) break;

      const majH = tickAreaH * 0.55;
      ctx.beginPath();
      ctx.moveTo(majorX, tickTopY);
      ctx.lineTo(majorX, tickTopY + majH);
      ctx.stroke();

      const labelVal = startVal + i * major;
      const decPlaces = String(major).includes('.')
        ? String(major).split('.')[1].length : 0;
      const labelStr = labelVal.toFixed(decPlaces);
      ctx.fillText(labelStr, majorX, tickTopY + majH + 3);

      for (let s = 1; s < subs; s++) {
        const subX = majorX + s * subPx;
        if (subX > imgX + rulerW - 1) break;
        const isMid = (subs % 2 === 0) && (s === subs / 2);
        const h     = isMid ? tickAreaH * 0.40 : tickAreaH * 0.25;
        ctx.beginPath();
        ctx.moveTo(subX, tickTopY);
        ctx.lineTo(subX, tickTopY + h);
        ctx.stroke();
      }
    }

    // Unit label
    ctx.textAlign = 'left';
    ctx.fillText(unit, scaleLeft + numMajors * tickPxMaj + 4, tickTopY + tickAreaH * 0.55 + 3);
    ctx.restore();

    // Arrow
    const readFrac   = (reading - startVal) / major;
    const readX      = scaleLeft + readFrac * tickPxMaj;
    const arrowTipY  = tickTopY - 1;
    const arrowHW    = Math.max(5, fontSize * 0.55);
    const stemLen    = Math.round(fontSize * 1.2);
    const stemTopY   = arrowTipY - stemLen - arrowHW * 1.6 - stemLen;

    ctx.save();
    ctx.fillStyle   = '#e03030';
    ctx.strokeStyle = '#e03030';
    ctx.lineWidth   = Math.max(1.5, zoom * 1.2);

    if (arrowStyle === 'line') {
      // Vertical line from arrowhead tip DOWN through the full ruler body
      ctx.beginPath();
      ctx.moveTo(readX, arrowTipY);
      ctx.lineTo(readX, imgY + rulerH);
      ctx.stroke();

      // Arrowhead pointing DOWN (tip at arrowTipY)
      const headBaseY = arrowTipY - arrowHW * 1.6;
      ctx.beginPath();
      ctx.moveTo(readX,         arrowTipY);
      ctx.lineTo(readX - arrowHW, headBaseY);
      ctx.lineTo(readX + arrowHW, headBaseY);
      ctx.closePath();
      ctx.fill();

      // Short stem above arrowhead
      ctx.beginPath();
      ctx.moveTo(readX, headBaseY);
      ctx.lineTo(readX, stemTopY);
      ctx.stroke();
    } else {
      // Pointer only
      const headBaseY = arrowTipY - arrowHW * 1.6;
      ctx.beginPath();
      ctx.moveTo(readX, headBaseY);
      ctx.lineTo(readX, stemTopY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(readX,           arrowTipY);
      ctx.lineTo(readX - arrowHW, headBaseY);
      ctx.lineTo(readX + arrowHW, headBaseY);
      ctx.closePath();
      ctx.fill();
    }

    if (showRead) {
      ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${reading} ${unit}`, readX, stemTopY - 2);
    }

    ctx.restore();
  }

  function exportPNG() {
    draw();
    const link = document.createElement('a');
    link.download = 'ruler_scale.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return { draw, setArrowStyle, exportPNG };
})();
