# game-center

## Overview
本元件為「Cyber Nexus 遊戲中心（Game Center）」之主大廳應用程式殼層與單頁入口（`game-center.html`），整合全站主題背景、左方遊戲中心側邊欄、開場進場動畫遮罩、即時 FPS/1% Low 效能監測 OSD、精選遊戲 Hero 輪播、分類篩選與 4 欄遊戲卡片網格、遊戲詳情檢視、全螢幕媒體預覽視窗，以及可將子遊戲載入 `#game-iframe` 內嵌執行之切換機制（另含樣式目錄 `css/` 存放 `entrance.css`、`sidebar.css`、`game_hub.css`）。

## Interface
- `./js/README.md` - 遊戲中心前端共用腳本子系統（匯出 `playEntranceAnimation`、`window.toggleFPSMonitor`、`gamesData`、`initSidebarControls`、`initGameHubUI`、獨立殼層 `bootShell` 及相關大廳互動與手把輪詢函式）
- `./games/README.md` - 收錄各獨立遊戲子專案（`cyberrace`、`nsroom`、`piano`、`snake`、`wallclimber`）的藍圖索引
- `[game-center.html:head]`：引入網站圖示 `../../assets/images/logo.png`、Google Fonts（`Chakra Petch`、`Noto Sans TC`、`Orbitron`、`Rajdhani`）、核心樣式（`../../assets/css/core.css`、`components.css`、`animations.css`）、模組樣式（`css/entrance.css`、`css/sidebar.css`、`css/game_hub.css`）與 CDN 腳本（`https://cdn.tailwindcss.com`、`https://unpkg.com/lucide@latest`）
- `[game-center.html:tailwind.config]`：擴充 Tailwind 主題字型（`sans`、`tech`）與 `cyber` 色票（`bg`、`card`、`accent`、`secondary`、`panel`、`border`）
- `[game-center.html:window.entryAnimationsCompleted]` 與早期防禦性全域函式佔位（`[game-center.html:window.setHeroFocus]`、`window.resumeHeroAuto`、`window.pauseHeroAuto`、`window.launchGameFromHero`、`window.launchHeroDirect`、`window.selectCategory`、`window.closeModal`、`window.openFilterModal`、`window.openSortModal`、`window.handleHeroProgressEnd`）
- `[game-center.html:scripts]`：依序載入全站核心腳本（`../../assets/js/core.js`、`live2d-manager.js`、`navigation.js`、`animations.js`）與遊戲中心腳本（`js/entrance.js`、`js/sidebar.js`、`js/fps-osd.js`、`js/games-data.js`、`js/game-hub.js`）
- `[game-center.html:DOMContentLoaded]`：執行 `Core.initBackground()`、`Navigation.init()` 與 `lucide.createIcons()` 初始化
- `[game-center.html:inline-handlers]`：HTML `on*` 屬性呼叫之全域函式，包含 `setHeroFocus()`、`resumeHeroAuto()`、`launchGameFromHero(event)`、`launchHeroDirect(event)`、`selectCategory(currentCategoryIndex - 1 | + 1)`（讀取全域 `currentCategoryIndex`）、`closeDetailView()`、`openMediaPreview()`、`navigateDetailMedia(-1 | 1)`、`launchGame()`、`toggleCurrentFavorite()`、`resetPreviewControlsTimer()`、`closeMediaPreview()`、`navigatePreviewMedia(event, -1 | 1)`、`toggleMediaFullscreen(event)` 與 `closeModal()`
- DOM 容器與控制項 ID 契約：
  - 全站外殼與入場：`#particles`、`#entranceOverlay`、`#entranceMatrix`、`#entranceHexagons`、`#entranceParticles`、`#navSearch`
  - 設定面板：`#headerFixed`、`#headerHeight`（50–100 步進 5，預設 75）、`#headerHeightValue`、`#sideNavTextVisible`、`#showSidebar`、`#themeMode`（`dark`/`light`）、`#live2dToggle`、`#backgroundStyle`（`dom`/`network`/`magnet`/`star`/`bubble`/`circuit`/`sakura`/`glitch`/`laser`/`fleet`/`off`）、`#animationStrength`（0–2 步進 1，預設 2）、`#animationValue`、`#fpsValue`、`#soundEnabled`
  - 側邊欄與 OSD：`#gcSidebar`、`#sidebarToggle`、`#gcBackBtn`、`#fpsOSDToggle`、`#hideSidebarBtn`、`#fpsOSD`、`#osdTitle`、`#osdContent`、`.osd-mode-btn[data-mode]`（`fps`、`advanced`、`full`）
  - 遊戲庫與詳情視圖：`#city-bg-container`、`#library-view`、`#hero-banner`、`#hero-img`、`#hero-focus-border`、`#hero-title`、`#hero-desc`、`#hero-play-btn`、`#hero-indicators`、`#game-count`、`#lb-indicator`、`#category-container`、`#rb-indicator`、`#game-grid`、`#detail-view`、`#detail-title`、`#detail-media-main`、`#detail-media-main-content`、`#detail-media-thumbnails`、`#detail-cover-img`、`#detail-desc`、`#detail-release-date`、`#detail-developer`、`#detail-tags-container`、`#detail-favorite-btn`、`#detail-favorite-icon`
  - 內嵌遊戲與彈窗：`#game-view`、`#game-iframe`（`allow="autoplay; fullscreen; midi"`）、`#media-preview-modal`、`#media-preview-stage`、`#media-preview-content`、`#media-preview-fullscreen-btn`、`#footer-hints-library`、`#footer-hints-detail`、`#sort-modal`、`#sort-options`、`#filter-modal`、`#filter-options`、`#cyber-toast`、`#toast-title`、`#toast-subtitle`

