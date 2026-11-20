# assets/live2d

Live2D 的執行期與模型，由 Live2D 作品頁（`/apps/live2d/`）與看板娘（`assets/js/shell/mascot.js`）共用。

- `live2dcubismcore.min.js`：官方 Cubism Core（Live2D Inc. 的可轉散發執行檔），全站只載入一次。
- `model/`：三個模型的原始匯出檔（`.moc3`、`.physics3.json`、原尺寸貼圖等）。網頁只讀取 `.moc3` 與 `.physics3.json`。
- `web/`：網頁實際使用的貼圖，由 `tools/live2d-textures.mjs` 從 `model/` 裡的原尺寸貼圖裁切、縮小而成（`-hi` 給作品頁的大畫面，`-lo` 給小畫面與看板娘）。

模型的清單與說明在 `assets/js/data/live2d.js`，驅動它們的程式在 `assets/js/live2d/`。新增模型的步驟見專案根目錄 README 的「Live2D 作品頁面」一節。
