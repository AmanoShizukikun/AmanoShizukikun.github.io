# assets/js

## Overview
網站核心前端腳本目錄，採用原生 JavaScript 模組化架構（無打包工具與外部建置流程，各腳本提供全域物件並附帶可選 CommonJS `module.exports`）。負責全域粒子/畫布背景系統、進場與互動動畫控制、頂部/側邊導覽與偏好設定持久化、Markdown 文件動態渲染，以及 Live2D 看板娘模組的延遲載入與生命週期管理。

## Interface
- `Core`（`[core.js:Core]`）：核心工具與全螢幕動態背景引擎。
  - 背景與粒子控制：`[core.js:Core.initParticles]`、`[core.js:Core.initBackground]`、`[core.js:Core._createBackgroundManager]` 建立並暴露單例 `[core.js:Core.BackgroundManager]`，支援 `apply(style, opts)`、`setStrength(value)`、`setMouseEnabled(enabled)`、`stop()` 及多種背景渲染模式（`dom`、`network`、`magnet`、`star`、`bubble`、`circuit`、`sakura`、`glitch`、`laser`、`fleet`、`off`）。
  - UI 與通用工具：`[core.js:Core.animateNumber]`、`[core.js:Core.initScrollReveal]`、`[core.js:Core.initSmoothScroll]`、`[core.js:Core.typewriter]`、`[core.js:Core.loadImage]`、`[core.js:Core.debounce]`、`[core.js:Core.throttle]`、`[core.js:Core.getQueryParam]`、`[core.js:Core.storage]`（`set`/`get`/`remove`）、`[core.js:Core.copyToClipboard]`、`[core.js:Core.formatDate]`。
- `Navigation`（`[navigation.js:Navigation]`）：導覽列、響應式選單與系統設定面板控制器（須由呼叫端顯式執行 `[navigation.js:Navigation.init]`）。
  - 導覽元件：`[navigation.js:Navigation.initSideNav]`、`[navigation.js:Navigation.initTopNav]`、`[navigation.js:Navigation.setActiveNavLink]`、`[navigation.js:Navigation.initMobileMenu]`、`[navigation.js:Navigation.generateBreadcrumb]`、`[navigation.js:Navigation.initBackToTop]`、`[navigation.js:Navigation.setHeaderHeightVariable]`、`[navigation.js:Navigation.initNavSearch]`、`[navigation.js:Navigation.initFPSMonitor]`。
  - 設定與游標特效：`[navigation.js:Navigation.initSettingsPanel]`、`[navigation.js:Navigation.initSettings]`、`[navigation.js:Navigation._cursorState]`、`[navigation.js:Navigation._applyCursorEffect]`。
- `Animations`（`[animations.js:Animations]`）：開屏載入畫面與頁面視覺特效控制器。
  - 進入與特效 API：`[animations.js:Animations.init]`、`[animations.js:Animations.createLoader]`、`[animations.js:Animations.showEntryAnimation]`、`[animations.js:Animations.triggerPageEntrance]`、`[animations.js:Animations.createSakuraEffect]`、`[animations.js:Animations.glitchEffect]`、`[animations.js:Animations.initCardAnimations]`、`[animations.js:Animations.animateText]`、`[animations.js:Animations.staggerAnimation]`、`[animations.js:Animations.addScanLine]`、`[animations.js:Animations.createDataStream]`、`[animations.js:Animations.pulseElement]`。
- `MarkdownRenderer`（`[markdown.js:MarkdownRenderer]`）：基於全域 `marked` 與 `hljs` 的 Markdown 載入與渲染器。
  - 公開方法：`[markdown.js:MarkdownRenderer.init]`、`[markdown.js:MarkdownRenderer.renderFile]`、`[markdown.js:MarkdownRenderer.processLinks]`、`[markdown.js:MarkdownRenderer.addCopyButtons]`、`[markdown.js:MarkdownRenderer.generateTOC]`、`[markdown.js:MarkdownRenderer.renderMultiple]`、`[markdown.js:MarkdownRenderer.addSearch]`。
- `window.live2dManager`（`[live2d-manager.js:window.live2dManager]`）：Live2D 看板娘管理閉包，暴露 `load()`、`show()`、`hide()`、`isAvailable()`、`setQuitVisible(visible)`、`isQuitVisible()`，集中處理 `waifu-tips.js` ES Module 延遲載入與顯示切換。

