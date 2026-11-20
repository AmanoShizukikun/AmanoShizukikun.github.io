# nagato-sakura-webos

## Overview
本元件為「Nagato Sakura WebOS（Cyber Nexus）」單頁式網頁作業系統模擬器，實作於單一自包含檔案 `nagato-sakura-webos.html`（共 20,442 行），結合全域網站頂部導航列與仿桌面視窗環境。系統由同步 `<head>` 主題初始化腳本、5 層 z-index 隔離的 CSS 設計系統（含深色／淺色主題、Mica/Acrylic 玻璃擬態與響應式小工具階層）、完整桌面殼層 DOM 結構，以及五大執行時期 `<script>` 區塊構成：核心殼層與視窗引擎 `[nagato-sakura-webos.html:initWebOS]`、天氣小工具 `[nagato-sakura-webos.html:initWeatherWidget]`、效能監控小工具 `[nagato-sakura-webos.html:initPerfWidget]`、關於與更新檢查器 `[nagato-sakura-webos.html:initAboutHelpers]`，以及獨立應用程式（記事本、終端機、相簿、播放器與計算機）。

系統架構採取「共用殼層協調 + 應用獨立狀態」設計：核心桌面殼層負責開機動畫序列、桌面圖示網格、任務欄、開始功能表、小工具抽屜（含全螢幕 Metro 磚塊模式）、雙層設定頁面與視窗拖曳／縮放／貼齊管理；各內建應用則透過標準 `.window[data-app]` 容器、全域物件介面與 `localStorage` 鍵值各自維護運作狀態，並依賴全站共用的 `../../assets/css/*`、`../../assets/js/*` 及計算機外部函式庫（jQuery 3.6.0、Big.js 6.2.1）。

## Interface

### 1. 啟動生命週期與全域進入點
- **Head 同步預初始化**：於 `<head>` 同步執行的匿名 IIFE，讀取 `localStorage` 並設定根元素 `data-theme` 與 `--header-height` `[nagato-sakura-webos.html:L5-16]`。
- **核心 WebOS 初始化**：`initWebOS()` 於 `DOMContentLoaded`（或 `document.readyState !== 'loading'` 時立即）執行，掛載開機流程 `[nagato-sakura-webos.html:initBootSequence]`、顯示與個人化設定、視窗管理、桌面與釘選管理、長門櫻 AI 助理與瀏覽器最愛列；同時若外部全域模組存在，會呼叫 `Core.initBackground()` 與 `Navigation.init()`（刻意跳過 `Animations.init()`）`[nagato-sakura-webos.html:initWebOS]`。
- **獨立應用啟動器**：`initApps()` 依序初始化 `notepadApp.init()`、`terminalApp.init()`、`photosApp.init()` 與 `playerApp.init()` `[nagato-sakura-webos.html:initApps]`。

