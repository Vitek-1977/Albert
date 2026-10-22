// Opakování: Leitnerovy krabičky po větách + váhy podle slabých kategorií.
import { get, recordTag, tagAccuracy } from './storage.js';

const DAY = 86400000;
const INTERVALS = [0, 1, 3, 7, 16, 35, 90]; // dny podle krabičky
export const LESSON_SIZE = 12;
const MAX_DICTATION = 3;

export function mainTag(item) { return item.tags[0]; }

export function grade(item, ok) {
  const s = get();
  const r = s.items[item.id] || (s.items[item.id] = { box: 0, due: 0, right: 0, wrong: 0 });
  const now = Date.now();
  if (ok) {
    r.box = Math.min(r.box + 1, INTERVALS.length - 1);
    r.right++;
    r.due = now + INTERVALS[r.box] * DAY - 3 * 3600000; // o pár hodin dřív, ať to vyjde na další den
  } else {
    r.box = 1;
    r.wrong++;
    r.due = now + 10 * 60000;
  }
  r.last = now;
  for (const t of new Set(item.tags)) recordTag(t, ok);
}

function weakness(item) {
  // 0.15 … 1 – čím horší úspěšnost v kategoriích věty, tím vyšší
  const accs = item.tags.map(tagAccuracy).filter(a => a !== null);
  if (!accs.length) return 0.5;
  return 0.15 + 0.85 * (1 - Math.min(...accs));
}

function weightedPick(list, weightFn, n) {
  const pool = list.map(x => ({ x, w: weightFn(x) * (0.5 + Math.random()) }));
  pool.sort((a, b) => b.w - a.w);
  return pool.slice(0, n).map(p => p.x);
}

export function buildLesson(items, { focus = null, silent = false } = {}) {
  const s = get();
  const now = Date.now();
  let pool = focus ? items.filter(i => i.tags.includes(focus)) : items;
  if (silent) pool = pool.filter(i => i.type !== 'dictation'); // skládání věty bez zvuku nejde
  const due = pool.filter(i => s.items[i.id] && s.items[i.id].due <= now);
  const fresh = pool.filter(i => !s.items[i.id]);

  const nDue = Math.min(due.length, fresh.length ? 7 : LESSON_SIZE);
  let picked = weightedPick(due, i => weakness(i) + Math.min(3, (now - s.items[i.id].due) / DAY) * 0.1, nDue);

  // nové věty – míchat kategorie, slabší kategorie dostanou přednost
  const usedTags = {};
  const freshSorted = weightedPick(fresh, i => weakness(i), fresh.length);
  for (const i of freshSorted) {
    if (picked.length >= LESSON_SIZE) break;
    const t = mainTag(i);
    if (!focus && (usedTags[t] || 0) >= 3) continue;
    usedTags[t] = (usedTags[t] || 0) + 1;
    picked.push(i);
  }
  // když nic nového, doplnit nejbližšími k opakování
  if (picked.length < LESSON_SIZE) {
    const rest = pool.filter(i => !picked.includes(i) && s.items[i.id])
      .sort((a, b) => s.items[a.id].due - s.items[b.id].due);
    picked.push(...rest.slice(0, LESSON_SIZE - picked.length));
  }
  // nejvýš tři skládání věty
  let dict = 0;
  picked = picked.filter(i => i.type !== 'dictation' || ++dict <= MAX_DICTATION);
  if (picked.length < LESSON_SIZE) {
    const extra = pool.filter(i => i.type !== 'dictation' && !picked.includes(i))
      .sort((a, b) => (s.items[a.id]?.due ?? 0) - (s.items[b.id]?.due ?? 0));
    picked.push(...extra.slice(0, LESSON_SIZE - picked.length));
  }
  // promíchat, ať nejdou stejné typy za sebou
  for (let k = picked.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [picked[k], picked[j]] = [picked[j], picked[k]];
  }
  return picked;
}

export function dueCount(items) {
  const s = get(); const now = Date.now();
  return items.filter(i => s.items[i.id] && s.items[i.id].due <= now).length;
}

export function seenCount(items) {
  const s = get();
  return items.filter(i => s.items[i.id]).length;
}
