// Uložení progresu v localStorage (instalovaná PWA na iPhonu ho drží trvale).
const KEY = 'albert.v1';

const DEFAULTS = () => ({
  items: {},          // id -> {box, due, right, wrong, last}
  tags: {},           // tag -> poslední výsledky [1,0,1…] (max 20)
  days: {},           // 'YYYY-MM-DD' -> XP
  xp: 0,
  lessons: 0,
  flags: [],          // nahlášené chyby ve větách
  settings: { rate: 1, goal: 60, silent: false },
});

let state;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...DEFAULTS(), ...JSON.parse(raw) } : DEFAULTS();
    state.settings = { ...DEFAULTS().settings, ...state.settings };
  } catch {
    state = DEFAULTS();
  }
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* plné úložiště – nic */ }
}

export const get = () => state;

export function today(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function addXP(n) {
  const t = today();
  state.days[t] = (state.days[t] || 0) + n;
  state.xp += n;
}

export function streak() {
  let n = 0;
  const d = new Date();
  if (!state.days[today(d)]) d.setDate(d.getDate() - 1);
  while (state.days[today(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function recordTag(tag, ok) {
  const a = state.tags[tag] || (state.tags[tag] = []);
  a.push(ok ? 1 : 0);
  if (a.length > 20) a.shift();
}

export function tagAccuracy(tag) {
  const a = state.tags[tag];
  if (!a || !a.length) return null;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

export function exportJSON() {
  return JSON.stringify({ app: 'albert', version: 1, exported: new Date().toISOString(), state });
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (data.app !== 'albert' || !data.state) throw new Error('Tohle není záloha Alberta.');
  state = { ...DEFAULTS(), ...data.state };
  save();
}

export function reset() {
  const keep = state.settings;
  state = DEFAULTS();
  state.settings = keep;
  save();
}
