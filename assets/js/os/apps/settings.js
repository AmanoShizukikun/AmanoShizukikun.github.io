// Settings. Every control writes straight to the system configuration (kernel.js); the system reacts to the
// change, so there is no "apply" step and nothing to keep in sync here beyond redrawing the open page.
import { h, ico, btn, appTile } from '../ui.js';
import { SCENES, WALLS, ACCENTS, bytes, two } from '../kernel.js';
import { APPS } from '../apps.js';

const PAGES = [['look', 'palette', '個人化'], ['display', 'display', '顯示'], ['bar', 'bar', '工作列與開始'], ['spaces', 'spaces', '工作區'], ['sound', 'vol', '音效'], ['storage', 'hdd', '儲存空間'], ['about', 'info', '關於']];
const KEYS = [
  ['Alt A', '開始'], ['Alt Q', '搜尋'], ['Alt G', '小工具'], ['Alt Z', '工作總覽'], ['Alt `', '下一個視窗'], ['Alt W', '關閉視窗'], ['Alt M', '最小化'], ['Alt X', '最大化 / 還原'],
  ['Alt Shift ← →', '貼齊左半 / 右半'], ['Alt Shift ↑ ↓', '最大化 / 還原'], ['Alt 1 – 6', '切換工作區'], ['Alt S', '顯示桌面'], ['Alt L', '鎖定'], ['Esc', '關閉選單、面板與工作總覽'], ['直接打字', '開始選單或開始畫面開著時，直接進入搜尋'],
];

