// 長門櫻 — the system's resident assistant.
//
// She is drawn live (the same Live2D runtime and renderer as the Live2D works page and the corner mascot) and
// she works the system: opens applications, changes wallpaper, scene, tone, volume and brightness, switches
// workspace, calculates, finds files, takes notes, reports the system's state.
//
// How she understands: by keywords and sentence patterns (`brain` below). There is no language model behind
// this window — when a sentence matches nothing she says so and offers what she can do, instead of improvising.
import { h, tool } from '../ui.js';
import { SCENES, WALLS, bytes, span, two, clamp } from '../kernel.js';
import { APPS } from '../apps.js';
import { evaluate, format, looksLikeMath } from '../lib/expr.js';
import { reducedMotion, quality } from '../../core/store.js';

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const START = ['你可以做什麼？', '打開檔案總管', '換個場景', '現在幾點？'];
const ALIAS = { files: ['檔案總管', '檔案', '資料夾', 'files', 'explorer'], browser: ['瀏覽器', '網頁', 'browser'], terminal: ['終端機', '終端', '命令列', 'terminal'], notes: ['記事本', '筆記', 'notes'], calc: ['計算機', 'calculator'], gallery: ['相簿', '圖片', '照片', 'gallery'], media: ['媒體播放器', '播放器', '音樂', '影片', 'player'], paint: ['繪圖板', '繪圖', '畫圖', 'paint'], arcade: ['遊戲中心', '遊戲', 'games', 'arcade'], monitor: ['系統監控', '監控', '工作管理員', 'monitor'], settings: ['設定', 'settings'] };
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export async function start(os, win, args = {}) {
  const { fs, cfg, wm } = os;
  const state = os.cfg.app('sakura');
  let log = state.get('log', []).slice(-120);

  // ================================================================ what she can do
  const appOf = (text) => { const t = text.toLowerCase(); for (const id in ALIAS) if (ALIAS[id].some((k) => t.includes(k))) return APPS.find((a) => a.id === id); return null; };
  const num = (text) => { const m = /(\d{1,3})/.exec(text); return m ? clamp(Number(m[1]), 0, 100) : null; };
  const setScene = (id) => { cfg.set('spaces', cfg.get('spaces').map((s, i) => (i === wm.ws ? { ...s, scene: id } : s))); if (cfg.get('wall') !== 'live') cfg.set('wall', 'live'); };

  /** One sentence in → { say, chips, mood, act } out. Rules are tried in order; the first that matches answers. */
  function brain(raw) {
    const text = raw.trim(), t = text.toLowerCase();
    const R = (say, chips = START, mood = null, act = null) => ({ say, chips, mood, act });

    if (/說明|幫助|help|你(會|可以|能)(做|幫)?(什麼|甚麼|哪些)|怎麼用|功能/.test(t)) {
      return R('我在這套系統裡能幫主人做這些：\n· 開啟應用程式——「打開終端機」\n· 換桌布與場景——「換到神樹」「換個桌布」\n· 調整系統——「淺色面板」「音量 40」「亮度 80」「夜間光」「專注模式」\n· 切換工作區——「到工作區 2」\n· 計算——「12 × (3 + 4)」\n· 找檔案——「找 歡迎」\n· 記事——「記下 明天要交報告」\n· 系統狀態、時間與日期', ['系統狀態', '換到神樹', '記下 喝水', '12 × (3 + 4)'], 'smile');
    }
    if (/^(hi|hello|hey|嗨|哈囉|你好|妳好|主人好|早安|午安|晚安|安安)/i.test(text)) {
      const hr = new Date().getHours();
      return R(`${hr < 5 ? '這麼晚了還沒睡嗎，主人' : hr < 11 ? '主人早安' : hr < 18 ? '主人午安' : '主人晚安'}。今天想讓長門櫻陪你做什麼呢？我會一直在這裡。`, START, 'smile');
    }
    if (/幾點|時間|what time/.test(t)) { const d = new Date(); return R(`現在是 ${two(d.getHours())}:${two(d.getMinutes())}。主人，要不要也讓眼睛休息一下？`, ['今天幾號？', '夜間光', '系統狀態']); }
    if (/日期|幾號|星期|今天.*(幾|哪)/.test(t)) { const d = new Date(); return R(`今天是 ${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日，${WEEK[d.getDay()]}。`, ['現在幾點？', '系統狀態']); }

    // ---- notes: 記下 …
    const note = /^(?:幫我)?(?:記下|記住|記一下|備忘|筆記)[：:，,\s]*(.+)$/.exec(text);
    if (note) {
      return R(`記好了，主人。寫在「文件／備忘.txt」裡。`, ['打開備忘', '找 備忘', '系統狀態'], 'smile', async () => {
        const d = new Date(), line = `${d.getFullYear()}/${two(d.getMonth() + 1)}/${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}　${note[1].trim()}\n`;
        const docs = fs.dir('docs'), old = fs.named(docs, '備忘.txt');
        if (old && !old.dir) fs.writeText(old, (await fs.text(old)) + line); else await fs.create(docs, '備忘.txt', { text: line });
      });
    }
    if (/打開備忘|開啟備忘|看備忘/.test(t)) { const n = fs.named(fs.dir('docs'), '備忘.txt'); return n ? R('這就打開備忘。', START, null, () => os.launch('notes', { node: n })) : R('還沒有備忘。說「記下 ……」我就會幫主人寫下來。', ['記下 喝水']); }

    // ---- files: 找 …
    const find = /^(?:幫我)?(?:找|搜尋|尋找|search)[：:\s]*(.+)$/i.exec(text);
    if (find && !appOf(find[1])) {
      const hits = fs.find(find[1].trim(), 5);
      if (!hits.length) return R(`找不到名稱裡有「${find[1].trim()}」的檔案。`, ['打開檔案總管', '找 歡迎']);
      return R(`找到 ${hits.length} 個：\n${hits.map((n) => `· ${fs.path(n)}`).join('\n')}\n我先打開第一個。`, ['打開檔案總管'], null, () => os.openNode(hits[0]));
    }

    // ---- arithmetic
    const mathText = text.replace(/^(?:幫我)?(?:算一下|算|計算|calc)[：:\s]*/i, '').replace(/[=＝?？]+$/, '').replace(/等於(多少|幾)?$/, '');
    if (looksLikeMath(mathText)) {
      try { return R(`${mathText.trim()} ＝ ${format(evaluate(mathText))}`, ['打開計算機', '(1 + 2) ^ 10', 'sqrt(2)']); } catch (e) { return R(`這個式子我算不出來：${e.message}。`, ['打開計算機']); }
    }

    // ---- windows and applications
    if (/關(閉|掉)(所有|全部)|全部關/.test(t)) return R(wm.wins.length > 1 ? '好的，把其他視窗都收起來。' : '現在只有我這個視窗。', START, null, async () => { for (const w of [...wm.wins]) if (w !== win) await wm.close(w); });
    if (/(工作)?總覽|所有視窗|overview/.test(t)) return R('這是目前工作區的所有視窗。', START, null, () => wm.setOverview(true));
    if (/顯示桌面|回到桌面|看桌面/.test(t)) return R('桌面在這裡。再說一次我就把視窗放回來。', ['顯示桌面'], null, () => { wm.showDesktop(); });
    if (/鎖定|鎖起來|lock/.test(t)) return R('好的，先鎖起來。', START, null, () => setTimeout(() => os.lock(), 700));
    const ws = /(?:工作區|桌面|workspace)\s*(\d)|(下一個|上一個)(?:工作區|桌面)/.exec(t);
    if (ws) {
      const n = cfg.get('spaces').length, i = ws[1] ? Number(ws[1]) - 1 : (wm.ws + (ws[2] === '下一個' ? 1 : n - 1)) % n;
      if (i < 0 || i >= n) return R(`現在只有 ${n} 個工作區。`, ['到工作區 1', '系統狀態']);
      return R(`前往工作區 ${two(i + 1)}「${cfg.get('spaces')[i].name}」。我會跟著過去。`, ['下一個工作區', '工作總覽'], null, () => { wm.sendTo(win, i); wm.setWs(i); });
    }
    const app = appOf(t);
    if (app && /開|啟動|執行|open|launch|run|start|看|給我|用/.test(t)) return R(`遵命，主人。我現在就幫你開啟${app.name}。`, ['再開一個應用程式', '工作總覽', '系統狀態'], 'smile', () => os.launch(app.id));
    if (app && text.length <= app.name.length + 2) return R(`要開啟${app.name}嗎？這就幫主人打開。`, START, null, () => os.launch(app.id));
    if (/再開一個/.test(t)) return R('要開哪一個呢？', ['打開記事本', '打開相簿', '打開遊戲中心', '打開系統監控']);

    // ---- wallpaper and scene
    const scene = Object.entries(SCENES).find(([id, s]) => t.includes(s.name) || t.includes(id) || t.includes(s.en.toLowerCase()));
    if (scene) {
      if (!os.env.stage.available) return R('這個瀏覽器沒有 WebGL，世界的場景顯示不出來，只能用插畫當桌布。', ['換個桌布']);
      return R(`這就帶主人到「${scene[1].name}」。`, ['換個場景', '換個桌布', '系統狀態'], null, () => setScene(scene[0]));
    }
    const wall = WALLS.find((w) => t.includes(w.name) || t.includes(w.id));
    if (wall) return R(`換成「${wall.name}」了。`, ['換個桌布', '回到即時場景'], 'smile', () => cfg.set('wall', `img:${wall.id}`));
    if (/即時場景|動態桌布|回到世界/.test(t)) return R(os.env.stage.available ? '回到世界裡了。' : '這個瀏覽器沒有 WebGL，沒辦法顯示即時場景。', ['換個場景'], null, () => { if (os.env.stage.available) cfg.set('wall', 'live'); });
    if (/(換|下一).*(場景|地點|地方)/.test(t)) {
      if (!os.env.stage.available) return R('這個瀏覽器沒有 WebGL，沒辦法顯示即時場景。', ['換個桌布']);
      const ids = Object.keys(SCENES), now = cfg.get('spaces')[wm.ws].scene, next = ids[(ids.indexOf(now) + 1) % ids.length];
      return R(`這次到「${SCENES[next].name}」。`, ['換個場景', '換個桌布'], null, () => setScene(next));
    }
    if (/(換|下一|改).*(桌布|背景|壁紙)|桌布/.test(t)) {
      const cur = cfg.get('wall'), i = WALLS.findIndex((w) => cur === `img:${w.id}`), next = WALLS[(i + 1) % WALLS.length];
      return R(`換成「${next.name}」。想回到世界裡的話，說「回到即時場景」。`, ['換個桌布', '回到即時場景'], 'smile', () => cfg.set('wall', `img:${next.id}`));
    }

    // ---- system switches
    if (/淺色|亮色|白色/.test(t)) return R('換成淺色面板了。', ['深色面板', '系統狀態'], null, () => cfg.set('tone', 'light'));
    if (/深色|暗色|黑色/.test(t)) return R('換回深色面板了。', ['淺色面板', '系統狀態'], null, () => cfg.set('tone', 'dark'));
    if (/夜間|護眼|暖色/.test(t)) { const on = !/關|取消|不要/.test(t) && !(cfg.get('night') && !/開/.test(t)); return R(on ? '夜間光打開了，眼睛會舒服一點。' : '夜間光關掉了。', ['夜間光', '亮度 70'], null, () => cfg.set('night', on)); }
    if (/滿版|全螢幕|隱藏.*(導覽|標題)/.test(t)) { const on = !/關|取消|離開|退出/.test(t) && !(cfg.get('focus') && !/開/.test(t)); return R(on ? '進入滿版模式：網站上方的導覽列先收起來。' : '滿版模式結束，導覽列回來了。', ['滿版模式'], null, () => cfg.set('focus', on)); }
    if (/勿擾/.test(t)) { const on = !/關|取消/.test(t) && !(cfg.get('dnd') && !/開/.test(t)); return R(on ? '勿擾開啟：通知只會安靜地放進通知面板。' : '勿擾關閉了。', START, null, () => cfg.set('dnd', on)); }
    if (/取消靜音|解除靜音|開聲音/.test(t)) return R('聲音回來了。', ['音量 50'], null, () => cfg.set('mute', false));
    if (/靜音|安靜|mute/.test(t)) return R('已經靜音。', ['取消靜音'], null, () => cfg.set('mute', true));
    if (/音量|聲音|volume/.test(t)) {
      const n = num(t), v = n != null ? n : /大|高|up/.test(t) ? clamp(cfg.get('vol') + 15, 0, 100) : /小|低|down/.test(t) ? clamp(cfg.get('vol') - 15, 0, 100) : null;
      if (v == null) return R(`現在音量是 ${cfg.get('vol')}${cfg.get('mute') ? '（靜音中）' : ''}。可以說「音量 40」。`, ['音量 40', '靜音']);
      return R(`音量調到 ${v}。`, ['靜音', '系統狀態'], null, () => { cfg.set('vol', v); cfg.set('mute', false); });
    }
    if (/亮度|太亮|太暗|brightness/.test(t)) {
      const n = num(t), v = clamp(n != null ? n : /太亮|暗一點|低/.test(t) ? cfg.get('bright') - 15 : cfg.get('bright') + 15, 50, 100);
      return R(`亮度調到 ${v}%。`, ['亮度 100', '夜間光'], null, () => cfg.set('bright', v));
    }
    if (/音效/.test(t)) { const on = !/關|取消/.test(t); return R(on ? '系統音效打開了。' : '系統音效關掉了。', START, null, () => cfg.set('sound', on)); }

    // ---- status
    if (/系統|狀態|用量|儲存|容量|status/.test(t)) {
      const u = fs.usage(), sp = cfg.get('spaces')[wm.ws];
      return R(`系統已經運作 ${span((Date.now() - os.bootAt) / 1000)}。\n· 工作區 ${two(wm.ws + 1)}「${sp.name}」，開著 ${wm.wins.length} 個視窗\n· ${u.count} 個檔案，共 ${bytes(u.text + u.blobs)}\n· 桌布：${os.root.dataset.wall === 'live' ? `即時場景 ${(SCENES[sp.scene] || SCENES.gate).name}` : '靜態圖片'}\n· 網路：${navigator.onLine ? '已連線' : '離線'}`, ['打開系統監控', '工作總覽']);
    }

    // ---- small talk (the lines she has always had)
    if (/你是誰|妳是誰|自我介紹|介紹.*自己|叫什麼/.test(t)) return R('我是長門櫻，你的 AI 女僕，也是這套系統的管家。除了陪你說話，我能幫你開啟應用程式、整理桌面、調整系統——想知道全部，說「說明」。', ['你可以做什麼？', '系統狀態'], 'smile');
    if (/謝謝|感謝|多虧|thank/.test(t)) return R('能幫上主人我很開心。你只要開口，我就會立刻回應你。', START, 'smile');
    if (/累|壓力|煩|焦慮|難過|沮喪|孤單|低落|想哭/.test(t)) return R('辛苦了，主人。先深呼吸三次，好嗎？你不用一個人撐著，我會陪你慢慢把事情整理好。', ['夜間光', '記下 今天先休息', '換個場景'], 'shy');
    if (/可愛|漂亮|喜歡(你|妳)|愛(你|妳)/.test(t)) return R('主、主人突然這麼說……我會更努力的。', START, 'shy');
    if (/笨|爛|沒用|討厭/.test(t)) return R('對不起，主人。我會的事還不多——告訴我哪裡做不好，我記下來。', ['你可以做什麼？'], 'shy');
    if (/再見|掰|bye|晚點見/.test(t)) return R('主人慢走。我會在這裡等你回來。', START, 'smile');

    return R(`主人，這句我還聽不懂。我在這套系統裡是照關鍵字辦事的，沒有接上語言模型——說「說明」可以看我會做的事。`, ['你可以做什麼？', '系統狀態', '打開檔案總管'], 'shy');
  }

  // ================================================================ interface
  const stageEl = h('div', { class: 'sk-stage' });
  const logEl = h('div', { class: 'sk-log os-text', role: 'log', 'aria-live': 'polite' });
  const chipsEl = h('div', { class: 'sk-chips' });
  const input = h('textarea', { class: 'os-input sk-in', rows: 1, placeholder: '對長門櫻說……', 'aria-label': '訊息', spellcheck: false });
  const form = h('form', { class: 'sk-form' }, input, tool('send', '送出（Enter）', { type: 'submit', class: 'os-tool sk-send' }));
  win.body.append(h('div', { class: 'sk' }, stageEl,
    h('div', { class: 'sk-chat' },
      h('header', { class: 'sk-head' }, h('div', null, h('b', null, '長門櫻'), h('span', null, 'NS-V5 · 本機指令解析 · 不連網')), tool('trash', '清除對話', { onclick: () => { log = []; state.set('log', log); drawLog(); chips(START); } })),
      logEl, chipsEl, form)));

  const stamp = (at) => { const d = new Date(at); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
  const bubble = (m) => h('div', { class: `sk-msg sk-msg--${m.r}` }, h('p', null, m.t), h('i', null, stamp(m.at)));
  function drawLog() {
    logEl.replaceChildren(...(log.length ? log.map(bubble) : [h('p', { class: 'sk-empty' }, '主人，有什麼吩咐嗎？')]));
    logEl.scrollTop = logEl.scrollHeight;
  }
  const chips = (list) => chipsEl.replaceChildren(...list.slice(0, 4).map((c) => h('button', { type: 'button' }, c)));
  function push(r, t) {
    const m = { r, t, at: Date.now() };
    log.push(m); if (log.length > 120) log.shift();
    state.set('log', log);
    logEl.querySelector('.sk-empty')?.remove();
    logEl.append(bubble(m));
    logEl.scrollTop = logEl.scrollHeight;
  }
  let thinking = 0;
  function send(text) {
    text = String(text).trim().slice(0, 300);
    if (!text) return;
    push('u', text);
    const wait = h('div', { class: 'sk-msg sk-msg--a sk-wait' }, h('p', null, h('i'), h('i'), h('i')));
    logEl.append(wait); logEl.scrollTop = logEl.scrollHeight;
    const my = ++thinking;
    setTimeout(async () => {
      wait.remove();
      if (!win.el.isConnected) return;
      let out;
      try { out = brain(text); } catch (e) { console.error(e); out = { say: '我這裡出了點差錯，沒能處理這句話。', chips: START, mood: 'shy' }; }
      push('a', out.say);
      if (my === thinking) chips(out.chips || START);
      speak(out.say, out.mood);
      if (out.act) { try { await out.act(); } catch (e) { push('a', `沒有成功：${e.message || e}`); speak('', 'shy'); } }
    }, reducedMotion() ? 0 : 320 + Math.min(500, text.length * 16));
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; input.style.height = ''; send(v); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = ''; input.style.height = `${Math.min(96, input.scrollHeight + 2)}px`; });
  chipsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) send(b.textContent); });

  // ================================================================ the figure
  let stage = null, pup = null, raf = 0, last = 0, skip = false, talk = 0, talkT = 0, nod = 0, mood = null, moodK = 0, moodUntil = 0, faces = [], role = {};
  const S = { cam: { cx: 0, cy: 0, sx: 0, sy: 0, s: 1 }, sheet: 0, sheetSide: 1, wire: 0, fill: 1, fan: 0, angle: 0, spread: 0, lift: 0, skew: 0, hi: -1, frame: 0, grid: 0 };
  const ptr = { x: 0, y: 0, at: 0 };
  const low = quality() === 'low';
  function speak(text, m) {
    if (!pup) return;
    if (!reducedMotion() && text) { talk = clamp(0.3 + text.length * 0.06, 0.6, 2.6); talkT = 0; nod = 1; }
    if (m) { mood = faces.find((f) => f.id === m) || null; moodUntil = performance.now() + 2600; }
    run();
  }
  function fit() {
    if (!stage || !pup) return;
    stage.resize();
    const w = stageEl.clientWidth, hh = stageEl.clientHeight, b = pup.bounds, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (!w || !hh) return;
    // head to waist when the box is short for her, the whole figure when it is tall
    const full = Math.min((hh * 0.98) / bh, (w * 0.98) / bw), bust = Math.min(hh / (bh * 0.52), w / (bw * 0.6));
    const tall = hh / w > 1.7;
    const s = tall ? full : bust;
    S.cam.s = s; S.cam.cx = (b.x0 + b.x1) / 2; S.cam.sx = w / 2;
    if (tall) { S.cam.cy = (b.y0 + b.y1) / 2; S.cam.sy = hh - 2 - (bh * s) / 2; } else { S.cam.cy = pup.face.y; S.cam.sy = hh * 0.34; }
    if (!stage.lost) stage.draw(S);            // a resized canvas is empty until it is drawn again
  }
  function hook(p) {
    const v = p.P.values, idx = (r) => p.index(role[r]);
    if (mood && moodK > 0.004) for (const [r, val] of mood.set) { const i = idx(r); if (i >= 0) v[i] += ((val === 'max' ? p.P.max[i] : val === 'min' ? p.P.min[i] : val) - v[i]) * moodK; }
    if (nod > 0.01) p.add('ParamAngleY', -9 * nod);
    if (talk > 0) { const i = idx('open'); if (i >= 0) v[i] = Math.max(v[i], Math.min(1, talk * 2.5) * (0.12 + 0.6 * Math.abs(Math.sin(talkT * 10.7) * Math.sin(talkT * 3.9 + 1)))); }
  }
  function frame(t) {
    raf = 0;
    if (!pup || !stage || stage.lost || !win.el.isConnected) return;
    const visible = !win.min && win.ws === wm.ws && !document.hidden;
    if (visible) {
      raf = requestAnimationFrame(frame);
      if (low && (skip = !skip)) return;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const still = reducedMotion(), r = stageEl.getBoundingClientRect(), c = S.cam;
      const fx = r.left + c.sx + (pup.face.x - c.cx) * c.s, fy = r.top + c.sy - (pup.face.y - c.cy) * c.s;
      const follow = t - ptr.at < 4000 ? 1 : 0;
      pup.look.x = clamp((ptr.x - fx) / (innerWidth * 0.4), -1, 1) * follow;
      pup.look.y = clamp((fy - ptr.y) / (innerHeight * 0.4), -1, 1) * follow;
      pup.idle = !still;
      talkT += dt; talk = Math.max(0, talk - dt); nod *= Math.exp(-dt * 5);
      const want = mood && t < moodUntil ? 1 : 0;
      moodK += (want - moodK) * (still ? 1 : 1 - Math.exp(-dt * (want ? 9 : 4)));
      if (moodK < 0.004 && !want) { moodK = 0; mood = null; }
      pup.hook = hook;
      pup.update(dt);
      stage.draw(S);
    }
  }
  function run() { if (!raf && pup && stage) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const onMove = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.at = performance.now(); };
  addEventListener('pointermove', onMove, { passive: true });
  const ro = new ResizeObserver(fit);
  ro.observe(stageEl);
  const wake = os.bus.on('wm', run), wake2 = os.bus.on('ws', run);
  document.addEventListener('visibilitychange', run);
  win.cleanup.push(() => {
    cancelAnimationFrame(raf); raf = 0;
    removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', run);
    ro.disconnect(); wake(); wake2();
    try { stage?.dispose(); } catch { /* the context is already gone */ }
    stage = null; pup = null;
  });

  drawLog();
  chips(START);
  if (!matchMedia('(pointer: coarse)').matches) input.focus({ preventScroll: true });
  if (args.ask) send(args.ask);

  // the figure arrives after the window is usable: the chat never waits for a model download
  (async () => {
    stageEl.classList.add('is-loading');
    try {
      const [puppet, stageMod, data] = await Promise.all([import('../../live2d/puppet.js'), import('../../live2d/stage.js'), import('../../data/live2d.js')]);
      const def = data.models.find((m) => m.id === 'ns-v5') || data.models[0];
      const img = new Image();
      img.decoding = 'async';
      img.src = def.tex[1];
      const [p] = await Promise.all([puppet.loadPuppet(def), img.decode()]);
      if (!win.el.isConnected) return;
      const canvas = h('canvas', { class: 'sk-canvas', 'aria-hidden': 'true' });
      stageEl.append(canvas);
      stage = stageMod.createStage(canvas, { maxDpr: low ? 1.5 : 2 });
      if (!stage) throw new Error('WebGL is not available');
      pup = p; faces = data.faces; role = { ...data.roles, ...(def.roles || {}) };
      pup.resetPose(); pup.physics?.reset();
      if (def.outfit && def.outfits) pup.setPose(def.outfit, def.outfits[0][1]);
      stage.setPuppet(pup, img, def.crop);
      S.sheetSide = pup.canvas.h;
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
      stageEl.classList.remove('is-loading');
      stageEl.classList.add('is-on');
      fit();
      run();
      speak('', 'smile');
    } catch (e) {
      console.warn('[os] the assistant has no figure', e);
      stageEl.classList.remove('is-loading');
      stageEl.classList.add('is-failed');
      stageEl.append(h('p', null, /WebGL/.test(String(e && e.message)) ? '這個瀏覽器無法顯示 Live2D（需要 WebGL）。對話仍然可以用。' : '模型沒有載入成功。對話仍然可以用。'));
    }
  })();

  return { open: (a) => { if (a.ask) send(a.ask); } };
}
