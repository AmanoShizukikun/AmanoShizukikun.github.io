# forza-tuning-calculator

## Overview
`forza-tuning-calculator.html` 為《極限競速：地平線 6》（Forza Horizon 6）單頁式通用調教計算器（`v0.9.5 Beta`），整合 Cyber Nexus 全站導覽與設定側欄，以及四大核心分頁模組：車輛規格與遊戲可調範圍（`#tab-car`）、四種駕駛風格底盤調教推薦與進階懸吊／阻尼面板（`#tab-rec`）、等比／極速齒比生成器與轉速鋸齒圖（`#tab-gear`）、彎道三階段遙測快速診斷（`#tab-telemetry`）。

## Interface
- **分頁導覽與車輛／範圍資料介面**：
  - 導覽與狀態控制：`[forza-tuning-calculator.html:switchTab]`、`[forza-tuning-calculator.html:updatePills]`、`[forza-tuning-calculator.html:updatePWR]`、`[forza-tuning-calculator.html:getCarData]`、`[forza-tuning-calculator.html:getRanges]`、`[forza-tuning-calculator.html:toggleRangesUnlock]`、`[forza-tuning-calculator.html:lockedIds]`（18 個範圍欄位 ID）。
  - 輪胎資訊介面：`[forza-tuning-calculator.html:tireProfile]`（10 種胎種係數 `lat`、`long`、`slip`）、`[forza-tuning-calculator.html:updateTireCard]`、`[forza-tuning-calculator.html:renderTireInfoCard]`。
  - DOM 輸入與導覽鉤子：`#main-tabs`、`#tab-car`（`#car-hp`、`#car-torque`、`#car-weight`、`#car-pwr`、`#car-front-bias`、`#car-drivetrain`、`#car-tire-type`、`#car-tire-f`、`#car-tire-r`、`#tire-info-card`、`#unlock-ranges-btn`、`#rng-{tp,fd,gr,cam,toe,cst,arb,spr,rhf,rhr,dr,db}-{min,max}`）。
- **調教推薦與進階參數介面**：
  - 推薦核心與常數：`[forza-tuning-calculator.html:currentStyle]`、`[forza-tuning-calculator.html:setStyle]`（`grip`、`touge`、`angle_drift`、`inertial_drift`）、`[forza-tuning-calculator.html:generateRec]`、`[forza-tuning-calculator.html:renderRec]`、`[forza-tuning-calculator.html:makeRangeBar]`、`[forza-tuning-calculator.html:recCard]`、`[forza-tuning-calculator.html:copyRec]`、`[forza-tuning-calculator.html:lastRec]`、`[forza-tuning-calculator.html:TIRE_SLIP_DAMPING_MOD]`、`[forza-tuning-calculator.html:BUMP_FACTOR_DRIFT]`、`[forza-tuning-calculator.html:BUMP_FACTOR_TOUGE]`、`[forza-tuning-calculator.html:BUMP_FACTOR_DEFAULT]`。
  - 進階自然頻率／阻尼面板：`[forza-tuning-calculator.html:customHz]`、`[forza-tuning-calculator.html:springAdvancedExpanded]`、`[forza-tuning-calculator.html:hzPresets]`、`[forza-tuning-calculator.html:renderSpringAdvanced]`、`[forza-tuning-calculator.html:toggleSpringAdvanced]`、`[forza-tuning-calculator.html:toggleCustomHz]`、`[forza-tuning-calculator.html:updateCustomHz]`、`[forza-tuning-calculator.html:applyHzPreset]`、`[forza-tuning-calculator.html:customDamp]`、`[forza-tuning-calculator.html:dampingAdvancedExpanded]`、`[forza-tuning-calculator.html:dampPresets]`（`fd3s`、`r34`、`ae86`）、`[forza-tuning-calculator.html:renderDampingAdvanced]`、`[forza-tuning-calculator.html:toggleDampingAdvanced]`、`[forza-tuning-calculator.html:toggleCustomDamp]`、`[forza-tuning-calculator.html:updateDampFormula]`、`[forza-tuning-calculator.html:updateCustomDamp]`、`[forza-tuning-calculator.html:updateWeightRatioBump]`、`[forza-tuning-calculator.html:applyDampPreset]`。
  - 數學工具與 DOM 容器：`[forza-tuning-calculator.html:$]`、`[forza-tuning-calculator.html:clamp]`、`[forza-tuning-calculator.html:lerp]`、`[forza-tuning-calculator.html:pct]`、`[forza-tuning-calculator.html:round]`；`#tab-rec`、`#style-selector`、`#rec-output`（`#rec-tires`、`#rec-alignment`、`#rec-suspension`、`#rec-ride-height`、`#rake-analysis`、`#rec-damping`、`#rec-differential`、`#rec-summary-box`）、動態面板 `#spring-advanced-panel` 與 `#damping-advanced-panel`。
