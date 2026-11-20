// Arithmetic for the calculator, the terminal and the assistant: a small recursive-descent evaluator.
// No eval. Understands + − × ÷ ^ %, parentheses, a postfix % (12% → 0.12), the constants pi and e, and a few
// functions. `deg` makes the trigonometric functions read their argument in degrees.
const FN = {
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
  round: Math.round, floor: Math.floor, ceil: Math.ceil,
};
const TRIG = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
const CONST = { pi: Math.PI, 'π': Math.PI, e: Math.E };

export function evaluate(src, { deg = true } = {}) {
  const s = String(src).replace(/\s+/g, '').replace(/[×＊]/g, '*').replace(/(?<=[\d).])[xX](?=[\d(.])/g, '*').replace(/[÷／]/g, '/').replace(/[−－–]/g, '-').replace(/[＋]/g, '+').replace(/√/g, 'sqrt').replace(/,/g, '').replace(/\s+/g, '');
  if (!s) throw new Error('沒有算式');
  let i = 0;
  const peek = () => s[i];
  const fail = (m) => { throw new Error(m); };
  function number() {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (!m) fail(i >= s.length ? '算式沒有寫完' : `看不懂「${s.slice(i, i + 6)}」`);
    i += m[0].length;
    return Number(m[0]);
  }
  function atom() {
    if (peek() === '(') {
      i++;
      const v = sum();
      if (peek() !== ')') fail('少了右括號');
      i++;
      return v;
    }
    const w = /^[a-zπ]+/i.exec(s.slice(i));
    if (w) {
      const name = w[0].toLowerCase();
      i += w[0].length;
      if (name in CONST) return CONST[name];
      const f = FN[name] || TRIG[name];
      if (!f) fail(`不認得「${w[0]}」`);
      if (peek() !== '(') fail(`${name} 後面要接括號`);
      const v = atom();
      return TRIG[name] ? f(deg ? (v * Math.PI) / 180 : v) : f(v);
    }
    return number();
  }
  function postfix() {
    let v = atom();
    while (peek() === '%' && !/[\d.(a-zπ]/i.test(s[i + 1] || '')) { i++; v /= 100; }
    return v;
  }
  function power() {
    const base = postfix();
    if (peek() === '^') { i++; return base ** unary(); }
    return base;
  }
  function unary() {
    if (peek() === '-') { i++; return -unary(); }
    if (peek() === '+') { i++; return unary(); }
    return power();
  }
  function product() {
    let v = unary();
    for (;;) {
      const c = peek();
      if (c === '*') { i++; v *= unary(); }
      else if (c === '/') { i++; const d = unary(); if (d === 0) fail('不能除以 0'); v /= d; }
      else if (c === '%') { i++; const d = unary(); if (d === 0) fail('不能除以 0'); v %= d; }
      else if (c === '(' || /[a-zπ]/i.test(c || '')) v *= unary();     // 2(3+4), 2pi
      else return v;
    }
  }
  function sum() {
    let v = product();
    for (;;) {
      const c = peek();
      if (c === '+') { i++; v += product(); } else if (c === '-') { i++; v -= product(); } else return v;
    }
  }
  const out = sum();
  if (i < s.length) fail(`看不懂「${s.slice(i, i + 6)}」`);
  if (!Number.isFinite(out)) fail(Number.isNaN(out) ? '結果不是一個數' : '結果超出範圍');
  return out;
}

/** A result without the noise of binary fractions: 0.1 + 0.2 → 0.3 */
export function format(v) {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e15 || a < 1e-9)) return v.toExponential(8).replace(/\.?0+e/, 'e');
  return String(Number(v.toPrecision(12)));
}

/** True when the text reads as arithmetic (so the assistant may answer with a number). */
export const looksLikeMath = (text) => /\d/.test(text) && /^[\d\s.+\-*/^%()×÷−xXπ,]+$|^(?:[\d\s.+\-*/^%()×÷−π,]|sqrt|sin|cos|tan|ln|log|abs|pi|e)+$/i.test(text.trim()) && /[+\-*/^%×÷−(]|sqrt|sin|cos|tan|ln|log/i.test(text);
