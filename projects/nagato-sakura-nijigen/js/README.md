# js

## Overview
`projects/nagato-sakura-nijigen/js` 為「長門櫻｜二次元風格展示頁」提供純瀏覽器端的前端視覺與互動模組，分為四個職責獨立的腳本：`particles.js` 負責全頁與各章節的 Canvas 2D 動態圖形系統、`ark-particles.js` 負責像素採樣點陣粒子重組與滑鼠斥力引擎、`animations.js` 負責載入畫面進度與全站 DOM 互動控制器、`main.js` 則統籌兩階段啟動時序、各畫布可見性節流渲染與視窗縮放同步。

## Interface
- **`particles.js`**（全域腳本，匯出 `[particles.js:window.ParticleSystems]`）：
  - 匯出畫布視覺類別：`[particles.js:BackgroundParticles]`（櫻花／數據粒子／神經網路連線背景）、`[particles.js:LoadingBackground]`（60 顆環繞連線粒子）、`[particles.js:CardVisual]`（幹員卡片 2D 視覺）、`[particles.js:AbilityVisual]`（`[3, 5, 5, 3]` 層神經網路視覺，含內部方法 `_initNodes`）、`[particles.js:SystemDiagram]`（7 衛星節點架構連線圖）、`[particles.js:GalleryVisual]`（依 `type` `0`/`1`/`2` 分別繪製 `_drawCircuitBoard`、`_drawWaveform`、`_drawGrid3D`）、`[particles.js:HeroCanvas]`（首頁背景 Canvas）。
  - 內部粒子類別與全域輔助函式：`[particles.js:Particle]`、`[particles.js:SakuraPetal]`、`[particles.js:DataParticle]`、`[particles.js:NeuralNetwork]`、`[particles.js:rand]`、`[particles.js:lerp]`。
- **`ark-particles.js`**（IIFE 封裝，匯出 `[ark-particles.js:window.ArkParticles]`）：
  - `[ark-particles.js:ArkParticle]`：單一粒子狀態與更新繪製（`draw`、`update`、`change`）。
  - `[ark-particles.js:ArkSource]`：離屏像素採樣來源（靜態方法 `fromImage`、`fromText`、`fromDraw` 與內部採樣 `_extract`）。
  - `[ark-particles.js:ArkParticleCanvas]`：主畫布動畫與滑鼠斥力控制器（`changeImg`、`draw`、`start`、`stop`、`resize`）。
  - `[ark-particles.js:ArkController]`：多來源切換總控（`init`、`switchTo`、`resize`、`destroy`，管理 6 組預設來源 `'PORTRAIT'`、`'NS'`、`'SAKURA'`、`'長門櫻'`、`'FOX'`、`'HEX'` 與 `.ark-btn` 切換鈕）。
- **`animations.js`**（全域腳本，匯出 `[animations.js:AnimControllers]`）：
  - 匯出控制器類別：`[animations.js:LoadingController]`（完成時於 `window` 派發 `'loading-done'` `CustomEvent`）、`[animations.js:FadelineController]`、`[animations.js:SectionRevealController]`、`[animations.js:NavController]`、`[animations.js:AbilityTabsController]`、`[animations.js:VoiceController]`、`[animations.js:CursorController]`、`[animations.js:MobileNavController]`、`[animations.js:ScrollHintController]`。
  - 全域輔助函式：`[animations.js:_lerp]`。
- **`main.js`**（IIFE 啟動入口，無全域匯出）：
  - 消費 `window.ParticleSystems`、`window.AnimControllers`、`window.ArkParticles` 並執行內部生命週期函式：`[main.js:init]`、`[main.js:onLoadingDone]`、`[main.js:initCanvases]`、`[main.js:initControllers]`、`[main.js:initPVControls]`、`[main.js:startRenderLoop]`（含 `tick`）、`[main.js:initVisibilityTracking]`、`[main.js:isSectionVisible]`、`[main.js:setupResize]`。

