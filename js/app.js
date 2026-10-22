import * as store from './storage.js';
import * as audio from './audio.js';
import { buildLesson, grade, dueCount, seenCount, mainTag, LESSON_SIZE } from './srs.js';
import { RENDER, feedbackHTML, spoken, esc, TYPE_LABEL } from './exercises.js';
import { avatar } from './albert.js';

const $ = s => document.querySelector(s);
const app = $('#app');
const pick = a => a[Math.floor(Math.random() * a.length)];
const RATES = [0.8, 1, 1.25];

let ITEMS = [], A = {};

/* ================= start ================= */
async function boot() {
  store.load();
  audio.setRate(store.get().settings.rate);
  const [items, albert] = await Promise.all([
    fetch('data/items.json').then(r => r.json()),
    fetch('data/albert.json').then(r => r.json()),
    audio.init(),
  ]);
  ITEMS = items.items; A = albert;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  home();
}

function greeting() {
  const h = new Date().getHours();
  return pick(A.greet[h < 11 ? 'morning' : h < 18 ? 'day' : 'evening']);
}

const catName = t => A.categories[t]?.name || t;

/* ================= domů ================= */
function home() {
  audio.stop();
  const s = store.get();
  const todayXP = s.days[store.today()] || 0;
  const goal = s.settings.goal;
  const st = store.streak();
  const due = dueCount(ITEMS);
  const seen = seenCount(ITEMS);
  const goalPct = Math.min(100, Math.round(todayXP / goal * 100));
  let line = greeting();
  if (todayXP >= goal) line = pick(A.goalDone);
  else if (st >= 3 && Math.random() < 0.5) line = pick(A.streak).replace('{n}', st);

  const cats = Object.keys(A.categories).map(t => {
    const acc = store.tagAccuracy(t);
    const total = ITEMS.filter(i => i.tags.includes(t)).length;
    return { t, acc, total };
  }).sort((x, y) => (x.acc ?? 2) - (y.acc ?? 2));

  app.innerHTML = `
  <header class="top">
    <span class="brand">Albert</span>
    <button class="icon-btn" id="settings" aria-label="Nastavení"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg></button>
  </header>
  <main class="home">
    <section class="albert-hello">
      ${avatar(todayXP >= goal ? 'happy' : 'neutral', 88)}
      <p class="bubble">${esc(line)}</p>
    </section>

    <section class="today">
      <div class="today-row">
        <span>Dnes <strong>${todayXP}</strong> z ${goal} XP</span>
        <span class="streak ${st ? 'on' : ''}">${st ? `Série ${st} ${st === 1 ? 'den' : st < 5 ? 'dny' : 'dní'}` : 'Série zatím nezačala'}</span>
      </div>
      <div class="bar"><span style="width:${goalPct}%"></span></div>
    </section>

    <button class="primary big" id="start">
      Začít lekci
      <small>${LESSON_SIZE} úloh, ${due ? `${due} k opakování` : 'nové věty'}</small>
    </button>

    <section class="cats">
      <h2>Kde to skřípe</h2>
      <p class="sub">Prošel jsi ${seen} z ${ITEMS.length} vět. Ťukni na kategorii a procvič jen ji.</p>
      <ul>
        ${cats.map(c => `
        <li><button class="cat" data-t="${c.t}">
          <span class="cat-name">${esc(catName(c.t))}</span>
          <span class="cat-meta">${c.acc === null ? 'zatím nezkoušeno' : `${Math.round(c.acc * 100)} %`}</span>
          <span class="bar thin ${c.acc !== null && c.acc < 0.7 ? 'weak' : ''}"><span style="width:${c.acc === null ? 0 : Math.round(c.acc * 100)}%"></span></span>
        </button></li>`).join('')}
      </ul>
    </section>
  </main>`;
  $('#start').onclick = () => startLesson();
  $('#settings').onclick = settings;
  app.querySelectorAll('.cat').forEach(b => b.onclick = () => startLesson(b.dataset.t));
  window.scrollTo(0, 0);
}

