# assets/live2d

## Overview
Live2D 看板娘前端元件目錄，整合官方 Cubism Core / Cubism 2 執行期廠商函式庫、封裝為 ES Module 的 Cubism Web SDK 渲染框架，以及控制看板娘 UI、互動提示詞、換裝/模型切換、畫面截圖與自由編輯模式的啟動器。本目錄同時包含提示詞與模型清單設定檔 `waifu-config.json`（並透過路徑參照本目錄下 `animations/` 動作檔與 `model/` 模型資料夾，靜態模型/二進位資源與 `live2d.css` 不在此展開）。

## Interface
- `waifu-tips.js`（看板娘控制層與 ES Module）：
  - 全域入口與編輯模式 API：`[waifu-tips.js:window.initWidget]` 負責檢查 `waifu-display` 隱藏狀態、插入 `#waifu-toggle` 並啟動 `[waifu-tips.js:loadWidget]`；`[waifu-tips.js:window.waifuEditMode]` 暴露 `toggle()`、`enter()`、`exit()`、`reset()`、`close()` 與 `active` 唯讀屬性；模組尾端匯出 `[waifu-tips.js:export]`（`export { logger as l }`）供 `live2d-framework.js` 引入。
  - 模型與工具管理類別：`[waifu-tips.js:ModelManager]`（含靜態 `initCheck`、`loadLive2D`、`loadModel`、`autoFitModel`、`getCubismModel`、`setModelParameter`、`applyParamOutfits`、`loadRandTexture`、`loadNextModel`、`resetCanvas`、`checkModelVersion`、`fetchWithCache`、`loadTextureCache`）與 `[waifu-tips.js:ToolsManager]`（`registerTools` 註冊 `hitokoto`、`switch-model`、`switch-texture`、`photo`、`info`、`quit` 六項工具按鈕）。
  - 提示詞與輔助函式：`[waifu-tips.js:showMessage]`、`[waifu-tips.js:getModelMessage]`、`[waifu-tips.js:detectPageKey]`、`[waifu-tips.js:enqueuePendingMotion]`、`[waifu-tips.js:triggerSpeechExpressionMotion]`、`[waifu-tips.js:pauseLive2D]`、`[waifu-tips.js:resumeLive2D]`、`[waifu-tips.js:Logger]`（實例 `logger`）、`loadScript`、`randomSelection`、`nextIndex`、`templateReplace`、`throttle`。
- `live2d-framework.js`（Cubism 5 Web SDK 框架層）：
  - 匯入與匯出：頂部執行 `import { l as t } from "./waifu-tips.js"`，尾端匯出 `[live2d-framework.js:AppDelegate]`（內部類別 `[live2d-framework.js:bs]`）。
  - 應用與畫布委派：`[live2d-framework.js:bs]`（`AppDelegate`，繼承 `[live2d-framework.js:Ms]` `LAppDelegate`）提供 `initialize()`、`run()`、`stop()`、`release()`、`changeModel(path)`、`initializeSubdelegates()`、`initializeEventListener()`、`releaseEventListener()`、`transformOffset()`、`onMouseMove()`、`onMouseEnd()`、`onTap()` 與 `subdelegates`；搭配 `[live2d-framework.js:vs]`（`AppSubdelegate`，繼承 `[live2d-framework.js:Cs]`）、`[live2d-framework.js:ds]`（`LAppLive2DManager`）、`[live2d-framework.js:gs]`（`LAppModel`）、`[live2d-framework.js:_s]`（`LAppTextureManager`）、`[live2d-framework.js:Ss]`（`LAppView`）、`[live2d-framework.js:ys]`（`TouchManager`）與 `[live2d-framework.js:ms]`（`CubismViewMatrix`）。
  - 核心 SDK 子系統（映射至 Cubism 命名空間）：`[live2d-framework.js:$]`（`CubismFramework`）、`[live2d-framework.js:Wi]`（`CubismModel`）、`[live2d-framework.js:Ji]`（`CubismMoc`）、`[live2d-framework.js:rs]`（`CubismUserModel`）、`[live2d-framework.js:zi]`（`CubismRenderer_WebGL`）、`[live2d-framework.js:Ai]`（`CubismClippingManager_WebGL`）、`[live2d-framework.js:Mi]`（`CubismShader_WebGL`）、`[live2d-framework.js:vi]`（`CubismShaderManager_WebGL`）、`[live2d-framework.js:Be]`（`CubismMotion`）、`[live2d-framework.js:we]`（`CubismMotionManager`）、`[live2d-framework.js:Ot]`（`CubismExpressionMotion`）、`[live2d-framework.js:Zt]`（`CubismExpressionMotionManager`）、`[live2d-framework.js:ii]`（`CubismPhysics`）、`[live2d-framework.js:Mt]`（`CubismPose`）、`[live2d-framework.js:ft]`（`CubismBreath`）、`[live2d-framework.js:St]`（`CubismEyeBlink`）、`[live2d-framework.js:pt]`（`CubismModelSettingJson`）、`[live2d-framework.js:at]`（`LAppPal`）與 WebGL 上下文封裝 `[live2d-framework.js:nt]`。