## Invariants
- **腳本載入順序**：`[main.js:IIFE]` 在執行當下即同步擷取 `PS = window.ParticleSystems`、`AC = window.AnimControllers`、`AK = window.ArkParticles`，因此 HTML 必須依序同步載入 `particles.js` → `ark-particles.js` → `animations.js` → `main.js`；同樣地，`[animations.js:LoadingController.init]` 執行時亦須 `window.ParticleSystems` 已就緒才會建立載入畫面背景粒子。
- **兩階段初始化與 Hero 文字顯示保護**：`[main.js:init]` 僅啟動 `LoadingController` 並監聽 `'loading-done'`，待載入進度達 `100%` 且淡出完成後才由 `[main.js:onLoadingDone]` 建立其餘畫布、控制器、渲染迴圈與縮放監聽；由於 `FadelineController` 在 `'loading-done'` 派發後才被實例化而會錯過該事件，`[main.js:initControllers]` 額外以 `setTimeout(..., 100)` 主動為 `.section-hero .fadeline` 加上 `'in'` 類別。
- **畫布尺寸、DPR 與父容器前置條件**：
  - `[particles.js:BackgroundParticles]` 等 7 個匯出類別於建構子立即呼叫 `canvas.getContext('2d')` 與 `resize()`，DPR 上限限制為 `Math.min(window.devicePixelRatio || 1, 2)`；其中 `[particles.js:CardVisual.resize]`、`[particles.js:AbilityVisual.resize]`、`[particles.js:SystemDiagram.resize]`、`[particles.js:GalleryVisual.resize]` 要求 `canvas.parentElement` 存在以讀取 `getBoundingClientRect()`，寬高為 `0` 時分別退回 `280x220`、`250x200`、`400x400`、`300x160`；`[particles.js:BackgroundParticles.resize]` 依視窗寬度 `< 768` 切換粒子數量（櫻花 `8`/`20`、數據 `15`/`40`、網路節點 `15`/`30`）。
  - `[particles.js:GalleryVisual.draw]` 不會在結尾重置 `ctx.globalAlpha = 1`，呼叫端不應假設繪製後透明度維持為 `1`。
  - `[ark-particles.js:ArkController.init]` 同步讀取 `canvasEl.width` 與 `canvasEl.height` 並呼叫 `ctx.getImageData(0, 0, w, h)`（`[ark-particles.js:ArkSource._extract]`），因此傳入之畫布寬高必須皆大於 `0` 否則會拋出 `IndexSizeError`；`[ark-particles.js:ArkController.resize]` 僅更新畫布尺寸而不重算既有粒子來源座標。
- **圖片 CORS 退回與粒子重組守恆**：`[ark-particles.js:ArkSource.fromImage]` 以 `crossOrigin = 'anonymous'` 載入 `'images/NS-V2.png'`，遇 `SecurityError` 或 `onerror` 時會自動退回使用 `ArkSource.fromText` 產生 `'NS'` 點陣文字；`[ark-particles.js:ArkParticleCanvas.changeImg]` 會增刪粒子使數量精確吻合新來源像素數並執行 Fisher-Yates 洗牌；滑鼠斥力僅於 `mouseX && mouseY` 同時為真值且作用倍率上限為 `7`（`MOUSE_RADIUS = 60`、`REPEL_FORCE = 0.85`）時生效（`[ark-particles.js:ArkParticle.update]`）。
- **DOM 假設與控制限制**：`[animations.js:LoadingController]` 未對 `#loading-screen`、`#bar-top`、`#bar-bottom`、`#loading-percent`、`#loading-status-text` 做空值檢查；`[animations.js:CursorController.init]` 僅於初始化時判斷 `window.innerWidth >= 1024`；`[main.js:initPVControls]` 假設 `#pv-icon-muted`/`sound`/`pause`/`play` 皆存在且未對 `video.play()` 附加拒絕處理；`[main.js:startRenderLoop]` 僅在 `[main.js:isSectionVisible]` 為真時繪製對應章節畫布，其中 `#hero` 預設為可見（`visibilityCache['hero'] = true`）。

## Side Effects
- **全域命名空間與自訂事件**：建立 `window.ParticleSystems`、`window.ArkParticles`、`window.AnimControllers`，並由 `[animations.js:LoadingController._hide]` 於 `window` 派發 `'loading-done'` 事件。
- **多組 `requestAnimationFrame` 與 `setTimeout` 排程**：`[animations.js:LoadingController._animate]`（完成即停）、`[animations.js:CursorController._animate]`（桌機版持續迴圈）、`[ark-particles.js:ArkParticleCanvas.start]` 與 `[main.js:startRenderLoop]` 各自驅動 RAF 迴圈；`setTimeout` 用於載入 6 階段進度（`200`～`2500ms`）、隱藏延遲（`400ms` / `600ms`）、`ArkController` 預設來源選取與輪詢（`300ms` / `200ms`）、Hero 文字進場（`100ms`）及視窗縮放防抖（`200ms`）。
- **離屏／主畫布繪製與影像請求**：`[ark-particles.js:ArkSource._extract]` 建立離屏 `<canvas>` 進行 `getImageData` 採樣；`[ark-particles.js:ArkSource.fromImage]` 透過 `new Image()` 載入 `'images/NS-V2.png'`（失敗或跨來源污損時呼叫 `console.warn`）；各系統持續改寫頁面中 `#loading-canvas`、`#bg-particles`、`#hero-canvas`、`#ark-canvas`、`#card-canvas`、`#ability-canvas`、`#system-canvas`、`#gal-canvas-1`～`3` 之尺寸或 2D 像素內容。
- **DOM 觀察器、事件監聽與影片操作**：建立 3 個 `IntersectionObserver`（`[animations.js:SectionRevealController.init]`、`[animations.js:NavController.init]`、`[main.js:visibilityObserver]`）；於 `window`、`document`、`#main-content`、`#ark-canvas`、`.ark-btn`、`.nav-link`、`.atab`、`.voice-item`、`#mobile-toggle`、`#pv-mute-btn`、`#pv-play-btn` 綁定事件，突變類別（`.loaded`、`.in`、`.in-view`、`.active`、`.open`、`.hover`）與 `style`（`transform`、`opacity`、`pointerEvents`、`display`、`width`），並切換 `#pv-video` 之 `muted` 與播放／暫停狀態（無使用 `localStorage`、`sessionStorage`、`fetch` 或 `AudioContext`）。

## Verification
- Run: `<test-command>`
