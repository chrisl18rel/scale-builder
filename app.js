// app.js

// ── Tab Routing ──────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + target).classList.add('active');
    if (target === 'ruler')    { setTimeout(() => ruler.draw(), 50); }
    if (target === 'cylinder') { setTimeout(() => cylinder.draw(), 50); }
    if (target === 'balance')  { setTimeout(() => balance.draw(), 50); }
    if (target === 'therm')    { setTimeout(() => thermometer.draw(), 50); }
  });
});

// ── Shared Utilities ────────────────────────────────────

/**
 * Bind a range slider and a linked number input so they stay in sync.
 * Both fire the callback when either changes.
 */
function bindSliderWithInput(sliderId, inputId, cb) {
  const slider = document.getElementById(sliderId);
  const input  = document.getElementById(inputId);
  if (!slider || !input) return;

  slider.addEventListener('input', () => {
    input.value = slider.value;
    cb(Number(slider.value));
  });
  input.addEventListener('input', () => {
    let v = parseFloat(input.value);
    if (isNaN(v)) return;
    v = Math.max(Number(slider.min), Math.min(Number(slider.max), v));
    slider.value = v;
    input.value  = v;
    cb(v);
  });
}

/**
 * Legacy bindSlider for cases where we just have a label span (b3-subs).
 */
function bindSlider(sliderId, labelId, suffix, cb) {
  const slider = document.getElementById(sliderId);
  const label  = document.getElementById(labelId);
  if (!slider || !label) return;
  slider.addEventListener('input', () => {
    label.textContent = slider.value + suffix;
    cb(Number(slider.value));
  });
}

function loadImageFromDataURI(dataURI) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataURI;
  });
}

function numVal(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const v = parseFloat(el.value);
  return isNaN(v) ? fallback : v;
}

function strVal(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? (el.value || fallback) : fallback;
}

function isChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function updateBgClass(wrapperId, transparent) {
  const el = document.getElementById(wrapperId);
  if (!el) return;
  if (transparent) {
    el.classList.remove('white-bg');
  } else {
    el.classList.add('white-bg');
  }
}

/**
 * Draw an image onto ctx at the given position/size, making near-white
 * background pixels transparent. Used when transparent=true on instruments
 * whose source images have opaque white backgrounds.
 * threshold: pixels with r,g,b all above this value become transparent (0-255).
 */
function drawImageWithTransparentBg(ctx, img, dx, dy, dw, dh, threshold = 240) {
  // Draw image to a temp offscreen canvas
  const off = document.createElement('canvas');
  off.width  = dw;
  off.height = dh;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0, dw, dh);

  // Make near-white pixels transparent
  const idata = octx.getImageData(0, 0, dw, dh);
  const d = idata.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= threshold && d[i+1] >= threshold && d[i+2] >= threshold) {
      d[i+3] = 0;
    }
  }
  octx.putImageData(idata, 0, 0);
  ctx.drawImage(off, dx, dy);
}

// Wire beam 3 subs slider label
const b3subsSlider = document.getElementById('b3-subs');
const b3subsLabel  = document.getElementById('b3-subs-val');
if (b3subsSlider && b3subsLabel) {
  b3subsSlider.addEventListener('input', () => {
    b3subsLabel.textContent = b3subsSlider.value;
  });
}

// Beam 1/2 step → reading step sync
['b1','b2'].forEach(prefix => {
  const stepEl    = document.getElementById(`${prefix}-step`);
  const readingEl = document.getElementById(`${prefix}-reading`);
  if (stepEl && readingEl) {
    stepEl.addEventListener('input', () => {
      readingEl.step = stepEl.value;
    });
  }
});

// Enforce reading ≤ max for all three beams.
// Whenever max changes: update reading's max attr and clamp current value.
// Whenever reading changes: clamp if it exceeds max.
['b1','b2','b3'].forEach(prefix => {
  const maxEl     = document.getElementById(`${prefix}-max`);
  const readingEl = document.getElementById(`${prefix}-reading`);
  if (!maxEl || !readingEl) return;

  function syncMax() {
    const maxVal = parseFloat(maxEl.value);
    if (isNaN(maxVal)) return;
    readingEl.max = maxVal;
    const currentVal = parseFloat(readingEl.value);
    if (!isNaN(currentVal) && currentVal > maxVal) {
      readingEl.value = maxVal;
      readingEl.dispatchEvent(new Event('input'));
    }
  }

  function clampReading() {
    const maxVal = parseFloat(maxEl.value);
    const val    = parseFloat(readingEl.value);
    if (!isNaN(maxVal) && !isNaN(val) && val > maxVal) {
      readingEl.value = maxVal;
      readingEl.dispatchEvent(new Event('input'));
    }
  }

  maxEl.addEventListener('input', syncMax);
  readingEl.addEventListener('input', clampReading);
  // Set initial max attr on page load
  syncMax();
});

// Reading label offset sliders wired after instruments load (deferred)
// These are called from each instrument's own init instead, since
// ruler/cylinder/balance objects don't exist yet at app.js parse time.
// See each instrument file for bindSliderWithInput calls on lbl-x/lbl-y.
