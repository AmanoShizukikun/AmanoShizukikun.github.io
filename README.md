# AmanoShizukikun.github.io Blueprint

## System Overview
本專案為建置於 GitHub Pages 的純前端靜態個人網站與互動作品集（Cyber Nexus 主題），無後端伺服器依賴。系統以根目錄首頁 `index.html` 與次級頁面群 `pages/` 作為個人簡歷入口，透過 `assets/js/` 提供全站共用的動態背景畫布引擎、主題與頁首高度設定、導覽系統與進場動畫，透過 `assets/live2d/` 提供延遲載入的 Cubism 5 Live2D 看板娘與自由編輯功能，並於 `projects/` 目錄承載獨立網頁應用（WebOS 模擬器、Forza 調教計算器、音樂播放器、長門櫻展示頁）與內嵌遊戲中心平台（`game-center`）。

## Local Interface & Invariants
根目錄包含首頁入口檔案 `[index.html]` 與開源授權條款 `LICENSE`，其局部介面、不變量與副作用如下：
- **外部資源與腳本消費（`[index.html:head-links]`、`[index.html:external-scripts]`、`[index.html:external-globals-consumed]`）**：載入 `assets/images/logo.png`、Google Fonts（`Orbitron`、`Rajdhani`）與本地樣式表（`assets/css/core.css`、`components.css`、`animations.css`），並依序引入 `assets/js/core.js`、`live2d-manager.js`、`navigation.js`、`animations.js`，呼叫 `Core.initBackground`、`Core.storage.get/set`、`Core.BackgroundManager.apply`、`Core.initSmoothScroll`、`Core.initScrollReveal`、`Navigation.init`、`Navigation.pageTransition`、`Animations.init` 與 `Animations.createSakuraEffect`。
- **DOM 介面與掛鉤（`[index.html:dom-ids-background-nav]`、`[index.html:dom-ids-settings]`、`[index.html:dom-ids-sections-avatar]`、`[index.html:nav-and-project-hooks]`）**：
  - 導覽與背景：`#particles`、`#navSearch`、主導覽連結（`index.html`、`pages/*.html`、`projects/*/*.html`）及 `.side-nav` 錨點（`#hero`、`#projects`、`#contact`）。
  - 設定面板：`#headerFixed`、`#headerHeightLabel`、`#headerHeightDesc`、`#headerHeightValue`、`#headerHeight`（50–100 步進 5，預設 75）、`#sideNavTextVisible`、`#themeModeLabel`、`#themeMode`（`dark`/`light`）、`#live2dToggle`、`#backgroundStyle`（11 種樣式選項）、`#animationStrengthLabel`、`#animationStrengthDesc`、`#animationValue`、`#animationStrength`（0–2 步進 1，預設 2）、`#fpsValue`、`#soundEnabled`。
  - 區段與互動元件：`#hero`、`#avatar-stage`、`#avatar-img`、`#avatar-curtain`、`#curtain-logo`、`#curtain-handle`、`#projects`、`#contact`、`.typewriter-text[data-text]`、`.stat-number[data-target][data-suffix]`、`.contact-link[data-email="hackamsk@gmail.com"]`（搭配 `.copy-btn` 與 `.copy-tooltip`）及 `.project-link` / `.project-card[data-project]`（`nagato-sakura`、`gitHub-repository`、`live2d-portal`）。
- **局部不變量**：
  - `[index.html:head-script]`：繪製前 IIFE 於 `localStorage.getItem('theme')` 為空時預設 `data-theme="dark"`，僅於 `headerHeight` 為真值時解析 `parseInt(hh) + 'px'` 設定 `--header-height`，並以 `try/catch` 吞沒儲存與 DOM 例外。
  - `[index.html:backgroundStyle-binding]`：缺乏 `#backgroundStyle` 時早退；預設值為 `'dom'`；若 `Core.BackgroundManager.apply` 未定義則退回呼叫 `Core.initBackground()`。
  - `[index.html:animateNumbers]`：透過布林旗標 `hasAnimated` 與 `IntersectionObserver`（`threshold: 0.5`）的 `unobserve()` 確保 `.stat-number` 數字計數動畫僅執行一次；非數值 `data-target`（如 `∞`）直接顯示 `data-suffix`。
  - `[index.html:project-link-click]`：外部 `http://`/`https://` 連結與 `#` 錨點不攔截；內部頁面連結必呼叫 `e.preventDefault()` 並依序循環 8 種 `exitTypes`（`geometric-warp`、`neon-pulse`、`sweep-wave`、`data-vortex`、`split-apart`、`glitch-tear`、`electron-collapse`、`cube-collapse`），若 `Navigation.pageTransition` 不可用則於 `300ms` 後改以 `window.location.href` 跳轉。
  - `[index.html:doCopy]`：優先使用 `navigator.clipboard.writeText`，失敗或缺失時退回暫時 `<textarea>` 與 `document.execCommand('copy')`，並於 `1500ms` 後重置 `.copied`、`aria-pressed`、`blur()`、文字選取及提示氣泡狀態。
  - `[index.html:avatar-curtain-click]` 與 `[index.html:css-pointer-events]`：頭像布幕切換延遲 `400ms` 依 `.active` 狀態交換 `assets/images/avatar-anime.jpg` 與 `assets/images/avatar.jpg`；`.project-card *` 停用指標事件防阻擋點擊，行動端（`<=768px`）`.profile-card` 停用指標事件並僅在互動子元素重啟 `pointer-events: auto`。