- **齒比計算與轉速圖表介面**：
  - 齒比函式：`[forza-tuning-calculator.html:buildGearInputs]`、`[forza-tuning-calculator.html:toggleGcMode]`、`[forza-tuning-calculator.html:generateAndCalc]`、`[forza-tuning-calculator.html:calcOnly]`、`[forza-tuning-calculator.html:drawGearChart]`、`[forza-tuning-calculator.html:copyGears]`、`[forza-tuning-calculator.html:showToast]`。
  - DOM 控制與結果：`#tab-gear`、`#gc-redline`、`#gc-target-drop`、`#gc-final`、`#gc-gear-count`（`3`–`10` 檔）、`#gc-mode`（`equal`／`limit`）、`#gc-gear-inputs`（`#gc-g1`～`#gc-g10`）、`#gc-results`、`<canvas id="gear-chart">`、`#gc-info-cells`（受 CSS 隱藏）、`#gc-tbody`、`#gc-analysis`、`#gc-warnings`、`#copy-toast`。
- **遙測快速診斷介面**：
  - `[forza-tuning-calculator.html:symptomsData]`（10 種症狀）、`[forza-tuning-calculator.html:currentDiagPhase]`、`[forza-tuning-calculator.html:switchDiagPhase]`、`[forza-tuning-calculator.html:diagnose]`；DOM 節點 `#tab-telemetry`、`#phase-btn-entry`、`#phase-btn-mid`、`#phase-btn-exit`、`#diag-symptom-list`、`#diag-workspace`。
- **外框初始化與全站外部相依**：
  - 主題初始化 `[forza-tuning-calculator.html:head-init-iife]`、`[forza-tuning-calculator.html:theme-init-iife]` 與 `[forza-tuning-calculator.html:DOMContentLoaded]`；全站設定面板（`#headerFixed`、`#headerHeight`、`#sideNavTextVisible`、`#themeMode`、`#live2dToggle`、`#backgroundStyle`、`#animationStrength`、`#fpsValue`、`#soundEnabled`、`#navSearch`）。
  - 外部樣式／腳本：`../../assets/css/{core,components,animations}.css` 與 `../../assets/js/{core,live2d-manager,navigation,animations}.js`（預期提供 `Core.initBackground`、`Navigation.init`、`Animations.init`）及 Google Fonts CDN。

## Invariants
- **主題預設與載入防閃爍**：`[forza-tuning-calculator.html:head-init-iife]` 以 `try/catch` 讀取 `localStorage`，主題預設為 `'dark'` 且僅於 `headerHeight` 具真值時寫入 `--header-height`；`[forza-tuning-calculator.html:theme-init-iife]` 僅在 `savedTheme === 'light'` 時覆寫 `data-theme="light"`。
- **初始化鎖定與空值防護**：`[forza-tuning-calculator.html:DOMContentLoaded]` 先設 `rangesUnlocked = true` 再呼叫 `[forza-tuning-calculator.html:toggleRangesUnlock]`，使頁面上線即鎖定 `lockedIds` 的 18 個範圍欄位（彈簧 `#rng-spr-*` 與車高 `#rng-rhf-*`、`#rng-rhr-*` 維持可編輯）；`[forza-tuning-calculator.html:updatePills]` 對不存在於現有 DOM 的 `#pill-car` 與 `#pill-rec` 執行 null check；`[forza-tuning-calculator.html:updatePWR]` 僅在 `w > 0` 時寫入 `#car-pwr`。
- **調教物理計算與參數限幅**：
  - `[forza-tuning-calculator.html:pct]` 在 `hi === lo` 時回傳 `0.5` 以防除零；`[forza-tuning-calculator.html:generateRec]` 所有輸出皆經 `clamp` 與 `round` 限制在 `getRanges()` 範圍內；計算彈簧採 $k_w = m (2\pi f_n)^2 / 9806.65$ 與 $mr^2 = 0.042 + \max(0, \text{weight}-1000)\times 0.00002$，未啟用 `customHz.enabled` 時會將基準頻率寫回 `customHz.f`／`customHz.r`。
  - 進階輸入限幅：`[forza-tuning-calculator.html:updateCustomHz]` 夾限於 `[0.5, 8.0]` Hz；`[forza-tuning-calculator.html:updateCustomDamp]` 將參考彈簧夾限於 `[20.0, 500.0]`、參考阻尼夾限於 `[1.0, 20.0]` 並切換 `refCar = 'custom'`；`[forza-tuning-calculator.html:updateWeightRatioBump]` 夾限於 `[0.20, 1.00]`；`[forza-tuning-calculator.html:renderRec]` 依風格檢查車身傾角 Rake（甩尾須 `|rake| < 0.15`，其餘須 `rake >= 0.2`）。
