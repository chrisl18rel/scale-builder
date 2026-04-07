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
  });
});

// ── Shared Utilities ────────────────────────────────────

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ' + src));
    img.src = src + '?v=' + Date.now();
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

// Wire up beam 3 subs slider label (the slider itself is read by balance.js via numVal)
const b3subsSlider = document.getElementById('b3-subs');
const b3subsLabel  = document.getElementById('b3-subs-val');
if (b3subsSlider && b3subsLabel) {
  b3subsSlider.addEventListener('input', () => {
    b3subsLabel.textContent = b3subsSlider.value;
  });
}
