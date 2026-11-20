// Single source of truth for site-wide data.
// Used by the browser (shell, pages) and by tools/build.mjs (static HTML generation).

export const site = {
  origin: 'https://amanoshizukikun.github.io',
  name: 'AMANO SHIZUKI',
  nameZh: '天野靜樹',
  role: 'AI Developer / System Architect',
  email: 'hackamsk@gmail.com',
  links: [
    { id: 'github', label: 'GitHub', href: 'https://github.com/AmanoShizukikun' },
    { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@Amano_Shizuki_Kun' },
    { id: 'discord', label: 'Discord', href: 'https://discord.gg/jac8eAFzjz' },
  ],
};

// Screens on which the works page stands its list beside the archive helix (works.js) instead of stacking it.
// The inline head script of every page (tools/build.mjs) reads it too: it marks <html> with `wk-staged`
// before the first paint, so a refresh never shows the stacked layout first.
export const WORKS_STAGED = '(min-width: 900px) and (min-aspect-ratio: 5/4) and (min-height: 560px)';

export const nav = [
  { id: 'home', href: '/', zh: '首頁', en: 'INDEX' },
  { id: 'profile', href: '/profile/', zh: '檔案', en: 'PROFILE' },
  { id: 'works', href: '/works/', zh: '作品', en: 'WORKS' },
];

// The works index, in the order the entries are shown everywhere (works page, home chapter 06, menu).
//   src    legacy application document that the shell mounts inside the app frame (→ /apps/<id>/)
//   href   an address outside the site: the entry leads there, in a new tab (see linkAttrs)
//   img    capture under /assets/img/ (null → a drawn placeholder is used)
//   items  what the entry contains. With `src` an item is an application of its own (→ /apps/<id>/);
//          an item whose id equals its parent's opens the parent; without either it is just a label.
//   native a page of the site itself instead of an embedded document ('games', 'sakura', 'live2d', 'music', 'webos', 'lore')
export const works = [
  {
    id: 'nagato-sakura', title: '長門櫻計畫', en: 'NAGATO SAKURA PROJECT', kind: 'AI · LLM', year: '2021—',
    desc: '以大型語言模型為推理核心，透過工具調用串接影像增強、品質評估、自動分類與詐騙簡訊偵測等衍生工具的 AI 助理生態系。',
    tech: ['Python', 'PyTorch', 'LLM', 'Tool Calling'],
    // a page of the site itself (assets/js/pages/sakura.js, content in data/sakura.js), not an embedded document
    src: null, native: 'sakura', img: 'works/nagato-sakura.webp',
  },
  {
    // the game centre is a page of the site itself (assets/js/pages/games.js), not an embedded document: a library
    // that manages its games — every game is opened from there, never straight from the works index.
    //   cat      library category (see `gameCats`)      pad   true → playable with a gamepad
    //   shots    further captures for the detail view     released   ISO date, if known
    //   controls { keys, pad }: [input, what it does] rows shown in the detail view
    id: 'game-center', title: '遊戲中心', en: 'GAME CENTER', kind: 'GAMES', year: '2026',
    desc: '遊戲收藏庫：可以直接在瀏覽器裡玩的遊戲，以及一個遊戲用的工具。支援鍵盤、滑鼠與手把操作。',
    tech: ['Three.js', 'Canvas', 'Web Audio', 'Gamepad API'],
    src: null, native: 'games', img: 'works/game-center.webp',
    items: [
      {
        id: 'cyber-race', title: 'Cyber Race', en: 'TOUGE RACING SIM', note: '3D 山道賽車', input: '鍵盤 · 手把（含震動）', img: 'games/cyber-race.webp',
        cat: 'RAC', pad: true, released: '2026-06-15', tags: ['競速', '3D', '山道', 'AI 對戰'],
        shots: [['games/cyber-race-2.webp', '賽中儀表'], ['games/cyber-race-3.webp', '賽道選擇'], ['games/cyber-race-4.webp', '車輛選擇'], ['games/cyber-race-5.webp', '對手等級']],
        controls: {
          keys: [['W / ↑', '油門'], ['S / ↓', '煞車'], ['A D / ← →', '轉向'], ['Space', '手煞車'], ['R', '氮氣'], ['C / Shift', '離合器'], ['P', '暫停']],
          pad: [['左搖桿', '轉向'], ['RT / LT', '油門 / 煞車'], ['A', '手煞車'], ['B / X', '升檔 / 降檔'], ['Y', '氮氣'], ['LB', '離合器'], ['RB', '切換視角'], ['START', '暫停']],
        },
        desc: '瀏覽器裡的 3D 山道賽車：自製車輛動力學與賽道建構，可選 AI 對戰或計時賽，並附遙測分析器。',
        src: '/legacy/projects/game-center/games/cyberrace/cyberrace.html',
      },
      {
        id: 'snake', title: 'Neon Snake', en: 'ARCADE', note: '貪食蛇', input: '鍵盤（方向鍵 / WASD）· 手把', img: 'games/snake.webp',
        cat: 'ACT', pad: true, released: '2026-01-10', tags: ['經典', '街機', '動作'],
        shots: [['games/snake-2.webp', '遊戲畫面'], ['games/snake-3.webp', '難度選擇'], ['games/snake-4.webp', '遊戲說明']],
        controls: {
          keys: [['方向鍵 / W A S D', '轉向'], ['Space', '暫停']],
          pad: [['十字鍵 / 左搖桿', '轉向'], ['START', '暫停'], ['B', '退出']],
        },
        desc: '貪食蛇：四種難度，吃到食物會變長，撞到牆或自己的身體就結束。',
        src: '/legacy/projects/game-center/games/snake/snake.html',
      },
      {
        id: 'piano', title: 'Cyber Piano', en: 'SYNTHESIZER', note: '合成器鋼琴', input: '鍵盤 · 滑鼠', img: 'games/piano.webp',
        cat: 'MUS', pad: false, released: '2025-11-20', tags: ['音樂', '合成器', '彈奏'],
        shots: [['games/piano-2.webp', '彈奏中']],
        controls: {
          keys: [['A S D F G H J K L ;', '白鍵 C4 – E5'], ['W E T Y U O P', '黑鍵'], ['滑鼠 / 觸控', '直接點琴鍵']],
        },
        desc: '用電腦鍵盤彈奏的合成器：可切換音色波形與延音，並即時顯示波形。',
        src: '/legacy/projects/game-center/games/piano/piano.html',
      },
      {
        id: 'wall-climber', title: 'Wall Climber', en: 'FIRST-PERSON CLIMBING', note: '攀牆動作', input: '鍵盤 · 滑鼠 · 手把', img: 'games/wall-climber.webp',
        cat: 'ACT', pad: true, released: '2026-03-12', tags: ['攀爬', '第一人稱', '3D', '動作'],
        shots: [['games/wall-climber-2.webp', '主選單'], ['games/wall-climber-3.webp', '暫停選單']],
        controls: {
          keys: [['W A S D', '移動'], ['滑鼠', '視角'], ['Space', '跳躍 · 攀爬'], ['C / Ctrl', '蹲下 · 滑行'], ['Shift', '切換跑步'], ['Esc', '暫停']],
          pad: [['左搖桿', '移動'], ['右搖桿', '視角'], ['A', '跳躍 · 攀爬'], ['B', '蹲下 · 滑行'], ['X / L3', '切換跑步'], ['START', '暫停']],
        },
        desc: '第一人稱攀牆：跳躍、跑牆與耐力管理，一路往上爬，場景會隨時間從早晨走到夜晚。',
        src: '/legacy/projects/game-center/games/wallclimber/wallclimber.html',
      },
      {
        id: 'forza', title: 'FH6 調教計算器', en: 'TUNING CALCULATOR', note: '遊戲工具', input: '鍵盤 · 滑鼠', img: 'games/forza.webp',
        cat: 'TOOL', pad: false, released: null, tags: ['工具', '調教', 'Forza Horizon 6'],
        shots: [['games/forza-2.webp', '調教推薦'], ['games/forza-3.webp', '快速診斷']],
        desc: '《極限競速：地平線 6》通用調教計算器：依車輛規格推算懸吊、定位與差速器設定，可生成等比齒比，並附症狀診斷。',
        src: '/legacy/projects/forza-tuning-calculator/forza-tuning-calculator.html',
      },
    ],
  },
  {
    // a page of the site itself (assets/js/pages/webos.js; the system lives in assets/js/os/), not an embedded document
    id: 'webos', title: 'WebOS', en: 'DESKTOP IN A BROWSER', kind: 'WEB APP', year: '2025—',
    desc: '在瀏覽器裡執行的桌面作業系統：多視窗與貼齊、工作區、檔案系統、檔案總管、終端機與十多個內建應用程式。桌布是首頁那個世界，每個工作區是其中一個地點。',
    tech: ['JavaScript', 'WebGL', 'IndexedDB', 'Web Audio'],
    src: null, native: 'webos', img: 'works/webos.webp',
  },
  {
    // a page of the site itself (assets/js/pages/music.js, content in data/music.js). Item ids are the track ids of
    // that page — /apps/music/#<id> opens it with that track on the turntable.
    id: 'music', title: '音樂播放器', en: 'MUSIC WORKS', kind: 'MUSIC', year: '2025—',
    desc: '原創音樂的播放器。日蝕是唱盤：日冕畫到哪裡，歌就播到哪裡；盤面上一圈一圈靠近的，是接下來幾秒的聲音。',
    tech: ['JavaScript', 'Canvas', 'Media Session', 'FFT'],
    src: null, native: 'music', img: 'works/music.webp',
    items: [{ id: 'sakura-room', title: '長門桜の部屋', note: '2026' }, { id: 'dream-mirror', title: '夢界鏡廻', note: 'Intro · 2025' }],
  },
  {
    id: 'ns-room', title: '3D 作品', en: '3D WORKS', kind: 'WebGL · 3D', year: '2026',
    desc: '以 Three.js 製作的 3D 場景。目前收錄可自由走訪、切換時段與視角的房間導覽。',
    tech: ['Three.js', 'glTF'],
    src: '/legacy/projects/game-center/games/nsroom/nsroom.html', img: 'works/room.webp',
    items: [{ id: 'ns-room', title: '長門櫻的房間', note: '3D 房間導覽' }],
  },
  {
    // a page of the site itself (assets/js/pages/live2d.js, content in data/live2d.js): the models run live on it.
    // Item ids are the model ids of that page — /apps/live2d/#<id> opens it with that model on stage.
    id: 'live2d', title: 'Live2D 作品', en: 'LIVE2D MODELS', kind: 'LIVE2D', year: '2021—',
    desc: '自製的 Live2D 角色模型。她們在頁面上即時運算：可以拆回貼圖、看每個零件的網格與圖層、拉動每一個參數，看頭髮怎麼被重力帶著走。',
    tech: ['Live2D Cubism', 'WebGL', 'Cubism Core'],
    src: null, native: 'live2d', img: 'works/live2d.webp',
    items: [{ id: 'ns-v5', title: 'NS-V5', note: '長門櫻' }, { id: 'l2d-cmt-01', title: 'L2D-CMT-01', note: 'SUMI' }, { id: 'wl2d-01', title: 'WL2D-01', note: '三和音' }],
  },
  {
    // a page of the site itself (assets/js/pages/lore.js, content in data/lore.js). Item ids are the character ids
    // of that page — /apps/nijigen/#<id> opens it on that character.
    id: 'nijigen', title: '世界觀', en: 'WORLD SETTING', kind: 'LORE', year: '2025—',
    desc: '常夜界的檔案：一棵托著所有世界的樹。十個地域、八個種族、十二位角色，以及從「剪枝」到「來訪者」的十六章故事。',
    tech: ['世界設定', '角色設計', '插畫演出'],
    src: null, native: 'lore', img: 'works/nijigen.webp',
    items: [{ id: 'shizuki', title: '天野靜樹', note: 'AS-00' }, { id: 'miwa', title: '三和音', note: 'OB-03' }, { id: 'sakura', title: '長門櫻', note: 'NS-00' }, { id: 'byakuya', title: '白夜', note: 'GD-00' }],
  },
  {
    // not a page of the site: the entry leads out to the repositories on GitHub
    id: 'github', title: 'GitHub 開源倉庫', en: 'OPEN SOURCE REPOSITORIES', kind: 'OPEN SOURCE', year: '2021—',
    desc: '公開在 GitHub 上的原始碼：長門櫻計畫的語言模型、影像增強與評估工具，這個網站本身，以及其他練習與小品。',
    tech: ['Python', 'PyTorch', 'JavaScript', 'Git'],
    src: null, href: 'https://github.com/AmanoShizukikun', img: 'works/github.webp',
  },
];

// library categories of the game centre, in tab order
export const gameCats = [['RAC', '競速'], ['ACT', '動作'], ['MUS', '音樂'], ['TOOL', '工具']];

// every application that gets a route of its own: the entries with a document, plus the items inside them
// `back` = where the header's back control leads when the visitor opened the page directly
export const apps = works.flatMap((w) => [
  ...(w.src ? [{ id: w.id, title: w.title, en: w.en, desc: w.desc, src: w.src, back: '/works/' }] : []),
  ...(w.items || []).filter((i) => i.src).map((i) => ({
    id: i.id, title: i.title, en: i.en || w.en, desc: i.desc || `${i.title}（${w.title}）：${i.note || w.desc}`, src: i.src,
    back: w.native ? `/apps/${w.id}/` : '/works/',
  })),
]);

/** Where an entry or an item leads: an address outside the site, its application, or its place on the works page. */
export const hrefOf = (w) => w.href || (w.src || w.native || apps.some((a) => a.id === w.id) ? `/apps/${w.id}/` : `/works/#${w.id}`);
/** Extra attributes for a link to an entry: one that leaves the site opens in a new tab (the router leaves it alone). */
export const linkAttrs = (w) => (w.href ? ' target="_blank" rel="noopener noreferrer"' : '');
export const workById = (id) => works.find((w) => w.id === id);
