# pages

## Overview
`pages` 目錄存放個人網站「Cyber Nexus / 天野靜樹」的三個次級靜態內容頁面，各自負責不同維度的個人展示並共用統一的導航與系統設定外殼：
- `about.html`（3,540 行）：個人檔案主頁，包含雙欄響應式佈局（可摺疊與捲動固定之左側個人名片側欄、右側「WHO AM I / CORE VALUES / SKILLS / TIMELINE」四個內容區段）、側邊章節導航 `.side-nav`，以及隱藏的「駭客揭露（Crash Fever Boss Warning）」多視窗彩蛋系統。
- `experience.html`（739 行）：專業經歷頁面，透過縱向交錯時間軸 `.timeline`（5 個階段）與 `.stats-grid`（3 項統計卡片）呈現技術演進歷程。
- `skills.html`（920 行）：技能矩陣頁面，以五大技術分類 `.skills-category` 共 17 張 `.skill-card` 展示多維度技術棧與動態進度條。

三頁共用一致的雙階段啟動模型：首先於 `<head>` 透過同步阻塞 IIFE 預讀 `localStorage` 中的主題與導航列高度以避免閃爍（FOUC）；接著在 `<body>` 提供背景圖層、`<header>` 導航選單與 `.settings-panel` 系統設定面板（共 13 個供外部共用腳本掛載的標準 DOM ID），並於 `DOMContentLoaded` 後串接 `../assets/js/core.js`、`../assets/js/live2d-manager.js`、`../assets/js/navigation.js` 與 `../assets/js/animations.js`。

## Interface
- **外部樣式、字型與資源相依**：三頁皆透過 `<link>` 載入網站圖示 `../assets/images/logo.png`、Google Fonts（`Orbitron`、`Rajdhani`），以及 `../assets/css/core.css`、`../assets/css/components.css`、`../assets/css/animations.css`（`[about.html:L21-L25]`、`[experience.html:L21-L25]`、`[skills.html:L21-L25]`）。
- **外部共用腳本與初始化介面**：三頁皆依序引入 `../assets/js/core.js`、`../assets/js/live2d-manager.js`、`../assets/js/navigation.js` 與 `../assets/js/animations.js`（`[about.html:L2460-L2463]`、`[experience.html:L703-L706]`、`[skills.html:L874-L877]`），並於 `DOMContentLoaded` 呼叫全域 `[core.js:Core.initBackground]`、`[navigation.js:Navigation.init]` 與 `[animations.js:Animations.init]`；`about.html` 另呼叫 `[core.js:Core.initSmoothScroll]`（`[about.html:L2466-L2469]`）。
- **跨頁導航契約**：三頁 `<header>` 皆提供一致的內部與外部連結介面，包含主要頁面（`../index.html`、`about.html`、`experience.html`、`skills.html`）、特別內容專案（`../projects/game-center/game-center.html`、`../projects/nagato-sakura-webos/nagato-sakura-webos.html`、`../projects/music-player/music-player.html`、`../projects/forza-tuning-calculator/forza-tuning-calculator.html`）以及外部社群與郵件連結（`[about.html:L2057-L2107]`、`[experience.html:L375-L426]`、`[skills.html:L303-L354]`）。
- **共用頁面外殼與設定面板 DOM ID（三頁一致）**：
  - 背景與導航搜尋掛載點：`#particles`、`#navSearch`，搭配 `.settings-toggle` 與行動版選單 `.menu-toggle` 按鈕。
  - `.settings-panel` 控制項 DOM ID：`#headerFixed`、`#headerHeightValue`、`#headerHeight`（`50`–`100`，步進 `5`）、`#sideNavTextVisible`、`#themeMode`（`dark` / `light`）、`#live2dToggle`、`#backgroundStyle`（11 種樣式選項：`dom`、`network`、`magnet`、`star`、`bubble`、`circuit`、`sakura`、`glitch`、`laser`、`fleet`、`off`）、`#animationValue`、`#animationStrength`（`0`–`2`）、`#fpsValue`、`#soundEnabled`（`[about.html:L2134-L2244]`、`[experience.html:L453-L563]`、`[skills.html:L381-L491]`）。
