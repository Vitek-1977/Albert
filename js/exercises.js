// Pět typů úloh. Každá vykreslí UI do root a zavolá ctx.onAnswer({ok, …}).
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const spoken = item => {
  switch (item.type) {
    case 'gap': return [item.de.replace(/[{}]/g, '')];
    case 'pair': return [{ text: item.a, tag: 'a' }, { text: item.b, tag: 'b' }];
    default: return [item.de];
  }
};

export const TYPE_LABEL = {
  gap: 'Poslouchej a doplň',
  errorhunt: 'Najdi chybu',
  pair: 'Dvě věty',
  dictation: 'Diktát',
  gender: 'Jaký rod?',
};

const playBtn = (label = 'Přehrát znovu') =>
  `<button class="play" data-play aria-label="${label}"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>`;

/* ---------- Doplňovačka ---------- */
function gap(item, root, ctx) {
  const [before, rest] = item.de.split('{');
  const [answer, after] = rest.split('}');
  root.innerHTML = `
    <div class="listen-row">${playBtn()}<span class="hint">Poslouchej a doplň, co slyšíš.</span></div>
    <p class="de sentence">${esc(before)}<span class="blank" id="blank">&nbsp;</span>${esc(after)}</p>
    <div class="options">${shuffle(item.options).map(o => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  root.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const o = b.dataset.o, ok = o === answer;
    root.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.dataset.o === answer) x.classList.add('is-right'); });
    if (!ok) b.classList.add('is-wrong');
    const bl = root.querySelector('#blank');
    bl.textContent = answer; bl.classList.add(ok ? 'is-right' : 'is-wrong');
    ctx.onAnswer({ ok, given: o });
  });
}

/* ---------- Rod ---------- */
function gender(item, root, ctx) {
  root.innerHTML = `
    <div class="gender-card">
      <p class="de noun"><span class="blank" id="blank">&nbsp;&nbsp;&nbsp;</span> ${esc(item.noun)}</p>
      <p class="cz-hint">${esc(item.cz)}</p>
    </div>
    <div class="options gender-opts">${['der', 'die', 'das'].map(g => `<button class="opt g-${g}" data-o="${g}">${g}</button>`).join('')}</div>`;
  root.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const o = b.dataset.o, ok = o === item.answer;
    root.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.dataset.o === item.answer) x.classList.add('is-right'); });
    if (!ok) b.classList.add('is-wrong');
    const bl = root.querySelector('#blank');
    bl.textContent = item.answer; bl.className = `blank g-text-${item.answer}`;
    ctx.onAnswer({ ok, given: o });
    ctx.play();
  });
}

/* ---------- Najdi chybu ---------- */
function errorhunt(item, root, ctx) {
  const words = item.de.split(' ');
  root.innerHTML = `
    <div class="listen-row">${playBtn()}<span class="hint">Je ve větě chyba? Ťukni na chybné slovo.</span></div>
    <p class="de sentence words">${words.map((w, i) => `<button class="word" data-i="${i}">${esc(w)}</button>`).join(' ')}</p>
    <button class="opt wide" data-ok>Věta je správně</button>`;
  const finish = (ok, given, btn) => {
    root.querySelectorAll('button.word, [data-ok]').forEach(x => x.disabled = true);
    if (item.error) {
      root.querySelectorAll('.word').forEach(x => { if (strip(x.textContent) === item.error) x.classList.add('is-error'); });
    } else root.querySelector('[data-ok]').classList.add('is-right');
    if (!ok && btn) btn.classList.add('is-wrong');
    ctx.onAnswer({ ok, given });
  };
  root.querySelectorAll('.word').forEach(b => b.onclick = () => {
    const w = strip(b.textContent);
    finish(!!item.error && w === item.error, w, b);
  });
  root.querySelector('[data-ok]').onclick = e => finish(!item.error, null, e.currentTarget);
}

/* ---------- Dvě věty ---------- */
function pair(item, root, ctx) {
  root.innerHTML = `
    <p class="question">${esc(item.q)}</p>
    <div class="pair">
      ${['a', 'b'].map(k => `
      <div class="pair-card" data-k="${k}">
        <button class="play small" data-play-one="${k}" aria-label="Přehrát ${k.toUpperCase()}"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>
        <span class="pair-label">${k.toUpperCase()}</span>
        <span class="de pair-text" hidden>${esc(item[k])}</span>
      </div>`).join('')}
    </div>
    <div class="options two">${['a', 'b'].map(k => `<button class="opt" data-o="${k}">${k.toUpperCase()}</button>`).join('')}</div>`;
  root.querySelectorAll('[data-play-one]').forEach(b => b.onclick = () => ctx.play([{ text: item[b.dataset.playOne], tag: b.dataset.playOne }]));
  root.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const ok = b.dataset.o === item.answer;
    root.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.dataset.o === item.answer) x.classList.add('is-right'); });
    if (!ok) b.classList.add('is-wrong');
    root.querySelectorAll('.pair-text').forEach(t => t.hidden = false);
    root.querySelector(`.pair-card[data-k="${item.answer}"]`).classList.add('is-right');
    ctx.onAnswer({ ok, given: b.dataset.o });
  });
}

/* ---------- Diktát ---------- */
const UML = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue', 'ß': 'ss' };
const normWord = w => strip(w.normalize('NFC')).replace(/[äöüÄÖÜß]/g, c => UML[c]);
const normWords = s => s.replace(/[„“”"‚‘’,.!?;:–—]/g, ' ').split(/\s+/).filter(Boolean).map(normWord).filter(Boolean);

export function diffWords(target, given) {
  // LCS nad slovy – vrací, která slova cíle chybí/jsou špatně, a která zadaná jsou navíc
  const A = normWords(target), B = normWords(given);
  const eq = (x, y, i) => i === 0 ? x.toLowerCase() === y.toLowerCase() : x === y;
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = eq(A[i], B[j], i) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const okA = new Array(n).fill(false), okB = new Array(m).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(A[i], B[j], i)) { okA[i] = okB[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return { okA, okB, perfect: okA.every(Boolean) && okB.every(Boolean) && n === m };
}

function dictation(item, root, ctx) {
  root.innerHTML = `
    <div class="listen-row">${playBtn()}<span class="hint">Napiš celou větu, kterou slyšíš.</span></div>
    <textarea class="de dict" rows="3" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" lang="de" placeholder="Sem piš…"></textarea>
    <div class="umlauts">${['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map(c => `<button class="uml" data-c="${c}">${c}</button>`).join('')}</div>
    <button class="primary wide" data-check disabled>Zkontrolovat</button>`;
  const ta = root.querySelector('textarea');
  const check = root.querySelector('[data-check]');
  ta.oninput = () => { check.disabled = !ta.value.trim(); };
  root.querySelectorAll('.uml').forEach(b => {
    b.onpointerdown = e => e.preventDefault(); // nezavírat klávesnici
    b.onclick = () => {
      const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
      ta.value = ta.value.slice(0, s) + b.dataset.c + ta.value.slice(e);
      ta.selectionStart = ta.selectionEnd = s + 1; ta.focus(); ta.oninput();
    };
  });
  check.onclick = () => {
    ta.blur();
    const d = diffWords(item.de, ta.value);
    ta.disabled = true; check.hidden = true;
    root.querySelector('.umlauts').hidden = true;
    ctx.onAnswer({ ok: d.perfect, given: ta.value, diff: d });
  };
}

export const RENDER = { gap, gender, errorhunt, pair, dictation };

/* ---------- Zpětná vazba: správná věta se zvýrazněním ---------- */
function markWords(sentence, okFlags) {
  // okFlags podle normalizovaných slov; mapujeme na slova věty (po odstranění interpunkce)
  let k = 0;
  return sentence.split(' ').map(w => {
    if (!normWord(w)) return esc(w);
    const ok = okFlags[k++];
    return ok ? esc(w) : `<mark>${esc(w)}</mark>`;
  }).join(' ');
}

export function feedbackHTML(item, res) {
  let main = '';
  switch (item.type) {
    case 'gap':
      main = esc(item.de.split('{')[0]) + `<mark>${esc(item.options[0])}</mark>` + esc(item.de.split('}')[1]);
      break;
    case 'gender':
      main = `<span class="g-text-${item.answer}">${item.answer}</span> ${esc(item.noun)} <span class="cz-inline">– ${esc(item.cz)}</span><br><span class="example">${esc(item.de)}</span>`;
      break;
    case 'errorhunt':
      main = item.error
        ? item.de.split(' ').map(w => strip(w) === item.error
            ? `<del>${esc(item.error)}</del>${item.fix ? ` <mark>${esc(item.fix)}</mark>` : ''}${esc(w.slice(w.indexOf(item.error) + item.error.length))}`
            : esc(w)).join(' ')
        : esc(item.de);
      break;
    case 'pair': {
      const right = item[item.answer], other = item[item.answer === 'a' ? 'b' : 'a'];
      const d = diffWords(right, other);
      const nBad = d.okA.filter(x => !x).length;
      // u slovosledu by zvýraznění mátlo – značíme jen drobné rozdíly ve stejně dlouhých větách
      main = nBad && nBad <= 2 && right.split(' ').length === other.split(' ').length ? markWords(right, d.okA) : esc(right);
      break;
    }
    case 'dictation': {
      main = markWords(item.de, res.diff.okA);
      if (!res.ok) {
        const g = res.given.trim(); let k = 0;
        const mine = g.split(/\s+/).map(w => normWord(w) ? (res.diff.okB[k++] ? esc(w) : `<del>${esc(w)}</del>`) : esc(w)).join(' ');
        main += `<span class="yours">Tvoje verze: ${mine}</span>`;
      }
      break;
    }
  }
  return `<p class="de fb-sentence">${main}</p>${item.note ? `<p class="fb-note">${esc(item.note)}</p>` : ''}`;
}
