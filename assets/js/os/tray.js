// What the two halves of the system tray open:
//   quick   (network · volume)  now playing, six switches — two of them with a page of their own —, brightness, volume
//   side    (the clock)         notifications on top, the calendar under them, the focus timer at its foot
// and the focus timer itself (`os.timer`), which the calendar, the search page and a widget all drive.
import { h, ico, btn, tool } from './ui.js';
import { svg } from './icons.js';
import { appById } from './apps.js';
import { two, clamp } from './kernel.js';
import { lunar } from './lib/lunar.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const NA = '這個瀏覽器不提供';
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${two(Math.floor(s / 60))}:${two(s % 60)}`; };

export function createTray(os, sh) {
  const { cfg, bus } = os;
  const offs = [];

  // ================================================================ focus timer
  // A session keeps "do not disturb" on and gives it back the way it found it. It lives in memory only: leaving
  // the system ends it.
  let run = null, tick = 0;
  const timer = os.timer = {
    state() { return run ? { left: run.until - Date.now(), total: run.total, k: clamp(1 - (run.until - Date.now()) / run.total, 0, 1) } : null; },
    start(min = cfg.get('focusMin')) {
      if (run) return;
      const total = clamp(Math.round(min), 5, 180) * 60000;
      run = { until: Date.now() + total, total, dnd: cfg.get('dnd') };
      if (!run.dnd) cfg.set('dnd', true);
      tick = setInterval(() => { if (run && Date.now() >= run.until) timer.stop(true); else bus.emit('timer'); }, 1000);
      bus.emit('timer');
    },
    stop(done = false) {
      if (!run) return;
      clearInterval(tick);
      const { dnd, total } = run;
      run = null;
      if (!dnd) cfg.set('dnd', false);
      bus.emit('timer');
      if (done) os.notify({ title: '專注時段結束', body: `${Math.round(total / 60000)} 分鐘到了。勿擾已經恢復原本的設定。`, icon: 'timer' });
    },
  };
  /** The timer's controls; used at the foot of the calendar and inside the timer widget. */
  function timerBar() {
    const el = h('div', { class: 'os-timer' });
    const draw = () => {
      const s = timer.state(), min = cfg.get('focusMin');
      el.classList.toggle('is-run', !!s);
      if (s) { el.style.setProperty('--k', String(s.k)); el.replaceChildren(h('b', null, mmss(s.left)), h('span', null, '專注中 · 勿擾已開啟'), btn('停止', { icon: 'stop', onclick: () => timer.stop() })); return; }
      el.replaceChildren(
        tool('minus', '減少 5 分鐘', { disabled: min <= 5, onclick: () => cfg.set('focusMin', clamp(min - 5, 5, 180)) }),
        h('b', null, String(min)), h('span', null, '分鐘'),
        tool('plus', '增加 5 分鐘', { disabled: min >= 180, onclick: () => cfg.set('focusMin', clamp(min + 5, 5, 180)) }),
        btn('開始專注', { icon: 'play', onclick: () => timer.start() }));
    };
    draw();
    return { el, draw };
  }

  // ================================================================ quick settings
  const q = {
    now: h('div', { class: 'os-card os-now', hidden: true }),
    grid: h('div', { class: 'os-qgrid' }),
    bright: h('input', { type: 'range', min: 50, max: 100, step: 1, 'aria-label': '亮度' }), brightOut: h('output'),
    vol: h('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': '音量' }), volOut: h('output'),
    mute: tool('vol', '靜音'), status: h('span'),
    main: h('div', { class: 'os-quick__main' }), sub: h('div', { class: 'os-quick__sub', hidden: true }),
  };
  // key · icon · label · page (a second level, like the arrow on a switch that has more to say)
  const TILES = [['net', 'wifi', '網路', 'net'], ['sound', 'vol', '系統音效'], ['dnd', 'bellOff', '勿擾'], ['night', 'moon', '夜間光', 'night'], ['focus', 'fit', '滿版模式'], ['tone', 'sun', '淺色面板']];
  TILES.forEach(([key, icon, label, page]) => {
    const main = h('button', { type: 'button', class: 'os-qt__main', data: { q: key }, 'aria-pressed': 'false', 'aria-label': label }, ico(icon));
    q.grid.append(h('div', { class: `os-qt${page ? ' os-qt--split' : ''}`, data: { key } },
      h('div', { class: 'os-qt__face' }, main, page ? h('button', { type: 'button', class: 'os-qt__more', data: { page }, 'aria-label': `${label}的詳細設定`, html: svg('chevR') }) : null),
      h('span', null, label)));
  });
  q.main.append(
    q.grid,
    h('label', { class: 'os-slide' }, ico('sun'), q.bright, q.brightOut),
    h('div', { class: 'os-slide' }, q.mute, q.vol, q.volOut),
    h('footer', { class: 'os-quick__foot' }, q.status, tool('gear', '所有設定', { onclick: () => { sh.close('quick'); os.launch('settings'); } })));
  const quickEl = h('aside', { class: 'os-quick', 'aria-label': '快速設定' }, q.now, h('div', { class: 'os-card os-quick__card' }, q.main, q.sub));

  let page = null;
  const rows = (list) => h('dl', { class: 'os-rows' }, list.map(([a, b]) => h('div', null, h('dt', null, a), h('dd', null, b))));
  function drawSub() {
    q.main.hidden = !!page; q.sub.hidden = !page;
    if (!page) return;
    const head = (title) => h('header', null, tool('back', '返回', { onclick: () => { page = null; drawSub(); q.grid.querySelector('button')?.focus(); } }), h('b', null, title));
    if (page === 'net') {
      const c = sh.conn, on = navigator.onLine;
      q.sub.replaceChildren(head('網路'),
        rows([['狀態', on ? '已連線' : '離線'], ['連線品質', c?.effectiveType ? `相當於 ${c.effectiveType}` : NA], ['下行速率', c?.downlink ? `約 ${c.downlink} Mbps（瀏覽器估計）` : NA], ['往返延遲', c?.rtt != null ? `約 ${c.rtt} ms（瀏覽器估計）` : NA], ['節省流量', c ? (c.saveData ? '已開啟' : '未開啟') : NA]]),
        h('p', { class: 'os-quick__note' }, '網頁不能替裝置開關網路：這裡是瀏覽器回報的連線狀態。系統本身不需要網路，檔案都留在這台裝置。'));
    } else if (page === 'night') {
      const k = h('input', { type: 'range', min: 10, max: 80, step: 1, value: cfg.get('nightK'), 'aria-label': '夜間光強度' }), out = h('output', null, `${cfg.get('nightK')}%`);
      k.addEventListener('input', () => { out.textContent = `${k.value}%`; cfg.set('nightK', Number(k.value)); });
      const sw = h('button', { type: 'button', class: 'nx-switch', role: 'switch', 'aria-label': '夜間光', 'aria-checked': String(!!cfg.get('night')), onclick: () => cfg.set('night', !cfg.get('night')) });
      q.sub.replaceChildren(head('夜間光'), h('div', { class: 'os-quick__row' }, h('span', null, '替畫面加上暖色'), sw), h('label', { class: 'os-slide' }, ico('moon'), k, out),
        h('p', { class: 'os-quick__note' }, '只影響這個系統的畫面。強度越高越暖。'));
    }
    q.sub.querySelector('button')?.focus({ preventScroll: true });
  }
  function drawQuick() {
    const on = navigator.onLine, state = { net: on, tone: cfg.get('tone') === 'light' };
    q.grid.querySelectorAll('.os-qt').forEach((t) => {
      const key = t.dataset.key, pressed = key in state ? state[key] : !!cfg.get(key);
      t.classList.toggle('is-on', pressed);
      t.querySelector('.os-qt__main').setAttribute('aria-pressed', String(pressed));
    });
    q.grid.querySelector('[data-q="net"]').innerHTML = `<span class="os-ico" aria-hidden="true">${svg(on ? 'wifi' : 'wifiOff')}</span>`;
    q.bright.value = cfg.get('bright'); q.brightOut.textContent = `${cfg.get('bright')}`;
    q.vol.value = cfg.get('vol'); q.volOut.textContent = cfg.get('mute') ? '靜音' : `${cfg.get('vol')}`;
    q.bright.style.setProperty('--k', `${(cfg.get('bright') - 50) * 2}%`); q.vol.style.setProperty('--k', `${cfg.get('vol')}%`);
    q.mute.innerHTML = svg(cfg.get('mute') ? 'volOff' : 'vol');
    q.mute.setAttribute('aria-pressed', String(cfg.get('mute')));
    const b = sh.battery();
    q.status.textContent = b ? `電池 ${Math.round(b.level * 100)}%${b.charging ? ' · 充電中' : ''}` : on ? `已連線${sh.conn?.effectiveType ? ` · ${sh.conn.effectiveType}` : ''}` : '離線';
    const m = os.media;
    q.now.hidden = !m;
    if (m) q.now.replaceChildren(
      h('p', { class: 'os-now__src' }, ico('music'), h('span', null, '媒體播放器')),
      h('div', { class: 'os-now__what' }, h('b', null, m.title), h('i', null, m.playing ? '播放中' : '已暫停')),
      h('div', { class: 'os-now__ctl' }, tool('prev', '上一首', { onclick: () => m.prev() }), tool(m.playing ? 'pause' : 'play', m.playing ? '暫停' : '播放', { class: 'os-tool is-main', onclick: () => m.toggle() }), tool('next', '下一首', { onclick: () => m.next() })));
  }
  q.grid.addEventListener('click', (e) => {
    const more = e.target.closest('.os-qt__more'), b = e.target.closest('.os-qt__main');
    if (more) { page = more.dataset.page; drawSub(); return; }
    if (!b) return;
    const k = b.dataset.q;
    if (k === 'net') { page = 'net'; drawSub(); return; }
    if (k === 'tone') cfg.set('tone', cfg.get('tone') === 'light' ? 'dark' : 'light'); else cfg.set(k, !cfg.get(k));
    os.sound.play('tick');
  });
  q.bright.addEventListener('input', () => cfg.set('bright', Number(q.bright.value)));
  q.vol.addEventListener('input', () => { cfg.set('vol', Number(q.vol.value)); if (cfg.get('mute')) cfg.set('mute', false); });
  q.vol.addEventListener('change', () => os.sound.play('tick'));
  q.mute.addEventListener('click', () => cfg.set('mute', !cfg.get('mute')));

  // ================================================================ notifications + calendar
  const n = {
    count: h('span'), dnd: tool('bellOff', '勿擾'), clear: btn('全部清除', { cls: 'is-quiet' }),
    quiet: h('p', { class: 'os-notes__quiet', hidden: true }, ico('bellOff'), h('span', null, '勿擾已開啟：通知只會放在這裡，不跳出來，也不出聲。')),
    list: h('ul', { class: 'os-notes__list' }), none: h('p', { class: 'os-notes__none' }, '沒有新的通知'),
  };
  const c = { day: h('b'), sub: h('span'), fold: tool('chevD', '收合月曆'), month: h('b'), grid: h('div', { class: 'os-cal__grid', role: 'grid' }), body: h('div', { class: 'os-cal__body' }) };
  let calAt = new Date(), picked = null;
  const tb = timerBar();
  const shift = (d) => { calAt = new Date(calAt.getFullYear(), calAt.getMonth() + d, 1); drawCal(); };
  c.body.append(
    h('header', { class: 'os-cal__nav' }, c.month, tool('chevU', '上個月', { onclick: () => shift(-1) }), tool('chevD', '下個月', { onclick: () => shift(1) }), tool('dot', '回到今天', { onclick: () => { calAt = new Date(); picked = null; drawCal(); } })),
    h('div', { class: 'os-cal__week', 'aria-hidden': 'true' }, WEEK.map((d) => h('i', null, d))), c.grid);
  const sideEl = h('aside', { class: 'os-side', 'aria-label': '通知與行事曆' },
    h('section', { class: 'os-card os-notes' }, h('header', null, h('b', null, '通知'), n.count, n.dnd, n.clear), n.quiet, n.list, n.none),
    h('section', { class: 'os-card os-cal' }, h('header', { class: 'os-cal__head' }, h('div', null, c.day, c.sub), c.fold), c.body, tb.el));

  const same = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  function drawCal() {
    const y = calAt.getFullYear(), m = calAt.getMonth(), today = new Date();
    const shown = picked || today, lu = lunar(shown);
    c.day.textContent = `${shown.getMonth() + 1} 月 ${shown.getDate()} 日　星期${WEEK[shown.getDay()]}`;
    const diff = picked ? Math.round((new Date(picked.getFullYear(), picked.getMonth(), picked.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000) : 0;
    c.sub.textContent = [lu ? `農曆${lu.text}` : null, picked && diff ? (diff > 0 ? `${diff} 天後` : `${-diff} 天前`) : picked ? '今天' : null].filter(Boolean).join('　·　') || `${shown.getFullYear()} 年`;
    const open = cfg.get('calOpen');
    c.body.hidden = !open;
    c.fold.innerHTML = svg(open ? 'chevD' : 'chevU');
    c.fold.dataset.tip = open ? '收合月曆' : '展開月曆'; c.fold.setAttribute('aria-label', c.fold.dataset.tip);
    if (!open) return;
    c.month.textContent = `${y} 年 ${m + 1} 月`;
    const first = new Date(y, m, 1).getDay();
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, m, i - first + 1), out = d.getMonth() !== m, l = lunar(d);
      cells.push(h('button', { type: 'button', class: `${out ? 'is-out' : ''}${same(d, today) ? ' is-today' : ''}${same(d, picked) ? ' is-on' : ''}${d.getDay() === 0 || d.getDay() === 6 ? ' is-rest' : ''}`.trim(), data: { d: d.getTime() }, 'aria-label': `${d.getMonth() + 1} 月 ${d.getDate()} 日${l ? ` 農曆${l.text}` : ''}` },
        h('b', null, String(d.getDate())), l ? h('i', null, l.day === 1 ? l.month : l.name) : null));
    }
    c.grid.replaceChildren(...cells);
  }
  c.grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    const d = new Date(Number(b.dataset.d));
    picked = same(d, picked) || same(d, new Date()) ? null : d;
    if (d.getMonth() !== calAt.getMonth()) calAt = new Date(d.getFullYear(), d.getMonth(), 1);
    drawCal();
  });
  c.grid.addEventListener('wheel', (e) => { e.preventDefault(); shift(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  c.fold.addEventListener('click', () => cfg.set('calOpen', !cfg.get('calOpen')));

  function drawNotes() {
    const dnd = cfg.get('dnd');
    n.none.hidden = !!os.notes.length;
    n.clear.hidden = !os.notes.length;
    n.count.textContent = os.notes.length ? String(os.notes.length) : '';
    n.quiet.hidden = !dnd;
    n.dnd.setAttribute('aria-pressed', String(dnd));
    n.dnd.dataset.tip = dnd ? '關閉勿擾' : '開啟勿擾';
    n.list.replaceChildren(...os.notes.map((note) => {
      const d = new Date(note.at);
      return h('li', { class: note.action ? 'is-link' : '', onclick: (e) => { if (e.target.closest('.os-tool')) return; if (note.action) { sh.close('side'); note.action(); } } },
        ico(note.icon), h('div', null, h('b', null, note.title), note.body ? h('p', null, note.body) : null, h('i', null, `${appById(note.app)?.name || '系統'} · ${two(d.getHours())}:${two(d.getMinutes())}`)),
        tool('close', '移除', { onclick: () => { os.notes.splice(os.notes.indexOf(note), 1); drawNotes(); bus.emit('notes'); } }));
    }));
  }
  n.clear.addEventListener('click', () => { os.notes.length = 0; drawNotes(); bus.emit('notes'); });
  n.dnd.addEventListener('click', () => cfg.set('dnd', !cfg.get('dnd')));

  // ================================================================ wiring
  offs.push(
    bus.on('cfg', (k) => {
      if (sh.isOpen('quick')) { drawQuick(); if (page === 'night' && k === 'night') drawSub(); }
      if (sh.isOpen('side')) { if (k === 'dnd') drawNotes(); if (k === 'calOpen') drawCal(); }
      if (k === 'focusMin') tb.draw();
    }),
    bus.on('note', () => { if (sh.isOpen('side')) drawNotes(); }),
    bus.on('media', () => { if (sh.isOpen('quick')) drawQuick(); }),
    bus.on('battery', () => { if (sh.isOpen('quick')) drawQuick(); }),
    bus.on('net', () => { if (sh.isOpen('quick')) { drawQuick(); if (page === 'net') drawSub(); } }),
    bus.on('timer', () => tb.draw()),
  );

  return {
    quick: { el: quickEl, open() { page = null; drawSub(); drawQuick(); } },
    side: { el: sideEl, open() { calAt = new Date(); picked = null; drawNotes(); drawCal(); tb.draw(); } },
    timerBar,
    dispose() { offs.forEach((f) => f()); clearInterval(tick); },
  };
}