- `waifu-config.json`（看板娘設定檔）：
  - 定義 `message`（全域互動提示與 `animations` 動作檔陣列 `/assets/live2d/animations/hiyori_m01.motion3.json`–`hiyori_m10.motion3.json`）、`modelMessages`（依 `NS-V5`、`L2D-CMT-01`、`WL2D-01` 覆寫 `default`、`hitokoto`、`tapBody`、`hoverBody`）、`mouseover`、`click`、`seasons`、`time`、`pageMessages`（`about`、`nagato-sakura`）及 `models` 陣列（分別引用 `/assets/live2d/model/NS-V5-Ver1.2/NS-V5-Ver1.2.model3.json` 含 `paramOutfits: { paramId: "ParamCloth", values: [-2, -1, 0, 1] }`、`/assets/live2d/model/L2D-CMT-01ver2.3_vts/L2D-CMT-01.model3.json` 與 `/assets/live2d/model/WL2D-01_vts/WL2D-01.model3.json`）。
- 第三方壓縮執行期程式庫（依標頭與全域匯出檢查）：
  - `live2d.min.js`：Cubism 2 WebGL Redistributable 執行期程式庫，將 `Live2D`、`Live2DModelWebGL`、`Live2DModelJS`、`Live2DMotion`、`MotionQueueManager`、`PhysicsHair`、`AMotion`、`LDTransform`、`LDGL`、`PartsDataID`、`DrawDataID`、`BaseDataID`、`ParamID`、`UtDebug`、`UtSystem` 註冊至 `window` 全域並於載入時執行 `Live2D.init()`（`[live2d.min.js:window.Live2D]`）。
  - `live2dcubismcore.min.js`：Live2D Inc. (C) 2019 Cubism Core SDK Redistributable，匯出全域/UMD 命名空間 `Live2DCubismCore`（含 `Version`、`Moc`、`Model`、`Parameters`、`Parts`、`Drawables`、`Memory`、`Logging`、`Utils`、`CanvasInfo` 與 `MocVersion_30`–`MocVersion_50` 常數，`[live2dcubismcore.min.js:Live2DCubismCore]`）。

## Invariants
- **啟動參數與模型版本不變量**：
  - `[waifu-tips.js:window.initWidget]` 僅接受設定物件（傳入字串將記錄錯誤並中止）；若 `localStorage['waifu-display']` 記錄時間距離現在未達 24 小時（`864e5` 毫秒），則僅顯示 `#waifu-toggle` 而略過 `[waifu-tips.js:loadWidget]`。
  - `[waifu-tips.js:ModelManager.constructor]` 要求設定必須提供 `cdnPath`/`apiPath` 或非空 `models` 陣列，否則拋出 `'Invalid initWidget argument!'`；`[waifu-tips.js:ModelManager.loadLive2D]` 以 `this.loading` 防止併發載入，並依 `checkModelVersion`（`Version === 3 || FileReferences` 判定為 Cubism 3/5）分派核心。因本目錄未包含 `./chunk/index.js`，實務上僅能載入 Cubism 3/5（`.model3.json`）模型，Cubism 2 動態匯入路徑無法解析。
