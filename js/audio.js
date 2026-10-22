// Přehrávání předgenerovaných nahrávek. Jeden <audio> prvek – iOS ho odemkne prvním klepnutím.
let manifest = {};
const el = new Audio();
el.preload = 'auto';
el.preservesPitch = true;
let rate = 1;
let queue = [];
let onState = () => {};

export async function init() {
  try {
    const r = await fetch('audio/manifest.json');
    manifest = await r.json();
  } catch { manifest = {}; }
}

export function urlFor(text) {
  const f = manifest[text];
  return f ? `audio/${f}` : null;
}

export function allUrls() { return Object.values(manifest).map(f => `audio/${f}`); }

export function setRate(r) { rate = r; el.playbackRate = r; }

export function onPlayState(fn) { onState = fn; }

el.addEventListener('playing', () => onState(true, el.dataset.tag));
el.addEventListener('pause', () => onState(false, el.dataset.tag));
el.addEventListener('ended', () => {
  if (queue.length) { setTimeout(next, 450); return; }
  onState(false, el.dataset.tag);
});

function next() {
  if (!queue.length) return;
  const { text, tag } = queue.shift();
  const u = urlFor(text);
  if (!u) { onState(false, tag); return; }
  el.dataset.tag = tag || '';
  el.src = u;
  el.playbackRate = rate;
  el.play().catch(() => onState(false, tag));
}

/** play(['Text', ...]) nebo play([{text, tag}]) – přehraje postupně */
export function play(texts) {
  queue = texts.map(t => typeof t === 'string' ? { text: t } : t);
  el.pause();
  if (queue.length) next();
}

export function stop() { queue = []; el.pause(); }

export async function cacheAll(progress) {
  if (!('caches' in window)) return;
  const c = await caches.open('albert-audio');
  const urls = allUrls();
  let done = 0;
  for (const u of urls) {
    if (!(await c.match(u))) {
      try { await c.add(u); } catch { /* offline */ }
    }
    done++;
    if (progress && done % 20 === 0) progress(done, urls.length);
  }
  progress && progress(urls.length, urls.length);
}