- **齒比驗證與 Canvas 顯示順序**：
  - `[forza-tuning-calculator.html:generateAndCalc]` 要求 `targetDrop < redline`，否則提示警告並中止計算；檔位輸入預設限制在 `0.48`–`6.00`。
  - `[forza-tuning-calculator.html:calcOnly]` 定義等比判定為各檔最大偏差 `< 0.008`；必須先設定 `#gc-results.style.display = 'block'` 再呼叫 `[forza-tuning-calculator.html:drawGearChart]`，使父元素 `clientWidth` 非零（若仍 `<= 24` 則退回 `900px`），並依 `window.devicePixelRatio || 1` 縮放畫布。
  - CSS 規則 `#gc-info-cells { display: none !important; }` 會持續隱藏 `#gc-info-cells` 內容。
- **腳本順序、診斷字串格式與剪貼簿限制**：主腳本區段須早於外部 `../../assets/js/*.js` 載入並於 `[forza-tuning-calculator.html:DOMContentLoaded]` 統一啟動；`[forza-tuning-calculator.html:switchDiagPhase]` 依賴每個 `symptomsData[key].title` 皆包含 `' — '` 分隔符；`[forza-tuning-calculator.html:copyRec]` 與 `[forza-tuning-calculator.html:copyGears]` 直接呼叫 `navigator.clipboard.writeText()`，無 `.catch()` 或 `execCommand` 退回機制；`[forza-tuning-calculator.html:showToast]` 每次觸發均啟動獨立 `2000ms` 計時器而未清除前次計時。

## Side Effects
- **Web Storage 讀取**：讀取 `localStorage` 的 `'theme'` 與 `'headerHeight'` 鍵（`[forza-tuning-calculator.html:head-init-iife]`、`[forza-tuning-calculator.html:theme-init-iife]`）。
- **DOM 與全域變數突變**：設定 `<html>` 的 `data-theme` 與 `--header-height`；更新全域隱式變數 `lastRec`；動態寫入 `#tire-info-card`、`#rec-*` 輸出格、`#gc-gear-inputs`、`#gc-tbody`、`#gc-analysis`、`#gc-warnings`、`#diag-symptom-list`、`#diag-workspace` 與 `#copy-toast`；停用／啟用 18 個範圍輸入框並切換分頁與按鈕 `.active` 狀態。
- **Canvas 2D 繪圖**：`[forza-tuning-calculator.html:drawGearChart]` 改寫 `<canvas id="gear-chart">` 寬高屬性、行內樣式及 2D 繪圖情境。
- **剪貼簿、計時器與事件**：呼叫 `navigator.clipboard.writeText()`；以 `setTimeout(..., 2000)` 移除 `#copy-toast` 的 `.show`（`[forza-tuning-calculator.html:copyRec]`、`[forza-tuning-calculator.html:showToast]`）；於 `document` 註冊 `DOMContentLoaded` 監聽器；載入 Google Fonts CDN 與全站共用 CSS／JS。

## Verification
- Run: `<test-command>`