- **Cubism SDK 初始化與 WebGL 管線不變量**：
  - `[live2d-framework.js:$]`（`CubismFramework`）要求 `startUp()` 必須早於 `initialize()` 執行，且依賴 `window.Live2DCubismCore` 已由 `live2dcubismcore.min.js` 預先注入；`[live2d-framework.js:bs]`（`AppDelegate`）要求 DOM 中已存在 `<canvas id="live2d">`，且 `transformOffset`、`onMouseMove`、`onTap` 與 `changeModel` 均假設單一畫布委派與模型固定位於索引 `0`。
  - `[live2d-framework.js:nt.initialize]` 建立 WebGL2/WebGL 上下文時強制啟用 `{ preserveDrawingBuffer: true }`，以確保 `[waifu-tips.js:ToolsManager]` 的 `photo` 截圖工具呼叫 `c.toDataURL()` 時不取得空白畫布。
  - `[live2d-framework.js:Mi]`（`CubismShader_WebGL`）強制要求繪製模型啟用 Premultiplied Alpha，否則中斷並記錄 `"NoPremultipliedAlpha is not allowed"`；`[live2d-framework.js:Ai]` 限制單張遮罩紋理上限為 `36` 個（多張為 `32 * _renderTextureCount`）；`[live2d-framework.js:ii]` 將物理步進累計殘差時間上限夾限於 `5.0` 秒內防止分頁切換後物理計算爆衝。
- **動作播放、編輯模式與互動約束**：
  - `[waifu-tips.js:triggerSpeechExpressionMotion]` 僅在 `live2dReady === true` 後生效；播放 Cubism 5 動作時強制關閉迴圈（`setIsLoop(false)`、優先權 2、`autoFree = true`），結束後以 800ms `requestAnimationFrame` 將參數平滑漸隱回預設值並跳過 `"ParamCloth"` 服裝參數；若模型尚未備妥則進入 `[waifu-tips.js:enqueuePendingMotion]`（250ms 輪詢、預設 5 秒逾時）。
  - `[waifu-tips.js:initEditMode]` 限制看板娘縮放尺寸於 `150px`–`900px`、工具列縮放 `--waifu-tool-scale` 於 `0.5`–`4.0`，並將頂端位置夾限於頁面 `<header>` 下緣以下；`enterEditMode` 與 `exitEditMode`/`closeEditMode` 受 `isEditing` 旗標保護不可重入。一般拖曳以 `LONG_PRESS_MS = 250` 區分拖曳與點擊（短按觸發 `live2d:tapbody`），右鍵（`button === 2`）或編輯模式開啟時忽略拖曳。
  - **已觀測之既有程式碼邊界瑕疵**：`[waifu-tips.js:ModelManager.loadModel]` 的 CDN Cubism 2 分支誤用未宣告變數 `mgr.loadTextureCache`；`[live2d-framework.js:bs.initializeSubdelegates]` 於錯誤記錄呼叫未定義變數 `t.error`，且基底 `[live2d-framework.js:Ms.releaseEventListener]` 移除指標監聽時事件名稱與註冊時不一致。

