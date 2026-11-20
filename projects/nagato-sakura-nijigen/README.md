# nagato-sakura-nijigen

## Overview
`nagato-sakura-nijigen` 為「長門櫻｜二次元風格展示頁」（`nagato-sakura-nijigen.html`），採用獨立的深色科幻頁面架構與 7 大全螢幕章節（Index/Hero、PV、Profile、Abilities、Timeline、System、Gallery），透過 `./js/README.md` 下的四支前端腳本驅動載入進度遮罩、10 組 `<canvas>` 即時視覺效果、像素點陣粒子重組、全螢幕宣傳影片控制與多標籤頁互動介面。

## Interface
- **子目錄腳本契約**：[./js/README.md](./js/README.md) — 提供全頁粒子系統（`[particles.js:window.ParticleSystems]`：`BackgroundParticles`、`LoadingBackground`、`CardVisual`、`AbilityVisual`、`SystemDiagram`、`GalleryVisual`、`HeroCanvas`）、點陣粒子重組引擎（`[ark-particles.js:window.ArkParticles]`：`ArkController` 等）、DOM 互動控制器（`[animations.js:AnimControllers]`：`LoadingController`、`NavController`、`AbilityTabsController`、`VoiceController`、`CursorController`、`MobileNavController`、`ScrollHintController` 與 `'loading-done'` 事件）及生命週期入口（`[main.js:init]`、`[main.js:onLoadingDone]`、`[main.js:startRenderLoop]`）。
- **全域覆蓋層與導覽骨架**：
  - 載入畫面 `[nagato-sakura-nijigen.html:#loading-screen]`：包含 `#loading-canvas`、`#bar-top`、`#bar-bottom`、`#loading-percent`、`#loading-status-text`。
  - 全域視覺與導覽控制：`[nagato-sakura-nijigen.html:#cursor-follower]`（僅桌機顯示）、`[nagato-sakura-nijigen.html:#bg-particles]`、`[nagato-sakura-nijigen.html:#main-nav]`（含 7 個 `.nav-link[data-idx="0..6"]` 與頁碼計數器 `#nav-current`）、`[nagato-sakura-nijigen.html:#mobile-toggle]`、`[nagato-sakura-nijigen.html:#scroll-hint]`、`[nagato-sakura-nijigen.html:#main-content]`。
- **7 大互動章節 DOM 介面**：
  - `#hero`：`#hero-canvas`、5 個 `.fadeline[data-delay="0..4"]`、`[nagato-sakura-nijigen.html:#ark-canvas]`（`width="400" height="480"`）與 `#ark-btns` 內的 6 個 `.ark-btn[data-ark-idx="0..5"]`（`PORTRAIT`、`NS`、`SAKURA`、`長門櫻`、`FOX`、`HEX`）。
  - `#pv`：`[nagato-sakura-nijigen.html:#pv-video]`（`<video autoplay muted loop playsinline preload="auto">` 載入 `videos/NS-PV1.mp4`）、`#pv-mute-btn`（含 `#pv-icon-muted`／`#pv-icon-sound`）與 `#pv-play-btn`（含 `#pv-icon-pause`／`#pv-icon-play`）。
  - `#profile`：`#card-canvas`、6 項能力參數條與 4 個 `.voice-item` 語音台詞切換項。
  - `#abilities`：7 個 `.atab[data-tab="0..6"]` 與 `.apanel[data-panel="0..6"]`，其中 Panel 0 內嵌 `#ability-canvas`。
  - `#timeline`：5 個 `.tl-item` 時序節點（`--i:0..4`）。
  - `#system`：`#system-canvas` 與 1 個中央／7 個衛星 `.sys-node`。
  - `#gallery`：`#gal-canvas-1`～`#gal-canvas-3` 與外部／站內導向連結、`.site-footer`。
- **靜態樣式與外部字體**：載入本地 `css/style.css`、`css/sections.css`、`css/animations.css`、圖示 `../../assets/images/logo.png` 及 Google Fonts CDN（`Orbitron`、`Rajdhani`、`Noto Sans TC`、`Zen Kaku Gothic New`），無外部 JS 函式庫。

## Invariants
- **底部腳本同步載入順序**：`[nagato-sakura-nijigen.html:scripts]` 於 `<body>` 結尾不使用 `async` 或 `defer`，必須嚴格維持 `js/particles.js` → `js/ark-particles.js` → `js/animations.js` → `js/main.js` 之順序，確保 `[main.js:IIFE]` 同步擷取全域命名空間與 `[animations.js:LoadingController.init]` 取得 `window.ParticleSystems`。
- **DOM 結構與畫布尺寸契約**：
  - `[nagato-sakura-nijigen.html:#ark-canvas]` 固定宣告 HTML 屬性 `width="400" height="480"`，滿足 `[ark-particles.js:ArkController.init]` 立即呼叫 `getImageData` 時寬高大於 `0` 之要求。
  - `#loading-screen`、`#bar-top`、`#bar-bottom`、`#loading-percent`、`#loading-status-text` 必須完整存在以供 `[animations.js:LoadingController]` 直接存取（無空值檢查）。
  - `.nav-link`（`data-idx="0..6"`）與 `<section>` ID（`#hero`、`#pv`、`#profile`、`#abilities`、`#timeline`、`#system`、`#gallery`）須保持 7 組一一對應並配合 `#nav-current` 分母 `07`（`[animations.js:NavController]`）。
- **影片自動播放與圖示狀態同步**：`[nagato-sakura-nijigen.html:#pv-video]` 預設具 `muted` 屬性以符合瀏覽器自動播放政策，且初始 `#pv-mute-btn.active`、`#pv-icon-muted` 顯示與 `#pv-icon-sound`／`#pv-icon-play` `display:none` 必須與 `[main.js:initPVControls]` 點擊切換狀態一致（該函式不監聽原生 `play`/`pause`/`volumechange` 事件）。
- **子系統渲染與跨模組約束**：所有由 `./js/README.md` 導入之條件亦適用本頁，包含父容器尺寸約束（`#card-canvas`、`#ability-canvas`、`#system-canvas`、`#gal-canvas-1..3`）、`#pv-video` 未處理播放拒絕、`[main.js:initVisibilityTracking]` 僅對可視章節執行畫布重繪，以及 `ArkSource.fromImage` 在 `'images/NS-V2.png'` CORS 受限或載入失敗時退回 `'NS'` 文字點陣。

## Side Effects
- **靜態與媒體資源載入**：載入本地影片 `videos/NS-PV1.mp4`、由 `[ark-particles.js:ArkSource.fromImage]` 載入的 `images/NS-V2.png`、本地 CSS 樣式表、Google Fonts CDN 及 favicon（`../../assets/images/logo.png`）。
- **執行期渲染、計時與 DOM 突變**：透過 `./js/README.md` 驅動全頁 10 個 `<canvas>`（含離屏 `<canvas>` 像素採樣與縮放重繪）、多組 `requestAnimationFrame` 與 `setTimeout` 排程、3 個 `IntersectionObserver`、全域與元素事件監聽（`window`、`document`、`#main-content`、按鈕與卡片）、類別／樣式切換以及 `<video id="pv-video">` 靜音／播放控制；本頁不使用 `localStorage`、`sessionStorage`、`fetch` 或 `<audio>` 元素。

## Verification
- Run: `<test-command>`
