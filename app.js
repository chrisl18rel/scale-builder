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

/**
 * Creates a mask canvas from an image using flood-fill from the image borders.
 * Connected light pixels reachable from the edges = background → alpha 0.
 * Everything else (glass body, interior) = opaque → alpha 255.
 * This correctly separates the outside background from the glass interior
 * even when both are near-white, because the dark glass outline blocks the fill.
 * fillThreshold: pixels with r,g,b all above this are considered "background-like"
 * and can be flooded. Lower = more selective (won't cross darker glass pixels).
 */
function createOutlineMask(img, w, h, fillThreshold = 220) {
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  octx.drawImage(img, 0, 0, w, h);

  const idata = octx.getImageData(0, 0, w, h);
  const d = idata.data;
  const visited = new Uint8Array(w * h);
  const queue = [];

  function enqueue(pi) {
    if (pi < 0 || pi >= w * h || visited[pi]) return;
    const idx = pi * 4;
    if (d[idx] > fillThreshold && d[idx+1] > fillThreshold && d[idx+2] > fillThreshold) {
      visited[pi] = 1;
      queue.push(pi);
    }
  }

  // Seed from all four edges
  for (let x = 0; x < w; x++) { enqueue(x); enqueue((h-1)*w + x); }
  for (let y = 0; y < h; y++) { enqueue(y*w); enqueue(y*w + w-1); }

  // BFS flood fill
  while (queue.length > 0) {
    const pi = queue.pop();
    d[pi * 4 + 3] = 0;   // make background pixel transparent
    const x = pi % w, y = Math.floor(pi / w);
    if (x > 0)   enqueue(pi - 1);
    if (x < w-1) enqueue(pi + 1);
    if (y > 0)   enqueue(pi - w);
    if (y < h-1) enqueue(pi + w);
  }

  octx.putImageData(idata, 0, 0);
  return off;
}
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