export function start(os, win, args = {}) {
  const { cfg, fs } = os;
  let page = PAGES.some((p) => p[0] === args.page) ? args.page : 'look';
  const nav = h('nav', { class: 'st-nav', 'aria-label': '設定分類' }, PAGES.map(([id, icon, label]) => h('button', { type: 'button', data: { p: id } }, ico(icon), h('span', null, label))));
  const main = h('div', { class: 'st-main' });
  win.body.append(h('div', { class: 'st' }, nav, main));

  // ---------------- controls
  const row = (title, desc, control) => h('div', { class: 'st-row' }, h('div', null, h('b', null, title), desc ? h('span', null, desc) : null), control);
  const sw = (key, label) => { const b = h('button', { type: 'button', class: 'nx-switch', role: 'switch', 'aria-label': label, 'aria-checked': String(!!cfg.get(key)) }); b.addEventListener('click', () => cfg.set(key, !cfg.get(key))); return b; };
  const seg = (key, options) => h('div', { class: 'nx-seg', role: 'group' }, options.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(cfg.get(key) === v), onclick: () => cfg.set(key, v) }, label)));
  const range = (key, min, max, unit = '') => { const out = h('output', null, `${cfg.get(key)}${unit}`); const i = h('input', { type: 'range', min, max, step: 1, value: cfg.get(key) }); i.addEventListener('input', () => { out.textContent = `${i.value}${unit}`; cfg.set(key, Number(i.value)); }); return h('label', { class: 'st-range' }, i, out); };
  const head = (kicker, title, text) => [h('p', { class: 'st-kicker' }, kicker), h('h2', null, title), text ? h('p', { class: 'st-lead' }, text) : null];

  const pages = {
    look() {
      const wall = cfg.get('wall'), live = os.env.stage.available;
      const spaces = cfg.get('spaces'), sc = spaces[os.wm.ws];
      const card = (id, label, sub, art, off) => h('button', { type: 'button', class: `st-wall${wall === id ? ' is-on' : ''}`, disabled: !!off, onclick: () => cfg.set('wall', id) }, art, h('b', null, label), h('span', null, sub));
      const custom = wall.startsWith('file:') ? fs.get(wall.slice(5)) : null;
      return [
        ...head('PERSONALISE / 01', '個人化', '桌布、色彩與面板材質。'),
        h('h3', null, '桌布'),
        h('div', { class: 'st-walls' },
          card('live', '即時場景', live ? '每個工作區是世界裡的一個地點' : '這個瀏覽器沒有 WebGL', h('span', { class: 'st-wall__art st-wall__art--live' }, h('i'), h('i'), h('i')), !live),
          ...WALLS.map((w) => card(`img:${w.id}`, w.name, '插畫', h('span', { class: 'st-wall__art' }, h('img', { src: `/assets/img/os/${w.file}-thumb.webp`, alt: '', loading: 'lazy' })))),
          card('solid', '純色', '最省電', h('span', { class: 'st-wall__art st-wall__art--solid' })),
          h('button', { type: 'button', class: `st-wall${custom ? ' is-on' : ''}`, onclick: async () => { const n = await os.ui.pick({ mode: 'open', kinds: ['image'], start: fs.dir('pics'), title: '選一張圖片當桌布' }); if (n) cfg.set('wall', n.wall ? `img:${n.wall}` : `file:${n.id}`); } },
            h('span', { class: 'st-wall__art st-wall__art--pick' }, ico('image')), h('b', null, '自己的圖片…'), h('span', null, custom ? custom.name : '從檔案選擇'))),
        wall === 'live' && live ? row(`這個工作區的場景（${two(os.wm.ws + 1)} ${sc.name}）`, '切換工作區時，鏡頭會飛到那個地點。其他工作區在「工作區」頁設定。',
          h('select', { class: 'os-select', onchange: (e) => cfg.set('spaces', spaces.map((s, i) => (i === os.wm.ws ? { ...s, scene: e.target.value } : s))) }, Object.entries(SCENES).map(([id, s]) => h('option', { value: id, selected: sc.scene === id }, `${s.name} · ${s.en}`)))) : null,
        h('h3', null, '色彩'),
        row('強調色', '「選取中」與「使用中」的顏色', h('div', { class: 'st-swatches' }, ACCENTS.map(([c, name]) => h('button', { type: 'button', class: cfg.get('accent') === c ? 'is-on' : '', style: { '--c': c }, title: name, 'aria-label': name, onclick: () => cfg.set('accent', c) })))),
        row('面板色調', '視窗、工作列與選單。桌面本身維持深色', seg('tone', [['dark', '深色'], ['light', '淺色']])),
        row('玻璃材質', '面板後方的畫面會模糊透出來；關閉比較省效能', sw('glass', '玻璃材質')),
      ];
    },
    display() {
      return [
        ...head('DISPLAY / 02', '顯示'),
        row('亮度', '只影響這個系統的畫面', range('bright', 50, 100, '%')),
        row('夜間光', '替畫面加上暖色，減少藍光', sw('night', '夜間光')),
        cfg.get('night') ? row('夜間光強度', null, range('nightK', 10, 80, '%')) : null,
        row('滿版模式', '收起網站最上方的導覽列，讓系統佔滿整個視窗。可以從快速設定或這裡關閉', sw('focus', '滿版模式')),
        row('桌面上的系統狀態', '右上角的時鐘、工作區與鏡頭座標', sw('widget', '系統狀態')),
        h('p', { class: 'st-note' }, '動態效果與畫質是整個網站共用的設定：在頁面右上角的齒輪裡調整，這裡會跟著套用。'),
      ];
    },
    bar() {
      const pins = cfg.get('pins');
      return [
        ...head('TASKBAR / 03', '工作列與開始'),
        row('開始樣式', '普通是開始選單；平板是全螢幕的磁貼畫面，左邊帶著小工具欄。兩種不會同時出現', seg('startStyle', [['menu', '普通'], ['tiles', '平板']])),
        row('應用程式的位置', null, seg('barAlign', [['left', '靠左'], ['center', '置中']])),
        row('高度', null, seg('barSize', [['m', '標準'], ['s', '精簡']])),
        row('時鐘', null, seg('hour12', [[false, '24 小時'], [true, '12 小時']])),
        row('顯示秒', null, sw('seconds', '顯示秒')),
        h('h3', null, '釘選的應用程式'),
        h('div', { class: 'st-pins' }, APPS.filter((a) => a.cat).map((a) => h('button', { type: 'button', class: pins.includes(a.id) ? 'is-on' : '', 'aria-pressed': String(pins.includes(a.id)), onclick: () => cfg.set('pins', pins.includes(a.id) ? pins.filter((x) => x !== a.id) : [...pins, a.id]) }, appTile(a, 'os-tile--s'), h('span', null, a.name)))),
      ];
    },
    spaces() {
      const spaces = cfg.get('spaces');
      const patch = (fn) => { const next = spaces.map((s) => ({ ...s })); fn(next); cfg.set('spaces', next); };
      return [
        ...head('WORKSPACES / 04', '工作區', '每個工作區有自己的視窗，也有自己在世界裡的位置。從工作總覽（Alt Z）或 Alt + 數字切換；在工作列的工作總覽按鈕上滾動滾輪也可以。'),
        h('div', { class: 'st-spaces' }, spaces.map((s, i) => h('div', { class: `st-space${i === os.wm.ws ? ' is-on' : ''}` },
          h('b', null, two(i + 1)),
          h('input', { class: 'os-input', type: 'text', value: s.name, maxlength: 12, 'aria-label': `工作區 ${i + 1} 的名稱`, onchange: (e) => patch((n) => { n[i].name = e.target.value.trim() || SCENES[n[i].scene]?.name || `工作區 ${i + 1}`; }) }),
          h('select', { class: 'os-select', 'aria-label': `工作區 ${i + 1} 的場景`, onchange: (e) => patch((n) => { n[i].scene = e.target.value; }) }, Object.entries(SCENES).map(([id, sc]) => h('option', { value: id, selected: s.scene === id }, `${sc.name} · ${sc.en}`))),
          h('span', null, `${os.wm.count(i)} 個視窗`),
          btn('前往', { cls: 'is-quiet', disabled: i === os.wm.ws, onclick: () => os.wm.setWs(i) }),
          btn('移除', { cls: 'is-quiet', disabled: spaces.length < 2, onclick: () => { patch((n) => n.splice(i, 1)); os.wm.dropWs(i); } })))),
        btn('新增工作區', { icon: 'plus', disabled: spaces.length >= 6, onclick: () => { const used = new Set(spaces.map((s) => s.scene)); const id = Object.keys(SCENES).find((k) => !used.has(k)) || 'gate'; cfg.set('spaces', [...spaces, { name: SCENES[id].name, scene: id }]); } }),
        h('p', { class: 'st-note' }, '移除工作區時，裡面的視窗會移到前一個工作區。場景只在桌布設為「即時場景」時看得到。'),
      ];
    },
    sound() {
      return [
        ...head('SOUND / 05', '音效'),
        row('系統音效', '開關視窗、通知、切換工作區時的提示音。是即時合成的，沒有音檔', sw('sound', '系統音效')),
        row('音量', '也是媒體播放器的總音量', range('vol', 0, 100)),
        row('靜音', null, sw('mute', '靜音')),
        row('勿擾', '通知只進通知面板，不跳出來，也不出聲。專注計時期間會自動開啟', sw('dnd', '勿擾')),
        h('p', { class: 'st-note' }, btn('試聽通知音', { icon: 'bell', onclick: () => { if (!cfg.get('sound')) os.ui.alert('系統音效是關閉的。', '音效'); else os.sound.play('note'); } })),
      ];
    },
    storage() {
      const u = fs.usage(), trash = fs.children(fs.dir('trash')).length;
      return [
        ...head('STORAGE / 06', '儲存空間', '所有檔案與設定都只存在這個瀏覽器裡，不會上傳。清除瀏覽器資料會一併清掉。'),
        h('dl', { class: 'os-rows' }, [['檔案', `${u.count} 個`], ['文字檔', bytes(u.text)], ['匯入的檔案', `${bytes(u.blobs)}${fs.volatile ? '（只在記憶體）' : ''}`], ['垃圾桶', `${trash} 個項目 · ${bytes(fs.size(fs.dir('trash')))}`], ['設定', bytes(cfg.size())]].map(([a, b]) => h('div', null, h('dt', null, a), h('dd', null, b)))),
        row('清空垃圾桶', '永久刪除垃圾桶裡的項目', btn('清空', { cls: 'is-danger', disabled: !trash, onclick: () => os.ops.emptyTrash() })),
        row('重設檔案', '刪除主資料夾裡的所有檔案，回到剛安裝的樣子', btn('重設檔案', { cls: 'is-danger', onclick: async () => { if (await os.ui.confirm('主資料夾（桌面、文件、圖片、音樂、下載）與垃圾桶裡的所有檔案都會被永久刪除。', { title: '重設檔案', ok: '全部刪除', danger: true })) { await os.wm.closeAll(); await fs.reset(); cfg.set('desk', os.deskDefaults()); os.launch('settings', { page: 'storage' }); } } })),
        row('重設設定', '桌布、色彩、工作區、釘選與各應用程式的偏好回到預設；檔案不受影響', btn('重設設定', { cls: 'is-danger', onclick: async () => { if (await os.ui.confirm('所有系統設定會回到預設值。檔案不會被刪除。', { title: '重設設定', ok: '重設', danger: true })) cfg.reset(); } })),
      ];
    },
    about() {
      return [
        ...head('ABOUT / 07', 'Nagato Sakura WebOS', `版本 ${os.version} · BUILD ${os.env.build}`),
        h('p', { class: 'st-lead' }, '一套在瀏覽器分頁裡執行的桌面環境：視窗管理、工作區、檔案系統與內建應用程式都是這個網站自己的程式，沒有使用框架。'),
        h('dl', { class: 'os-rows' }, [
          ['桌布', '首頁那個 WebGL 世界。工作區之間的切換是鏡頭在世界裡的移動'],
          ['檔案', '目錄與文字檔存在 localStorage，匯入的檔案存在 IndexedDB，全部留在這台裝置'],
          ['長門櫻', '助理依關鍵字與句型辦事（開啟應用程式、調整系統、計算、找檔案）。這裡沒有接上語言模型'],
          ['音效', '以 Web Audio 即時合成'],
          ['離開時', '視窗裡尚未儲存的內容不會保留；檔案與設定會'],
        ].map(([a, b]) => h('div', null, h('dt', null, a), h('dd', null, b)))),
        h('h3', null, '鍵盤快捷鍵'),
        h('dl', { class: 'st-keys' }, KEYS.map(([k, v]) => h('div', null, h('dt', null, h('kbd', null, k)), h('dd', null, v)))),
        h('p', { class: 'st-note' }, '焦點在內嵌的網頁或遊戲裡時，快捷鍵會被它們接走；先點一下視窗的標題列。'),
      ];
    },
  };

  function draw() {
    nav.querySelectorAll('button').forEach((b) => { if (b.dataset.p === page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const top = main.scrollTop, focus = document.activeElement, label = main.contains(focus) ? focus.getAttribute('aria-label') : null;
    main.replaceChildren(h('div', { class: 'st-page' }, pages[page]().filter(Boolean)));
    main.scrollTop = top;
    win.setTitle(`${PAGES.find((p) => p[0] === page)[2]} — 設定`);
    // a redraw replaces the control that was being used: hand the focus to its successor
    if (label) main.querySelector(`[aria-label="${CSS.escape(label)}"]`)?.focus({ preventScroll: true });
  }
  nav.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) { page = b.dataset.p; main.scrollTop = 0; draw(); } });
  // sliders keep their own element while they are being dragged: only other controls trigger a redraw
  const LIVE = new Set(['bright', 'nightK', 'vol']), QUIET = new Set(['geo', 'app', 'desk', 'seen', 'recent', 'memo', 'widgets', 'tiles', 'tileSize', 'calOpen', 'hubCol', 'focusMin', 'allView', 'startPins']);
  win.cleanup.push(os.bus.on('cfg', (k) => { if (QUIET.has(k)) return; if (!LIVE.has(k) || !main.contains(document.activeElement) || document.activeElement.type !== 'range') draw(); }), os.bus.on('fs', () => { if (page === 'storage') draw(); }), os.bus.on('ws', () => { if (page === 'look' || page === 'spaces') draw(); }), os.bus.on('wm', () => { if (page === 'spaces') draw(); }));
  draw();
  return { open: (a) => { if (a.page && pages[a.page]) { page = a.page; main.scrollTop = 0; draw(); } } };
}
