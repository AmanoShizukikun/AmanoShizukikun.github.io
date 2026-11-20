// Terminal: a small shell over the WebOS file system and the system itself.
// One command per line; `>` and `>>` send what a command prints into a file. Tab completes commands and paths,
// ↑ ↓ walk the history (kept across sessions), Ctrl L clears, Ctrl C drops the line.
import { h } from '../ui.js';
import { SCENES, WALLS, two, span, bytes } from '../kernel.js';
import { APPS, appById } from '../apps.js';
import { evaluate, format } from '../lib/expr.js';

const HELP = [
  ['ls [-l] [路徑]', '列出資料夾內容'], ['cd [路徑]', '切換資料夾（不寫路徑回到 ~）'], ['pwd', '目前的位置'],
  ['cat <檔案>', '顯示文字檔內容'], ['echo <文字>', '印出文字（可接 > 或 >> 寫進檔案）'], ['touch <檔名>', '建立空白檔案'],
  ['mkdir <名稱>', '建立資料夾'], ['mv <來源> <目的>', '搬移或改名'], ['cp <來源> <目的>', '複製'],
  ['rm <路徑>', '丟進垃圾桶（-f 永久刪除）'], ['tree [路徑]', '樹狀列出'], ['find <關鍵字>', '依名稱搜尋檔案'],
  ['open <路徑|應用程式>', '用對應的應用程式開啟'], ['apps', '列出應用程式'], ['ps', '列出視窗'], ['kill <編號>', '關閉視窗'],
  ['space [編號]', '切換工作區'], ['wallpaper [名稱]', '列出或切換桌布與場景'], ['calc <算式>', '計算'], ['sakura <話>', '交給長門櫻'],
  ['notify <文字>', '送出一則通知'], ['date · uptime · whoami · uname · neofetch', '系統資訊'], ['history · clear · lock · exit', ''],
];
const NAMES = ['help', 'ls', 'cd', 'pwd', 'cat', 'echo', 'touch', 'mkdir', 'mv', 'cp', 'rm', 'tree', 'find', 'open', 'apps', 'ps', 'kill', 'space', 'wallpaper', 'calc', 'sakura', 'notify', 'date', 'uptime', 'whoami', 'uname', 'neofetch', 'history', 'clear', 'lock', 'exit'];

function split(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(>>?)|([^\s>]+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[3] ? { op: m[3] } : m[1] ?? m[2] ?? m[4]);
  return out;
}