### 2. 全域匯出介面與計算機引擎
- **`window.appCalculator`（計算機實體）**：實例化自 `[nagato-sakura-webos.html:Calculator]` 類別（透過 `Big.js` 進行高精度加減乘除四則運算），綁定 `#calc-input` 與 `#win-calc>.keyb`，供 HTML 內聯 `onkeydown`／`onclick` 與全域鍵盤監聽呼叫方法 `number_key`、`func_key`、`check`、`uncheck`、`isCheck`、`point`、`square`、`squareRoot`、`backspace`、`clear_num`、`eq`、`get_num`、`_calc` `[nagato-sakura-webos.html:window.appCalculator]`。
- **`window.initWeatherWidget(widget)`**：初始化單一天氣小工具實例，提供城市輸入查詢、手動刷新與瀏覽器地理定位查詢介面 `[nagato-sakura-webos.html:window.initWeatherWidget]`。
- **`window.initPerfWidget(widget)`**：初始化單一效能監控小工具實例，每秒更新 CPU 估算值、記憶體／JS Heap、FPS、執行時間、DOM 節點數與頁面載入耗時 `[nagato-sakura-webos.html:window.initPerfWidget]`。
- **HTML 內聯事件依賴之全域應用物件**：
  - `[nagato-sakura-webos.html:notepadApp]`：公開 `init`、`newFile`、`openFile`、`loadFile`、`saveFile`、`undo`、`redo`、`cut`、`copy`、`paste`、`selectAll`、`find`、`updateTitle`、`updateStatus`（綁定於 `#window-notepad` 工具列與 `#notepad-editor`）。
  - `[nagato-sakura-webos.html:terminalApp]`：公開 `init` 與 `executeCommand`（支援 `help`、`cls`、`echo`、`date`、`time`、`ver`，綁定於 `#window-terminal` 與 `#terminal-input`）。
  - `[nagato-sakura-webos.html:photosApp]`：公開 `init`、`initSidebar`、`loadWallpapers`、`createPhotoItem`、`layout`、`initDragAndDrop`、`selectPhoto`、`setViewMode`、`uploadPhoto`、`addPhoto`、`viewPhoto`、`setAsWallpaper`、`toggleFavorite`、`deletePhoto`、`viewSlideshow`、`rotateLeft`、`rotateRight`（綁定於 `#window-photos` 與動態燈箱／幻燈片視圖）。
  - `[nagato-sakura-webos.html:playerApp]`：公開 `init`、`openFile`、`togglePlay`、`stop`、`seekBackward`、`seekForward`、`toggleMute`、`toggleFullscreen`、`updateTime`、`updateProgress`、`updateVolumeIcon`、`formatTime`（控制 `#window-player` 內單一 `<video id="player-video">` 元素）。

### 3. 視窗管理與桌面殼層 DOM / 函式契約
- **視窗生命週期函式**：`openWindow(appId)`、`closeWindow(appId)`、`minimizeWindow(appId)`、`maximizeWindow(appId)`、`snapWindow(windowEl, mode)`、`focusWindow(windowEl)`、`clearActiveWindow()`、`updateTaskbarActive(appId)`、`createTaskbarIconIfMissing(appId)`、`syncTaskbarWithWindows()`、`getAllTaskbarIcons()`、`minimizeAllWindows()` `[nagato-sakura-webos.html:openWindow]` `[nagato-sakura-webos.html:focusWindow]`。
- **拖曳／縮放／邊緣貼齊核心**：`actionState` 全域操作狀態物件 `[nagato-sakura-webos.html:actionState]`、`resizewin(win, arg, resizeElt, ev)`（含 `applyResize`、`tick`、`moveHandler`、`up_f`）`[nagato-sakura-webos.html:resizewin]`、`applyActionState()`、`clearActionState(e)`、`requestApply()`、`cancelApply()`、`setSnapHoverMode(mode)`、`showSnapPreview(mode)`、`hideSnapPreview()`（對應 `#snap-preview` 與 `OFFSCREEN_ALLOW_RATIO`）`[nagato-sakura-webos.html:applyActionState]` `[nagato-sakura-webos.html:showSnapPreview]`。
- **桌面圖示與開始功能表排序管理**：
  - `[nagato-sakura-webos.html:desktopManager]`：管理 `#desktop` 網格座標、名稱／自訂排序（`sortMode`）、拖曳交換預覽、`#desktop-context-menu` 右鍵選單與位置持久化。
  - `[nagato-sakura-webos.html:pinnedAppsManager]`：管理 `#start-menu .pinned-apps` 的指標拖曳重排與順序持久化。
- **標準視窗容器 DOM 契約**：所有 10 個內建視窗（`#window-settings`、`#window-nagato`、`#window-explorer`、`#window-browser`、`#window-store`、`#window-calculator`、`#window-notepad`、`#window-terminal`、`#window-photos`、`#window-player`）均採用 `.window[data-app]` 結構，包含 8 向 `.resize-handle.{n,s,e,w,nw,ne,sw,se}`、`.window-header` 控制鈕（`.minimize`、`.maximize` 內嵌 4 個 `.snap-layout-option`、`.close`）與 `.window-content`。其中 `#window-explorer` 與 `#window-store` 僅為靜態展示／佔位視窗 `[nagato-sakura-webos.html:#window-explorer]` `[nagato-sakura-webos.html:#window-store]`。

