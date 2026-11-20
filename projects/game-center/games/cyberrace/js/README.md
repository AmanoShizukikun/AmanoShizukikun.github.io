# cyberrace/js

## Overview
本目錄包含 CyberRace 3D 賽車遊戲的前端核心模組群，全部採用非 ES Module 的嚴格模式（`'use strict'`）IIFE 或單例物件實作，透過 `window.*` 全域命名空間向主頁面（`../cyberrace.html`）提供服務。整體依職責分為五大子系統：
1. **車輛物理與動力模擬**：`physics.js`（純公式與單輪／動力模型）與 `vehicle-dynamics.js`（車輛狀態建構、四輪載重與摩擦圓更新、AI 路徑追蹤及護欄／車間碰撞解算）。
2. **3D 場景與視覺建構**：`track-builder.js`（5000 分段柏油路面、排水溝、W-Beam 護欄、捷徑與起終點／檢查點門架）、`car-builder.js`（依 `modelKey` 建構 3D 車輛 `THREE.Group`）、`particle-system.js`（雙組 `THREE.Points` 環形緩衝胎煙與氮氣尾焰）與 `camera-controller.js`（四視角切換、動態 FOV 與飄移側偏相機）。
3. **輸入與觸覺回饋**：`input-haptics.js`（手把軸／鍵邊緣觸發輪詢、選單焦點管理、換檔提醒與雙馬達 ABS／打滑／碰撞震動回饋）。
4. **競技 HUD 與 3D 賽道遙測**：`hud.js`（類比／數位雙模式儀表、旋轉小地圖、四輪三區胎溫遙測面板、漫畫擬聲詞與區間／圈速橫幅）與 `track-telemetry-analyzer.js`（選單階段獨立運作的 3D 賽道高度牆、軌跡追蹤光點與 SVG HUD 疊層分析儀）。
5. **UI 流程與系統設定控制器**：`ui-controller.js`（全螢幕選單狀態機、賽道／車輛篩選與資料快取、暫停與 Horizon 三欄設定選單、音效提示及選單手把輪詢）。

## Interface
- **物理公式與參數庫（`[physics.js:window.CyberRacePhysics]`）**：
  - 常數表：`[physics.js:PHYSICS]`、`[physics.js:TIRE_COMPOUNDS]`（`street`、`sport`、`semiSlick`、`slick`）。
  - 動力與傳動：`[physics.js:getEngineTorque]`、`[physics.js:updateTurboBoost]`、`[physics.js:speedToRPM]`、`[physics.js:getCalibrationFactor]`、`[physics.js:calculateBrakeForce]`、`[physics.js:calculateAeroForces]`、`[physics.js:calculateWeightTransfer]`。
  - 輪胎狀態與 Pacejka 力學：`[physics.js:createTireState]`、`[physics.js:pacejkaTireForce]`、`[physics.js:updateTireTemperature]`、`[physics.js:getTireTemperatureGripMultiplier]`、`[physics.js:updateTirePressure]`、`[physics.js:getTirePressureGripMultiplier]`、`[physics.js:updateTireWear]`、`[physics.js:getTireWearGripMultiplier]`、`[physics.js:getCamberGripEffect]`。
- **車輛動力、AI 與碰撞（`[vehicle-dynamics.js:window.CyberRaceVehicleDynamics]`）**：
  - 核心介面：`[vehicle-dynamics.js:createCar]`（建立含 `tires[0..3]` 與 `aiData` 之車輛狀態物件）、`[vehicle-dynamics.js:updatePhysics]`（輸入融合、自／手排變速與離合器、四輪載重／摩擦圓、飄移與氮氣）、`[vehicle-dynamics.js:updateAI]`、`[vehicle-dynamics.js:handleCollisions]`。
  - 角度工具：`[vehicle-dynamics.js:normalizeAngle]`、`[vehicle-dynamics.js:angleDiff]`、`[vehicle-dynamics.js:moveAngleTowards]`、`[vehicle-dynamics.js:angleToDir]`、`[vehicle-dynamics.js:dirToAngle]`。
  - 依賴輸入／外部符號：讀取 `ctx.keys`、`ctx.gamepadInput`、`ctx.consumePressedKey`、`ctx.getClosestTrackInfo`，並呼叫 `CyberRacePhysics`、`CyberRaceCarBuilder`、`CyberRaceInputHaptics`、`CyberRaceCamera` 與 `window.setTelemetryVisible`（備援 DOM `#telemetryPanel`）。
