# nagato-sakura

## Overview
`nagato-sakura.html` 為「長門櫻計畫 - Cyber Nexus」專案主展示頁，除了整合全站導覽列、側邊錨點導航與設定面板外，內部實作了三套視覺與資料子系統：Sakura Genesis 全螢幕 Canvas 入場動畫（`#nsLoader`／`#nsCanvas`）、6 組長門櫻 AI 子系統即時 Canvas 2D 模擬動畫（`#feat-canvas-1`～`#feat-canvas-6`），以及透過 CORS 代理擷取 GitHub Social Preview 的生態系卡片網格（`#ecosystem-grid`）與無縫跑馬燈展廳（`#gallery-track`）。

## Interface
- **Sakura Genesis 入場動畫介面**：
  - `[nagato-sakura.html:nsResize]`、`[nagato-sakura.html:nsAnimate]`、`[nagato-sakura.html:nsDrawHUD]`、`[nagato-sakura.html:nsExpandHUD]`、`[nagato-sakura.html:nsDrawLogo]`、`[nagato-sakura.html:nsDrawLogoExit]`、`[nagato-sakura.html:easeOutExpo]`、`[nagato-sakura.html:sakuraPolys]`；DOM 容器 `#nsLoader` 與 `<canvas id="nsCanvas">`。
- **滾動顯現與 6 大 AI 模擬畫布**：
  - `[nagato-sakura.html:revealObs]`（觀察 `.reveal` 並加上 `.visible`）。
  - 6 個獨立 IIFE 各自的 `[nagato-sakura.html:draw]` 函式分別驅動 `#feat-canvas-1`（神經網路脈衝 `layers=[3,5,7,7,5,3]`）、`#feat-canvas-2`（中央 LLM 調度 7 工具 `tools`）、`#feat-canvas-3`（24x16 網格影像修復掃描對比）、`#feat-canvas-4`（CV 偵測框與標籤追蹤 `detections`）、`#feat-canvas-5`（48 頻段長條圖與 32 輻射音頻圓環 `frequencies`）、`#feat-canvas-6`（六角格與圓錐漸層雷達威脅掃描 `threats`）。
- **生態系網格與跑馬燈展廳介面**：
  - `[nagato-sakura.html:GITHUB_USER]`（`'AmanoShizukikun'`）、`[nagato-sakura.html:ecosystemProjects]`（6 個衍生專案清單）、`[nagato-sakura.html:galleryRepos]`、`[nagato-sakura.html:fetchSocialPreview]`、`[nagato-sakura.html:ecoImgMap]`、`[nagato-sakura.html:previewCache]`、`[nagato-sakura.html:cardMap]`；DOM 容器 `#ecosystem-grid` 與 `#gallery-track`。
- **全站外框、控制項與外部相依**：
  - 初始化腳本 `[nagato-sakura.html:head-init-iife]`、`[nagato-sakura.html:inline_script]`（緊接於 `#nsLoader` 之後）與 `[nagato-sakura.html:DOMContentLoaded]`；頁面章節 `#hero`、`#about`、`#features`、`#demo`（YouTube iframe）、`#ecosystem`、`.side-nav` 及 `.settings-panel` 控制項（`#headerFixed`、`#headerHeight`、`#sideNavTextVisible`、`#themeMode`、`#live2dToggle`、`#backgroundStyle`、`#animationStrength`、`#fpsValue`、`#soundEnabled`、`#navSearch`）。
  - 外部相依：`../../assets/css/{core,components,animations}.css`、`../../assets/js/{core,live2d-manager,navigation,animations}.js`（無防呆直接呼叫 `Core.initBackground()`、`Navigation.init()`、`Animations.init()`、`Core.initSmoothScroll()`）及 Google Fonts CDN。