- **局部副作用（`[index.html:head-links]`、`[index.html:head-script]`、`[index.html:DOMContentLoaded-init]`、`[index.html:animateNumbers]`、`[index.html:project-link-click]`、`[index.html:doCopy]`、`[index.html:avatar-curtain-click]`）**：同步讀寫 `localStorage`（`theme`、`headerHeight`、`backgroundStyle`）與 `document.documentElement` 屬性；發出 Google Fonts 與本地資源網路請求；執行 `IntersectionObserver`、`requestAnimationFrame`、`setTimeout`；點擊 `nagato-sakura` 卡片觸發 `Animations.createSakuraEffect(3000)`；操作系統剪貼簿與臨時 `<textarea>`；切換頭像圖片來源與轉場導航。

## Subdirectories & System Boundaries
- `assets`: [./assets/README.md](./assets/README.md) - 網站核心前端腳本套件（`Core`、`Navigation`、`Animations`、`MarkdownRenderer`、`window.live2dManager`）與 Live2D 看板娘子系統（`waifu-tips.js`、`live2d-framework.js`、`waifu-config.json`、Cubism 執行期函式庫），另包含共用 CSS 與圖片資源。
- `pages`: [./pages/README.md](./pages/README.md) - 次級靜態頁面群（`about.html`、`experience.html`、`skills.html`），共用 `<head>` 預載腳本與 13 個設定面板 DOM ID，實作區段動畫、Sticky 側欄狀態機與駭客揭露彩蛋。
- `projects`: [./projects/README.md](./projects/README.md) - 獨立互動應用與遊戲集合，涵蓋 Forza 調教計算器、Game Center 平台與 5 款遊戲／3D 體驗、音樂播放器、長門櫻展示主頁與二次元展示頁，以及 Nagato Sakura WebOS 模擬器。

## Global Invariants
- **跨頁共用設定持久化與繪製前防閃爍（FOUC）契約**：全站 HTML 入口（`index.html`、`pages/*.html`、`projects/` 各頁面）於 `<head>` 優先執行同步 `try/catch` IIFE，讀取 `localStorage` 中的 `theme`（預設 `'dark'`）與 `headerHeight`，預先寫入 `document.documentElement` 的 `data-theme` 屬性與 `--header-height` CSS 變數。
- **全站外殼腳本依賴順序與 DOM ID 契約**：使用全站外殼的頁面必須先載入 `assets/js/core.js`，再載入 `live2d-manager.js`、`navigation.js`、`animations.js`，並保留 `#particles`、`#navSearch` 及設定面板標準控制項 ID（`#headerFixed`、`#headerHeight`、`#sideNavTextVisible`、`#themeMode`、`#live2dToggle`、`#backgroundStyle`、`#animationStrength`、`#fpsValue`、`#soundEnabled`）。
- **單一畫布互斥與效能降載**：`Core._createBackgroundManager` 切換背景樣式前必先呼叫 `stop()` 清除前一個全螢幕背景 `<canvas>`；WebGL／2D 遊戲與粒子引擎（如 `Core` DPR 上限 `1.5`、`cyberrace` 與 `particles.js` DPR 上限 `2`、`cyberrace` 與 `wallclimber` 物理步長 `dt <= 0.05s`）均各自設有限幅與可見性節流。
- **平台內嵌與跳轉協作**：遊戲中心與子遊戲透過 `localStorage` 的 `sidebarCollapsed`／`gcSidebarCollapsed`／`showSidebar` 與 `sessionStorage.skipEntranceAnimation` 同步側邊欄狀態及略過返回大廳時的入場動畫；`game-center.html` 透過 `#game-iframe`（`allow="autoplay; fullscreen; midi"`）承載內嵌模式，`game-shell.js` 則偵測 `window.self !== window.top` 控制殼層是否注入。

## Global Side Effects
- **瀏覽器儲存空間共享狀態**：全站跨頁面透過 `localStorage` 共享設定與狀態（包含 `theme`、`headerHeight`、`backgroundStyle`、`animationStrength`、`backgroundMouseEnabled`、`headerFixed`、`sideNavTextVisible`、`soundEnabled`、`live2dEnabled`、`cursorEffectEnabled`、`showSidebar`、`sidebarCollapsed`、`gcSidebarCollapsed`、`waifu-display`、`live2dQuitEnabled`、`modelId`、`modelTexturesId`、`waifu-custom-layout`、`waifu-tool-layout`、`snakeHighScore`、`pianoWaveformType`、`cyberrace` 紀錄及 `nagato-sakura-webos` 15 組專屬鍵值），並使用 `sessionStorage`（`loaderShown`、`nsLoaderShown`、`skipEntranceAnimation`、`waifu-message-priority`）。
- **外部 CDN 與第三方網路依賴**：除本機靜態資產（`./assets/`、`.glb`、`.mp3`、`.mp4`、`./data/*.json`）外，各頁面依需求向 Google Fonts、Tailwind CSS CDN、Lucide Icons CDN、Three.js r128／OrbitControls／GLTFLoader CDN、Tween.js、Font Awesome、jQuery、Big.js、GitHub API／`corsproxy.io`（`nagato-sakura` 與 `nagato-sakura-webos`）及 `wttr.in`／`api.allorigins.win`／`nominatim.openstreetmap.org`（`nagato-sakura-webos`）發出網路請求。
- **全域執行期資源與 Web API**：多數元件於前景維護 `requestAnimationFrame`、`setInterval`、`IntersectionObserver`、`ResizeObserver`、WebGL 上下文、Web Audio `AudioContext`、`Pointer Lock`、`Gamepad` 輪詢與動態 DOM／`<style>` 注入。

## System Verification
- Run: `<test-command>`