### 4. 設定系統、小工具面板、AI 助理與瀏覽器介面
- **顯示與夜燈子頁面**：`mapSliderToBrightness`、`mapSliderToNightlightOpacity`、`applyDisplaySettings`、`applyNavbarVisibility`、`saveDisplaySettings`、`switchSettingsPage`、`openNightlightSubpage`、`closeNightlightSubpage`、`isTimeInRange`、`applyScheduleIfNeeded`（控制 `#page-display` 與 `#nightlight-settings`）`[nagato-sakura-webos.html:applyDisplaySettings]` `[nagato-sakura-webos.html:applyScheduleIfNeeded]`。
- **個人化與外部面板連動**：`personalizationControls`、`DEFAULT_PERSONALIZATION`、`fadeSetBackground`、`applyPersonalizationSettings`、`savePersonalizationSettings`、`loadPersonalizationSettings`、`updateAccentPreviews`、`syncStartToggles`、`mirrorToMain`、`openBgPanel`/`closeBgPanel`、`openWindowPanel`/`closeWindowPanel`、`openFontPanel`/`closeFontPanel`、`loadWallpaperIndex`、`loadVideoIndex`（涵蓋 `#page-personalization`、`#personalization_background_panel`、`#personalization_window_panel`、`#personalization_font_panel` 與右側全域 `.settings-panel` 的 `#themeMode`）`[nagato-sakura-webos.html:applyPersonalizationSettings]` `[nagato-sakura-webos.html:personalizationControls]`。
- **關於與版本更新檢查**：`initAboutHelpers` 及其內部函式 `fetchLatestRelease`、`doCheckUpdatesUI`、`getAutoCheck`、`setAutoCheck`（操作 `#page-about` 與 `#page-update`）`[nagato-sakura-webos.html:initAboutHelpers]`。
- **小工具與日曆系統**：`updateTime`、`renderCalendar`（渲染 `#calendar-flyout` 的 `#calendar-grid`）、`closeWidgetsPanel`、`widgetTemplates`（`weather`、`performance`、`news`、`clock`）、`saveWidgetsState`、`loadWidgetsState`、`createAddMenu`、`closeAddMenu`、長按拖曳排序（`startDrag`、`moveDrag`、`endDrag`、`cancelDrag`）與 `.metro-tile[data-app]` 磚塊啟動 `[nagato-sakura-webos.html:widgetTemplates]` `[nagato-sakura-webos.html:loadWidgetsState]`。
- **長門櫻 AI 助理（`#window-nagato`）**：`initNagatoAssistantUI`、`ensureNagatoLive2D`、`stabilizeNagatoWaifuLayout`、`ensureNagatoConversationSeed`、`loadNagatoConversation`/`saveNagatoConversation`、`loadNagatoSuggestions`/`saveNagatoSuggestions`、`pushNagatoMessage`、`renderNagatoHistory`、`renderNagatoSuggestions`、`showNagatoAIBubble`、`setNagatoHistoryVisible`、`syncNagatoOverlayLayout`、`detectOpenWindowIntent`、`generateNagatoResponse`、`sendNagatoMessage`、`autoResizeNagatoInput` `[nagato-sakura-webos.html:initNagatoAssistantUI]` `[nagato-sakura-webos.html:ensureNagatoLive2D]`。
- **Edge 風格瀏覽器（`#window-browser` / `#win-edge`）**：`setBrowserUrl`、`loadFavorites`/`saveFavorites`、`renderFavorites`、`isFavorite`、`addFavorite`、`removeFavoriteByUrl`、`updateNavigationButtons`、`updateBookmarkButton`（操作 `#browser-back`、`#browser-forward`、`#browser-refresh`、`#browser-url-input`、`#bookmark-toggle`、`#favorites-bar` 與沙盒 `iframe.browser-iframe`）`[nagato-sakura-webos.html:setBrowserUrl]` `[nagato-sakura-webos.html:renderFavorites]`。
- **CSS 自訂屬性與主題介面**：`:root` 定義核心調色盤、`--font-display`、`--font-body`、`--font-ui`、`--font-scale`、`--taskbar-height`、`--taskbar-icon-size`、`--window-border-radius`、`--window-bg`、`--window-backdrop`、`--simulator-brightness`、`--background-brightness`、`--background-overlay`、`--nightlight-opacity`、`--header-height` 與圖層變數 `--z-*`，並透過 `[data-theme="light"]` 覆寫各子系統樣式 `[nagato-sakura-webos.html:--z-window-base]` `[nagato-sakura-webos.html:--font-scale]`。

