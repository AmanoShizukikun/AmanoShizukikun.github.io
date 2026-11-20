# Cyber Piano Synthesizer

## Overview
`projects/game-center/games/piano/piano.html` 為單一檔案實作之賽博龐克 17 鍵電子鋼琴合成器（音域涵蓋 C4 至 E5），整合全站主題切換、遊戲中心左側欄（`sidebar.js`）與效能 OSD（`fps-osd.js`）。系統完全以 Web Audio API 實作複音合成、三振盪器賽博混合音色、ADSR 音量包絡、低通濾波器、延音切換，並透過 Canvas 2D 渲染即時時域波形示波器。

## Interface
- 音訊合成引擎（`piano.html`）：`[piano.html:CyberPianoSynth]` 類別提供 `setWaveformType(type)`、`playNote(note)`、`stopNote(note)`、`setVolume(value)` 與 `setSustain(enabled)`，內建 `noteFrequencies` 17 鍵音高對照表（C4 `261.63Hz` 至 E5 `659.25Hz`）；於 `DOMContentLoaded` 後實例化並暴露至 `[piano.html:window.pianoSynth]`。
- 鍵盤與輸入控制器（`piano.html`）：`[piano.html:CyberPiano]` 類別提供 `init()`、`handleKeyPress(keyElement, note)` 與 `handleKeyRelease(keyElement, note)`，於 `DOMContentLoaded` 後暴露至 `[piano.html:window.pianoGame]`；綁定 `.piano-key[data-key][data-note]`（對應鍵盤 `a, w, s, e, d, f, t, g, y, h, u, j, k, o, l, p, ;`）、音量滑桿 `#volumeSlider`、音色選單 `#waveformType`（`cyber`、`sine`、`square`、`sawtooth`、`triangle`）、鍵位標籤切換 `#showKeysToggle` 與延音切換 `#sustainToggle`。
- 波形視覺化器（`piano.html`）：`[piano.html:WaveformVisualizer]` 類別提供 `resize()`、`start()`、`stop()` 與 `draw()`，讀取 `AnalyserNode` 時域資料並繪製於 `#waveformCanvas`。
- 儲存與外圍整合（`piano.html`）：`[piano.html:SafeStorage]` 提供 `getItem`／`setItem`；頁面整合 `#gameContainer`、`#gcSidebar`、`#fpsOSD` 與系統設定面板，載入 `core.js`、`navigation.js`、`animations.js`、`../../js/fps-osd.js` 及 `../../js/sidebar.js`。

## Invariants
- 單音複音上限保護（Voice Stealing）：`[piano.html:CyberPianoSynth.playNote]` 為每個音名於 `this.activeNotes` 維護活躍聲部陣列，當同音超過 4 個聲部時強制將最舊聲部的 `envelopeGain` 於 20ms 內線性歸零並停止振盪器，避免連續連打造成音訊緩衝爆音。
- Web Audio 節點斷開與自動播放恢復：`[piano.html:CyberPianoSynth.playNote]` 檢查 `audioContext.state === 'suspended'` 時自動呼叫 `resume()`，並於 `!frequency` 時直接返回；`[piano.html:CyberPianoSynth.stopNote]` 依延音設定釋放時間（延音開啟 `1.0s`、關閉 `0.25s`），並於 `releaseTime * 1000 + 100` ms 後呼叫 `disconnect()` 釋放所有振盪器、子增益、低通濾波與包絡節點。
- 輸入焦點防護與按鍵連發抑制：`[piano.html:CyberPiano.init]` 的 `keydown`／`keyup` 監聽器在焦點位於 `INPUT`、`TEXTAREA`、`SELECT` 時直接略過，並以 `this.pressedKeys` `Set` 過濾長按重複事件；觸控事件採 `{ passive: false }` 並呼叫 `e.preventDefault()` 防止捲動或縮放干擾。
- 全域靜音開關與腳本選用防護：`[piano.html:CyberPiano.handleKeyPress]` 與 `handleKeyRelease` 會讀取 `SafeStorage.getItem('soundEnabled') !== 'false'` 判斷是否觸發發聲；啟動序列對 `Core`、`Navigation` 與 `lucide` 執行 `typeof !== 'undefined'` 保護。

## Side Effects
- `localStorage` 讀寫：`<head>` 內聯 IIFE 讀取 `theme` 與 `headerHeight` 並設定 `document.documentElement` 的 `data-theme` 與 `--header-height`；`[piano.html:CyberPiano.init]` 讀取與寫入 `pianoWaveformType`；按鍵事件讀取 `soundEnabled`。
- Web Audio 硬體輸出與音訊圖建構：`[piano.html:CyberPianoSynth]` 建立 `AudioContext` 並串接振盪器（`cyber` 模式為正弦 `f`、三角 `2f`、方波 `0.5f` 三路混合）、`BiquadFilterNode`（2200Hz 低通濾波, `Q = 1`）、`masterGain` 與 `AnalyserNode`（`fftSize = 1024`）至硬體輸出 `audioContext.destination`。
- 計時器、`requestAnimationFrame` 與 DOM 狀態變更：`[piano.html:WaveformVisualizer.start]` 持續透過 `requestAnimationFrame` 以殘影疊層方式更新 `#waveformCanvas`；`stopNote` 建立非同步 `setTimeout` 回收音訊節點；`window` 註冊 `keydown`、`keyup`、`resize` 監聽器；琴鍵與開關操作動態切換 `.piano-key.active`、`.key-label.hide` 與 `aria-checked`。
- 外部資源相依：載入 Google Fonts 及 Lucide CDN 腳本。

## Verification
- Run: `python -m http.server 8000` （本元件為純靜態單頁 HTML 應用且無自動化測試套件；於儲存庫根目錄啟動伺服器後開啟 `/projects/game-center/games/piano/piano.html` 驗證 17 鍵發聲、波形示波器、延音與音色切換）