## Invariants
- **入場動畫重播略過與無條件執行限制**：`[nagato-sakura.html:inline_script]` 在解析 `#nsLoader` 後立即檢查 `sessionStorage.getItem('nsLoaderShown') === 'true'` 並未經空值檢查直接呼叫 `document.getElementById('nsLoader').remove()`，故 `#nsLoader` 必須位於該內聯腳本正上方；`[nagato-sakura.html:DOMContentLoaded]` 內不再重複檢查 `nsLoaderShown` 或 `prefers-reduced-motion`，僅依 `if (nsLoader)` 執行 `T3 = 2700ms` 動畫（`elapsed >= T3` 時停止 `requestAnimationFrame` 遞迴）；`[nagato-sakura.html:nsResize]` 以 CSS 像素（下限 `1px`）設定寬高而未套用 DPR 縮放。
- **展示畫布固定尺寸與無可見性暫停**：`#feat-canvas-1`～`#feat-canvas-6` 僅於初始化時讀取父容器 `clientWidth`/`clientHeight`（退回 `600x400`），未實作 DPR 縮放、未監聽 `resize`、亦未以 `IntersectionObserver` 或 `prefers-reduced-motion` 暫停，只要 DOM 元素存在即永久運行 `requestAnimationFrame`；各動畫陣列維持硬性上限（`pulses <= 60`、`dataStreams <= 30`、`detections <= 6`、`threats <= 5`）。
- **跑馬燈四倍複製與 Social Preview 擷取約束**：`#gallery-track` 將 6 個儲存庫展開為 4 倍共 24 張卡片以匹配 CSS `@keyframes galleryScroll`（`translateX(-25%)`）；`[nagato-sakura.html:fetchSocialPreview]` 以 `AbortSignal.timeout(8000)` 請求 `corsproxy.io`，未檢查 `res.ok`，且僅在解析出的 `og:image` 包含 `'repository-images.githubusercontent.com'` 時採用自訂預覽圖，失敗或逾時皆靜默退回 `https://opengraph.githubassets.com/1/...`（`<img>` 亦設 `onerror` 退回保護）；由於 `ecoImgMap` 與 `previewCache` 作用域彼此隔離，兩個區塊同時存在時會各自發出 6 次（共 12 次）代理請求。
- **外部全域物件強相依**：`[nagato-sakura.html:DOMContentLoaded]` 未檢查 `Core`、`Navigation`、`Animations` 是否為 `undefined` 即直接呼叫其方法，因此 `../../assets/js/{core,live2d-manager,navigation,animations}.js` 必須在頁面主 `<script>` 之前同步載入完成。

## Side Effects
- **Web Storage 讀寫**：讀取 `localStorage`（`'theme'`、`'headerHeight'`）與讀寫 `sessionStorage`（讀取 `'nsLoaderShown'`，寫入 `'nsLoaderShown' = 'true'` 與 `'loaderShown' = 'true'`）（`[nagato-sakura.html:head-init-iife]`、`[nagato-sakura.html:inline_script]`、`[nagato-sakura.html:DOMContentLoaded]`）。
- **外部網路請求與嵌入媒體**：對 `https://corsproxy.io/?...` 發出最多 12 次非同步 `fetch` 請求擷取 GitHub 頁面 HTML；載入 Google Fonts CDN（`Orbitron`、`Rajdhani`）、GitHub OpenGraph／圖片預覽、`../nagato-sakura-webos/assets/apps/icon/NS-V2.png` 及懶載入 YouTube 嵌入播放器（`https://www.youtube-nocookie.com/embed/LSTw9uEcpqg?si=ZtgQ_FzpknLAnXLi`）。
- **DOM 突變、Canvas 動畫與計時器**：改寫 `<html>` 主題與 `--header-height`、移除或淡出移除 `#nsLoader`、動態建立並插入 `.eco-card` 與 `.gallery-card`（`Promise.all` 完成後更新 `img.src`）、建立 `IntersectionObserver`（`revealObs`）、註冊並於動畫結束後卸載 `window` `resize` 監聽、並行執行 1 個入場與 6 個展示 `requestAnimationFrame` 迴圈，以及使用 `setTimeout`（`400ms` 移除 `#nsLoader`、`100ms` 添加 `.visible`）。

## Verification
- Run: `<test-command>`