## Invariants
- **頁面佈局與疊層順序不變量**：
  - `html, body` 強制 `padding-top: 0 !important` 與 `margin-top: 0 !important`，避免 `navigation.js` 的 `toggleSettings` 推擠版面；頂部 `header` 固定於 `z-index: 20000`（`transform: none !important`），`.nav-overlay` 為 `19998`；`.main-wrapper` 與 `.simulator-container` 依 `var(--header-height, 60px)` 扣除頂部高度 `[nagato-sakura-webos.html:header]` `[nagato-sakura-webos.html:.simulator-container]`。
  - 模擬器內部圖層由下至上嚴格分層：`#desktop-bg`（`--z-window - 50` = 950）< `#desktop-video`（951）< `#desktop-overlay` 與 `#desktop`（960）< 一般視窗 `--z-window-base`（1000）< `#snap-preview`（`--z-snap-preview` = 2000）< 活躍視窗 `.window.active`（`--z-window-active` = 3000 `!important`）< `#widgets-panel`（3800）< `#nightlight-overlay`（`--z-start-menu - 1` = 3899）< `#start-menu`（3900）< `#taskbar`（4000）< `--z-context-menu`（6000）< `#boot-loader`（9999）< `.desktop-drag-preview` / `.pinned-app-drag-preview`（10000）< `.desktop-context-menu`（10001）；其中所有背景與覆蓋層（含 `#snap-preview`、`#nightlight-overlay`）均設定 `pointer-events: none` `[nagato-sakura-webos.html:--z-window-base]` `[nagato-sakura-webos.html:#nightlight-overlay]` `[nagato-sakura-webos.html:#snap-preview]`。
  - 當 `#widgets-panel` 進入 `.fullscreen`（Metro 模式）時，面板本體 `z-index` 降至 `calc(var(--z-window-base) - 1)`（999），確保已開啟視窗可疊加於 Metro 桌面之上，而其標題列升至 `calc(var(--z-taskbar) + 1)` `[nagato-sakura-webos.html:#widgets-panel]`。
- **視窗開啟、聚焦、縮放與貼齊約束**：
  - `openWindow(appId)` 僅在 `!dataset.placed && !dataset.isSnapped && !dataset.isMaximized` 時執行一次性置中，且保留已設定的非 `'auto'` 內聯 `left`/`top`；`snapWindow` 僅在 `!dataset.oldW` 時記錄 `oldX`/`oldY`/`oldW`/`oldH`，避免連續貼齊覆蓋原始視窗尺寸 `[nagato-sakura-webos.html:openWindow]` `[nagato-sakura-webos.html:snapWindow]`。
  - 最小化視窗仍於任務欄保留 `.open-app`（同時移除 `.active-app` 與 `aria-pressed="false"`）；聚焦最小化視窗會轉交 `openWindow` 還原；關閉當前活躍視窗時，`closeWindow` 會將焦點移交給剩餘非最小化 `.window.show` 中 `z-index` 最高者 `[nagato-sakura-webos.html:focusWindow]` `[nagato-sakura-webos.html:closeWindow]` `[nagato-sakura-webos.html:minimizeWindow]`。
  - 拖曳與縮放均透過 `requestAnimationFrame` 節流（分別以 `rafId` 與 `state.rafId` 維護每幀最多一次 DOM 更新）。拖曳還原最大化需超過 `restoreThreshold = 6px`；非最大化視窗拖曳時禁止超越桌面頂端（`minTop = 0`），水平／底部則依 `OFFSCREEN_ALLOW_RATIO` 允許部分超出視口；貼齊預覽需游標停留在邊緣 24px（角落 120px）並經過 `SNAP_HOVER_DELAY = 30ms` 顯示 `#snap-preview.show` 後放開才會提交 `[nagato-sakura-webos.html:applyActionState]` `[nagato-sakura-webos.html:setSnapHoverMode]` `[nagato-sakura-webos.html:clearActionState]`。
  - `applyResize` 遵守 `dataset.minWidth || 400` 與 `dataset.minHeight || 300`（計算機視窗 `#window-calculator` 顯式宣告 `data-min-width="320"`、`data-min-height="430"` 對應 CSS `min-width: 320px; min-height: 430px`），並在從左／上邊緣縮放時錨定 `rightEdge`/`bottomEdge` 防止視窗位移 `[nagato-sakura-webos.html:applyResize]` `[nagato-sakura-webos.html:#window-calculator]`。
  - `desktopManager` 固定網格參數為 `cellWidth: 90`、`cellHeight: 100`、`padding: 20`、`gap: 5`、`taskbarHeight: 48`，當 `sortMode === "name"` 時禁止拖曳圖示 `[nagato-sakura-webos.html:desktopManager.grid]` `[nagato-sakura-webos.html:desktopManager.onPointerDown]`。
