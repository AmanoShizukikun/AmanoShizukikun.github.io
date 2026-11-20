# Wall Climber (Cyber Nexus)

## Overview
`projects/game-center/games/wallclimber/wallclimber.html` 為單一檔案實作的 3D 第一人稱賽博高空跑酷與攀爬遊戲（基於 Three.js r128）。遊戲建置包含建築群、浮空平台、圓柱迷宮、圓弧牆與高空走廊之立體關卡，支援雙段跳、自動抓牆攀爬、頂緣翻越（Vault）、牆面側跑（Wall Run）、衝刺滑鏟、快速下墜與蹬牆跳，並結合 12 分鐘循環晝夜天體陰影系統、Pointer Lock 視角及遊戲中心側邊欄／FPS OSD 整合介面。

## Interface
- 關卡幾何與紋理建構函式（`wallclimber.html`）：`[wallclimber.html:createGlowTexture]`、`[wallclimber.html:makeBox]`、`[wallclimber.html:addWall]`、`[wallclimber.html:addFloatingPlatform]`、`[wallclimber.html:addCylinder]`、`[wallclimber.html:isAngleInArc]`、`[wallclimber.html:addCurvedWall]`、`[wallclimber.html:addBuilding]`、`[wallclimber.html:addSlimTower]`、`[wallclimber.html:addSkywalk]`、`[wallclimber.html:addNeonPillar]`、`[wallclimber.html:createCloudTexture]`，自動將碰撞體積寫入 `[wallclimber.html:walls]`、頂面地板平台寫入 `[wallclimber.html:platforms]`。
- 晝夜循環與時間系統（`wallclimber.html`）：`[wallclimber.html:DAY_DURATION]`（720 秒）、`[wallclimber.html:DAY_NIGHT_KEYFRAMES]`、`[wallclimber.html:getDayNightState]` 與 `[wallclimber.html:formatGameTime]`，計算天空背景、霧效、日／月光色與強度、星辰透明度與雲層色調。
- 物理碰撞與動作狀態機（`wallclimber.html`）：核心狀態物件 `[wallclimber.html:player]` 搭配碰撞／移動函式 `[wallclimber.html:resolveWalls]`（支援 AABB、圓柱與圓弧牆面幾何）、`[wallclimber.html:nearbyClimbWall]`、`[wallclimber.html:detectWallRun]`、`[wallclimber.html:getFloorY]`、`[wallclimber.html:startGame]`、`[wallclimber.html:update]`、`[wallclimber.html:updateCamera]`、`[wallclimber.html:animate]` 與 `[wallclimber.html:setStateUI]`。
- 頁面介面與殼層控制器（`wallclimber.html`）：`[wallclimber.html:togglePause]`、`[wallclimber.html:applyGameContainerMarginHidden]`、`[wallclimber.html:syncSidebarState]`、`[wallclimber.html:updateLayout]`；DOM 介面包含標題畫面 `#titleScreen`（`#startBtn`、`#instructionsBtn`、`#backToGCBtn`）、說明面板 `#instructionsPanel`（`#instructionsBackBtn`）、遊戲主畫布 `#gameMain`／`#canvas`、HUD 指標（`#state-indicator`、`#stamina-fill`、`#h-val`、`#time-widget`、`#time-display`、`#time-phase`）與暫停選單 `#pauseOverlay`（`#pauseResumeBtn`、`#pauseQuitBtn`、`#pauseHomeBtn`）。

## Invariants
- 物理步長夾限與地面防跌落保護：`[wallclimber.html:animate]` 透過 `Math.min(clock.getDelta(), 0.05)` 將單幀 `dt` 鎖定於 50ms 內（暫停時為 `0`），避免低幀率時發生牆體穿隧；`[wallclimber.html:update]` 強制 `player.pos.y < player.height` 時校正回地面高度並重置跳躍次數。
- 台階跨越與弧牆角度容差：`[wallclimber.html:resolveWalls]` 略過 `w.maxY - py_feet < 0.9` 的矮牆障礙以實現流暢踏階；`[wallclimber.html:isAngleInArc]` 具備 `0.08 rad` 角度容差以彌補弧線接縫計算誤差。
- 攀爬與跑牆法線夾角條件：`[wallclimber.html:update]` 要求視線方向與牆面內向法線點積 `lookDotWall > 0.3` 才可進入抓牆攀爬（且依賴 `climbCooldown === 0` 與耐力值 `stamina > 0.001`）；`[wallclimber.html:detectWallRun]` 明確跳過圓柱體並要求 `|dotFwdNormal| <= 0.75`（接近平行貼牆前進）方判定跑牆，最長持續 `1.8s`。
- Pointer Lock 異常位移過濾與自動暫停：當 `pointerlockchange` 偵測失去指標鎖定且 `gameRunning && !gamePaused` 時自動呼叫 `[wallclimber.html:togglePause]`；`mousemove` 監聽器過濾鎖定後 `100ms` 內或單幀位移絕對值超過 `300` 的尖峰數值，並將 `player.pitch` 限制於 `[-1.4, 1.4]` rad。
- 天體陰影俯仰下限與容器視口同步：`[wallclimber.html:update]` 對太陽與月亮陰影方向向量強制 `y >= 0.2` 以消除低仰角無限延長陰影閃爍；`[wallclimber.html:updateLayout]` 依 `.game-container` 實際 `clientWidth`/`clientHeight` 同步 `camera.aspect` 與 `renderer.setSize`。

## Side Effects
- WebGL 渲染、離屏紋理與永續動畫迴圈：建立 `THREE.WebGLRenderer`（啟用 `PCFSoftShadowMap` 2048×2048 陰影、雙向平行光與 `THREE.FogExp2`）與離屏 `<canvas>` 光暈／雲紋理；於最頂層無條件啟動 `[wallclimber.html:animate]` `requestAnimationFrame` 迴圈，運行中每幀更新天體軌道、雲朵漂移、物理向量並寫入 `#state-indicator`、`#stamina-fill`、`#h-val`、`#time-display`、`#time-phase`。
- Pointer Lock 與鍵盤狀態變更：`[wallclimber.html:startGame]`、點擊 `#canvas` 與恢復遊戲呼叫 `canvas.requestPointerLock()`；暫停或離開關卡呼叫 `document.exitPointerLock()`；鍵盤監聽 `WASD`、方向鍵、`Space`、`Shift`、`C`／`Ctrl` 與 `Escape`。
- `localStorage` / `sessionStorage` 與視窗事件同步：`localStorage` 讀取 `theme`、`sidebarCollapsed`、`gcSidebarCollapsed`、`showSidebar`；點擊 `#backToGCBtn` 或 `#pauseHomeBtn` 時寫入 `sessionStorage.skipEntranceAnimation = 'true'` 並導向 `../../game-center.html`；`window` 註冊雙 `resize`（含 100ms 防抖）、`sidebarToggle`、`sidebarVisibilityChange`、`sidebarCollapseChange` 與 `storage` 監聽器。
- 外部資源與站內腳本相依：依賴 Google Fonts、Lucide CDN、Three.js r128 CDN，以及站內 `core.js`、`live2d-manager.js`、`navigation.js`、`animations.js`、`../../js/sidebar.js`、`../../js/fps-osd.js`。

## Verification
- Run: `python -m http.server 8000` （本元件為純靜態單頁 HTML 3D 遊戲且無自動化測試套件；於儲存庫根目錄啟動伺服器後開啟 `/projects/game-center/games/wallclimber/wallclimber.html` 驗證 Pointer Lock 視角、攀爬／跑牆／翻越／滑鏟動作與晝夜循環）
