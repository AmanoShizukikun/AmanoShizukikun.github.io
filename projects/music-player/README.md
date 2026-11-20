# music-player

## Overview
`music-player.html` 為「音樂播放器 - Cyber Nexus」，是一個全螢幕鎖定視窗的賽博龐克風格單頁音樂播放器，結合全站共用導覽與設定面板，提供 3D 專輯封面拖曳輪播、左側滑入式播放清單抽屜、可點擊與拖曳的進度條、靜音音量記憶及全域鍵盤快捷鍵操作。

## Interface
- **曲目資料與模組狀態**：
  - `[music-player.html:songs]`（2 首曲目陣列，含 `title`、`artist`、`src`、`cover`、`youtube`）。
  - 狀態變數：`[music-player.html:currentSongIndex]`、`[music-player.html:isPlaying]`、`[music-player.html:isDragging]`、`[music-player.html:startX]`、`[music-player.html:currentTranslate]`、`[music-player.html:prevTranslate]`、`[music-player.html:dragThreshold]`（`50`）、`[music-player.html:isProgressDragging]`、`[music-player.html:resizeTimer]`。
- **播放控制與輪播函式**：
  - `[music-player.html:init]`、`[music-player.html:generateAlbumSlides]`、`[music-player.html:updateSlides]`、`[music-player.html:generatePlaylist]`、`[music-player.html:updatePlaylistHighlight]`、`[music-player.html:loadSong]`、`[music-player.html:togglePlay]`、`[music-player.html:playSong]`、`[music-player.html:pauseSong]`、`[music-player.html:prevSong]`、`[music-player.html:nextSong]`。
- **拖曳、進度條、清單與音量函式**：
  - `[music-player.html:initDragEvents]`、`[music-player.html:dragStart]`、`[music-player.html:drag]`、`[music-player.html:dragEnd]`、`[music-player.html:initPlaylistEvents]`、`[music-player.html:togglePlaylist]`、`[music-player.html:closePlaylist]`、`[music-player.html:updateProgress]`、`[music-player.html:setProgress]`、`[music-player.html:initProgressDragEvents]`、`[music-player.html:progressDragStart]`、`[music-player.html:progressDrag]`、`[music-player.html:progressDragEnd]`、`[music-player.html:formatTime]`、`[music-player.html:updateVolumeIcon]`、`[music-player.html:toggleMute]`。
- **DOM 介面、CSS 鉤子與外部相依**：
  - 核心媒體與播放器節點：`[music-player.html:#audio-element]`（`<audio>`）、`#player-wrapper`（`.playing`）、`#album-slider`、`#album-track`（`.dragging`、`.album-slide.active/.prev/.next`）、`#track-name`、`#artist-name`、`#progress-container`、`#progress-fill`、`#progress-thumb`、`#current-time`、`#duration`、`#play-pause-btn`、`#play-icon`、`#prev-btn`、`#next-btn`、`#volume-icon`、`#volume-slider`。
  - 清單抽屜與設定／導覽節點：`#playlist-overlay`（`.visible`）、`#playlist-panel`（`.open`）、`#playlist-count`、`#playlist-close`、`#playlist`（`.playlist-item.active`）、`#playlist-toggle`（`.active`）；全站設定控制 `#headerFixed`、`#headerHeight`、`#sideNavTextVisible`、`#themeMode`、`#live2dToggle`、`#backgroundStyle`、`#animationStrength`、`#fpsValue`、`#soundEnabled`、`#navSearch`；淺色主題鉤子 `[data-theme="light"]` 與縮放鎖定類別 `body.resizing`。
  - 初始化與外部相依：`[music-player.html:head-init-script]`、Google Fonts CDN（`Orbitron`、`Rajdhani`）、`../../assets/css/{core,components,animations}.css` 與 `../../assets/js/{core,live2d-manager,navigation,animations}.js`（受 `typeof !== 'undefined'` 保護呼叫 `Core.initBackground`、`Navigation.init`、`Animations.init` 並同步 `window.soundEnabled`）。

