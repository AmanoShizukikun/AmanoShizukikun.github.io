# NSRoom (長門櫻的房間 3D 導覽)

## Overview
`projects/game-center/games/nsroom/` 為「長門櫻的房間」純瀏覽器 3D 沉浸式互動導覽模組（入口 `nsroom.html`、主邏輯 `app.js`、I/B/L 室內環境貼圖場景 `RoomEnvironment.js`、液態玻璃 UI 樣式 `styles.css`、靜態 3D 模型 `nagato_sakura_room.glb`）。系統整合 Three.js r128、`OrbitControls`、`GLTFLoader` 與 `Tween.js`，提供 6 組預設運鏡、6 個 3D-to-2D 投影資訊熱點、晨曦／夕照／夜色三種光影氛圍切換、2D Canvas 櫻花粒子雨、Web Audio 程序化 Lo-Fi 治療音效，以及依網格材質色彩衍生深色描邊的反轉外殼（Inverted Hull）動漫輪廓系統。

## Interface
- 環境反射場景（`RoomEnvironment.js`）：`[RoomEnvironment.js:RoomEnvironment]` 繼承 `THREE.Scene` 並掛載為 `[RoomEnvironment.js:THREE.RoomEnvironment]`，透過 `[RoomEnvironment.js:createAreaLightMaterial]` 配置包圍盒、1 盞點光源、6 個遮光／反射方塊與 6 面區域光模擬板，供 `[app.js:pmremGenerator]` 生成環境反射貼圖 `envTexture`。
- 攝影機與運鏡預設（`app.js` / `nsroom.html`）：`[app.js:CAMERA_PRESETS]` 定義 `iso`、`charm`、`bed`、`desk`、`bookshelf`、`window` 六組位置／目標／FOV；`[app.js:flyToCamera]` 使用 Tween.js 平滑移動鏡頭並同步 `#views-group` 內按鈕（`#view-iso`、`#view-charm`、`#view-bed`、`#view-desk`、`#view-bookshelf`、`#view-window`，具 `data-view` 屬性）與 `#btn-reset-view`。
- 互動熱點系統（`app.js` / `nsroom.html`）：`[app.js:HOTSPOTS_DATA]` 定義 `hotspot-charm`、`hotspot-bed`、`hotspot-desk`、`hotspot-bookshelf`、`hotspot-rug`、`hotspot-window` 六個互動點；`[app.js:createHotspots]` 於 `#hotspots-layer` 產生 `.hotspot-pin`，`[app.js:updateHotspots]` 每幀更新螢幕投影；點擊熱點開啟 `#hotspot-modal`（`#modal-badge`、`#modal-title`、`#modal-desc`、`#modal-focus-btn`、`#modal-close`）。
- 氛圍燈光與動漫描邊（`app.js` / `nsroom.html`）：`[app.js:ATMOSPHERES]` 定義 `morning`、`sunset`、`night` 光照組態，由 `[app.js:setAtmosphere]` 控制 `[app.js:ambientLight]`、`[app.js:hemiLight]`、`[app.js:sunLight]`、`[app.js:roomFillLight]`、`[app.js:deskLampLight]` 與曝光值（對應 `#lighting-group` 之 `#light-morning`、`#light-sunset`、`#light-night`）。描邊著色器 `[app.js:_OUTLINE_VS]`／`[app.js:_OUTLINE_FS]` 透過 `[app.js:getDerivedOutlineColor]`、`[app.js:makeOutlineMaterial]`、`[app.js:buildOutlineMeshes]`、`[app.js:setOutlineVisible]` 運作，並由 `#btn-outline` 切換顯示（註：`nsroom.html` 雖載入 `EffectComposer.js`、`RenderPass.js`、`ShaderPass.js`、`CopyShader.js`，但 `app.js` 實際使用 `renderer.render(scene, camera)` 直接渲染）。
- 落櫻特效、音訊與狀態樣式（`app.js` / `nsroom.html` / `styles.css`）：`[app.js:SakuraPetal]` 與 `[app.js:animateSakura]` 繪製 `#sakura-canvas`；`[app.js:HealingAudioSystem]` 提供 `init`、`playNote`、`playChime`、`scheduleNextChord`、`start`、`stop` 驅動 `#btn-soundtrack`；輔助按鈕包含 `#btn-help`（控制 `#help-modal`、`#help-close`、`#help-confirm-btn`）、`#btn-auto-rotate`、`#btn-sakura-rain`、`#btn-toggle-hotspots`；樣式系統依賴 `[styles.css:.active]`、`[styles.css:.hidden]`、`[styles.css:.entered]` 與 `[styles.css:.fade-out]`。