- **主題、顯示與個人化狀態同步約束**：
  - `localStorage["theme"]` 為深淺色主題的單一真實來源（SSOT）：`loadPersonalizationSettings()` 與啟動流程皆會以 `localStorage.getItem("theme") || "dark"` 覆寫個人化設定中的 `theme` 欄位，且跨分頁 `storage` 事件或手動切換主題於 `backgroundMode === "default"` 時會清除 `_lastBackgroundMode`／`_lastBackgroundValue` 快取以重繪預設桌布 `[nagato-sakura-webos.html:loadPersonalizationSettings]` `[nagato-sakura-webos.html:applyPersonalizationSettings]`。
  - 每個頁面之導航列隱藏鍵 `PAGE_HIDE_KEY`（`webos_hide_nav_<PAGE_ID>`）在 `applyDisplaySettings` 中優先權高於 `DISPLAY_STORAGE_KEY`（`webos_display_settings`）內的 `hideNavbar` `[nagato-sakura-webos.html:applyDisplaySettings]`。
  - 亮度滑桿 `[0, 100]` 線性映射為 `--simulator-brightness` `[0.600, 1.200]`；夜燈強度 `[0, 100]` 映射為 `--nightlight-opacity` `[0.000, 0.500]`。`applyScheduleIfNeeded` 與 `applyDisplaySettings` 在關閉夜燈時係以 `#nightlight-overlay.style.opacity = "0"` 隱藏視覺效果，部分路徑不會同步將 `--nightlight-opacity` 歸零 `[nagato-sakura-webos.html:mapSliderToBrightness]` `[nagato-sakura-webos.html:applyDisplaySettings]`。
  - **個人化控制項實作邊界與已知缺陷**：
    - `personalizationControls` 滑桿在 `input` 時僅做即時預覽，僅在 `change` 時寫入 `localStorage`；但檔案上傳圖片限制 `1.5MB`（轉存 Data URL）、影片限制 `5MB`（轉為 `URL.createObjectURL`，頁面重整後即失效）`[nagato-sakura-webos.html:MAX_UPLOAD_BYTES]` `[nagato-sakura-webos.html:MAX_VIDEO_BYTES]`。
    - `#personalization_backgroundMode` 在第 13290–13295 行註冊了一個在 `change` 時對自身呼叫 `bgMode.dispatchEvent(new Event("change"))` 的事件監聽器，觸發時會造成同步遞迴派發風險；同時 `backgroundMode` 切換邏輯會開啟 `#personalization_background_video` 卻未在其他模式切換時將其設回 `none` `[nagato-sakura-webos.html:bgMode]` `[nagato-sakura-webos.html:#personalization_background_video]`。
    - `#personalization_background_panel` 必須置於 `#page-personalization` 之外作為 `.settings-main` 的兄弟節點，方可在主頁面隱藏時顯示子頁面 `[nagato-sakura-webos.html:#personalization_background_panel]`。