- **`about.html` 專屬 DOM、樣式與互動函式介面**：
  - 側邊導航與平滑捲動錨點：`nav.side-nav` 定義 `#hero`（`data-offset="80"`）、`#about-me`、`#values`、`#skills`、`#timeline`（`data-offset="100"`）（`[about.html:L2249-L2256]`），另有 Hero 捲動按鈕 `.scroll-arrow-link[href="#about-me"][data-offset="100"]`（`[about.html:L2266]`），供 `[navigation.js:Navigation.initSideNav]` 與 `[core.js:Core.initSmoothScroll]` 綁定。
  - 雙欄佈局與個人檔案節點：`.layout-container` 包含左側 `.sidebar-wrapper`（`.profile-card`、`#about-avatar-box`、`#about-avatar-img`、`#about-profile-name`、`.profile-badge`、`.sidebar-toggle[aria-controls="sidebar-info_more"]`、`#sidebar-info_more`、`#profile-status-text`）與右側 `.content-wrapper`（`#about-me`、`#values`、`#skills` 內含 5 組 `.skill-progress[data-width]`、`#timeline`）（`[about.html:L2272-L2457]`）。
  - 區段觀察器與標題閃爍：`[about.html:skillObserver]`（`IntersectionObserver`, `threshold: 0.3`）與 `[about.html:glitchTitle]` 計時器（`[about.html:L2472-L2509]`）。
  - Sticky 側欄降級定位閉包（`[about.html:L2512-L2925]`）：定義 `[about.html:recalc]`、`[about.html:syncFixedPosition]`、`[about.html:update]` 與 `[about.html:setCollapsedOnResize]`，維護動態建立的 `.sidebar-placeholder` 及 `.is-fixed`、`.is-anchored`、`.is-collapsed` 狀態類別；支援全域除錯旗標 `window.__SIDEBAR_DEBUG__`。
  - 駭客揭露彩蛋閉包（`[about.html:L2928-L3536]`）：定義 `[about.html:updateProfileUI]`、`[about.html:onProfileClick]` 與 `[about.html:triggerRevealAnimation]`，綁定 `#about-avatar-box`（若缺少則回退至 `#about-avatar-img`）與 `#about-profile-name` 的 `click` 事件，觸發後切換 `body.is-hacked-state` / `.profile-card.is-unmasked` 並生成 `#hacker-reveal-overlay`（或 `.recovery`）、`.hacker-window`（含 `#reveal-progress-bar`、`#reveal-progress-text`、`#buffer-a-bar`、`#buffer-b-bar`、`#buffer-c-bar`、`#shuffle-name-text`、`#binary-stream-box`、`#purge-countdown`、`#memory-registry-box`、`#hex-matrix-box`、`#log-export-box`）與 `.main-boss-banner`。
- **`experience.html` 專屬結構與介面**：
  - `<main class="page-content">` 包含 `.hero-section`（`.hero-title`）、`.timeline`（5 個 `.timeline-item`）與 `.stats-grid`（3 個 `.stat-card`）（`[experience.html:L569-L700]`）；內嵌腳本包含 `.hero-title` 閃爍計時器與觀察 `.timeline-item` 的 `IntersectionObserver`（`[experience.html:observer]`，`threshold: 0.2`）（`[experience.html:L715-L735]`）。本頁靜態 HTML 不含 `.side-nav` 元素。
- **`skills.html` 專屬結構與介面**：
  - `<main class="page-content">` 包含 `.hero-section`（`.hero-title`）與 5 個 `.skills-category` 區段（共 17 張 `.skill-card`，內含 `.skill-bar[data-level]`，值域 `75`–`95`）（`[skills.html:L497-L871]`）；內嵌腳本定義 `[skills.html:skillObserver]`（`IntersectionObserver`, `{ threshold: 0.3, rootMargin: '0px' }`）與 `.hero-title` 閃爍計時器（`[skills.html:L886-L916]`）。本頁靜態 HTML 亦不含 `.side-nav` 元素。

