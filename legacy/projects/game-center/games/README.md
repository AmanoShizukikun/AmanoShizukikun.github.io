# games

## Overview
本目錄彙整遊戲中心（Game Center）底下所有獨立可玩的網頁遊戲與 3D 互動體驗子專案，涵蓋 3D 山道賽車（`cyberrace`）、17 鍵電子鋼琴合成器（`piano`）、賽博龐克貪食蛇（`snake`），以及 3D 第一人稱高空攀爬跑酷（`wallclimber`）。各子專案皆可獨立於 `<iframe>` 內嵌環境（`#game-iframe`）或獨立視窗中執行，並依各自需求介接遊戲中心側邊欄（`#gcSidebar`）與效能浮動視窗（`#fpsOSD`）。

## Subdirectories & Boundaries
- `cyberrace`: [./cyberrace/README.md](./cyberrace/README.md) - CyberRace 3D 山道賽車遊戲應用程式根目錄，整合 `window.Game` 主引擎、`./js/README.md` 物理／車輛動力／賽道／HUD／遙測分析子系統、`data/` JSON 資料集與兩個離線 Python 賽道製作工具。
- `piano`: [./piano/README.md](./piano/README.md) - 單頁賽博龐克 17 鍵電子鋼琴合成器（C4–E5），整合 Web Audio API 複音合成（`CyberPianoSynth`）、ADSR 包絡、延音模式與 Canvas 2D 波形示波器（`WaveformVisualizer`），並連動遊戲中心側邊欄與 FPS OSD。
- `snake`: [./snake/README.md](./snake/README.md) - 單頁 15×15 格網賽博龐克貪食蛇遊戲（`SnakeGame`），具備四段速度難度、本地高分持久化（`snakeHighScore`）、亮／暗主題畫布切換與側邊欄響應式版面控制。
- `wallclimber`: [./wallclimber/README.md](./wallclimber/README.md) - 基於 Three.js r128 的單頁 3D 第一人稱賽博高空跑酷與攀爬遊戲，支援多型態建築幾何碰撞（`resolveWalls`）、雙段跳、抓牆攀爬、水平跑牆（`detectWallRun`）、12 分鐘晝夜循環（`getDayNightState`）與 Pointer Lock 視角控制。