- **小工具與系統功能不變量**：
  - `.widget` 強制三段固定高度階層（`.widget-size-1`: 90px、`.widget-size-2`: 160px、`.widget-size-3`: 300px），`.widget-size-toggle` 依 `1 -> 2 -> 3 -> 1` 循環切換；拖曳排序需在非 `.widget-controls`/按鈕/輸入框上長按 `500ms`（垂直移動超過 10px 則取消）`[nagato-sakura-webos.html:.widget]` `[nagato-sakura-webos.html:initWidgetSizeToggle]` `[nagato-sakura-webos.html:initWidgetDragSort]`。
  - 天氣快取 `_checkCache` 要求城市名稱完全相符且快取年齡 `<= 600000ms`（10 分鐘）；效能監控 `computeMetrics` 在 `frameTimes.length <= 10` 前回傳 `cpuEstimate = 0`，其後夾限於 `[5, 100]` `[nagato-sakura-webos.html:_checkCache]` `[nagato-sakura-webos.html:computeMetrics]`。
  - `initWeatherWidget` 與 `initPerfWidget` 分別透過 `widget._weatherInited` 與 `widget._perfInited` 確保單一小工具僅初始化一次 `[nagato-sakura-webos.html:initWeatherWidget]` `[nagato-sakura-webos.html:initPerfWidget]`。
- **內建應用程式契約與實作細節**：
  - **計算機**：DOM 窗口為 `#window-calculator`（`data-app="calculator"`），內部 `#calc-input` 為 `readonly`，在 `onkeydown` 的 `switch` 之後仍執行 `!isNaN(event.key)` 檢查；運算元採用 `Big.js`，但 `square()` 與 `squareRoot()` 會轉成原生 `Number`；除以 0 時 `_calc` 回傳 `null`，`eq()` 顯示 `'錯誤'` 並於 `1400ms` 後重置為 `'0'` `[nagato-sakura-webos.html:#window-calculator]` `[nagato-sakura-webos.html:#calc-input]` `[nagato-sakura-webos.html:Calculator]`。
  - **長門櫻 AI 助理**：對話紀錄上限為 `180` 則、建議按鈕上限為 `3` 個；`ensureNagatoLive2D` 以 `nagatoLive2DReady || nagatoLive2DBooting` 防重入，動態載入 `../../assets/live2d/waifu-tips.js` 與模型 `WL2D-01`（未使用 `../../assets/js/live2d-manager.js`）並移除全域 `#waifu-toggle`；`showNagatoAIBubble` 使用 `options.duration || 5000`，故傳入 `duration: 0` 仍會於 `5000ms` 後自動隱藏 `[nagato-sakura-webos.html:pushNagatoMessage]` `[nagato-sakura-webos.html:ensureNagatoLive2D]` `[nagato-sakura-webos.html:showNagatoAIBubble]`。
  - **瀏覽器**：`iframe.browser-iframe` 設有 `sandbox="allow-scripts allow-same-origin"`，且 `setBrowserUrl` 以 `new URL(u, window.location.href).href` 比對現有 `src`，網址相同時不重複載入或推入 `browserHistory`；`renderFavorites` 直接以 `innerHTML` 插入書籤標題 `[nagato-sakura-webos.html:.browser-iframe]` `[nagato-sakura-webos.html:setBrowserUrl]` `[nagato-sakura-webos.html:renderFavorites]`。
  - **記事本、終端機、相簿、播放器**：四者均無 `localStorage` 持久化；`terminalApp.executeCommand` 會將整行指令先轉小寫再剖析參數；`photosApp.initSidebar` 雖寫入 `currentFolder`，但 `layout`/`viewPhoto`/`viewSlideshow` 並未依資料夾篩選（僅過濾 `style.display !== 'none'`）；`playerApp` 無播放清單且不主動 `revokeObjectURL` `[nagato-sakura-webos.html:notepadApp]` `[nagato-sakura-webos.html:terminalApp.executeCommand]` `[nagato-sakura-webos.html:photosApp.initSidebar]` `[nagato-sakura-webos.html:playerApp]`。

## Side Effects