- **3D 賽道與環境建構（`[track-builder.js:window.CyberRaceTrackBuilder]`）**：
  - 公開方法：`[track-builder.js:init]`（注入 `_ctx`：`THREE`、`scene`、`renderer`、`trackCurve`、`trackWidth`、`trackType`、`altRouteJunctions`、`altRouteSamples`、`selectedTrackKey`、`TRACKS`、`TRACK_SAMPLES`、`CHECKPOINT_RATIOS`）、`[track-builder.js:buildTrackMesh]`、`[track-builder.js:buildTrackEdges]`、`[track-builder.js:buildAltRoutes]`、`[track-builder.js:buildStartFinishLine]`、`[track-builder.js:buildCheckpoints]`（回傳 `{ checkpointMeshes, checkpointIndices }`）、`[track-builder.js:buildEnvironment]`。
  - 內部紋理與門架：`[track-builder.js:createAnimeAsphaltTexture]`、`[track-builder.js:createGantryBannerTexture]`、`[track-builder.js:createCheckeredGroundTexture]`、`[track-builder.js:isNearJunctionOpening]`、`[track-builder.js:buildGantryArch]`。
- **3D 車輛模型與粒子特效**：
  - `[car-builder.js:window.CyberRaceCarBuilder]`：匯出 `[car-builder.js:createCarMesh]`，支援 `ae86*`（含 `isCarbonHood`）、`fd3s*`（含 `isReAmemiya` 寬體）、`fc3s*`、`gc8_sti` 及通用預設外型，回傳 `THREE.Group`。
  - `[particle-system.js:window.CyberRaceParticles]`：匯出 `[particle-system.js:init]`、`[particle-system.js:emitTireSmokePerWheel]`（`tier` 1/2/3）、`[particle-system.js:emitBoostFlame]`、`[particle-system.js:update]`、`[particle-system.js:clear]`。
- **攝影機控制器（`[camera-controller.js:window.CyberRaceCamera]`）**：
  - 公開介面：`MODES`（別名 `[camera-controller.js:CAMERA_MODES]`，含 `chase_close`、`chase_far`、`hood`、`bumper`）、`[camera-controller.js:init]`、`[camera-controller.js:cycleMode]`、`[camera-controller.js:setMode]`、`[camera-controller.js:update]`、`[camera-controller.js:snapToPlayer]`、`[camera-controller.js:resetHeading]`、`[camera-controller.js:getCurrentMode]`。
  - 存取 DOM ID：`#hudCamToast`、`#camToastName`、`#hudCamName`。
- **手把輸入、變速箱與觸覺回饋（`[input-haptics.js:window.CyberRaceInputHaptics]`）**：
  - 公開介面：`[input-haptics.js:GEAR_MAX_SPEEDS]`、`[input-haptics.js:GEAR_ACCEL_MULS]`、`[input-haptics.js:menuFocusManager]`、`[input-haptics.js:showShiftToast]`、`[input-haptics.js:getGearDisplayString]`（另匯出 `[input-haptics.js:window.getGearDisplayString]`）、`[input-haptics.js:cleanGamepadName]`、`[input-haptics.js:updateGamepadStatusUI]`、`[input-haptics.js:setTransmissionMode]`、`[input-haptics.js:getTransmissionMode]`、`[input-haptics.js:updateTransModeButtonsUI]`、`[input-haptics.js:updateGamepadVibration]`、`[input-haptics.js:triggerTestVibration]`、`[input-haptics.js:pollGamepad]`。
  - 存取 DOM ID：`#hudShiftToast`、`#shiftToastIcon`、`#shiftToastMsg`、`#pauseGamepadStatus`、`#trackSelectBackBtn`、`#carSelectBackBtn`、`#aiDifficultyBackBtn`、`#instructionsBackBtn`、`#pauseResumeBtn` 及 `.trans-mode-btn`、`data-trans`。
