// The applications the WebOS ships with. A module is only downloaded the first time its application is opened.
//   multi   more than one window of it may be open        cat   group in the launcher
//   tint    the application's own colour (its icon and the mark on its windows); the system's accent stays the
//           colour of everything that is "selected" or "active"
export const APPS = [
  { id: 'files', name: '檔案總管', en: 'FILES', code: 'FS', icon: 'folder', tint: '#ffc400', cat: 'sys', multi: true, w: 900, h: 560, minW: 360, minH: 300, keys: 'file explorer finder 資料夾 檔案', load: () => import('./apps/files.js') },
  { id: 'sakura', name: '長門櫻', en: 'ASSISTANT', code: 'NS', icon: 'sakura', tint: '#ff7fa8', cat: 'sys', w: 780, h: 580, minW: 340, minH: 420, keys: 'assistant ai 助理 聊天 nagato sakura', load: () => import('./apps/sakura.js') },
  { id: 'browser', name: '瀏覽器', en: 'BROWSER', code: 'WB', icon: 'globe', tint: '#7fb4d6', cat: 'app', multi: true, w: 1000, h: 640, minW: 360, minH: 300, keys: 'web browser 網頁', load: () => import('./apps/browser.js') },
  { id: 'terminal', name: '終端機', en: 'TERMINAL', code: 'TTY', icon: 'terminal', tint: '#7fd4c1', cat: 'sys', multi: true, w: 740, h: 460, minW: 320, minH: 220, keys: 'shell console cmd 命令 指令', load: () => import('./apps/terminal.js') },
  { id: 'notes', name: '記事本', en: 'NOTES', code: 'TXT', icon: 'note', tint: '#ecebe5', cat: 'app', multi: true, w: 740, h: 520, minW: 320, minH: 240, keys: 'text editor notepad 文字 編輯', load: () => import('./apps/notes.js') },
  { id: 'calc', name: '計算機', en: 'CALCULATOR', code: 'CAL', icon: 'calc', tint: '#ff6a1a', cat: 'app', w: 360, h: 540, minW: 300, minH: 440, keys: 'calculator 計算', load: () => import('./apps/calc.js') },
  { id: 'gallery', name: '相簿', en: 'GALLERY', code: 'IMG', icon: 'image', tint: '#b79cff', cat: 'media', w: 920, h: 600, minW: 340, minH: 300, keys: 'photos pictures 圖片 照片 桌布', load: () => import('./apps/gallery.js') },
  { id: 'media', name: '媒體播放器', en: 'MEDIA PLAYER', code: 'AV', icon: 'music', tint: '#e58cf0', cat: 'media', w: 780, h: 520, minW: 340, minH: 360, keys: 'music video player 音樂 影片 播放', load: () => import('./apps/media.js') },
  { id: 'paint', name: '繪圖板', en: 'PAINT', code: 'PNT', icon: 'brush', tint: '#ff9d5c', cat: 'media', w: 920, h: 620, minW: 360, minH: 320, keys: 'draw canvas 畫圖 繪圖', load: () => import('./apps/paint.js') },
  { id: 'arcade', name: '遊戲中心', en: 'ARCADE', code: 'GC', icon: 'pad', tint: '#ffc400', cat: 'app', w: 900, h: 580, minW: 340, minH: 320, keys: 'games 遊戲', load: () => import('./apps/arcade.js') },
  { id: 'monitor', name: '系統監控', en: 'MONITOR', code: 'MON', icon: 'pulse', tint: '#7fd4c1', cat: 'sys', w: 740, h: 520, minW: 340, minH: 320, keys: 'task manager performance 效能 處理程序 工作管理員', load: () => import('./apps/monitor.js') },
  { id: 'settings', name: '設定', en: 'SETTINGS', code: 'CFG', icon: 'gear', tint: '#a9a79f', cat: 'sys', w: 880, h: 580, minW: 340, minH: 320, keys: 'preferences 個人化 桌布 主題 顯示', load: () => import('./apps/settings.js') },
  // a window that runs one game of the arcade; opened by the arcade, never listed
  { id: 'game', name: '遊戲', en: 'GAME', code: 'RUN', icon: 'pad', tint: '#ffc400', cat: null, multi: true, w: 1000, h: 640, minW: 360, minH: 300, load: () => import('./apps/arcade.js').then((m) => ({ start: m.startGame })) },
];
export const CATS = [['sys', '系統'], ['app', '應用程式'], ['media', '媒體']];
export const appById = (id) => APPS.find((a) => a.id === id) || null;