## Invariants
- **單例與載入順序不變量**：
  - `core.js` 尾端透過 `try-catch` 自動呼叫 `[core.js:Core._createBackgroundManager]`，且內部以 `if (this.BackgroundManager) return;` 確保單例存在；`[navigation.js:Navigation]`（節流、防抖、儲存與背景控制）及 `[markdown.js:MarkdownRenderer]`（`copyToClipboard`、`debounce`）均假設全域 `Core` 已先於其載入。
  - `[navigation.js:Navigation]` 僅導出物件而不會自動執行，必須由頁面腳本呼叫 `[navigation.js:Navigation.init]`（該方法固定最先執行 `setHeaderHeightVariable()` 以避免頁首版面位移）。
  - `[markdown.js:MarkdownRenderer.init]` 依賴全域 `marked`（必要）與 `hljs`（選用）；若缺少目標 DOM 或 `response.ok` 為 `false`，`renderFile` 不得繼續執行後處理。
- **背景引擎互斥與降級不變量**：
  - `[core.js:apply]` 切換樣式前必定呼叫 `[core.js:stop]`，各 `start*` 亦會先停用其他衝突畫布；若 `this.current === style` 且未傳入 `opts.force`，則略過重複初始化。
  - 舊版樣式名稱 `'city'` 與 `'cyber-city'` 會自動遷移為 `'dom'` 並寫回 `backgroundStyle`；所有背景 `<canvas>` 的 `devicePixelRatio` 上限皆鎖定為 `1.5`，且在 `_strength === 0` 時停用或將速度倍率歸零。
  - 當 `BackgroundManager.current` 非 `'dom'` 時，`[core.js:Core.initParticles]` 會隱藏 `.particles` 容器並提前返回。
- **設定狀態與 UI 互斥不變量**：
  - `[navigation.js:loadSettings]` 將 `animationStrength` 嚴格限制於 `0..2`（無效值回退至 `2`）；若頁首導覽在設定面板（`.settings-panel.active`）開啟期間調整設定，必須以 `skipHeaderFixed = true` 呼叫 `[navigation.js:applySettings]` 防止版面跳動。
  - 行動選單（`[navigation.js:Navigation.initMobileMenu]`）與設定面板（`[navigation.js:Navigation.initSettingsPanel]`）保持互斥，且僅在兩者皆關閉時才移除 `.nav-overlay` 並恢復頁面捲動；設定面板外部點擊檢查 `e.isTrusted`，避免合成點擊事件誤關面板。
  - `nagato-sakura-webos` 頁面若啟用 `webos_hide_nav_nagato-sakura-webos` 或 `webos_display_settings.hideNavbar`，`--header-height` 會強制維持 `0px`。
  - `#backgroundStyle` 下拉選單事件綁定嵌套於 `if (live2dToggle)` 條件內（`[navigation.js:Navigation.initSettings]`），若頁面缺少 `#live2dToggle` DOM 則不會初始化背景切換監聽。
- **動畫與 Live2D 時序不變量**：
  - `[animations.js:Animations.triggerPageEntrance]` 透過 `el.dataset.animated === 'true'` 防止進場動畫重複觸發；`init()` 依 `sessionStorage['loaderShown']` 決定執行載入畫面或立即排程設定 `window.entryAnimationsCompleted = true` 並派發 `animations:entryComplete`。
  - `[live2d-manager.js:loadScriptModule]` 先以 `HEAD` 請求確認 `/assets/live2d/waifu-config.json` 存在才載入 CSS 與動態 `import('/assets/live2d/waifu-tips.js')`；`[live2d-manager.js:show]` 會等待 `animations:entryComplete`（最多 3 秒）、清除 `localStorage['waifu-display']` 與既有 `#waifu` 後才呼叫 `window.initWidget(config)`，並於 `hide()` 先關閉 `window.waifuEditMode` 再延遲移除 `#waifu` DOM。