- **遊戲 HUD 與 2D 儀表／小地圖（`[hud.js:window.CyberRaceHUD]`）**：
  - 公開介面：`[hud.js:init]`、`[hud.js:updateHUD]`、`[hud.js:updateTelemetryPanel]`、`[hud.js:updateDriftSFX]`、`[hud.js:spawnInitialDSFX]`、`[hud.js:drawGaugeCanvas]`、`[hud.js:drawRoundRectHelper]`、`[hud.js:initMinimap]`、`[hud.js:drawMinimap]`、`[hud.js:triggerCPFeedback]`、`[hud.js:triggerLapBanner]`、`[hud.js:setGaugeStyle]`、`[hud.js:gaugeStyle]`（唯讀 getter）。
  - 存取 DOM ID：`#raceHUD`、`#telemetryPanel`、`#speedVignette`、`#hudSpeed`、`#hudProgress`、`#hudProgressTitle`、`#hudRightLapBadge`、`#hudRightLapVal`、`#hudPosition`、`#hudPosSuffix`、`#hudTimer`、`#hudRightPanelTitle`、`#hudDrift`、`#rpmGearValue`、`#cpRowItem1`–`4`／`#cpName1`–`4`／`#cpTime1`–`4`／`#cpSplit1`–`4`、`#telCompound`、`#telTemp{FL,FR,RL,RR}_{O,M,I}`、`#telPress{FL,FR,RL,RR}`、`#telWear{FL,FR,RL,RR}`、`#telCam{FL,FR,RL,RR}`、`#telLatG`、`#telLongG`、`#gaugeCanvas`、`#gaugeDigital`、`#digiRPM`、`#digiGear`、`#digiSpeed`、`#digiBoostFill`、`#digiNitroPct`、`#minimapCanvas`、`#hudCPBanner`、`#cpBannerTitle`、`#cpBannerTime`、`#cpBannerSplit`。
- **3D 賽道遙測分析儀（`[track-telemetry-analyzer.js:window.TrackAnalyzer]`）**：
  - 公開方法：`[track-telemetry-analyzer.js:TrackAnalyzer.init]`、`[track-telemetry-analyzer.js:TrackAnalyzer.createHeightWallTexture]`、`[track-telemetry-analyzer.js:TrackAnalyzer.loadRouteData]`、`[track-telemetry-analyzer.js:TrackAnalyzer.getRouteCenter]`、`[track-telemetry-analyzer.js:TrackAnalyzer.getRouteBoundingBox]`、`[track-telemetry-analyzer.js:TrackAnalyzer.fitTopDownCamera]`、`[track-telemetry-analyzer.js:TrackAnalyzer.createOnTrackReticleMesh]`、`[track-telemetry-analyzer.js:TrackAnalyzer.rebuildRouteMeshes]`、`[track-telemetry-analyzer.js:TrackAnalyzer.updateHudOverlay]`、`[track-telemetry-analyzer.js:TrackAnalyzer.updateCompass]`、`[track-telemetry-analyzer.js:TrackAnalyzer.updateTracerPosition]`、`[track-telemetry-analyzer.js:TrackAnalyzer.setCameraMode]`（`'iso' | 'follow' | 'top' | 'free'`）、`[track-telemetry-analyzer.js:TrackAnalyzer.setupEventListeners]`、`[track-telemetry-analyzer.js:TrackAnalyzer.onWindowResize]`、`[track-telemetry-analyzer.js:TrackAnalyzer.animate]`。
  - 存取 DOM ID：`#analyzer-canvas-container`、`#hud-svg-overlay`、`#compass-dial`、`#progress-percent`、`#cam-iso`、`#cam-follow`、`#cam-top`、`#cam-free`、`#btn-play-pause`、`#play-icon`、`#btn-restart`、`#scrubber-slider`、`#btn-toggle-scrubber`、`#scrubber-wrapper`、`#toggle-scrubber-icon`、`#btn-toggle-perspective`、`#perspective-wrapper`、`#toggle-perspective-icon`、`#toggle-wall`、`#toggle-grid`、`#toggle-nodes`。
- **UI 流程與選單控制器（`[ui-controller.js:CyberRaceUI]`）**：
  - 模組匯出：`window.CyberRaceUI` 暴露 `{ init }`（`[ui-controller.js:init]`）。
  - 掛載至 `window` 之全域函式：`[ui-controller.js:loadTrackData]`（`window.loadTrackData`），以及 `init` 期間綁定之 23 個供 HTML `onclick` 與外部呼叫之函式：`window.selectMode`、`window.getSelectedGameMode`、`window.navigateTo`、`window.goBack`、`window.goBackHome`、`window.confirmCourse`、`window.confirmCar`、`window.startGame`、`window.setOpt`、`window.switchTrackFilter`、`window.switchCarFilter`、`window.selectTrackFilterVal`、`window.selectCarFilterVal`、`window.onTrackCardClick`、`window.onCarCardClick`、`window.handleFooterAction`、`window.toggleModal`、`window.switchModalTab`、`window.restartCurrentRace`、`window.hideExitConfirm`、`window.exitToMenu`、`window.openGameSettingsPage`、`window.navigateToPausePage`。
  - 主要管理面板／設定資料：`[ui-controller.js:HORIZON_SETTINGS_CONFIG]`、`[ui-controller.js:renderHorizonSettingsList]`、`[ui-controller.js:handlePauseMenuAction]`、`[ui-controller.js:pollGamepad]`、`[ui-controller.js:loadTracksIndex]`、`[ui-controller.js:loadCarsIndex]`、`[ui-controller.js:drawCarCanvas]`、`[ui-controller.js:drawTrackCanvas]`。
  - 事件監聽：`window` 上註冊 `'resize'`（100ms debounce）、`'sidebarToggle'`、`'sidebarVisibilityChange'`、`'sidebarCollapseChange'`、`'storage'`、`'keydown'`、`'gamepadconnected'`、`'gamepaddisconnected'`。