/* ================= lekce ================= */
let L = null;

function startLesson(focus = null) {
  const tasks = buildLesson(ITEMS, { focus });
  if (!tasks.length) { alertAlbert(pick(A.empty)); return; }
  L = { focus, queue: tasks.map(it => ({ it, retry: false })), idx: 0, total: tasks.length, right: 0, firstTry: 0, xp: 0, missed: [] };
  app.innerHTML = `
  <header class="lesson-top">
    <button class="icon-btn" id="quit" aria-label="Ukončit lekci"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
    <div class="bar lesson-bar"><span id="prog"></span></div>
    <button class="rate" id="rate"></button>
  </header>
  <main class="lesson">
    <div class="task-head"><span id="tlabel"></span><span id="tcat"></span></div>
    <div id="intro" class="lesson-intro"></div>
    <div id="task"></div>
  </main>
  <div class="sheet" id="sheet" hidden></div>`;
  $('#quit').onclick = () => { L = null; home(); };
  const rateBtn = $('#rate');
  const showRate = () => rateBtn.textContent = `${String(store.get().settings.rate).replace('.', ',')}×`;
  showRate();
  rateBtn.onclick = () => {
    const s = store.get().settings;
    s.rate = RATES[(RATES.indexOf(s.rate) + 1) % RATES.length];
    audio.setRate(s.rate); store.save(); showRate();
  };
  $('#intro').innerHTML = `${avatar('neutral', 44)}<p>${esc(focus ? A.categories[focus].intro : pick(A.lessonStart))}</p>`;
  showTask();
}

function showTask() {
  const { it, retry } = L.queue[L.idx];
  $('#prog').style.width = `${Math.round(L.idx / L.queue.length * 100)}%`;
  $('#tlabel').textContent = retry ? 'Ještě jednou' : TYPE_LABEL[it.type];
  $('#tcat').textContent = catName(mainTag(it));
  if (L.idx > 0) $('#intro').hidden = true;
  const root = $('#task');
  root.className = `task t-${it.type}`;
  const ctx = {
    play: (texts) => audio.play(texts || spoken(it)),
    onAnswer: res => answer(it, retry, res),
  };
  RENDER[it.type](it, root, ctx);
  root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => ctx.play());
  audio.onPlayState((on, tag) => {
    root.querySelectorAll('[data-play]').forEach(b => b.classList.toggle('playing', on));
    root.querySelectorAll('.pair-card').forEach(c => c.classList.toggle('playing', on && c.dataset.k === tag));
  });
  if (it.type !== 'gender' && it.type !== 'errorhunt') ctx.play();
}

function answer(it, retry, res) {
  if (!retry) {
    grade(it, res.ok);
    if (res.ok) { L.right++; L.firstTry++; L.xp += 10; }
    else { L.missed.push(it); L.queue.push({ it, retry: true }); }
  } else if (res.ok) { L.xp += 5; }
  store.save();

  const sheet = $('#sheet');
  sheet.className = `sheet ${res.ok ? 'ok' : 'bad'}`;
  sheet.innerHTML = `
    <div class="sheet-head">${avatar(res.ok ? 'happy' : 'hmm', 44)}<p class="verdict">${esc(res.ok ? pick(A.right) : pick(A.wrong))}</p></div>
    ${feedbackHTML(it, res)}
    <div class="sheet-actions">
      <button class="icon-btn" id="again" aria-label="Přehrát správnou větu"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>
      <button class="icon-btn" id="flag" aria-label="Nahlásit chybu ve větě"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 21V4h11l-1.5 4L16 12H7v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>
      <button class="primary" id="next">Pokračovat</button>
    </div>`;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('up'));
  if (it.type === 'errorhunt') $('#again').hidden = true;
  $('#again').onclick = () => audio.play(it.type === 'pair' ? [it[it.answer]] : spoken(it).filter(t => typeof t === 'string'));
  $('#flag').onclick = () => flagItem(it);
  $('#next').onclick = () => {
    sheet.classList.remove('up'); sheet.hidden = true;
    L.idx++;
    if (L.idx >= L.queue.length) finish(); else showTask();
  };
  $('#next').focus({ preventScroll: true });
}

