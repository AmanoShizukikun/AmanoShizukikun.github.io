# Neon Snake: Reloaded

## Overview
`projects/game-center/games/snake/snake.html` 為單一檔案實作之 15×15 格網賽博龐克風格貪食蛇遊戲，整合遊戲中心頂部導覽列、左側欄（`sidebar.js`）、即時 FPS 監控面板（`fps-osd.js`）與亮／暗主題雙配色渲染。支援四段速度難度、本地最高分持久化、暫停與退出二次確認對話框，以及跟隨側邊欄狀態調整版面的響應式同步邏輯。

## Interface
- 遊戲核心引擎（`snake.html`）：`[snake.html:SnakeGame]` 物件封裝遊戲狀態與方法，包含 `init()`、`reset()`、`start(difficulty)`、`stop()`、`update()`、`draw()`、`spawnFood()`、`checkCollision(head)`、`handleKeyPress(e)`、`togglePause()`、`updateUI()` 與 `gameOver()`；固定棋盤規格 `gridSize = 40`、`tileCount = 15`（600×600px），難度步長對照表 `speeds` 為 `easy: 200`、`normal: 150`、`hard: 100`、`insane: 50` ms。
- 側邊欄版面同步函式（`snake.html`）：`[snake.html:applyGameContainerMarginHidden]`、`[snake.html:syncSidebarState]` 與 `[snake.html:updateLayoutOnResize]`，負責調整 `.game-container` 左側邊距以配合 `#gcSidebar` 顯示或隱藏。
- DOM 畫面與互動介面（`snake.html`）：遊戲畫布 `#gameCanvas`；畫面容器 `#titleScreen`、`#difficultyPanel`（`.difficulty-btn[data-difficulty="easy|normal|hard|insane"]`）、`#instructionsPanel`、`#gameMain`、`#gameOverPanel`、`#exitConfirmPanel`；HUD 數據顯示 `#scoreDisplay`、`#highScoreDisplay`、`#lengthDisplay`、`#finalScore`；操作按鈕 `#startBtn`、`#instructionsBtn`、`#backToGCBtn`、`#difficultyBackBtn`、`#instructionsBackBtn`、`#pauseBtn`、`#exitBtn`、`#exitConfirmBtn`、`#exitCancelBtn`、`#restartBtn`、`#menuBtn`。鍵盤支援方向鍵、`WASD`、`Space`（暫停／繼續）與 `Escape`（關閉退出確認）。

## Invariants
- 單 Tick 方向緩衝與防 180 度自殺不變量：`[snake.html:SnakeGame.handleKeyPress]` 將輸入方向暫存於 `nextDirection` 且限制垂直軸轉向（僅於 `direction.y === 0` 時接受上下、僅於 `direction.x === 0` 時接受左右），並於 `[snake.html:SnakeGame.update]` 步進開頭才提交至 `direction`，防止單一迴圈週期內連按兩鍵造成直接回頭自撞。
- 食物生成排除不變量：`[snake.html:SnakeGame.spawnFood]` 透過 `do...while` 與 `this.snake.some(...)` 驗證隨機座標不與任何蛇身區段重疊。
- 狀態保護與經典邊界碰撞規則：`[snake.html:SnakeGame.update]` 在 `isPaused || isGameOver` 為真時提早返回，`handleKeyPress` 於 `isGameOver` 為真時忽略輸入；本實作無傳送門或額外障礙物，觸及邊界（`x/y < 0` 或 `>= 15`）或自撞蛇身即刻呼叫 `gameOver()`。
- 側邊欄 `!important` 邊距覆寫規則：`[snake.html:applyGameContainerMarginHidden]` 於隱藏側邊欄時對 `.game-container` 設定 `style.setProperty('margin-left', '0', 'important')` 以覆寫 CSS 規則，恢復顯示時執行 `removeProperty('margin-left')`。
- 外部全域掛鉤保護：初始化與 HUD 更新對 `Core`、`Navigation`、`lucide` 與選用掛鉤 `window.updateOSDGameInfo`（註：現行 `fps-osd.js` 未實作此全域函式）進行存在性檢查。

## Side Effects
- `localStorage` 與 `sessionStorage` 讀寫：`<head>` 後與側邊欄前內聯 IIFE 讀取 `theme`、`sidebarCollapsed`、`gcSidebarCollapsed`；`[snake.html:SnakeGame]` 讀寫 `localStorage.snakeHighScore`；`DOMContentLoaded` 與跨分頁監聽讀取 `showSidebar`、`sidebarCollapsed`、`gcSidebarCollapsed`；點擊 `#backToGCBtn` 時寫入 `sessionStorage.skipEntranceAnimation = 'true'` 並導向 `../../game-center.html`。
- 計時器與 Canvas 2D 渲染：`[snake.html:SnakeGame.start]` 建立 `setInterval` 週期執行 `update()` 與 `draw()`（依 `<html data-theme>` 切換亮／暗色背景、格線、蛇身與食物發光色彩），`stop()` 以 `clearInterval` 釋放；`window` `resize` 使用 100ms 防抖 `setTimeout` 呼叫 `updateLayoutOnResize()`。
- 全域事件監聽與 DOM 狀態切換：`document` 監聽 `keydown`；`window` 監聽 `resize`、`sidebarToggle`、`sidebarCollapseChange` 與 `storage` 事件；介面互動動態切換 `.active` 與 `.hidden` 類別以及按鈕顯示文字；頁面載入外部 Google Fonts、Lucide CDN 與站內腳本 `core.js`、`live2d-manager.js`、`navigation.js`、`animations.js`、`../../js/fps-osd.js`、`../../js/sidebar.js`。

## Verification
- Run: `python -m http.server 8000` （本元件為純靜態單頁 HTML 遊戲且無自動化測試套件；於儲存庫根目錄啟動伺服器後開啟 `/projects/game-center/games/snake/snake.html` 驗證各難度移動、碰撞結算、高分持久化與側邊欄響應式佈局）