## Invariants
- `[game-center.html:data-theme]`：`<head>` 同步腳本於 `localStorage.getItem('theme')` 為空時預設套用 `'dark'`，並以 `parseInt(hh) + 'px'` 設定 CSS 變數 `--header-height`（以 `try/catch` 包覆）。
- `[game-center.html:skip-entrance-anim]`：僅當 `sessionStorage.getItem('skipEntranceAnimation') === 'true'` 或 `localStorage.getItem('showEntranceAnimation') === 'false'` 時，於 `<head>` 立即為 `<html>` 加入 `skip-entrance-anim` 類別並將 `window.entryAnimationsCompleted` 設為 `true`。
- `[game-center.html:window]`：早期防禦性佔位迴圈僅在 `typeof window[fn] !== 'function'` 時寫入空函式以免覆寫既有函式；`closeDetailView`、`openMediaPreview`、`navigateDetailMedia`、`launchGame`、`toggleCurrentFavorite`、`resetPreviewControlsTimer`、`closeMediaPreview`、`navigatePreviewMedia`、`toggleMediaFullscreen` 與 `currentCategoryIndex` 未包含於此預先佔位清單。
- `[game-center.html:#gcSidebar]`：側邊欄初始帶有 `collapsed` 類別，僅當 `(localStorage.getItem('sidebarCollapsed') ?? localStorage.getItem('gcSidebarCollapsed')) === 'false'` 時於繪製前移除 `collapsed`。
- `[game-center.html:.game-center-container]`：主容器採 `position: fixed`（`top: var(--header-height, 75px); bottom: 0; right: 0; z-index: 10`），其 `left` 位置依前置 `.gc-sidebar` 狀態切換（預設 `220px`、`.collapsed` 時 `72px`、`.hidden-sidebar` 時 `0px`、`@media (max-width: 768px)` 下為 `65px`）；`html.no-scroll, body.no-scroll` 強制 `overflow: hidden !important`。
- `[game-center.html:#detail-media-main]`：鍵盤事件僅於按下 `'Enter'` 或 `' '` 鍵時呼叫 `event.preventDefault()` 並觸發 `openMediaPreview()`；`#hero-indicators` 與媒體切換按鈕皆呼叫 `event.stopPropagation()` 以隔離父層點擊事件。
- `[game-center.html:#media-preview-modal]`：設定 `bottom-[44px]` 避開底部熱鍵提示列；`#city-bg-container`、`#detail-view`、`#game-view`、`#media-preview-modal`、`#sort-modal`、`#filter-modal` 與 `#cyber-toast` 初始均處於隱藏或不可互動狀態；`#game-iframe` 僅開放 `allow="autoplay; fullscreen; midi"`，外部社群連結強制 `target="_blank" rel="noopener noreferrer"`。
- `[game-center.html:DOMContentLoaded]`：呼叫 `Core.initBackground`、`Navigation.init` 與 `lucide.createIcons` 前均檢查 `typeof ... !== 'undefined' && typeof ... === 'function'`，並於 `./js/README.md` 延續各項側欄與遊戲大廳狀態不變量。

## Side Effects
- `[game-center.html:head]`：於 `<head>` 解析期間同步讀取 `localStorage`（`theme`、`headerHeight`、`showEntranceAnimation`）與 `sessionStorage`（`skipEntranceAnimation`），修改 `document.documentElement` 屬性／類別／行內樣式及 `window` 全域屬性，並向 Google Fonts、Tailwind CDN 與 Lucide CDN 發出外部請求及寫入全域 `tailwind.config`。
- `[game-center.html:#gcSidebar]`：於 `<body>` 解析期間同步讀取 `localStorage`（`sidebarCollapsed`、`gcSidebarCollapsed`）並條件移除 `#gcSidebar` 的 `collapsed` 類別。
- `[game-center.html:scripts]` & `[game-center.html:DOMContentLoaded]`：載入並執行 9 支本機腳本，註冊 `DOMContentLoaded` 監聽以初始化背景系統、全站導覽列、Live2D、OSD、入場動畫與遊戲中心大廳，並將 `[data-lucide]` 元素替換為 SVG 圖示。
- `[game-center.html:inline-handlers]`：於 Hero、分類列、詳情視圖、媒體預覽視窗與排序／篩選彈窗掛載內聯事件處理器，觸發頁面跳轉、音效合成、`#game-iframe` 載入與儲存狀態讀寫（詳見 `./js/README.md`）。

## Verification
- Run: `<test-command>`