## Invariants
- **初始化與全域相依順序**：
  - 所有建構／渲染模組依賴全域 `THREE`（或傳入之 `THREE_LIB`）：`[car-builder.js:createCarMesh]` 缺乏 `THREE` 回傳 `null`；`[particle-system.js:init]` 缺乏 `_scene` 或 `_THREE` 直接返回；`[track-builder.js:buildStartFinishLine]` 與 `[track-builder.js:buildCheckpoints]` 直接存取全域 `THREE.Vector3` 而非 `_ctx.THREE`，且 `[track-builder.js:init]` 必須先於任何 `build*` 呼叫，否則解構 `_ctx` 會拋出例外。
  - `[track-telemetry-analyzer.js:TrackAnalyzer.init]` 採單例防護（`isInitialized === true` 或缺少 `#analyzer-canvas-container` 時早退）；在尚未初始化前呼叫 `[track-telemetry-analyzer.js:TrackAnalyzer.loadRouteData]` 會先暫存至 `pendingData` 並觸發 `init()` 延後消費。
  - `[camera-controller.js:update]` 若偵測 `!camHeadingInit`，首幀強制呼叫 `[camera-controller.js:snapToPlayer]` 立即對齊並返回，避免從原點插值偏移；`[camera-controller.js:setMode]` 僅接受 `[0, CAMERA_MODES.length - 1]` 索引。
- **物理與動態數值夾限**：
  - `[physics.js:updateTurboBoost]` `NA` 車型強制 `currentBoostPSI = 0` 回傳 `1.0`；`lagSec` 下限 `0.05` 秒，增壓係數固定 `1.0 + currentBoostPSI * 0.065`。
  - `[physics.js:updateTireTemperature]` 三區溫度夾限 `[25, 220]`°C；`[physics.js:updateTireWear]` 磨耗下限 `0`；`[physics.js:getTireTemperatureGripMultiplier]` / `[physics.js:getTirePressureGripMultiplier]` / `[physics.js:getTireWearGripMultiplier]` 抓地力下限分別為 `0.62`/`0.85`、`0.70`/`0.85`、`0.60`。
  - `[vehicle-dynamics.js:updatePhysics]` 手把軸／板機死區門檻為 `> 0.05`；Feint 甩尾需同時滿足 `steerDeltaRate > 5.5`、轉向反向且 `|speed| > 0.12`；`manual_clutch` 模式需 `clutchInput >= 0.3` 才允許換檔，檔位限定於 `[-1, maxGear]`，引擎轉速夾限 `[idleRpm, maxRpm]`，紅線 `>= 0.98 * maxRpm` 觸發 `0.1` 斷油；四輪載重下限 `100`，摩擦圓超出 `maxTractionForce` 時等比例縮放縱向與側向力；`nitroEnergy` 夾限 `[0, 1.0]`；四輪輪胎磨耗／溫度／胎壓僅於 `car.isPlayer` 時更新。
  - `[vehicle-dynamics.js:handleCollisions]` 玩家／AI 碰撞護欄推回距離為 `boundary - 1.1` 並保留最低速 `PHYSICS.wallMinSpeed`；車間碰撞僅於 `0.01 < dist < PHYSICS.carCollisionDist` 執行防零除。