function finish() {
  audio.stop();
  const s = store.get();
  L.xp += 10;
  store.addXP(L.xp);
  s.lessons++;
  store.save();
  const pct = L.firstTry / L.total;
  const tier = pct >= 0.9 ? 'great' : pct >= 0.65 ? 'good' : 'meh';
  const missedCats = [...new Set(L.missed.map(mainTag))];
  const st = store.streak();
  app.innerHTML = `
  <main class="result">
    ${avatar(tier === 'meh' ? 'neutral' : 'happy', 120)}
    <p class="bubble big">${esc(pick(A.lessonEnd[tier]))}</p>
    <dl class="stats">
      <div><dt>Napoprvé správně</dt><dd>${L.firstTry} z ${L.total}</dd></div>
      <div><dt>Získáno</dt><dd>${L.xp} XP</dd></div>
      <div><dt>Série</dt><dd>${st} ${st === 1 ? 'den' : st < 5 ? 'dny' : 'dní'}</dd></div>
    </dl>
    ${missedCats.length ? `<div class="missed"><h3>Dnes skřípalo</h3><ul>${missedCats.map(t => `<li><button class="link" data-t="${t}">${esc(catName(t))}</button></li>`).join('')}</ul></div>` : ''}
    <button class="primary big" id="more">Další lekce</button>
    <button class="secondary" id="home">Zpět domů</button>
  </main>`;
  const focus = L.focus;
  L = null;
  $('#more').onclick = () => startLesson(focus);
  $('#home').onclick = home;
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => startLesson(b.dataset.t));
  window.scrollTo(0, 0);
}

/* ================= nahlášení chyby ================= */
function itemText(it) {
  return it.type === 'pair' ? `${it.a} / ${it.b}` : it.type === 'gender' ? `${it.answer} ${it.noun}: ${it.de}` : it.de.replace(/[{}]/g, '');
}

function flagItem(it) {
  const d = document.createElement('dialog');
  d.className = 'modal';
  d.innerHTML = `<form method="dialog">
    <h3>Chyba ve větě?</h3>
    <p class="de small">${esc(itemText(it))}</p>
    <textarea rows="3" placeholder="Co je špatně? (nepovinné)"></textarea>
    <div class="row"><button value="cancel" class="secondary">Zrušit</button><button value="ok" class="primary">Nahlásit</button></div>
  </form>`;
  document.body.append(d);
  d.showModal();
  d.onclose = () => {
    if (d.returnValue === 'ok') {
      const s = store.get();
      s.flags.push({ id: it.id, text: itemText(it), note: d.querySelector('textarea').value.trim(), at: new Date().toISOString() });
      store.save();
      const f = $('#flag'); if (f) { f.classList.add('flagged'); f.disabled = true; }
    }
    d.remove();
  };
}

function alertAlbert(text) {
  const d = document.createElement('dialog');
  d.className = 'modal';
  d.innerHTML = `<form method="dialog"><div class="sheet-head">${avatar('neutral', 44)}<p>${esc(text)}</p></div><div class="row"><button class="primary">Dobře</button></div></form>`;
  document.body.append(d); d.showModal(); d.onclose = () => d.remove();
}