### 1. `localStorage` 讀寫（共 15 組鍵值）
- `theme`：於 `<head>`、預設個人化設定、主題切換與跨分頁同步時讀寫深淺主題字串（`'dark'` / `'light'`）`[nagato-sakura-webos.html:L8]` `[nagato-sakura-webos.html:loadPersonalizationSettings]`。
- `headerHeight`：於 `<head>` 讀取並寫入 `--header-height` `[nagato-sakura-webos.html:L10-13]`。
- `webos_display_settings`（`DISPLAY_STORAGE_KEY`）：保存亮度、夜燈狀態／強度／排程與導航列隱藏設定 `[nagato-sakura-webos.html:DISPLAY_STORAGE_KEY]` `[nagato-sakura-webos.html:saveDisplaySettings]`。
- `webos_hide_nav_<PAGE_ID>`（`PAGE_HIDE_KEY`）：保存每頁專屬之頂部導航列隱藏布林字串 `[nagato-sakura-webos.html:PAGE_HIDE_KEY]`。
- `offscreenRatio`：保存視窗拖曳允許超出螢幕邊緣之百分比 `[nagato-sakura-webos.html:OFFSCREEN_ALLOW_RATIO]`。
- `webos_personalization_v1`（`PERSONALIZATION_STORAGE_KEY`）：保存主題、強調色、桌布／影片 URL 與模式、工作列位置／圖示大小、字型組／縮放與視窗玻璃效果參數 `[nagato-sakura-webos.html:PERSONALIZATION_STORAGE_KEY]` `[nagato-sakura-webos.html:savePersonalizationSettings]`。
- `desktop_settings`：保存桌面 `sortMode` 與各圖示 `{col, row}` 座標 `[nagato-sakura-webos.html:desktopManager.saveSettings]` `[nagato-sakura-webos.html:desktopManager.loadSettings]`。
- `pinned_apps_order_v1`（`pinnedAppsManager.STORAGE_KEY`）：保存開始功能表釘選應用的 `data-app` 排序陣列 `[nagato-sakura-webos.html:pinnedAppsManager.saveOrder]`。
- `webos_widgets_state_v2`（`WIDGETS_STATE_KEY`）與 `webos_removed_widgets`：保存小工具排列、大小、類型與曾移除類型清單 `[nagato-sakura-webos.html:saveWidgetsState]` `[nagato-sakura-webos.html:initWidgetSizeToggle]`。
- `nagato_conversation_v2`（`NAGATO_KEY`）與 `nagato_suggestions_v2`（`NAGATO_SUGGEST_KEY`）：保存長門櫻對話歷史與建議回覆晶片 `[nagato-sakura-webos.html:NAGATO_KEY]` `[nagato-sakura-webos.html:NAGATO_SUGGEST_KEY]`。
- `sim_favorites_v1`（`favoritesKey`）：保存瀏覽器最愛書籤 `{title, url}` 陣列 `[nagato-sakura-webos.html:favoritesKey]`。
- `webos_weather_cache_v1`（`CACHE_KEY`）與 `webos_update_auto_check_v1`（`AUTO_KEY`）：保存天氣快取 JSON 與自動更新檢查狀態 `[nagato-sakura-webos.html:CACHE_KEY]` `[nagato-sakura-webos.html:AUTO_KEY]`。

### 2. 網路請求與外部資源載入
- **動態模組與 Live2D 資源**：透過 `import("../../assets/live2d/waifu-tips.js")` 與 `window.initWidget` 載入 `live2d.min.js`、`live2dcubismcore.min.js`、`waifu-config.json` 與 `WL2D-01.model3.json` `[nagato-sakura-webos.html:ensureNagatoLive2D]`。
- **天氣與地理反查 API**：`fetchWeatherData` 請求 `https://wttr.in/<city>?format=j1`，失敗時改走 CORS 代理 `https://api.allorigins.win/raw?url=...`；`detectLocationAndUpdateWidget` 呼叫 `navigator.geolocation.getCurrentPosition` 並請求 `https://nominatim.openstreetmap.org/reverse` `[nagato-sakura-webos.html:fetchWeatherData]` `[nagato-sakura-webos.html:detectLocationAndUpdateWidget]`。
- **GitHub 版本更新檢查**：`fetchLatestRelease` 請求 `https://api.github.com/repos/AmanoShizukikun/AmanoShizukikun.github.io/releases/latest`，並可透過 `window.open` 開啟發行頁面 `[nagato-sakura-webos.html:fetchLatestRelease]` `[nagato-sakura-webos.html:doCheckUpdatesUI]`。
- **外部靜態與第三方資源**：`<head>` 與 `<body>` 載入 Font Awesome CDN、Google Fonts、jQuery 3.6.0 與 Big.js 6.2.1 CDN；瀏覽器預載 `https://amanoshizukikun.github.io/` 及 Google `s2/favicons`；新聞小工具載入 `https://placehold.co/100x100/...`；桌布／影片／播放器預載本地相對路徑 `assets/wallpaper/NS-V5-*.jpg`、`assets/videos/NS-V5-*.mp4`、`assets/videos/demo.mp4` 與 `assets/apps/icon/NS-V2.png` `[nagato-sakura-webos.html:renderFavorites]` `[nagato-sakura-webos.html:loadWallpaperIndex]` `[nagato-sakura-webos.html:photosApp]`。