- **賽道拓撲、捷徑與座標變換不變量**：
  - `[track-builder.js:buildTrackMesh]` 與 `[track-builder.js:buildTrackEdges]` 依 `trackType === 'circuit'` 決定環形取模或夾限 `[0, 5000]`，遇零切線／零外積退回 `(0, 0, 1)`／`(1, 0, 0)`；護欄與排水溝網格達最小頂點數（`flushGutter` `>= 12` 浮點數；`flushRail` `>= 30` 浮點數）才建立 `Mesh`，並依左／右側反轉三角形繞序維持法線。
  - `[track-telemetry-analyzer.js:TrackAnalyzer.loadRouteData]` 在 `Circuit` 模式強制 `startIdx = 0`、`finishIdx = 0`、`checkPoints = []`；`PTP` 模式於 `direction === 'reverse'` 時互換 `startIdx`/`finishIdx` 並反轉 `checkpoints` 與 `altRoutes` 點列；退化外積（`lengthSq < 0.0001`）一律退回 `(1, 0, 0)`。
- **輸入節流、狀態鎖定與選單不變量**：
  - `[input-haptics.js:showShiftToast]` 忽略 `'GEAR '` 開頭字串；`[input-haptics.js:updateGamepadVibration]` 僅在 `vibrationEnabled`、有致動器且 `userIntensity > 0` 時作用，雙馬達輸出夾限 `[0.0, 1.0]`，輸出節流 `100ms` 且變化須 `> 0.05`；`[input-haptics.js:menuFocusManager.navigate]` 節流 `180ms`；`[input-haptics.js:pollGamepad]` 僅讀取首個 `pad.connected` 裝置，左搖桿死區 `0.15`。
  - `[hud.js:updateHUD]` `linear` 賽道未達 `totalProgress >= 0.999` 前進度顯示上限 `99%`；`[hud.js:drawGaugeCanvas]` 僅支援 `300x300` 類比畫布（圓心 `(150, 150)`）；`[hud.js:triggerCPFeedback]` 僅在歷史最佳 `prevBestCP === 0 || currentTime < prevBestCP` 時寫入新紀錄。
  - `[ui-controller.js:init]` 暫停與設定鍵盤防抖共用 `lastPauseToggleTime`（鍵盤 `300ms`、手把切換 `350ms`、手把方向 `200ms`）；`[ui-controller.js:HORIZON_SETTINGS_CONFIG]` 中標記 `lockedInRace: true` 之項目（`transmission`、`tireWear`）於 `Game.getState() !== 'menu'` 時禁用修改；`[ui-controller.js:navigateTo]` 禁止重複推入相同 `screenId` 至 `historyStack`，且 `time_attack` 模式在 `[ui-controller.js:confirmCar]` 時跳過 `#screen-ai` 直接開賽。

## Side Effects
- **全域命名空間與物件狀態**：
  - 各模組分別寫入 `window.CyberRacePhysics`、`window.CyberRaceVehicleDynamics`、`window.CyberRaceTrackBuilder`、`window.CyberRaceCarBuilder`、`window.CyberRaceParticles`、`window.CyberRaceCamera`、`window.CyberRaceInputHaptics`、`window.getGearDisplayString`、`window.CyberRaceHUD`、`window.TrackAnalyzer`、`window.CyberRaceUI`、`window.loadTrackData`、`window.gameSettings` 及 23 個 UI 操作函式。
  - `[physics.js:updateTurboBoost]`、`[physics.js:updateTireTemperature]`、`[physics.js:updateTirePressure]`、`[physics.js:updateTireWear]` 與 `[vehicle-dynamics.js:updatePhysics]`／`[vehicle-dynamics.js:updateAI]`／`[vehicle-dynamics.js:handleCollisions]` 就地突變 `car`、`car.tires[0..3]`、`car.aiData` 與碰撞目標車 `other` 之位置／速度屬性。
- **Three.js / WebGL 場景與緩衝區操作**：
  - `[track-builder.js:buildTrackMesh]` / `buildTrackEdges` / `buildAltRoutes` / `buildGantryArch` / `buildEnvironment` 與 `[particle-system.js:init]` 向傳入 `scene` 新增網格、燈光與點雲（`[particle-system.js:clear]` 與 `[track-telemetry-analyzer.js:TrackAnalyzer.rebuildRouteMeshes]` 移除舊物件時皆未呼叫 `.dispose()`）。
  - `[particle-system.js:emitTireSmokePerWheel]`、`[particle-system.js:emitBoostFlame]`、`[particle-system.js:update]` 原地覆寫環形 `Float32Array` 並設定 `needsUpdate = true`；`[vehicle-dynamics.js:createCar]` 將車輛網格加入 `ctx.scene` 並持續更新 `car.mesh.position` 與 `rotation`。
  - `[camera-controller.js:update]` / `snapToPlayer` 修改 `camera.position`、`camera.fov`、`updateProjectionMatrix()` 及 `player.mesh.visible`。
  - `[track-telemetry-analyzer.js:TrackAnalyzer]` 於 `#analyzer-canvas-container` 建立獨立 `WebGLRenderer`、`OrbitControls`、`ResizeObserver` 與 `requestAnimationFrame` 主迴圈，並於離屏 `<canvas>` 繪製紋理。
