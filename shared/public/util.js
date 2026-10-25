// Helpers shared by the utility apps (load after lib.js).
// copy(text, button): copy to clipboard and flash the button label.
const copy = async (t, b) => {
  try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove(); }
  if (b) { const o = b.textContent; b.textContent = 'Copied ✓'; setTimeout(() => b.textContent = o, 900); }
};
const num = id => parseFloat(document.getElementById(id).value) || 0;
const fmt = (n, d = 2) => isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const money = n => isFinite(n) ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '–';
const pad2 = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const pdate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
// ymd(a, b): whole years, months and days from a to b (a <= b). Month ends clamp, so Jan 31 + 1 month = Feb 28/29.
function ymd(a, b) {
  const addM = (d, n) => { const t = new Date(d.getFullYear(), d.getMonth() + n, 1); t.setDate(Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return t; };
  let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); if (addM(a, m) > b) m--;
  return [Math.floor(m / 12), m % 12, Math.round((b - addM(a, m)) / 864e5)];
}
// only(list, kind?): app records, skipping the helper docs below (or just one kind).
const only = (l, k) => l.filter(x => k ? x.kind === k : x.kind !== '_state' && x.kind !== 'saved');

// KV: one hidden document per app that remembers the last-used inputs.
const KV = {
  doc: null,
  async load() { const d = await api.list(); this.doc = d.find(x => x.kind === '_state') || null; return this.doc?.state || {}; },
  save(state) { clearTimeout(this.t); this.t = setTimeout(async () => { if (this.doc) api.upd(this.doc.id, { state }); else this.doc = await api.add({ kind: '_state', state }); }, 400); },
};
// remember(): restore every [data-keep] input from the last visit, then autosave on change.
async function remember() {
  const s = await KV.load(), els = () => document.querySelectorAll('[data-keep]');
  els().forEach(el => { if (el.id in s) { if (el.type === 'checkbox') el.checked = s[el.id]; else el.value = s[el.id]; } });
  document.addEventListener('input', () => { const o = {}; els().forEach(el => o[el.id] = el.type === 'checkbox' ? el.checked : el.value); KV.save(o); });
}
// savedBar(el, {get, set}): name + Save button and chips of saved presets (stored as kind "saved").
function savedBar(el, { get, set }) {
  let list = [];
  el.innerHTML = '<div class="row"><div class="col"><input class="sn" placeholder="Name this setup"></div><button class="s sv">Save</button></div><div class="chips"></div>';
  const chips = () => el.querySelector('.chips').innerHTML = list.map(s => `<span class="chip" data-id="${s.id}">${esc(s.name)}<i data-del>✕</i></span>`).join('');
  el.querySelector('.sv').onclick = async () => { const n = el.querySelector('.sn').value.trim() || 'Untitled'; list.unshift(await api.add({ kind: 'saved', name: n, data: get() })); el.querySelector('.sn').value = ''; chips(); };
  el.querySelector('.chips').onclick = async e => { const c = e.target.closest('.chip'); if (!c) return; const s = list.find(x => x.id === c.dataset.id); if (e.target.hasAttribute('data-del')) { await api.del(s.id); list = list.filter(x => x !== s); chips(); } else set(s.data); };
  api.list().then(d => { list = only(d, 'saved'); chips(); });
}

// compile(expr, {deg}): safe expression parser (recursive descent, no eval). Returns f(vars) → number; throws on bad syntax.
// Supports + - * / % ^ !, implicit multiplication (2x, 3(4+1), 2pi), constants pi/e/tau, variables, and common functions.
function compile(src, { deg = false } = {}) {
  const T = src.replace(/\s+/g, '').match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[a-zA-Z_]\w*|[-+*\/^%(),!]/gi) || [];
  if (T.join('') !== src.replace(/\s+/g, '').replace(/×/g, '*')) { if (T.join('').length !== src.replace(/\s+/g, '').length) throw Error('Unexpected character'); }
  let p = 0; const peek = () => T[p], next = () => T[p++];
  const rad = x => deg ? x * Math.PI / 180 : x, back = x => deg ? x * 180 / Math.PI : x;
  const fact = n => { if (n < 0 || n !== Math.floor(n)) return NaN; if (n > 170) return Infinity; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const F = { sin: x => Math.sin(rad(x)), cos: x => Math.cos(rad(x)), tan: x => Math.tan(rad(x)), asin: x => back(Math.asin(x)), acos: x => back(Math.acos(x)), atan: x => back(Math.atan(x)), sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, fact, min: Math.min, max: Math.max, pow: Math.pow, mod: (a, b) => a % b, hypot: Math.hypot };
  const C = { pi: Math.PI, e: Math.E, tau: 2 * Math.PI };
  const isNum = t => t !== undefined && /^[\d.]/.test(t), isId = t => t !== undefined && /^[a-z_]/i.test(t);
  function expr() { let l = term(); while (peek() === '+' || peek() === '-') { const o = next(), r = term(); const a = l; l = o === '+' ? v => a(v) + r(v) : v => a(v) - r(v); } return l; }
  function term() { let l = unary(); for (;;) { const t = peek(); if (t === '*' || t === '/' || t === '%') { next(); const r = unary(), a = l; l = t === '*' ? v => a(v) * r(v) : t === '/' ? v => a(v) / r(v) : v => a(v) % r(v); } else if (isNum(t) || isId(t) || t === '(') { const r = unary(), a = l; l = v => a(v) * r(v); } else return l; } }
  function unary() { if (peek() === '-') { next(); const u = unary(); return v => -u(v); } if (peek() === '+') { next(); return unary(); } return power(); }
  function power() { let b = postfix(); if (peek() === '^') { next(); const e = unary(), a = b; b = v => Math.pow(a(v), e(v)); } return b; }
  function postfix() { let a = primary(); while (peek() === '!') { next(); const x = a; a = v => fact(x(v)); } return a; }
  function primary() {
    const t = next(); if (t === undefined) throw Error('Unexpected end');
    if (isNum(t)) { const n = parseFloat(t); return () => n; }
    if (t === '(') { const e = expr(); if (next() !== ')') throw Error('Missing )'); return e; }
    if (isId(t)) { const k = t.toLowerCase();
      if (peek() === '(') { next(); const args = []; if (peek() !== ')') { do args.push(expr()); while (peek() === ',' && next()); } if (next() !== ')') throw Error('Missing )'); const f = F[k]; if (!f) throw Error('Unknown function ' + t); return v => f(...args.map(a => a(v))); }
      if (k in C) return () => C[k]; return v => { if (v && k in v) return v[k]; throw Error('Unknown name ' + t); }; }
    throw Error('Unexpected ' + t);
  }
  const ast = expr(); if (p < T.length) throw Error('Unexpected ' + T[p]); return ast;
}