## Invariants
- **渲染前主題與 Header 高度預載不變量**：三頁 `<head>` 內的同步 IIFE 皆以 `try { ... } catch(e) {}` 包裹，必須在外部樣式表套用前讀取 `localStorage.getItem('theme') || 'dark'` 與 `localStorage.getItem('headerHeight')`，並設定 `document.documentElement` 的 `data-theme` 與 `--header-height`（`[about.html:L5-L16]`、`[experience.html:L5-L16]`、`[skills.html:L5-L16]`）；在無法存取 `localStorage` 的環境下會靜默維持預設 `'dark'` 主題。
- **外部全域模組與設定面板 ID 契約不變量**：三頁內嵌腳本假設 `Core`、`Navigation`、`Animations` 已由外部 `<script>` 載入完成（`[about.html:L2460-L2469]`、`[experience.html:L703-L712]`、`[skills.html:L874-L883]`），且 DOM 中保留完整的 13 個共通 ID 供 `Navigation.initSettingsPanel()` 與 `Core.initBackground()` 綁定；刪除任一設定控制項或未帶 `.side-nav`（如 `experience.html`、`skills.html`）時，外部模組需能對缺失元素安全降級。
- **進場觀察器單次觸發與動畫差異不變量**：
  - `[about.html:skillObserver]` 與 `[skills.html:skillObserver]` 於首次 `entry.isIntersecting` 後立即呼叫 `unobserve(entry.target)`，確保進度條展寬與 `.section-title.is-active` 僅執行一次（`[about.html:L2472-L2495]`、`[skills.html:L886-L906]`）。
  - `[experience.html:observer]` 未呼叫 `unobserve` 且 `threshold: 0.2`，其 `.timeline-item` 同時透過 CSS `animation: fadeInUp 0.8s ease forwards` 依 `:nth-child(1..5)` 延遲（`0.3s`–`1.1s`）進場（`[experience.html:L93-L101, L726-L735]`）。
  - `skills.html` 中 `.skills-category:nth-child(1..5)` CSS 選擇器因 `.hero-section` 為 `<main>` 的第 1 個子元素，實際依序套用至第 1–4 個 `.skills-category`（`0.5s`–`1.1s`），第 5 個類別無延遲覆寫（`[skills.html:L65-L69, L499-L807]`）。
- **`about.html` Sticky 側欄幾何與狀態互斥不變量**：
  - `html, body` 與 `.page-content` 須保持垂直可捲動／`overflow: visible !important`，且 `.layout-container` 須維持 `align-items: flex-start`，否則黏性定位與高度基準將失效（`[about.html:L30-L44, L174-L181]`）。
  - 當 `.sidebar-wrapper` 具 `.is-collapsed` 時（`window.innerWidth <= 1024` 由 `[about.html:setCollapsedOnResize]` 強制設為摺疊，或手動點擊 `.sidebar-toggle`），`.is-fixed` 與 `.is-anchored` 必須互斥清除、清空內嵌定位樣式並隱藏 `.sidebar-placeholder`（`[about.html:update]` L2631-L2645、`[about.html:setCollapsedOnResize]` L2870-L2887、`[about.html:L2905-L2917]`）；此外 `update()` 在 `window.innerWidth < 1024` 時停用 sticky 切換（`[about.html:L2648-L2657]`）。
  - `[about.html:update]` 以 `margin = 20` 計算 `fixTrigger = baseTop - headerHeight - 20` 與 `anchorTrigger = effectiveLayoutBottom - sidebarHeight - headerHeight - 20`；當處於 `.is-anchored` 時以即時 `layoutBottom` 追蹤右欄回流，否則沿用 `baseLayoutBottom`，且錨定 `top` 以 `Math.max(0, ...)` 鉗位非負（`[about.html:L2596, L2660-L2670, L2739-L2741]`）。
  - 當 `.sidebar-placeholder` 存在時，`[about.html:recalc]` 與 `[about.html:syncFixedPosition]` 一律以該佔位元素為水平座標與寬度的單一真實來源（`leftWithinLayout = Math.round(pRect.left - lRect.left)`、`absLeft = Math.round(lRect.left) + leftWithinLayout`），保證 `.is-fixed` 與 `.is-anchored` 轉換時無次像素位移（`[about.html:L2548-L2600]`）。
