// app.js

// ── Tab Routing ──────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + target).classList.add('active');

    // Trigger a redraw on the newly visible tab
    if (target === 'ruler')    { setTimeout(() => ruler.draw(), 50); }
    if (target === 'cylinder') { setTimeout(() => cylinder.draw(), 50); }
    if (target === 'balance')  { setTimeout(() => balance.draw(), 50); }
  });
});

// ── Shared Utilities ────────────────────────────────────

/**
 * Bind a range slider to update a display label and call a callback on change.
 * @param {string} sliderId
 * @param {string} labelId
 * @param {string} suffix   - e.g. "%" or "px"
 * @param {Function} cb
 */
function bindSlider(sliderId, labelId, suffix, cb) {
  const slider = document.getElementById(sliderId);
  const label  = document.getElementById(labelId);
  if (!slider || !label) return;
  const update = () => {
    label.textContent = slider.value + suffix;
    cb(Number(slider.value));
  };
  slider.addEventListener('input', update);
}

/**
 * Load an image from a relative path, returning a Promise<HTMLImageElement>.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src;
  });
}

/**
 * Get a numeric input value by element ID, with a fallback default.
 */
function numVal(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const v = parseFloat(el.value);
  return isNaN(v) ? fallback : v;
}

/**
 * Get a string input value by element ID.
 */
function strVal(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? (el.value || fallback) : fallback;
}

/**
 * Check if a checkbox is checked.
 */
function isChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

/**
 * Update the checker/white background class on an element.
 */
function updateBgClass(wrapperId, transparent) {
  const el = document.getElementById(wrapperId);
  if (!el) return;
  if (transparent) {
    el.classList.remove('white-bg');
  } else {
    el.classList.add('white-bg');
  }
}
// TEMP: click anywhere on a canvas to log pixel coordinates
document.querySelectorAll('canvas').forEach(c => {
  c.addEventListener('click', e => {
    const rect = c.getBoundingClientRect();
    const scaleX = c.width  / rect.width;
    const scaleY = c.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top)  * scaleY);
    console.log(`x: ${x}, y: ${y}  (canvas: ${c.width}×${c.height})`);
  });
});