## Invariants
- 鏡頭地板防穿模與運鏡鎖定：`[app.js:controls]` 設定 `maxPolarAngle = Math.PI / 2 - 0.01`（且 `minDistance = 1.0`、`maxDistance = 22.0`）防止視角穿入地板下方；`[app.js:flyToCamera]` 補間期間強制設定 `controls.enabled = false` 與 `isCameraMoving = true`，完成後才解鎖操控。
- 選擇性環境貼圖不變量：`[app.js:scene]` 刻意不設定 `scene.environment = envTexture`，僅在載入 `nagato_sakura_room.glb` 時針對 `metalness > 0.5` 或材質名稱含 `'metal'` 的網格套用 `envMap`，避免整體場景遭環境光貼圖過度洗白。
- 雙面材質、陰影剔除與描邊透明過濾：載入 GLB 時會移除模型內嵌燈光（`child.isLight`）；僅對材質名稱含 `'curtain'`、`'leaf'`、`'glass'` 者啟用 `THREE.DoubleSide`；名稱含 `'glass'`、`'sky'`、`'backdrop'`、`'sheer'` 的網格強制 `castShadow = false` 以免阻擋陽光；`[app.js:buildOutlineMeshes]` 略過 `transparent && opacity < 0.5` 的半透明材質。
- 熱點視錐與進場遮罩保護：`[app.js:updateHotspots]` 僅計算已具備 `.entered` 類別的熱點，並以 `tempV.z < 1.0` 隱藏位於鏡頭後方之熱點（不執行 3D 射線遮擋判斷）。
- 自動播放政策合規：`[app.js:HealingAudioSystem]` 於點擊 `#btn-soundtrack` 時才惰性建立或 `resume()` `AudioContext`。

## Side Effects
- 網路請求與 GLTF 模型載入：`nsroom.html` 自 Google Fonts 與 cdnjs/jsdelivr 載入字型與 Three.js 相依庫；`[app.js:loader]` 使用 `GLTFLoader` 發起網路請求讀取同目錄 `nagato_sakura_room.glb`（於 `file://` 協定開啟將失敗並顯示錯誤提示卡片），同步更新 `#loading-screen`、`#progress-bar` 與 `#progress-text`。
- WebGL 渲染與雙重動畫迴圈：`[app.js:renderer]` 掛載至 `#canvas-container`，由 `[app.js:animate]` 與 `[app.js:animateSakura]` 持續執行兩條獨立 `requestAnimationFrame` 迴圈；`window` 註冊 `resize` 事件同步重設攝影機長寬比、WebGL 尺寸與 `#sakura-canvas` 解析度。
- DOM 動態變更與計時器：`[app.js:createHotspots]` 動態生成熱點 DOM 並每幀寫入 `style.left`、`style.top`、`visibility`、`pointerEvents`；模型載入完成後透過多組 `setTimeout`（`400ms`、`1000ms`、`800ms` 及 `index * 100ms`）淡出 `#loading-screen` 並逐一加入 `.entered`；`[app.js:HealingAudioSystem.scheduleNextChord]` 每 `4000ms` 排程 `setTimeout` 觸發和弦與風鈴振盪器輸出至 `audioCtx.destination`。
- 本地儲存與跨視窗通訊：無（程式碼中未使用 `localStorage`、`sessionStorage` 或 `postMessage`）。

## Verification
- Run: `node --check projects/game-center/games/nsroom/RoomEnvironment.js && node --check projects/game-center/games/nsroom/app.js` （並於儲存庫根目錄執行 `python -m http.server 8000` 後透過瀏覽器開啟 `/projects/game-center/games/nsroom/nsroom.html` 驗證 3D 模型、熱點與燈光轉場）