## Invariants
- **主題初始化與全頁鎖定佈局**：`[music-player.html:head-init-script]` 預設套用 `data-theme="dark"`，僅當 `headerHeight` 具真值時寫入 `--header-height`，並以 `try/catch` 忽略存取失敗；CSS 強制鎖定視窗捲動（`html, body { overflow: hidden; height: 100%; }`），僅 `.album-slide.active` 開放 `pointer-events: auto`，其餘投影片與圖片停用指標攔截以確保橫向滑動手勢穩定；播放器頂層 DOM 查詢與綁定於 `<body>` 結尾同步執行，要求控制項元素皆已存在。
- **曲目索引循環與 2 曲輪播狀態**：`[music-player.html:prevSong]` 與 `[music-player.html:nextSong]` 以模數 `(index ± 1 + songs.length) % songs.length` 循環切換；`[music-player.html:updateSlides]` 依序比對當前、上一首、下一首索引，因目前 `songs.length === 2` 時 `(i - 1 + 2) % 2 === (i + 1) % 2`，非作用中投影片會優先套用 `.prev` 而不會套用 `.next`。
- **輪播滑動門檻與點擊條件**：`[music-player.html:dragEnd]` 僅在水平移動距離嚴格大於 `50px`（`Math.abs(diff) > dragThreshold`）時切換上一首或下一首；`[music-player.html:generateAlbumSlides]` 僅允許在點擊目前作用中封面（且非拖曳狀態、未點擊 `<a>` 外連按鈕）時觸發 `[music-player.html:togglePlay]`。
- **進度跳轉保護與雙層靜音狀態**：`[music-player.html:setProgress]`、`[music-player.html:progressDrag]`、`[music-player.html:progressDragEnd]` 均先檢查 `!isNaN(duration) && width > 0` 並將比例夾限於 `[0, 1]`，拖曳中 `[music-player.html:updateProgress]` 會提早返回以避免播放事件覆寫拖曳畫面；`[music-player.html:playSong]` 直接呼叫 `audio.play()` 且未附帶 `.catch()` 處理自動播放拒絕，失敗時 UI 狀態仍會先行切為播放中；全站 `#soundEnabled` 控制 `audio.muted`，而 `[music-player.html:toggleMute]` 另行透過 `audio.volume` 與 `audio.dataset.prevVolume`（預設退回 `0.8`）保存並還原音量。
- **視窗縮放防抖與快捷鍵過濾**：`window` `resize` 會掛上 `body.resizing` 停用 CSS transition 並在 `200ms` 後移除；`document` `keydown` 僅在 `e.target.tagName === 'INPUT'` 時略過（不攔截 `<select>` 等其他表單元素），並支援 `Space`、`ArrowLeft`、`ArrowRight`、`ArrowUp`/`ArrowDown`（每次 ±10 且夾限於 `[0, 100]`）、`KeyM`、`KeyP`、`Escape`；於行動寬度（`<= 768px`）點選清單曲目後會自動關閉清單抽屜（`[music-player.html:generatePlaylist]`）。

## Side Effects
- **Web Storage 讀取**：讀取 `localStorage` 的 `'theme'` 與 `'headerHeight'` 鍵（`[music-player.html:head-init-script]`）。
- **媒體串流與音訊操作**：透過 `<audio id="audio-element">` 載入並播放 `assets/songs/*.mp3`，修改 `audio.src`、`audio.volume`、`audio.muted`、`audio.currentTime` 與 `audio.dataset.prevVolume`；專輯封面或清單縮圖載入失敗時於 `<img>` `onerror` 回退至 `../../assets/images/logo.png`（`[music-player.html:loadSong]`、`[music-player.html:generateAlbumSlides]`、`[music-player.html:generatePlaylist]`）。
- **DOM 與樣式突變**：更新 `<html>` 屬性、注入 `.album-slide` 與 `.playlist-item` 節點、更新曲名／歌手／時間／進度條寬度／按鈕 SVG 圖示與 `albumTrack.style.transform`，並切換 `.playing`、`.open`、`.visible`、`.active`、`body.resizing` 等類別。
- **全域監聽器、計時器與外部網路**：於 `document` 註冊 `mousemove`、`mouseup`、`touchmove`、`touchend`、`keydown`、`DOMContentLoaded`，於 `window` 註冊 `resize` 並以 `setTimeout(..., 200)` 防抖；載入 Google Fonts CDN（`Orbitron`、`Rajdhani`）與共用靜態 CSS／JS。

## Verification
- Run: `<test-command>`