- **`about.html` 駭客揭露彩蛋狀態與已知限制不變量**：
  - 狀態僅暫存於 `body.is-hacked-state` 與 `.profile-card.is-unmasked` 類別中，不寫入任何持久化儲存；每次載入皆無條件呼叫 `updateProfileUI(false)` 還原為預設身份（`[about.html:L2959-L2960, L3517]`）。
  - 需於頭像或名稱累積 `clickCount >= 10` 次才重置計數並觸發 `[about.html:triggerRevealAnimation]`（`[about.html:L2963-L2980]`）；動畫約 4.1 秒期間無重入鎖定旗標。
  - 當 `window.innerWidth < 768`（`isMobile`）時僅取前 12 個視窗對應 12 組行動版 `positions`（`[about.html:L3014-L3028, L3317]`）；於桌面端（`>= 768px`），`positions` 僅有 24 個座標項目而 `popupsData` 兩分支皆為 25 筆（`[about.html:L3028-L3315]`），使第 25 個視窗（`index === 24`、`#log-export-box`）讀取 `positions[24].styleClass` 時拋出 `TypeError` 而不會掛載進 DOM。
  - `#shuffle-name-text` 視窗與 `shuffleInterval` 僅在 `toUnmasked` 為 `true` 時建立，回復模式（`!toUnmasked`）下 `shuffleInterval` 保持 `null`（`[about.html:L3108, L3237-L3239, L3406-L3427]`）。
  - 靜態 HTML 結構註記：`[about.html:L2275-L2351]` 中 `.profile-card` 與 `.sidebar-info` 開啟了兩層 `<div>` 但僅有單一閉合 `</div>`，依賴瀏覽器 HTML 解析器自動補齊。

## Side Effects
- **`localStorage` 讀取與根元素屬性寫入（三頁）**：`<head>` 同步腳本讀取 `localStorage` 鍵 `'theme'` 與 `'headerHeight'`，直接修改 `document.documentElement` 的 `data-theme` 屬性與 `--header-height` CSS 自訂屬性（`[about.html:L8-L13]`、`[experience.html:L8-L13]`、`[skills.html:L8-L13]`）。三頁本身未直接寫入 `localStorage`、`sessionStorage`、`document.cookie` 或發起 `fetch` 請求（設定面板持久化由外部 `navigation.js` 與 `live2d-manager.js` 處理）。
- **外部資源網路請求（三頁）**：載入頁面時向 `fonts.googleapis.com` 發起字型樣式請求，並載入相對路徑 `../assets/` 下的圖片、CSS 與 JS 腳本（`[about.html:L21-L25, L2460-L2463]`、`[experience.html:L21-L25, L703-L706]`、`[skills.html:L21-L25, L874-L877]`）。
- **視口觀察器與 DOM 樣式突變**：
  - `[about.html:skillObserver]` 透過 `setTimeout(..., 100)` 設定 `.skill-progress` 的 `style.width`，並透過 `setTimeout(..., 120)` 為 `.section-title` 加入 `.is-active`（`[about.html:L2477-L2490]`）。
  - `[experience.html:observer]` 於相交時寫入 `.timeline-item` 的 `style.opacity = '1'` 與 `style.transform = 'translateY(0)'`（`[experience.html:L727-L731]`）。
  - `[skills.html:skillObserver]` 透過 `setTimeout(..., 100)` 設定 `.skill-bar` 的 `style.width`（`[skills.html:L894-L898]`）。
