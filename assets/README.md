# assets

## Overview
網站靜態資源與共用前端模組根目錄，集中存放全站頁面（`index.html`、`pages/`、`projects/`）共用的腳本、Live2D 看板娘元件與靜態樣式／圖像資源。本目錄依職責切分為四個子目錄：`js/` 提供核心背景引擎、導覽與設定管理、進場動畫、Markdown 渲染與 Live2D 掛載介面；`live2d/` 封裝 Cubism Web SDK 執行期、渲染框架與互動看板娘元件；此外另包含無程式碼邏輯之純靜態資源目錄 `css`（`animations.css`、`components.css`、`core.css`）與 `images`（`avatar-anime.jpg`、`avatar.jpg`、`logo.png`），僅作為全域樣式表與圖片資產引用。

## Subdirectories & Boundaries
- js: [./js/README.md](./js/README.md) - 全站核心前端腳本套件，提供 `Core`（背景引擎與工具）、`Navigation`（導覽列與設定持久化）、`Animations`（開屏與視覺特效）、`MarkdownRenderer`（文件渲染）及 `window.live2dManager`（Live2D 延遲載入與生命週期管理）。
- live2d: [./live2d/README.md](./live2d/README.md) - Live2D 看板娘子系統，包含 `waifu-tips.js`（互動 UI、`ModelManager`、`ToolsManager`、自由編輯模式與 `window.initWidget`）、`live2d-framework.js`（Cubism SDK 框架與 `AppDelegate` WebGL 渲染迴圈）、`waifu-config.json`（提示詞與模型清單設定）以及 `live2d.min.js`、`live2dcubismcore.min.js` 執行期程式庫。
