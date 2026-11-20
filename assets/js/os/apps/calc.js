// Calculator: type or tap an expression; the result is previewed while it is being written.
import { h, tool } from '../ui.js';
import { evaluate, format } from '../lib/expr.js';

const KEYS = [
  ['C', 'clear', 'fn'], ['⌫', 'back', 'fn'], ['%', '%', 'op'], ['÷', '÷', 'op'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['×', '×', 'op'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['−', '−', 'op'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['+', '+', 'op'],
  ['±', 'neg', 'fn'], ['0', '0'], ['.', '.'], ['=', 'eq', 'eq'],
];
const SCI = [['(', '('], [')', ')'], ['^', '^'], ['√', 'sqrt('], ['π', 'π'], ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['ln', 'ln('], ['log', 'log(']];

export function start(os, win) {
  const state = os.cfg.app('calc');
  let expr = '', deg = state.get('deg', true), sci = state.get('sci', false), tape = state.get('tape', []).slice(-30), done = false;

  const exprEl = h('p', { class: 'cc-expr os-text' }), outEl = h('p', { class: 'cc-out os-text' });
  const tapeEl = h('ol', { class: 'cc-tape', hidden: true });
  const sciEl = h('div', { class: 'cc-sci' }, SCI.map(([label, v]) => h('button', { type: 'button', data: { k: v } }, label)));
  const degBtn = h('button', { type: 'button', class: 'os-btn is-quiet', title: '角度單位', onclick: () => { deg = !deg; state.set('deg', deg); draw(); } });
  const sciBtn = tool('calc', '科學函數', { onclick: () => { sci = !sci; state.set('sci', sci); draw(); } });
  const tapeBtn = tool('list', '計算紀錄', { onclick: () => { tapeEl.hidden = !tapeEl.hidden; tapeBtn.setAttribute('aria-pressed', String(!tapeEl.hidden)); drawTape(); } });
  const pad = h('div', { class: 'cc-pad' }, KEYS.map(([label, v, kind]) => h('button', { type: 'button', class: kind ? `is-${kind}` : '', data: { k: v } }, label)));
  const box = h('div', { class: 'cc', tabindex: '0' }, h('div', { class: 'cc-top' }, sciBtn, tapeBtn, h('i'), degBtn), h('div', { class: 'cc-screen' }, exprEl, outEl), tapeEl, sciEl, pad);
  win.body.append(box);

  const calc = (s) => evaluate(s, { deg });
  function draw() {
    exprEl.textContent = expr || '0';
    let preview = '';
    if (expr && !done) { try { preview = format(calc(expr)); } catch { preview = ''; } }
    outEl.textContent = done ? outEl.textContent : preview && preview !== expr ? `= ${preview}` : '';
    outEl.classList.toggle('is-final', done);
    degBtn.textContent = deg ? 'DEG' : 'RAD';
    sciEl.hidden = !sci;
    sciBtn.setAttribute('aria-pressed', String(sci));
    exprEl.scrollLeft = exprEl.scrollWidth;
  }
  function drawTape() {
    if (tapeEl.hidden) return;
    tapeEl.replaceChildren(...(tape.length ? tape.slice().reverse().map(([e, r]) => h('li', null, h('button', { type: 'button', title: '放回算式', onclick: () => { expr = r; done = false; draw(); } }, h('span', null, e), h('b', null, `= ${r}`)))) : [h('li', { class: 'cc-none' }, '還沒有計算紀錄')]));
  }
  function press(k) {
    if (k === 'clear') { expr = ''; done = false; outEl.textContent = ''; }
    else if (k === 'back') { if (done) { done = false; outEl.textContent = ''; } else expr = expr.slice(0, /(sqrt|sin|cos|tan|ln|log)\($/.test(expr) ? -RegExp.$1.length - 1 : -1); }
    else if (k === 'neg') { if (!expr) expr = '−'; else if (/^−\((.*)\)$/.test(expr)) expr = RegExp.$1; else expr = `−(${expr})`; done = false; }
    else if (k === 'eq') {
      if (!expr) return;
      try {
        const r = format(calc(expr));
        tape.push([expr, r]); if (tape.length > 30) tape.shift(); state.set('tape', tape);
        outEl.textContent = expr; exprEl.textContent = r; expr = r; done = true;
        outEl.classList.add('is-final');
        drawTape();
        return;
      } catch (e) { outEl.textContent = e.message; outEl.classList.add('is-final'); os.sound.play('error'); done = false; box.classList.remove('is-err'); void box.offsetWidth; box.classList.add('is-err'); return; }
    } else {
      // after "=", a digit starts a new expression; an operator continues from the result
      if (done && /^[\d.(πa-z]/i.test(k)) expr = '';
      done = false;
      expr += k;
    }
    draw();
  }
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { press(b.dataset.k); os.sound.play('tick'); box.focus({ preventScroll: true }); } });
  box.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { Enter: 'eq', '=': 'eq', Backspace: 'back', Delete: 'clear', Escape: 'clear', '*': '×', '/': '÷', '-': '−' };
    const k = map[e.key] || (/^[\d.+%^()]$/.test(e.key) ? e.key : e.key === 'p' ? 'π' : null);
    if (!k) return;
    if (e.key === 'Escape' && !expr) return;          // nothing to clear: let Esc do its usual job
    e.preventDefault(); e.stopPropagation();
    press(k);
  });
  // an expression copied from elsewhere can be pasted in
  box.addEventListener('paste', (e) => { const t = (e.clipboardData.getData('text') || '').trim().slice(0, 80); if (t) { e.preventDefault(); expr = done ? t : expr + t; done = false; draw(); } });
  win.el.addEventListener('focus', () => box.focus({ preventScroll: true }));
  draw();
  box.focus({ preventScroll: true });
  return null;
}