- **週期性標題閃爍計時器（三頁）**：三頁皆於 `DOMContentLoaded` 建立未保留參照（永不清除）的 `setInterval(..., 3000)`，以 5% 機率（`Math.random() > 0.95`）對 `.glitch-title`（`about.html`）或 `.hero-title`（`experience.html`、`skills.html`）呼叫 `Animations.glitchEffect(..., 200)`（`[about.html:L2502-L2509]`、`[experience.html:L715-L722]`、`[skills.html:L909-L916]`）。
- **`about.html` Sticky 側欄監聽器與 DOM 佔位節點副作用（`[about.html:L2512-L2925]`）**：
  - 註冊 `window` `scroll`（`{ passive: true }`）、`resize`、`load` 與 `.sidebar-toggle` `click` 事件監聽器，並以 `[about.html:ro]`（`ResizeObserver`）觀察 `.layout-container`、`.sidebar-wrapper` 與 `.content-wrapper`。
  - 動態建立並插入 `<div class="sidebar-placeholder">` 兄弟節點，持續讀寫 `.sidebar-wrapper` 的 `.is-fixed`/`.is-anchored`/`.is-collapsed` 類別、`.sidebar-toggle` 的 `aria-expanded` 與 `.toggle-text` 文字，以及多項內嵌幾何樣式（`position`、`top`、`left`、`width`、`height`、`display`），並排程 `requestAnimationFrame(syncFixedPosition)` 與 `setTimeout`（`120ms`、`60ms`、`330ms`）。（另當啟用 `window.__SIDEBAR_DEBUG__` 時會寫入 `console.debug`，且 anchored 分支在 `[about.html:L2759]` 引用區塊內 `const leftWithinLayout` 會觸發 `ReferenceError`。）
- **`about.html` 駭客揭露彩蛋 DOM、捲動鎖定與多計時器陣列副作用（`[about.html:L2928-L3536]`）**：
  - 點擊時暫時修改 `#about-avatar-img` 的 `style.transform` 與 `style.filter` 並於 `150ms` 後復原（`[about.html:L2968-L2974]`）。
  - 觸發 `[about.html:triggerRevealAnimation]` 時鎖定頁面捲動（設定 `document.documentElement.style.overflow` 與 `document.body.style.overflow` 為 `'hidden'`），並對 `.page-content, header, .side-nav, .cyber-bg, .grid-overlay` 加入 `.hacker-glitch-active` 震動類別，於 `3600ms` 後解除（`[about.html:L2995-L3000, L3520-L3523]`）。
  - 動態於 `document.body` 插入 `#hacker-reveal-overlay`（`z-index: 100000`），依序（`index * 60ms`）建立 `.hacker-window` 彈窗（行動版 12 個、桌面成功建立 24 個）與 `1200ms` 時的 `.main-boss-banner`；同時啟動最多 7 個高頻 `setInterval`（`progressTimer` `100ms`、`streamTimer` `120ms`、`shuffleInterval` `100ms`、`countdownInterval` `100ms`、`memTimer` `200ms`、`hexTimer` `150ms`、`logTimer` `250ms`）更新視窗 DOM 內容，於 `3500ms` 全部 `clearInterval` 並閃白覆蓋層，`3600ms` 淡出並於 `4100ms` 呼叫 `overlay.remove()` 移除節點（`[about.html:L3321-L3533]`）。
  - `[about.html:updateProfileUI]` 切換 `body.is-hacked-state` 與 `.profile-card.is-unmasked`（啟用紅/洋紅配色覆寫與 `cyber-bg` 警戒條紋動畫），並置換 `#about-avatar-img` `src`（`../assets/images/avatar.jpg` ↔ `../assets/images/avatar-anime.jpg`）、`#about-profile-name`（`陳右承` ↔ `天野靜樹`）、`.profile-badge`（`ROOT ARCHITECT` ↔ `AI ARCHITECT`）與 `#profile-status-text`（`OVERLORD` ↔ `Online`）（`[about.html:L2937-L2957]`）。

## Verification
- Run: `python -m http.server 8000`（本倉庫為純靜態 HTML/CSS/JS 專案，無自動化測試套件；於倉庫根目錄啟動靜態伺服器後開啟 `http://localhost:8000/pages/about.html`、`http://localhost:8000/pages/experience.html`、`http://localhost:8000/pages/skills.html` 進行渲染、響應式與互動人工驗證）