### 3. 計時器、動畫迴圈與全域事件監聽
- **週期性計時器（`setInterval`）與 `requestAnimationFrame`**：
  - 任務欄時鐘 `updateTime`（1000ms）與各時鐘小工具 `updateClock`（1000ms）`[nagato-sakura-webos.html:updateTime]` `[nagato-sakura-webos.html:updateClock]`。
  - 夜燈排程輪詢 `applyScheduleIfNeeded`（60,000ms）`[nagato-sakura-webos.html:applyScheduleIfNeeded]`。
  - 天氣自動刷新 `widget._weatherInterval`（600,000ms）、效能監控 `widget._perfInterval`（1000ms）與全域持續執行之 `requestAnimationFrame(fpsLoop)` `[nagato-sakura-webos.html:initWeatherWidget]` `[nagato-sakura-webos.html:fpsLoop]` `[nagato-sakura-webos.html:initPerfWidget]`。
  - 自動更新檢查輪詢（300,000ms，預設間隔 86,400,000ms）`[nagato-sakura-webos.html:initAboutHelpers]`。
  - 視窗拖曳／縮放 `requestAnimationFrame` 與 `snapHoverTimer`（30ms）、開機步驟 `setTimeout`（200–3500ms + 800ms 移除 DOM）、計算機錯誤重置（1400ms）、長門櫻輸入延遲與氣泡計時器、小工具長按拖曳計時（500ms）與震動回饋 `navigator.vibrate(50)`、相簿幻燈片輪播（4000ms）`[nagato-sakura-webos.html:initBootSequence]` `[nagato-sakura-webos.html:initWidgetDragSort]` `[nagato-sakura-webos.html:photosApp.viewSlideshow]`。
- **DOM 變更、檔案系統／剪貼簿／全螢幕 API 與系統對話框**：
  - 動態操作根節點 CSS 變數、建立／移除臨時任務欄圖示、搬移 `#waifu` 並刪除 `#waifu-toggle`、寫入 `document.body.style.userSelect`/`cursor` 並註冊多組 `document`/`window` 指標、鍵盤、滾輪、`resize` 與 `blur` 監聽器（含 `resizewin` 直接指派 `document.onmousemove`/`ontouchmove` 等）`[nagato-sakura-webos.html:resizewin]` `[nagato-sakura-webos.html:createTaskbarIconIfMissing]`。
  - `FileReader`（圖片 Data URL 與記事本文字檔讀取）、`Blob` 下載（記事本存檔）、`URL.createObjectURL`/`revokeObjectURL`（背景影片與播放器本地媒體）、`document.execCommand` 與 `navigator.clipboard.readText`（記事本編輯）、`requestFullscreen`/`exitFullscreen`（播放器全螢幕），以及 `alert`/`confirm`/`prompt` 同步瀏覽器對話框 `[nagato-sakura-webos.html:notepadApp.saveFile]` `[nagato-sakura-webos.html:playerApp.toggleFullscreen]` `[nagato-sakura-webos.html:photosApp.deletePhoto]`。

## Verification
- Run: `python -m http.server 8000`（本目錄無自動化測試腳本，需透過本地靜態伺服器於瀏覽器開啟 `/projects/nagato-sakura-webos/nagato-sakura-webos.html` 進行手動功能驗證，避免 `file://` 協定阻擋 Live2D ESM 動態匯入與 `iframe` 操作）