/* ================= nastavení ================= */
function settings() {
  const s = store.get();
  const flags = s.flags;
  app.innerHTML = `
  <header class="top">
    <button class="icon-btn" id="back" aria-label="Zpět"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <span class="brand">Nastavení</span><span></span>
  </header>
  <main class="settings">
    <section>
      <h2>Rychlost přehrávání</h2>
      <div class="seg" id="rate">${RATES.map(r => `<button data-v="${r}" class="${s.settings.rate === r ? 'on' : ''}">${String(r).replace('.', ',')}×</button>`).join('')}</div>
    </section>
    <section>
      <h2>Denní cíl</h2>
      <div class="seg" id="goal">${[30, 60, 100, 150].map(g => `<button data-v="${g}" class="${s.settings.goal === g ? 'on' : ''}">${g} XP</button>`).join('')}</div>
      <p class="sub">Jedna lekce je zhruba 100–130 XP.</p>
    </section>
    <section>
      <h2>Offline</h2>
      <p class="sub">Stáhne všechny nahrávky do telefonu, aby Albert mluvil i bez signálu.</p>
      <button class="secondary" id="offline">Stáhnout nahrávky</button>
    </section>
    <section>
      <h2>Nahlášené věty</h2>
      ${flags.length ? `<ul class="flags">${flags.map(f => `<li><span class="de">${esc(f.text)}</span>${f.note ? `<em>${esc(f.note)}</em>` : ''}</li>`).join('')}</ul>
      <div class="row"><button class="primary" id="shareFlags">Poslat seznam</button><button class="secondary" id="clearFlags">Vymazat</button></div>`
      : '<p class="sub">Zatím nic. Když narazíš na chybnou větu, ťukni ve vyhodnocení na vlaječku.</p>'}
    </section>
    <section>
      <h2>Záloha progresu</h2>
      <p class="sub">Progres je jen v tomhle telefonu. Zálohu si můžeš uložit do Souborů a později nahrát zpět.</p>
      <div class="row"><button class="secondary" id="export">Uložit zálohu</button><label class="secondary file">Nahrát zálohu<input type="file" accept="application/json,.json" id="import" hidden></label></div>
    </section>
    <section>
      <h2>Začít znovu</h2>
      <button class="danger" id="reset">Smazat veškerý progres</button>
    </section>
    <p class="about">Albert, ${ITEMS.length} vět. Hlasy: Piper TTS.</p>
  </main>`;
  $('#back').onclick = home;
  const seg = (id, key, conv) => app.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => {
    s.settings[key] = conv(b.dataset.v); store.save();
    if (key === 'rate') audio.setRate(s.settings.rate);
    app.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b));
  });
  seg('rate', 'rate', Number); seg('goal', 'goal', Number);
  $('#offline').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    await audio.cacheAll((d, n) => b.textContent = d < n ? `Stahuji ${d} / ${n}…` : 'Nahrávky jsou v telefonu');
  };
  if (flags.length) {
    $('#shareFlags').onclick = async () => {
      const text = 'Albert – nahlášené věty\n\n' + flags.map(f => `[${f.id}] ${f.text}${f.note ? `\n   → ${f.note}` : ''}`).join('\n');
      try { if (navigator.share) await navigator.share({ title: 'Albert – nahlášené věty', text }); else { await navigator.clipboard.writeText(text); alertAlbert('Seznam je ve schránce.'); } } catch { /* zrušeno */ }
    };
    $('#clearFlags').onclick = () => { s.flags = []; store.save(); settings(); };
  }
  $('#export').onclick = async () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const name = `albert-zaloha-${store.today()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
    } catch { return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  };
  $('#import').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); alertAlbert('Záloha nahrána. Vítej zpátky!'); settings(); }
    catch (err) { alertAlbert(err.message || 'Zálohu se nepodařilo načíst.'); }
  };
  let armed = false;
  $('#reset').onclick = e => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'Opravdu? Ťukni znovu'; return; }
    store.reset(); home();
  };
  window.scrollTo(0, 0);
}

boot().catch(err => {
  app.innerHTML = `<main class="home"><p class="bubble">Něco se nenačetlo: ${esc(err.message)}. Zkus aplikaci zavřít a otevřít znovu.</p></main>`;
});
