// ==================== CYBER RACER - HUD 顯示模組 (HUD Display Module) ====================
// 從 cyberrace.html 分離，透過 window.CyberRaceHUD 暴露給主程式 Game 使用
// 使用前需呼叫 CyberRaceHUD.init(ctx) 傳入共享 context

(function () {
    'use strict';

    // 共享 context (由主程式 init 時注入)
    let _ctx = null;

    /**
     * 初始化 context。主程式在初始化 renderer 後呼叫。
     * @param {Object} ctx - 包含 getState, getCars, getRaceTime, getTrackState,
     *                       gameSettings, getTransmissionMode, getGaugeStyle, setGaugeStyle
     */
    function init(ctx) {
        _ctx = ctx;
        if (ctx && ctx.gameSettings) {
            const panel = document.getElementById('telemetryPanel');
            if (panel) {
                const isVis = !!ctx.gameSettings.telemetryVisible;
                panel.classList.toggle('active', isVis);
                panel.style.display = isVis ? 'block' : 'none';
            }
        }
    }

    // ===== 跨瀏覽器 Canvas 圓角繪製 Helper =====
    function drawRoundRectHelper(ctx, x, y, w, h, r) {
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
    }

    // ===== HUD 主更新 =====
    function updateHUD(dt, cars, raceTime, PHYSICS, TOTAL_LAPS, trackType, selectedTrackKey, selectedTrackDirection, TRACKS) {
        dt = dt || 0.016;
        cars = cars || (_ctx && _ctx.cars);
        if (!cars || !cars[0]) return;
        const player = cars[0];

        raceTime = (raceTime !== undefined) ? raceTime : ((_ctx && _ctx.raceTime) || 0);
        PHYSICS = PHYSICS || (_ctx && _ctx.PHYSICS) || (window.CyberRacePhysics && window.CyberRacePhysics.PHYSICS) || { speedToKMH: 120 };
        TOTAL_LAPS = (TOTAL_LAPS !== undefined) ? TOTAL_LAPS : ((_ctx && _ctx.TOTAL_LAPS) || 3);
        trackType = trackType || (_ctx && _ctx.trackType) || 'circuit';
        selectedTrackKey = selectedTrackKey || (_ctx && _ctx.selectedTrackKey) || 'akina';
        selectedTrackDirection = selectedTrackDirection || (_ctx && _ctx.selectedTrackDirection) || 'forward';
        TRACKS = TRACKS || (_ctx && _ctx.TRACKS) || {};

        // 速度
        const speedKMH = Math.floor(Math.abs(player.speed) * PHYSICS.speedToKMH);
        const hudSpeedEl = document.getElementById('hudSpeed');
        if (hudSpeedEl) hudSpeedEl.textContent = speedKMH;

        // 完成度 / 圈數
        const progressEl = document.getElementById('hudProgress');
        const progressTitleEl = document.getElementById('hudProgressTitle');
        const displayLap = Math.min(player.lap, TOTAL_LAPS);
        if (progressEl) {
            if (trackType === 'linear') {
                if (progressTitleEl) progressTitleEl.textContent = 'PROGRESS';
                let progressPct = 0;
                if (player.finished || player.totalProgress >= 0.999) {
                    progressPct = 100;
                } else {
                    progressPct = Math.min(99, Math.floor(player.totalProgress * 100));
                }
                progressEl.textContent = progressPct + '%';
            } else {
                if (progressTitleEl) progressTitleEl.textContent = 'LAP';
                progressEl.textContent = displayLap + ' / ' + TOTAL_LAPS;
            }
        }

        // 右上角圈數徽章 (若為環道賽)
        const rightLapBadge = document.getElementById('hudRightLapBadge');
        const rightLapVal = document.getElementById('hudRightLapVal');
        if (rightLapBadge) {
            if (trackType === 'circuit') {
                rightLapBadge.style.display = 'block';
                if (rightLapVal) rightLapVal.textContent = displayLap + ' / ' + TOTAL_LAPS;
            } else {
                rightLapBadge.style.display = 'none';
            }
        }

        // 名次
        const sorted = [...cars].sort((a, b) => b.totalProgress - a.totalProgress);
        const position = sorted.findIndex(c => c === player) + 1;
        const isTimeAttack = (_ctx && _ctx.getGameMode && _ctx.getGameMode() === 'time_attack') || cars.length === 1;
        const posBlock = document.querySelector('.hud-pos-block');
        if (isTimeAttack) {
            if (posBlock) posBlock.style.display = 'none';
        } else {
            if (posBlock) posBlock.style.display = '';
            const posEl = document.getElementById('hudPosition');
            const posSufEl = document.getElementById('hudPosSuffix');
            if (posEl) posEl.textContent = position;
            if (posSufEl) posSufEl.textContent = '/' + cars.length;
        }

        // 比賽計時器
        const mins = Math.floor(raceTime / 60);
        const secs = Math.floor(raceTime % 60);
        const ms = Math.floor((raceTime % 1) * 10);
        const timerEl = document.getElementById('hudTimer');
        if (timerEl) {
            timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
        }

        // 右側成績面板：環道賽顯示圈耗時 (LAP TIMES)，線性賽道顯示區間計時 (SECTOR SPLITS)
        const panelTitleEl = document.getElementById('hudRightPanelTitle');
        if (trackType === 'circuit') {
            if (panelTitleEl) panelTitleEl.textContent = '圈耗時 (LAP TIMES)';
            const lapTimes = player.lapTimes || [];
            const minCompletedLap = lapTimes.length > 0 ? Math.min(...lapTimes) : 0;

            for (let i = 0; i < 4; i++) {
                const rowEl = document.getElementById(`cpRowItem${i+1}`);
                const nameEl = document.getElementById(`cpName${i+1}`);
                const timeEl = document.getElementById(`cpTime${i+1}`);
                const splitEl = document.getElementById(`cpSplit${i+1}`);
                if (!timeEl || !splitEl) continue;

                if (i >= TOTAL_LAPS) {
                    if (rowEl) rowEl.style.display = 'none';
                    continue;
                }
                if (rowEl) rowEl.style.display = 'flex';
                if (nameEl) nameEl.textContent = `LAP ${i+1}`;

                if (i < lapTimes.length) {
                    // 已完成圈
                    const t = lapTimes[i];
                    const lMins = Math.floor(t / 60);
                    const lSecs = Math.floor(t % 60);
                    const lMS = Math.floor((t % 1) * 10);
                    timeEl.textContent = `${lMins.toString().padStart(2, '0')}:${lSecs.toString().padStart(2, '0')}.${lMS}`;
                    timeEl.className = 'cp-row-time done';

                    if (t === minCompletedLap) {
                        splitEl.textContent = 'BEST';
                        splitEl.className = 'cp-row-split fast';
                    } else {
                        const diff = t - minCompletedLap;
                        splitEl.textContent = `+${diff.toFixed(1)}s`;
                        splitEl.className = 'cp-row-split slow';
                    }
                } else if (player.lap === (i + 1) && !player.finished && player.currentLapStartTime > 0) {
                    // 當前進行中的圈 (Live Lap Time)
                    const liveT = Math.max(0, raceTime - player.currentLapStartTime);
                    const lMins = Math.floor(liveT / 60);
                    const lSecs = Math.floor(liveT % 60);
                    const lMS = Math.floor((liveT % 1) * 10);
                    timeEl.textContent = `${lMins.toString().padStart(2, '0')}:${lSecs.toString().padStart(2, '0')}.${lMS}`;
                    timeEl.className = 'cp-row-time running';
                    splitEl.textContent = 'LIVE';
                    splitEl.className = 'cp-row-split live';
                } else {
                    // 尚未開始此圈
                    timeEl.textContent = '--:--.-';
                    timeEl.className = 'cp-row-time';
                    splitEl.textContent = '';
                    splitEl.className = 'cp-row-split';
                }
            }
        } else {
            // 線性賽道：區間計時 (SECTOR SPLITS)
            if (panelTitleEl) panelTitleEl.textContent = 'SECTOR SPLITS';
            const sectorNames = ['區間1', '區間2', '區間3', '區間4'];

            for (let i = 0; i < 4; i++) {
                const rowEl = document.getElementById(`cpRowItem${i+1}`);
                const nameEl = document.getElementById(`cpName${i+1}`);
                const timeEl = document.getElementById(`cpTime${i+1}`);
                const splitEl = document.getElementById(`cpSplit${i+1}`);
                if (!timeEl || !splitEl) continue;
                if (rowEl) rowEl.style.display = 'flex';
                if (nameEl) nameEl.textContent = sectorNames[i];

                let isPassed = false;
                let t = 0;
                if (i < 3) {
                    isPassed = player.checkpointsPassed[i];
                    t = player.checkpointTimes[i];
                } else {
                    isPassed = player.finished;
                    t = player.finishTime;
                }

                if (isPassed) {
                    const cpMins = Math.floor(t / 60);
                    const cpSecs = Math.floor(t % 60);
                    const cpMS = Math.floor((t % 1) * 10);
                    timeEl.textContent = `${cpMins.toString().padStart(2, '0')}:${cpSecs.toString().padStart(2, '0')}.${cpMS}`;
                    timeEl.className = 'cp-row-time done';

                    const bestKey = `cyberRacer_best_cp_${selectedTrackKey}_${selectedTrackDirection}_${i}`;
                    const prevBestCP = parseFloat(localStorage.getItem(bestKey) || '0');
                    if (prevBestCP > 0) {
                        const diff = t - prevBestCP;
                        splitEl.textContent = diff <= 0 ? `${diff.toFixed(1)}s` : `+${diff.toFixed(1)}s`;
                        splitEl.className = 'cp-row-split ' + (diff <= 0 ? 'fast' : 'slow');
                    } else {
                        splitEl.textContent = 'BEST';
                        splitEl.className = 'cp-row-split fast';
                    }
                } else {
                    timeEl.textContent = '--:--.-';
                    timeEl.className = 'cp-row-time';
                    splitEl.textContent = '';
                    splitEl.className = 'cp-row-split';
                }
            }
        }

        // 漂移指示
        const driftEl = document.getElementById('hudDrift');
        const nitroPct = Math.min(100, (player.nitroEnergy || 0) * 100);
        if (driftEl) {
            if (player.isDrifting) {
                driftEl.classList.add('active');
                driftEl.classList.remove('drift-l1', 'drift-l2', 'drift-l3');
                const slipAngle = Math.abs(_angleDiff(player.heading, player.velAngle)) * (180 / Math.PI);
                if (slipAngle > 25) {
                    driftEl.textContent = 'COUNTER STEER!';
                    driftEl.classList.add('drift-l3');
                } else if (slipAngle > 15) {
                    driftEl.textContent = 'DRIFT!';
                    driftEl.classList.add('drift-l2');
                } else {
                    driftEl.textContent = 'SLIDE';
                    driftEl.classList.add('drift-l1');
                }
            } else if (player.nitroActive) {
                driftEl.classList.add('active');
                driftEl.classList.remove('drift-l1', 'drift-l2', 'drift-l3');
                driftEl.textContent = 'NITRO BOOST!';
                driftEl.classList.add('drift-l3');
            } else {
                driftEl.classList.remove('active');
            }
        }

        // 速度暈影
        const vignette = document.getElementById('speedVignette');
        if (vignette) {
            const vignetteOpacity = Math.min(0.8, speedKMH / 280);
            vignette.style.opacity = vignetteOpacity;
            if (player.nitroActive) {
                vignette.classList.add('boost-active');
            } else {
                vignette.classList.remove('boost-active');
            }
        }

        // 儀表盤
        const model = player.model;
        const playerRpm = player.engineRpm || (model ? (model.idleRpm || 900) : 900);
        const gMax = model ? (model.gaugeMaxRpm || 8000) : 8000;
        const rLine = model ? (model.redlineRpm || 7500) : 7500;
        const mRpm = model ? (model.maxRpm || 8000) : 8000;
        const gearVal = (player.gear !== undefined && player.gear !== null) ? player.gear : 1;
        const currentGearDisplay = (typeof getGearDisplayString === 'function')
            ? getGearDisplayString(gearVal)
            : ((typeof CyberRaceInputHaptics !== 'undefined' && CyberRaceInputHaptics.getGearDisplayString)
                ? CyberRaceInputHaptics.getGearDisplayString(gearVal)
                : (gearVal === -1 || gearVal === '-1' ? 'R' : (gearVal === 0 || gearVal === '0' ? 'N' : String(gearVal))));

        const rpmGearValue = document.getElementById('rpmGearValue');
        if (rpmGearValue) rpmGearValue.textContent = currentGearDisplay;

        drawGaugeCanvas(speedKMH, playerRpm, currentGearDisplay, nitroPct, player.nitroActive, player.isDrifting, player.clutch || 0, gMax, rLine, mRpm);

        // 頭文字D 漫畫擬聲詞
        updateDriftSFX(dt, cars);

        // 輪胎遙測
        updateTelemetryPanel(player);

        // 小地圖
        drawMinimap(cars);

        // OSD
        if (window.updateOSDGameInfo && TRACKS) {
            const trackData = TRACKS[selectedTrackKey];
            const isTimeAttack = (_ctx && _ctx.getGameMode && _ctx.getGameMode() === 'time_attack') || cars.length === 1;
            const posStr = isTimeAttack ? 'TIME ATTACK' : `P${position}/${cars.length}`;
            window.updateOSDGameInfo(
                `${posStr} | ${trackType === 'linear' ? Math.floor(player.totalProgress * 100) + '%' : 'Lap ' + Math.min(player.lap, TOTAL_LAPS) + '/' + TOTAL_LAPS}`,
                trackData ? trackData.name : selectedTrackKey
            );
        }
    }

    // --- 角度差計算 (模組內部使用) ---
    function _angleDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return d;
    }

    // ===== 輪胎遙測 HUD 面板更新 =====
    function updateTelemetryPanel(player) {
        const gameSettings = (_ctx && _ctx.gameSettings) || window.gameSettings;
        const panel = document.getElementById('telemetryPanel');
        if (!panel) return;

        const isVisible = !!(gameSettings && gameSettings.telemetryVisible);
        if (!isVisible) {
            if (panel.style.display !== 'none') panel.style.display = 'none';
            if (panel.classList.contains('active')) panel.classList.remove('active');
            return;
        }

        if (panel.style.display !== 'block') panel.style.display = 'block';
        if (!panel.classList.contains('active')) panel.classList.add('active');

        const model = player.model;
        const compoundEl = document.getElementById('telCompound');
        if (compoundEl) compoundEl.textContent = ((model && model.tireCompound) || 'sport').toUpperCase();

        const wheelKeys = ['FL', 'FR', 'RL', 'RR'];
        const optTemp = (model && model.optimalTireTemp) || 85;

        for (let i = 0; i < 4; i++) {
            const wKey = wheelKeys[i];
            const tire = player.tires[i];
            if (!tire) continue;

            const displayTags = ['O', 'M', 'I'];
            const zoneKeysMap = { 'O': 'outer', 'M': 'mid', 'I': 'inner' };

            for (let z = 0; z < 3; z++) {
                const tag = displayTags[z];
                const tempBox = document.getElementById(`telTemp${wKey}_${tag}`);
                if (tempBox) {
                    const tempVal = Math.round(tire.temperature[zoneKeysMap[tag]]);
                    tempBox.textContent = tempVal;
                    let bg = 'rgba(40, 120, 255, 0.8)';
                    const diff = tempVal - optTemp;
                    if (Math.abs(diff) <= 15) {
                        bg = 'rgba(0, 220, 100, 0.85)';
                    } else if (tempVal > optTemp + 15) {
                        bg = 'rgba(255, 60, 40, 0.9)';
                    }
                    tempBox.style.backgroundColor = bg;
                }
            }

            const pressEl = document.getElementById(`telPress${wKey}`);
            if (pressEl) pressEl.textContent = `${Math.round(tire.pressure)} kPa`;

            const wearEl = document.getElementById(`telWear${wKey}`);
            if (wearEl) {
                const avgWear = (tire.wear.inner + tire.wear.mid + tire.wear.outer) / 3;
                const wearPct = Math.round(avgWear * 100);
                wearEl.textContent = `${wearPct}%`;
                wearEl.style.color = wearPct < 40 ? '#ff3344' : (wearPct < 70 ? '#ffaa00' : '#00ffcc');
            }

            const camEl = document.getElementById(`telCam${wKey}`);
            if (camEl) camEl.textContent = `${tire.camber.toFixed(1)}°`;
        }

        const latG = (player.prevLateralAccMS2 || 0) / 9.81;
        const longG = (player.prevAccelMS2 || 0) / 9.81;

        const latGEl = document.getElementById('telLatG');
        if (latGEl) latGEl.textContent = (latG >= 0 ? '+' : '') + latG.toFixed(2) + 'G';

        const longGEl = document.getElementById('telLongG');
        if (longGEl) longGEl.textContent = (longG >= 0 ? '+' : '') + longG.toFixed(2) + 'G';
    }

    // ===== 頭文字D 漫畫風格日文擬聲詞 SFX 系統 =====
    let driftSFXTimer = 0;
    const MANGA_SFX_LIST = [
        'ギャアアア！', 'ギャギャギャ！', 'キキキィィ！', 'キュィィィ！',
        'ドギャアア！', 'ドギュゥゥ！', 'ズズズズ！', 'ギャアッ！'
    ];

    function updateDriftSFX(dt, cars) {
        dt = dt || 0.016;
        const player = cars[0];
        if (!player) return;

        const gameState = (_ctx && _ctx.getGameState) ? _ctx.getGameState() : 'playing';
        if (player.isDrifting && !player.finished && gameState === 'playing') {
            driftSFXTimer -= dt;
            if (driftSFXTimer <= 0) {
                spawnInitialDSFX(player);
                driftSFXTimer = 0.35 + Math.random() * 0.12;
            }
        } else {
            driftSFXTimer = 0;
        }
    }

    function spawnInitialDSFX(player) {
        const hud = document.getElementById('raceHUD');
        if (!hud) return;

        const text = MANGA_SFX_LIST[Math.floor(Math.random() * MANGA_SFX_LIST.length)];
        const sideDir = (player.driftDir || (Math.random() > 0.5 ? 1 : -1));

        let sfxX = 0;
        if (sideDir > 0) {
            sfxX = window.innerWidth * (0.74 + Math.random() * 0.12);
        } else {
            sfxX = window.innerWidth * (0.14 + Math.random() * 0.12);
        }
        const sfxY = window.innerHeight * (0.28 + Math.random() * 0.32);

        const el = document.createElement('div');
        el.className = 'initial-d-sfx';
        el.textContent = text;

        const randomRot = (sideDir < 0 ? -1 : 1) * (10 + Math.random() * 18);
        el.style.setProperty('--rot', `${randomRot}deg`);
        el.style.left = `${sfxX}px`;
        el.style.top = `${sfxY}px`;

        hud.appendChild(el);
        setTimeout(() => {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 580);
    }

    // ===== 儀表盤 Canvas 繪製 =====
    let gaugeStyle = localStorage.getItem('gaugeStyle') || 'analog';

    function setGaugeStyle(style) { gaugeStyle = style; }

    function drawGaugeCanvas(speedKMH, currentRpm, gear, nitroPct, nitroActive, isDrifting, clutchVal, gaugeMaxRpm, redlineRpm, maxRpm) {
        clutchVal = clutchVal || 0;
        gaugeMaxRpm = gaugeMaxRpm || 8000;
        redlineRpm = redlineRpm || 7500;
        maxRpm = maxRpm || 8000;

        const canvas = document.getElementById('gaugeCanvas');
        const digital = document.getElementById('gaugeDigital');
        if (!canvas || !digital) return;

        const displayMaxRpm = gaugeMaxRpm || 8000;
        const rpmRatio = Math.min(1.0, Math.max(0.0, currentRpm / displayMaxRpm));
        const transmissionMode = (_ctx && _ctx.getTransmissionMode) ? _ctx.getTransmissionMode() : 'auto';

        if (gaugeStyle === 'digital') {
            canvas.style.display = 'none';
            digital.style.display = 'block';
            const digiRPM = document.getElementById('digiRPM');
            const digiGear = document.getElementById('digiGear');
            const digiSpeed = document.getElementById('digiSpeed');
            const digiBoostFill = document.getElementById('digiBoostFill');
            const digiNitroPct = document.getElementById('digiNitroPct');
            if (digiRPM) {
                digiRPM.textContent = Math.floor(currentRpm).toString().padStart(5, '0');
                digiRPM.style.color = currentRpm >= redlineRpm ? '#ff2255' : '#ffffff';
            }
            if (digiGear) digiGear.textContent = gear;
            if (digiSpeed) digiSpeed.textContent = speedKMH.toString().padStart(3, '0');
            if (digiBoostFill) digiBoostFill.style.width = nitroPct + '%';
            if (digiNitroPct) digiNitroPct.textContent = Math.floor(nitroPct) + '%';
            return;
        }

        canvas.style.display = 'block';
        digital.style.display = 'none';

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const cx = 150, cy = 150, r = 132;

        // 底盤
        ctx.fillStyle = 'rgba(8, 12, 22, 0.88)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // 外圍霓虹邊框
        ctx.strokeStyle = isDrifting ? '#00ffcc' : 'rgba(0, 255, 255, 0.45)';
        ctx.lineWidth = 5;
        ctx.shadowColor = isDrifting ? '#00ffcc' : 'rgba(0, 255, 255, 0.4)';
        ctx.shadowBlur = isDrifting ? 28 : 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 轉速弧
        const startAng = Math.PI * 0.75;
        const sweepAng = Math.PI * 1.5;

        ctx.beginPath();
        ctx.arc(cx, cy, r - 12, startAng, startAng + sweepAng);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();

        const redlineRatio = Math.min(1.0, redlineRpm / displayMaxRpm);
        const redlineStartAng = startAng + sweepAng * redlineRatio;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 12, redlineStartAng, startAng + sweepAng);
        ctx.strokeStyle = 'rgba(255, 30, 60, 0.45)';
        ctx.lineWidth = 14;
        ctx.stroke();

        // 刻度
        const maxTicks = Math.ceil(displayMaxRpm / 1000);
        for (let i = 0; i <= maxTicks; i++) {
            const tickRpm = i * 1000;
            const ratio = tickRpm / displayMaxRpm;
            if (ratio > 1.0) break;
            const ang = startAng + ratio * sweepAng;
            const isRed = tickRpm >= redlineRpm;
            const isMajor = (maxTicks > 10) ? (i % 2 === 0 || i === maxTicks || tickRpm === redlineRpm) : true;
            const tickLen = isMajor ? 14 : 8;
            const rInner = r - 18 - tickLen;
            const rOuter = r - 18;

            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ang) * rInner, cy + Math.sin(ang) * rInner);
            ctx.lineTo(cx + Math.cos(ang) * rOuter, cy + Math.sin(ang) * rOuter);
            ctx.strokeStyle = isRed ? '#ff2255' : 'rgba(255, 255, 255, 0.65)';
            ctx.lineWidth = isRed ? (isMajor ? 3.5 : 2) : (isMajor ? 3 : 1.5);
            ctx.stroke();

            if (isMajor) {
                const numR = r - 42;
                const nx = cx + Math.cos(ang) * numR;
                const ny = cy + Math.sin(ang) * numR;
                ctx.font = (maxTicks > 10 ? '700 13px Orbitron' : '700 15px Orbitron') + ', sans-serif';
                ctx.fillStyle = isRed ? '#ff4466' : '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(i.toString(), nx, ny);
            }
        }

        // 動態轉速填充弧
        if (rpmRatio > 0.01) {
            const rpmGrad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
            rpmGrad.addColorStop(0, '#00ffff');
            rpmGrad.addColorStop(Math.min(0.8, redlineRatio * 0.9), '#ffcc00');
            rpmGrad.addColorStop(1, '#ff0055');

            ctx.beginPath();
            ctx.arc(cx, cy, r - 12, startAng, startAng + sweepAng * rpmRatio);
            ctx.strokeStyle = rpmGrad;
            ctx.lineWidth = 12;
            ctx.shadowColor = currentRpm >= redlineRpm ? '#ff0055' : '#00ffff';
            ctx.shadowBlur = currentRpm >= redlineRpm ? 20 : 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // 指針
        let renderRatio = rpmRatio;
        if (currentRpm >= maxRpm * 0.97) {
            renderRatio += (Math.random() - 0.5) * 0.025;
        }
        const needleAng = startAng + sweepAng * Math.min(1.05, Math.max(0.0, renderRatio));
        const needleLen = r - 24;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(needleAng) * needleLen, cy + Math.sin(needleAng) * needleLen);
        ctx.strokeStyle = currentRpm >= redlineRpm ? '#ff1144' : '#00ffcc';
        ctx.lineWidth = 4.5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 18;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#0a101d';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // 中央速度數字
        ctx.font = '700 14px Orbitron, sans-serif';
        ctx.fillStyle = '#00ffff';
        ctx.textAlign = 'center';
        ctx.fillText('KM/H', cx, cy - 40);

        ctx.font = '900 56px Orbitron, Rajdhani, sans-serif';
        ctx.fillStyle = '#ffea00';
        ctx.shadowColor = '#ffea00';
        ctx.shadowBlur = 18;
        ctx.fillText(speedKMH.toString(), cx, cy + 16);
        ctx.shadowBlur = 0;

        // 檔位
        const gearText = `GEAR ${gear}`;
        ctx.font = '900 18px Orbitron, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(gearText, cx, cy + 48);

        const transTag = transmissionMode === 'auto' ? 'AUTO' : transmissionMode === 'manual' ? 'MANUAL' : 'M+CLUTCH';
        ctx.font = '700 10px Orbitron, sans-serif';
        ctx.fillStyle = transmissionMode === 'auto' ? 'rgba(0, 255, 255, 0.6)' : transmissionMode === 'manual' ? 'rgba(255, 234, 0, 0.8)' : 'rgba(255, 51, 102, 0.9)';
        ctx.fillText(transTag, cx, cy + 62);

        // 離合器 / 漂移 / 氮氣
        if (clutchVal > 0.1) {
            drawRoundRectHelper(ctx, cx - 35, cy + 68, 70, 16, 4);
            ctx.fillStyle = 'rgba(255, 51, 102, 0.85)';
            ctx.fill();
            ctx.font = '900 9px Orbitron, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('CLUTCH', cx, cy + 79);
        } else if (isDrifting) {
            drawRoundRectHelper(ctx, cx - 45, cy + 68, 90, 20, 6);
            ctx.fillStyle = '#00ffcc';
            ctx.shadowColor = '#00ffcc';
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.font = '900 13px Orbitron, sans-serif';
            ctx.fillStyle = '#000000';
            ctx.fillText('DRIFT', cx, cy + 83);
        } else {
            const nWidth = 130, nHeight = 8, nX = cx - 65, nY = cy + 74;
            drawRoundRectHelper(ctx, nX, nY, nWidth, nHeight, 4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.fill();
            if (nitroPct > 0) {
                drawRoundRectHelper(ctx, nX, nY, nWidth * (nitroPct / 100), nHeight, 4);
                ctx.fillStyle = nitroActive ? '#ffff00' : '#00ffcc';
                if (nitroActive) { ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 12; }
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }

    // ===== 小地圖 =====
    let minimapCtx = null;

    function initMinimap() {
        const canvas = document.getElementById('minimapCanvas');
        if (!canvas) return;
        minimapCtx = canvas.getContext('2d');
        minimapCtx._MSIZE = 300;
    }

    function drawMinimap(cars, trackSamples, trackNormals, trackWidthsLeft, trackWidthsRight,
                          trackType, TRACK_SAMPLES, CHECKPOINT_RATIOS, altRouteSamples, trackWidth) {
        if (!minimapCtx) {
            initMinimap();
            if (!minimapCtx) return;
        }
        const ctx = minimapCtx;
        const player = cars && cars[0];
        if (!player || !player.mesh) return;

        trackSamples = trackSamples || (_ctx && _ctx.trackSamples);
        trackNormals = trackNormals || (_ctx && _ctx.trackNormals);
        trackWidthsLeft = trackWidthsLeft || (_ctx && _ctx.trackWidthsLeft);
        trackWidthsRight = trackWidthsRight || (_ctx && _ctx.trackWidthsRight);
        trackType = trackType || (_ctx && _ctx.trackType);
        TRACK_SAMPLES = TRACK_SAMPLES || (_ctx && _ctx.TRACK_SAMPLES) || (trackSamples ? trackSamples.length : 2400);
        CHECKPOINT_RATIOS = CHECKPOINT_RATIOS || (_ctx && _ctx.CHECKPOINT_RATIOS) || [0.205, 0.445, 0.695];
        altRouteSamples = altRouteSamples || (_ctx && _ctx.altRouteSamples);
        trackWidth = trackWidth || (_ctx && _ctx.trackWidth) || 18;

        if (!trackSamples || trackSamples.length === 0) return;

        const MSIZE = ctx._MSIZE || 240;
        const cx = MSIZE / 2;
        const cy = MSIZE / 2;

        ctx.clearRect(0, 0, MSIZE, MSIZE);

        const zoomScale = 0.52;
        const rotAngle = player.heading + Math.PI;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = 'rgba(6, 10, 22, 0.93)';
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (let r = 35; r < cx; r += 35) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.translate(cx, cy);
        ctx.rotate(rotAngle);

        // 賽道底層發光
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = Math.max(8, trackWidth * zoomScale + 4);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < trackSamples.length; i++) {
            const pt = trackSamples[i];
            const dx = (pt.x - player.mesh.position.x) * zoomScale;
            const dy = (pt.z - player.mesh.position.z) * zoomScale;
            if (i === 0) ctx.moveTo(dx, dy);
            else ctx.lineTo(dx, dy);
        }
        if (trackType === 'circuit') ctx.closePath();
        ctx.stroke();

        // 賽道主幹
        ctx.strokeStyle = 'rgba(0, 255, 220, 0.85)';
        ctx.lineWidth = Math.max(5, trackWidth * zoomScale);
        ctx.beginPath();
        for (let i = 0; i < trackSamples.length; i++) {
            const pt = trackSamples[i];
            const dx = (pt.x - player.mesh.position.x) * zoomScale;
            const dy = (pt.z - player.mesh.position.z) * zoomScale;
            if (i === 0) ctx.moveTo(dx, dy);
            else ctx.lineTo(dx, dy);
        }
        if (trackType === 'circuit') ctx.closePath();
        ctx.stroke();

        // 中心虛線
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i < trackSamples.length; i++) {
            const pt = trackSamples[i];
            const dx = (pt.x - player.mesh.position.x) * zoomScale;
            const dy = (pt.z - player.mesh.position.z) * zoomScale;
            if (i === 0) ctx.moveTo(dx, dy);
            else ctx.lineTo(dx, dy);
        }
        if (trackType === 'circuit') ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // 岔路
        if (altRouteSamples && altRouteSamples.length > 0) {
            ctx.strokeStyle = 'rgba(0, 255, 220, 0.85)';
            ctx.lineWidth = Math.max(4, trackWidth * zoomScale * 0.8);
            altRouteSamples.forEach(samples => {
                ctx.beginPath();
                samples.forEach(({ pt }, i) => {
                    const dx = (pt.x - player.mesh.position.x) * zoomScale;
                    const dy = (pt.z - player.mesh.position.z) * zoomScale;
                    if (i === 0) ctx.moveTo(dx, dy);
                    else ctx.lineTo(dx, dy);
                });
                ctx.stroke();
            });
        }

        // Checkpoint 標記 (僅在線性賽道顯示)
        if (trackType === 'linear') {
            CHECKPOINT_RATIOS.forEach((ratio, cpIdx) => {
                const idx = Math.floor(TRACK_SAMPLES * ratio);
                const pt = trackSamples[idx];
                if (pt) {
                    const dx = (pt.x - player.mesh.position.x) * zoomScale;
                    const dy = (pt.z - player.mesh.position.z) * zoomScale;
                    ctx.fillStyle = player.checkpointsPassed[cpIdx] ? '#00ff88' : '#ffcc00';
                    ctx.beginPath();
                    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // AI 車輛
        const carColors = ['#00ffff', '#ff4444', '#ffcc00', '#44ff44'];
        cars.forEach((car, i) => {
            if (i === 0) return;
            const dx = (car.mesh.position.x - player.mesh.position.x) * zoomScale;
            const dy = (car.mesh.position.z - player.mesh.position.z) * zoomScale;
            ctx.fillStyle = carColors[i] || '#ff4444';
            ctx.beginPath();
            ctx.arc(dx, dy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // 玩家標記 (中央)
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 玩家方向箭頭
        const headingAngle = player.heading - Math.PI / 2;
        ctx.save();
        ctx.rotate(headingAngle);
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(-4, -4);
        ctx.lineTo(4, -4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 賽道起點 / 終點線
        if (trackSamples.length > 0) {
            const startPt = trackSamples[0];
            const sDx = (startPt.x - player.mesh.position.x) * zoomScale;
            const sDy = (startPt.z - player.mesh.position.z) * zoomScale;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sDx - 4, sDy - 2, 8, 4);
        }

        ctx.restore();

        // 外圈霓虹邊框
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, cx - 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 北方指南針
        const northAngle = player.heading + Math.PI / 2;
        const badgeR = cx - 14;
        const nx2 = cx + Math.cos(northAngle) * badgeR;
        const ny2 = cy + Math.sin(northAngle) * badgeR;
        ctx.beginPath();
        ctx.arc(nx2, ny2, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(235, 45, 75, 0.95)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ff2d4b';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.font = '900 11px Orbitron, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', nx2, ny2 + 0.5);
        ctx.restore();
    }

    // ===== Checkpoint 彈出橫幅回饋 =====
    let cpBannerTimeout = null;

    function triggerCPFeedback(cpIdx, currentTime, selectedTrackKey, selectedTrackDirection) {
        selectedTrackKey = selectedTrackKey || (_ctx && _ctx.selectedTrackKey) || 'akina';
        selectedTrackDirection = selectedTrackDirection || (_ctx && _ctx.selectedTrackDirection) || 'forward';
        const bestKey = `cyberRacer_best_cp_${selectedTrackKey}_${selectedTrackDirection}_${cpIdx}`;
        const prevBestCP = parseFloat(localStorage.getItem(bestKey) || '0');
        let diffStr = '--';
        let isFast = true;

        if (prevBestCP > 0) {
            const diff = currentTime - prevBestCP;
            if (diff <= 0) {
                diffStr = `${diff.toFixed(2)}s (NEW BEST!)`;
                isFast = true;
                localStorage.setItem(bestKey, currentTime.toString());
            } else {
                diffStr = `+${diff.toFixed(2)}s`;
                isFast = false;
            }
        } else {
            localStorage.setItem(bestKey, currentTime.toString());
            diffStr = '首紀錄！';
            isFast = true;
        }

        const mins = Math.floor(currentTime / 60);
        const secs = Math.floor(currentTime % 60);
        const ms = Math.floor((currentTime % 1) * 10);
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;

        const banner = document.getElementById('hudCPBanner');
        const titleEl = document.getElementById('cpBannerTitle');
        const timeEl = document.getElementById('cpBannerTime');
        const splitEl = document.getElementById('cpBannerSplit');

        if (banner && titleEl && timeEl && splitEl) {
            titleEl.textContent = `CHECKPOINT ${cpIdx + 1}`;
            timeEl.textContent = timeStr;
            splitEl.textContent = diffStr;
            splitEl.className = 'cp-banner-split ' + (isFast ? 'fast' : 'slow');

            banner.classList.add('active');
            if (cpBannerTimeout) clearTimeout(cpBannerTimeout);
            cpBannerTimeout = setTimeout(() => {
                banner.classList.remove('active');
            }, 2200);
        }
    }

    // ===== 環道賽單圈切換橫幅回饋 =====
    function triggerLapBanner(lap, lapTime, totalLaps, isFinish) {
        const banner = document.getElementById('hudCPBanner');
        const titleEl = document.getElementById('cpBannerTitle');
        const timeEl = document.getElementById('cpBannerTime');
        const splitEl = document.getElementById('cpBannerSplit');
        if (!banner || !titleEl || !timeEl || !splitEl) return;

        function formatBannerTime(t) {
            if (!t || t <= 0) return '00:00.0';
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            const ms = Math.floor((t % 1) * 10);
            return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
        }

        if (lap === 1) {
            titleEl.textContent = 'LAP 1 START!';
            timeEl.textContent = '第 1 圈開始';
            splitEl.textContent = `1 / ${totalLaps}`;
            splitEl.className = 'cp-banner-split fast';
        } else if (isFinish) {
            titleEl.textContent = 'RACE FINISH!';
            timeEl.textContent = `第 ${lap} 圈: ${formatBannerTime(lapTime)}`;
            splitEl.textContent = `${totalLaps} / ${totalLaps} 完賽`;
            splitEl.className = 'cp-banner-split fast';
        } else if (lap === totalLaps) {
            titleEl.textContent = 'FINAL LAP (最後一圈)';
            timeEl.textContent = `第 ${lap - 1} 圈: ${formatBannerTime(lapTime)}`;
            splitEl.textContent = `${lap} / ${totalLaps}`;
            splitEl.className = 'cp-banner-split fast';
        } else {
            titleEl.textContent = `LAP ${lap}`;
            timeEl.textContent = `第 ${lap - 1} 圈: ${formatBannerTime(lapTime)}`;
            splitEl.textContent = `${lap} / ${totalLaps}`;
            splitEl.className = 'cp-banner-split fast';
        }

        banner.classList.add('active');
        if (cpBannerTimeout) clearTimeout(cpBannerTimeout);
        cpBannerTimeout = setTimeout(() => {
            banner.classList.remove('active');
        }, 2200);
    }

    // ===== 暴露至全域 =====
    window.CyberRaceHUD = {
        init,
        updateHUD,
        updateTelemetryPanel,
        updateDriftSFX,
        spawnInitialDSFX,
        drawGaugeCanvas,
        drawRoundRectHelper,
        initMinimap,
        drawMinimap,
        triggerCPFeedback,
        triggerLapBanner,
        setGaugeStyle,
        get gaugeStyle() { return gaugeStyle; },
    };

})();