## Side Effects
- **DOM 與樣式注入**：
  - `[core.js:Core.initBackground]` 與各背景啟動方法會在 `document.body` 插入 `.cyber-bg`、`.grid-overlay`、`.particles` 與固定定位全螢幕 `<canvas>`（`#bg-network-canvas`、`#bg-magnet-canvas`、`#bg-dom-canvas`、`#bg-star-canvas`、`#bg-bubble-canvas`、`#bg-circuit-canvas`、`#bg-sakura-canvas`、`#bg-glitch-canvas`、`#bg-laser-canvas`、`#bg-fleet-canvas`），並清理 `#global-city-bg` 與 `#city-bg-container`。
  - `[navigation.js:Navigation]` 會修改 `<html>` 的 `data-theme` 與 CSS 變數（`--header-height`、`--dark-bg`、`--darker-bg`、`--glass-bg`、`--primary-cyan`、`--primary-magenta`、`--accent-cyan`、`--primary-yellow`），切換 `document.body` 類別（`side-nav-text-hidden`、`no-animations`、`low-animations`、`custom-cursor-active`），動態建立 `.nav-overlay`、`.back-to-top`、`#custom-cursor`、`#custom-cursor-ring`、`#cursor-ripple-style` 與遺漏的設定項目 DOM。
  - `[animations.js:Animations]` 暫時插入並移除 `.loader-container` 與櫻花 `<div>`；`[live2d-manager.js:injectExtraStyles]` 與 `loadScriptModule` 會在 `document.head` 注入 `<style id="live2d-extra-style">` 與 `live2d.css` `<link>`，並移除 `#waifu`、`#waifu-toggle` 或 `#waifu-tool-quit`。
  - `[markdown.js:MarkdownRenderer]` 改寫目標容器 `innerHTML`，為外部連結加上 `target="_blank"` 與 `rel="noopener noreferrer"`，為程式碼區塊加上 `.copy-code-btn`，為標題指派 `#heading-${index}`，並以 `<mark class="search-highlight">` 包裹搜尋命中文字。
- **瀏覽器儲存讀寫**：
  - `localStorage`：`[core.js:Core.storage]`、`[navigation.js:Navigation.initSettings]`、`[navigation.js:Navigation.setHeaderHeightVariable]` 與 `[live2d-manager.js:window.live2dManager]` 讀寫 `backgroundStyle`、`animationStrength`、`backgroundMouseEnabled`、`headerFixed`、`headerHeight`、`sideNavTextVisible`、`theme`、`soundEnabled`、`live2dEnabled`、`cursorEffectEnabled`、`showSidebar`、`webos_hide_nav_*`、`webos_display_settings`、`waifu-display`、`live2dQuitEnabled`。
  - `sessionStorage`：`[animations.js:Animations.init]` 讀寫 `loaderShown`。
- **計時器、動畫迴圈與事件機制**：
  - 啟動多個 `requestAnimationFrame` 迴圈（所有 Canvas 背景渲染、`[navigation.js:Navigation.initFPSMonitor]`、`[navigation.js:Navigation._applyCursorEffect]`）、`setInterval`/`setTimeout`（`animateNumber`、`typewriter`、`debounce`、`throttle`、載入與櫻花計時器、Live2D 顯示/隱藏延遲）及 `IntersectionObserver`（`[core.js:Core.initScrollReveal]`）。
  - 註冊全域 `window` / `document` 監聽器（`scroll`、`resize`、`mousemove`、`mouseover`、`mouseout`、`click`、`keydown`、`visibilitychange`、`storage`、`animations:entryComplete`、`live2d:quit`、`live2d:modelReady`）。
  - 讀寫全域狀態與派發自訂事件：設定 `window.entryAnimationsCompleted`、`window.soundEnabled`、`window.live2dManager`；讀取 `window.updateSidebarPositionCallback`、`window.waifuEditMode`、`window.initWidget`；派發 `animations:entryComplete`、`sidebarToggle`、`live2d:quit`。
- **網路請求與系統 API**：
  - `[markdown.js:MarkdownRenderer.renderFile]` 執行 `fetch(filePath)` 取得 Markdown 內容。
  - `[live2d-manager.js:checkAsset]` 執行 `HEAD` 請求檢查 `/assets/live2d/waifu-config.json`，`loadScriptModule` 執行動態 ES `import()` 載入 `assets/live2d/waifu-tips.js`。
  - `[core.js:Core.copyToClipboard]` 呼叫 `navigator.clipboard.writeText`，失敗時回退至隱藏 `<textarea>` 與 `document.execCommand('copy')`。

## Verification
- Run: `node -e "const cp=require('child_process');['animations.js','core.js','live2d-manager.js','markdown.js','navigation.js'].forEach(f=>cp.execFileSync(process.execPath,['--check','assets/js/'+f],{stdio:'inherit'}))"`