## Side Effects
- **DOM 結構與樣式操作**：
  - `[waifu-tips.js:loadScript]` 動態於 `document.head` 插入 `<script>` 載入執行期核心（`cubism2Path` / `cubism5Path`）；`[waifu-tips.js:loadWidget]` 移除既有 `#waifu` 後重新插入 `#waifu`、`#waifu-edit-titlebar`、`#waifu-tips`、`#waifu-canvas`、`<canvas id="live2d">`、`#waifu-tool` 與縮放/拖曳控制項，並於 `document.body` 插入 `#waifu-toggle`；`photo` 工具點擊時會短暫插入並點擊 `<a download="live2d-photo.png">` 後移除。
  - `[waifu-tips.js:initEditMode]` 與 `[waifu-tips.js:autoFitModel]` 直接修改 `#waifu`、`#waifu-canvas`、`#live2d`、`#waifu-tool` 的內嵌幾何樣式、CSS `transform` 與 CSS 變數 `--waifu-scale`、`--waifu-tool-scale`；`[live2d-framework.js:bs.initializeSubdelegates]` 會將 `#live2d` 的 `style.width`/`style.height` 設為畫布屬性值。
- **瀏覽器儲存讀寫**：
  - `localStorage`：讀寫 `waifu-display`、`modelId`、`modelTexturesId`、`paramOutfitIdx_<modelId>`、`waifu-edit-before`、`waifu-custom-layout`、`waifu-tool-layout`。
  - `sessionStorage`：`[waifu-tips.js:showMessage]` 與 `loadWidget` 讀寫/清除 `waifu-message-priority`。
- **WebGL、網路請求與音訊/影像資源**：
  - `[waifu-tips.js:ModelManager]` 與 `[waifu-tips.js:loadWidget]` 透過 `fetch()` 載入 `config.waifuPath`（`waifu-config.json`）、`model3.json`、`motion3.json`（`arrayBuffer`）或 CDN 模型索引；`[live2d-framework.js:at.loadFileAsBytes]`、`[live2d-framework.js:gs]` 與 `[live2d-framework.js:ns]` 透過 `fetch()` 載入 `.moc3`、`.exp3.json`、`.physics3.json`、`.pose3.json`、`.userdata3.json`、`.motion3.json` 與 `.wav` 音訊，並計算 RMS 驅動嘴型同步。
  - `[live2d-framework.js:_s]` 以 `new Image()` 載入 PNG 貼圖並建立/刪除 WebGL 紋理、FBO 遮罩緩衝區與頂點緩衝區；`[live2d-framework.js:nt.initialize]` 在不支援 WebGL 時會呼叫瀏覽器 `alert()`。
- **計時器、觀察器與跨元件事件**：
  - `[live2d-framework.js:bs.run]` 啟動持續 `window.requestAnimationFrame` 渲染迴圈，並由 `[waifu-tips.js:pauseLive2D]`/`[waifu-tips.js:resumeLive2D]` 透過 `document` `visibilitychange` 與 `IntersectionObserver`（偵測 `#waifu`）控制啟停；`[live2d-framework.js:vs.initialize]` 建立 `window.ResizeObserver` 監聽畫布尺寸變化。
  - 註冊並派發跨模組事件：在 `window` 派發 `live2d:hoverbody`（`[live2d-framework.js:bs.onMouseMove]`）與 `live2d:tapbody`（`[live2d-framework.js:bs.onTap]`、`[waifu-tips.js:loadWidget]`），在 `document` 派發 `live2d:modelReady`（`[waifu-tips.js:loadWidget]`）；全域監聽 `mousemove`、`mouseout`、`pointerdown`、`mouseover`、`click`、`keydown`、`copy`、`visibilitychange`、`resize`；並覆寫 `window.initWidget`、`window.waifuEditMode`、`window.onresize`、`at.printMessage`（靜音框架日誌）與偵測 DevTools 的 `console.log('%c', devtools)`。

## Verification
- Run: `node -e "const cp=require('child_process'),fs=require('fs');['waifu-tips.js','live2d-framework.js'].forEach(f=>cp.execFileSync(process.execPath,['--check','assets/live2d/'+f],{stdio:'inherit'}));JSON.parse(fs.readFileSync('assets/live2d/waifu-config.json','utf8'))"`