- **DOM、Canvas 2D 與 SVG 操作**：
  - `[hud.js:updateHUD]`、`updateTelemetryPanel`、`drawGaugeCanvas`、`drawMinimap`、`spawnInitialDSFX`、`triggerCPFeedback`、`triggerLapBanner` 持續更新 HUD 文字／樣式、重繪 `#gaugeCanvas` 與 `#minimapCanvas`，並於 `#raceHUD` 動態插入／移除 `<div class="initial-d-sfx">` 節點；`[hud.js:updateHUD]` 亦會呼叫 `window.updateOSDGameInfo`。
  - `[ui-controller.js:init]` 及相關輔助函式操作側邊欄版面、透過 `innerHTML` 重繪賽道／車輛清單與 Horizon 設定列、於 `#carCanvas` 繪製車輛側面線稿、更新輸入裝置提示與焦點 `scrollIntoView`，並呼叫 `lucide.createIcons()` 與 `Navigation.init()` / `Core.initBackground()` / `Game.*`。
  - `[camera-controller.js:showCameraToast]`、`[input-haptics.js:showShiftToast]`、`[input-haptics.js:menuFocusManager]` 修改對應 Toast／焦點元素 `classList` 與文字，並模擬 `.click()`。
- **網路請求（`fetch`）與 Web Storage**：
  - `[ui-controller.js:loadTracksIndex]` 請求 `./data/tracks/tracks_index.json`；`[ui-controller.js:loadCarsIndex]` 請求 `./data/cars/cars_index.json`；`[ui-controller.js:loadTrackData]` 請求 `./data/tracks/${trackId}.json` 並快取至 `trackDataCache`。
  - `localStorage` 讀寫：`transmissionMode`（`input-haptics.js`、`ui-controller.js`）、`gaugeStyle`（`hud.js`、`ui-controller.js`）、`cyberRacer_best_cp_*`（`hud.js`）、`showSidebar`／`sidebarCollapsed`／`gcSidebarCollapsed`／`tireWearEnabled`／`vibrationEnabled`／`vibrationIntensity`／`telemetryVisible`／`fpsOSDActive`／`fpsOSDVisible`（`ui-controller.js`、`vehicle-dynamics.js`）。
  - `sessionStorage` 寫入與導頁：`[ui-controller.js:goBackHome]` 設定 `skipEntranceAnimation = 'true'` 並導頁至 `../../game-center.html`。
- **AudioContext、手把震動、計時器與非確定性**：
  - `[ui-controller.js:playBeep]` 建立並恢復 `AudioContext`，產生振盪器＋增益音效；`[input-haptics.js:updateGamepadVibration]` 與 `[input-haptics.js:triggerTestVibration]` 呼叫手把 `vibrationActuator.playEffect` / `pulse` / `reset`；`[ui-controller.js:pollGamepad]` 與 `[track-telemetry-analyzer.js:TrackAnalyzer.animate]` 持續排程 `requestAnimationFrame`。
  - `setTimeout` / `clearTimeout`：`camera-controller.js`（1800ms）、`input-haptics.js`（1200ms）、`hud.js`（580ms、2200ms）、`ui-controller.js`（100ms resize debounce、80ms 確認音效）。
  - `Math.random()` 非確定性：`[physics.js:getEngineTorque]`（超轉抖動）、`[track-builder.js:createAnimeAsphaltTexture]`／`buildEnvironment`、`[particle-system.js:emitTireSmokePerWheel]`／`emitBoostFlame`、`[hud.js:spawnInitialDSFX]`／`updateDriftSFX`、`[vehicle-dynamics.js:createCar]`／`updateAI`。

## Verification
- Run: `無自動化測試套件；請於專案根目錄啟動靜態 HTTP 伺服器後，在瀏覽器開啟 ../cyberrace.html 並檢視 DevTools Console 確認無載入錯誤，實機測試選單、3D 賽道遙測與比賽物理／HUD／手把流程`