export function start(os, win, args = {}) {
  const { fs } = os;
  const state = os.cfg.app('terminal');
  let cwd = args.dir && args.dir.dir ? args.dir : fs.home;
  let hist = state.get('hist', []).slice(-100), hi = hist.length, draft = '';

  const out = h('div', { class: 'tm-out os-text', role: 'log', 'aria-live': 'polite' });
  const prompt = h('span', { class: 'tm-ps' });
  const input = h('input', { class: 'tm-in', type: 'text', spellcheck: false, autocomplete: 'off', autocapitalize: 'off', 'aria-label': '指令' });
  const box = h('div', { class: 'tm' }, out, h('label', { class: 'tm-line' }, prompt, input));
  win.body.append(box);

  const where = () => { const p = fs.path(cwd); return p === '/Home' ? '~' : p.startsWith('/Home/') ? `~${p.slice(5)}` : p || '/'; };
  const ps = () => { prompt.textContent = `amano@nsos ${where()} ›`; win.setTitle(`${where()} — 終端機`); };
  const print = (text = '', cls = '') => { out.append(h('p', { class: cls }, text)); };
  const scroll = () => { box.scrollTop = box.scrollHeight; };
  const fail = (m) => { throw new Error(m); };
  const need = (v, what) => (v != null && v !== '' ? v : fail(`用法錯誤：少了${what}`));
  const node = (p, what = '檔案或資料夾') => fs.resolve(p, cwd) || fail(`找不到${what}：${p}`);
  const dirOf = (p) => { const n = node(p, '資料夾'); return n.dir ? n : fail(`不是資料夾：${p}`); };
  /** "a/b/c.txt" → the folder a/b and the name c.txt */
  const target = (p) => { const i = p.lastIndexOf('/'); return i < 0 ? { dir: cwd, name: p } : { dir: dirOf(p.slice(0, i) || '/'), name: p.slice(i + 1) }; };

  const cmd = {
    help() { return ['指令　　　　　（Tab 補完 · ↑↓ 歷史 · Ctrl L 清除）', ...HELP.map(([a, b]) => `  ${a.padEnd(26)}${b}`)]; },
    pwd: () => [fs.path(cwd) || '/'],
    ls(a) {
      const long = a.includes('-l'), p = a.find((x) => !x.startsWith('-'));
      const n = p ? node(p) : cwd;
      const list = n.dir ? fs.children(n) : [n];
      if (!list.length) return [];
      if (!long) return [list.map((x) => (x.dir ? `${x.name}/` : x.name)).join('    ')];
      return list.map((x) => `${x.dir ? 'd' : x.app ? 'l' : '-'}${fs.isRO(x) ? 'r-' : 'rw'}  ${(x.dir ? `${fs.children(x).length} 項` : x.url ? '—' : bytes(x.size || 0)).padStart(9)}  ${x.dir ? `${x.name}/` : x.name}`);
    },
    cd(a) { cwd = a[0] ? dirOf(a[0]) : fs.home; ps(); return []; },
    async cat(a) { const n = node(need(a[0], '檔案')); if (n.dir) fail(`是資料夾：${a[0]}`); if (fs.kind(n) !== 'text') fail(`不是文字檔：${a[0]}（用 open 開啟）`); return (await fs.text(n)).replace(/\n$/, '').split('\n'); },
    echo: (a) => [a.join(' ')],
    async touch(a) { const t = target(need(a[0], '檔名')); if (!fs.named(t.dir, t.name)) await fs.create(t.dir, t.name, { text: '' }); return []; },
    mkdir(a) { const t = target(need(a[0], '名稱')); if (fs.named(t.dir, t.name)) fail(`已經存在：${a[0]}`); fs.mkdir(t.dir, t.name); return []; },
    mv(a) {
      const src = node(need(a[0], '來源')), dst = fs.resolve(need(a[1], '目的'), cwd);
      if (dst && dst.dir) fs.move(src, dst);
      else if (dst) fail(`已經存在：${a[1]}`);
      else { const t = target(a[1]); if (t.dir.id !== src.parent) fs.move(src, t.dir); fs.rename(src, t.name); }
      return [];
    },
    async cp(a) {
      const src = node(need(a[0], '來源')), dst = fs.resolve(need(a[1], '目的'), cwd);
      if (dst && dst.dir) await fs.copy(src, dst);
      else if (dst) fail(`已經存在：${a[1]}`);
      else { const t = target(a[1]); await fs.copy(src, t.dir, t.name); }
      return [];
    },
    async rm(a) {
      const force = a.includes('-f') || a.includes('-rf'), p = a.find((x) => !x.startsWith('-'));
      const n = node(need(p, '路徑'));
      if (force) { await fs.remove(n); return [`已永久刪除 ${p}`]; }
      fs.trash(n);
      return [`已丟進垃圾桶：${p}`];
    },
    tree(a) {
      const rootNode = a[0] ? dirOf(a[0]) : cwd, lines = [fs.path(rootNode) || '/'];
      let count = 0;
      const walk = (n, pre) => {
        const list = fs.children(n);
        list.forEach((x, i) => {
          if (++count > 200) return;
          const last = i === list.length - 1;
          lines.push(`${pre}${last ? '└─ ' : '├─ '}${x.name}${x.dir ? '/' : ''}`);
          if (x.dir) walk(x, pre + (last ? '   ' : '│  '));
        });
      };
      walk(rootNode, '');
      if (count > 200) lines.push('…（只列出前 200 項）');
      return lines;
    },
    find(a) { const r = fs.find(need(a.join(' '), '關鍵字')); return r.length ? r.map((n) => fs.path(n)) : ['沒有符合的檔案']; },
    open(a) {
      const what = need(a.join(' '), '路徑或應用程式');
      const app = APPS.find((x) => x.cat && (x.id === what.toLowerCase() || x.name === what));
      if (app) { os.launch(app.id); return [`開啟 ${app.name}`]; }
      os.openNode(node(what));
      return [];
    },
    apps: () => APPS.filter((x) => x.cat).map((x) => `  ${x.id.padEnd(10)}${x.name}`),
    ps() { return os.wm.wins.length ? ['  編號  工作區  狀態　　應用程式', ...os.wm.wins.map((w) => `  ${String(w.id).padStart(4)}  ${two(w.ws + 1)}　　　${w.min ? '最小化' : w === os.wm.active ? '使用中' : '背景　'}　${appById(w.app)?.name || w.app} — ${w.title}`)] : ['沒有開啟的視窗']; },
    kill(a) { const w = os.wm.wins.find((x) => x.id === Number(need(a[0], '視窗編號'))) || fail(`沒有這個視窗：${a[0]}`); setTimeout(() => os.wm.close(w)); return [`關閉 ${w.title}`]; },
    space(a) {
      const spaces = os.cfg.get('spaces');
      if (!a[0]) return spaces.map((s, i) => `${i === os.wm.ws ? '›' : ' '} ${two(i + 1)}  ${s.name.padEnd(8)}${(SCENES[s.scene] || SCENES.gate).en}`);
      const i = Number(a[0]) - 1;
      if (!(i >= 0 && i < spaces.length)) fail(`沒有工作區 ${a[0]}`);
      os.wm.setWs(i);
      return [];
    },
    wallpaper(a) {
      const cur = os.cfg.get('wall'), spaces = os.cfg.get('spaces');
      if (!a[0]) return ['桌布：', `  ${cur === 'live' ? '›' : ' '} live      即時場景（依工作區）`, ...WALLS.map((w) => `  ${cur === `img:${w.id}` ? '›' : ' '} ${w.id.padEnd(10)}${w.name}`), `  ${cur === 'solid' ? '›' : ' '} solid     純色`, '這個工作區的場景：', ...Object.entries(SCENES).map(([id, s]) => `  ${spaces[os.wm.ws].scene === id ? '›' : ' '} ${id.padEnd(10)}${s.name}`)];
      const k = a[0].toLowerCase();
      if (k === 'live' || k === 'solid') os.cfg.set('wall', k);
      else if (WALLS.some((w) => w.id === k)) os.cfg.set('wall', `img:${k}`);
      else if (SCENES[k]) { os.cfg.set('spaces', spaces.map((s, i) => (i === os.wm.ws ? { ...s, scene: k } : s))); os.cfg.set('wall', 'live'); }
      else fail(`沒有這個桌布或場景：${a[0]}`);
      return [];
    },
    calc: (a) => [format(evaluate(need(a.join(' '), '算式')))],
    sakura(a) { os.launch('sakura', { ask: need(a.join(' '), '要說的話') }); return []; },
    notify(a) { os.notify({ app: 'terminal', title: need(a.join(' '), '文字'), body: `來自 ${where()}` }); return []; },
    date: () => [new Date().toLocaleString('zh-TW', { dateStyle: 'full', timeStyle: 'medium' })],
    uptime: () => [`已運作 ${span((Date.now() - os.bootAt) / 1000)}，${os.wm.wins.length} 個視窗`],
    whoami: () => ['amano（本機工作階段，沒有帳號系統）'],
    uname: () => [`NSOS ${os.version} build ${os.env.build} · ${navigator.platform || 'web'}`],
    neofetch() {
      const u = fs.usage(), spaces = os.cfg.get('spaces');
      const info = [
        'amano@nsos', '──────────', `OS       Nagato Sakura WebOS ${os.version}`, `Build    ${os.env.build}`, `Uptime   ${span((Date.now() - os.bootAt) / 1000)}`,
        `Shell    nsh · ${NAMES.length} 個指令`, `Display  ${os.wm.size.w}×${os.wm.size.h} @${devicePixelRatio}x`, `Space    ${two(os.wm.ws + 1)} / ${spaces[os.wm.ws].name}`,
        `Scene    ${os.root.dataset.wall === 'live' ? (SCENES[spaces[os.wm.ws].scene] || SCENES.gate).en : 'still image'}`, `Windows  ${os.wm.wins.length}`, `Files    ${u.count}（${bytes(u.text + u.blobs)}）`,
      ];
      const art = ['       /\\       ', '      /  \\      ', '     / /\\ \\     ', '    / /  \\ \\    ', '   / /____\\ \\   ', '  /__________\\  ', '                '];
      return info.map((l, i) => `${art[i] || art.at(-1)} ${l}`);
    },
    history: () => hist.map((l, i) => `${String(i + 1).padStart(4)}  ${l}`),
    clear() { out.replaceChildren(); return []; },
    lock() { setTimeout(() => os.lock(), 80); return []; },
    exit() { setTimeout(() => win.close(), 0); return []; },
  };

  async function run(line) {
    print(`${prompt.textContent} ${line}`, 'tm-echo');
    const parts = split(line);
    if (!parts.length) return;
    const ri = parts.findIndex((p) => typeof p === 'object');
    const argv = (ri < 0 ? parts : parts.slice(0, ri)).filter((p) => typeof p === 'string');
    const redirect = ri < 0 ? null : { append: parts[ri].op === '>>', path: parts[ri + 1] };
    const name = argv.shift();
    try {
      if (!cmd[name]) fail(`找不到指令：${name}（輸入 help 看得到全部）`);
      if (redirect && typeof redirect.path !== 'string') fail('> 後面要接檔名');
      const lines = await cmd[name](argv);
      if (redirect) {
        const t = target(redirect.path), old = fs.named(t.dir, t.name), body = `${lines.join('\n')}\n`;
        if (old) { if (old.dir) fail(`是資料夾：${redirect.path}`); fs.writeText(old, redirect.append ? (await fs.text(old)) + body : body); }
        else await fs.create(t.dir, t.name, { text: body });
      } else lines.forEach((l) => print(l));
    } catch (e) { print(e.message || String(e), 'tm-err'); }
  }

  function complete() {
    const v = input.value.slice(0, input.selectionStart), rest = input.value.slice(input.selectionStart);
    const m = /(\S*)$/.exec(v), word = m[1], first = !/\s/.test(v.trimStart());
    let options;
    if (first) options = NAMES.filter((n) => n.startsWith(word));
    else {
      const i = word.lastIndexOf('/'), base = i < 0 ? '' : word.slice(0, i + 1), stem = word.slice(i + 1).toLowerCase();
      const d = fs.resolve(base || '.', cwd);
      options = d && d.dir ? fs.children(d).filter((n) => n.name.toLowerCase().startsWith(stem)).map((n) => base + (/\s/.test(n.name) ? `"${n.name}"` : n.name) + (n.dir ? '/' : '')) : [];
    }
    if (!options.length) return;
    if (options.length === 1) { input.value = v.slice(0, v.length - word.length) + options[0] + (first ? ' ' : '') + rest; return; }
    let common = options[0];
    for (const o of options) while (!o.startsWith(common)) common = common.slice(0, -1);
    if (common.length > word.length) input.value = v.slice(0, v.length - word.length) + common + rest;
    else { print(`${prompt.textContent} ${input.value}`, 'tm-echo'); print(options.join('    '), 'tm-dim'); scroll(); }
  }

  let busy = false;
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (busy) return;
      const line = input.value.trim();
      input.value = '';
      if (line && hist.at(-1) !== line) { hist.push(line); if (hist.length > 100) hist.shift(); state.set('hist', hist); }
      hi = hist.length; draft = '';
      busy = true;
      await run(line);
      busy = false;
      scroll();
    } else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi === hist.length) draft = input.value; if (hi > 0) input.value = hist[--hi]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length) { hi++; input.value = hi === hist.length ? draft : hist[hi]; } }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); out.replaceChildren(); }
    else if (e.ctrlKey && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) { e.preventDefault(); print(`${prompt.textContent} ${input.value}^C`, 'tm-echo'); input.value = ''; scroll(); }
  });
  // a click anywhere in the window puts the caret back on the line — unless text is being selected
  box.addEventListener('click', () => { if (!String(getSelection())) input.focus({ preventScroll: true }); });
  win.el.addEventListener('focus', () => input.focus({ preventScroll: true }));
  win.cleanup.push(os.bus.on('fs', () => { if (!fs.get(cwd.id) || fs.inTrash(cwd)) { cwd = fs.home; ps(); } }));

  ps();
  print(`Nagato Sakura WebOS ${os.version} — nsh`, 'tm-hi');
  print('輸入 help 看指令，neofetch 看系統資訊。', 'tm-dim');
  input.focus({ preventScroll: true });
  return null;
}
