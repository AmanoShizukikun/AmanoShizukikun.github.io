/**
 * CyberRaceInputHaptics - 手把輸入、動態雙馬達震動與選單導航模組
 * 支援 Forza Horizon 按鍵配置、路感/甩尾/紅線斷油/降檔雙馬達震動、以及全選單 Gamepad Focus 導航
 */
window.CyberRaceInputHaptics = (() => {
    'use strict';

    let transmissionMode = localStorage.getItem('transmissionMode') || 'auto'; // auto, manual, manual_clutch
    let shiftToastTimer = null;
    let hapticPulseTimer = 0;
    let lastVibTime = 0;
    let lastWeakMag = -1;
    let lastStrongMag = -1;

    const gamepadState = {
        connected: false,
        id: '',
        prevButtons: {}
    };

    const GEAR_MAX_SPEEDS = {
        '-1': 0.42, // Reverse (倒檔)
        '0': 0.0,   // Neutral (空檔)
        '1': 0.32,  // 1檔 (~45 km/h)
        '2': 0.58,  // 2檔 (~80 km/h)
        '3': 0.88,  // 3檔 (~120 km/h)
        '4': 1.15,  // 4檔 (~160 km/h)
        '5': 1.38,  // 5檔 (~190 km/h)
        '6': 1.62   // 6檔 (~225 km/h)
    };

    const GEAR_ACCEL_MULS = {
        '-1': 1.1,
        '0': 0.0,
        '1': 1.45,
        '2': 1.25,
        '3': 1.05,
        '4': 0.90,
        '5': 0.78,
        '6': 0.65
    };

    // ===== 全選單手把導航系統 (Gamepad Menu Focus Manager) =====
    const menuFocusManager = {
        focusedIndex: 0,
        elements: [],
        lastNavTime: 0,

        update(gameState = 'menu') {
            if (gameState === 'playing' || gameState === 'countdown') {
                this.clearFocus();
                this.elements = [];
                return;
            }

            const activePanel = document.querySelector('.panel-overlay.active, .pause-menu-overlay.active, .race-result-panel.active, .title-screen:not(.hidden)');
            if (!activePanel) {
                this.clearFocus();
                this.elements = [];
                return;
            }

            const focusables = Array.from(activePanel.querySelectorAll('button:not([disabled]), .track-card, .car-card, .difficulty-btn'));
            if (focusables.length === 0) {
                this.clearFocus();
                this.elements = [];
                return;
            }

            if (this.elements.length !== focusables.length || this.elements[0] !== focusables[0]) {
                this.clearFocus();
                this.elements = focusables;
                this.focusedIndex = 0;
                this.applyFocus();
            }
        },

        clearFocus() {
            document.querySelectorAll('.gamepad-focused').forEach(el => el.classList.remove('gamepad-focused'));
        },

        applyFocus() {
            this.clearFocus();
            if (this.elements[this.focusedIndex]) {
                const el = this.elements[this.focusedIndex];
                el.classList.add('gamepad-focused');
                if (typeof el.scrollIntoView === 'function') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        },

        navigate(dir) {
            if (this.elements.length === 0) return;
            const now = performance.now();
            if (now - this.lastNavTime < 180) return;
            this.lastNavTime = now;

            if (dir === 'next' || dir === 'down' || dir === 'right') {
                this.focusedIndex = (this.focusedIndex + 1) % this.elements.length;
            } else if (dir === 'prev' || dir === 'up' || dir === 'left') {
                this.focusedIndex = (this.focusedIndex - 1 + this.elements.length) % this.elements.length;
            }
            this.applyFocus();
        },

        confirm() {
            if (this.elements[this.focusedIndex]) {
                this.elements[this.focusedIndex].click();
            }
        },

        back() {
            const activePanel = document.querySelector('.panel-overlay.active, .pause-menu-overlay.active');
            if (activePanel) {
                const backBtn = activePanel.querySelector('.back-btn, #trackSelectBackBtn, #carSelectBackBtn, #aiDifficultyBackBtn, #instructionsBackBtn, #pauseResumeBtn');
                if (backBtn) backBtn.click();
            }
        }
    };

    function showShiftToast(msg, isWarning = false) {
        if (typeof msg === 'string' && msg.startsWith('GEAR ')) return;
        const toast = document.getElementById('hudShiftToast');
        const iconEl = document.getElementById('shiftToastIcon');
        const msgEl = document.getElementById('shiftToastMsg');
        if (!toast || !msgEl) return;

        msgEl.textContent = msg;
        if (iconEl) iconEl.textContent = isWarning ? '⚠️' : '⚙️';

        if (isWarning) {
            toast.classList.add('warning');
        } else {
            toast.classList.remove('warning');
        }

        toast.classList.add('active');
        if (shiftToastTimer) clearTimeout(shiftToastTimer);
        shiftToastTimer = setTimeout(() => {
            toast.classList.remove('active');
        }, 1200);
    }

    function getGearDisplayString(g) {
        if (g === -1 || g === '-1') return 'R';
        if (g === 0 || g === '0') return 'N';
        return (g !== undefined && g !== null) ? g.toString() : '1';
    }

    function cleanGamepadName(id) {
        if (!id) return '手把';
        if (id.includes('Xbox') || id.includes('XINPUT')) return 'Xbox 手把';
        if (id.includes('DualSense') || id.includes('Wireless Controller') || id.includes('PlayStation')) return 'PS 手把';
        return '標準手把';
    }

    function updateGamepadStatusUI(connected, id = '') {
        const badge = document.getElementById('pauseGamepadStatus');
        if (badge) {
            if (connected) {
                badge.textContent = `🎮 已連線 (${cleanGamepadName(id)})`;
                badge.classList.add('active');
            } else {
                badge.textContent = '未連接手把';
                badge.classList.remove('active');
            }
        }
    }

    function setTransmissionMode(mode) {
        transmissionMode = mode;
        localStorage.setItem('transmissionMode', mode);
        if (!window.gameSettings) window.gameSettings = {};
        window.gameSettings.transmissionMode = mode;
        updateTransModeButtonsUI();
        showShiftToast(`變速箱：${mode === 'auto' ? '自動排檔' : mode === 'manual' ? '手動排檔' : '手排+離合'}`);
    }

    function getTransmissionMode() {
        return transmissionMode;
    }

    function updateTransModeButtonsUI() {
        document.querySelectorAll('.trans-mode-btn').forEach(btn => {
            if (btn.dataset.trans === transmissionMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // ===== 極限地平線風格 (Forza Horizon Style) 手把動態雙馬達震動反饋系統 =====
    function updateGamepadVibration(car, pad, dt = 0.016, gameSettings = {}) {
        if (!gameSettings.vibrationEnabled || !pad) return;

        const actuator = pad.vibrationActuator || (pad.hapticActuators && pad.hapticActuators[0]);
        if (!actuator) return;

        const userIntensity = (gameSettings.vibrationIntensity !== undefined) ? gameSettings.vibrationIntensity : 0.10;
        if (userIntensity <= 0) return;

        hapticPulseTimer += dt;
        const now = performance.now();

        let weakMag = 0.0;
        let strongMag = 0.0;

        if (car) {
            // 1. 油門踩踏與加速微震
            if (car.currentThrottleInput > 0.08 && Math.abs(car.speed) > 0.05) {
                weakMag += Math.min(0.08, car.currentThrottleInput * 0.06);
            }

            // 2. 腳煞車摩擦與 ABS 脈動
            if (car.currentBrakeInput > 0.05 && Math.abs(car.speed) > 0.05) {
                weakMag += car.currentBrakeInput * 0.12;
                if (car.currentBrakeInput > 0.4) {
                    const absPulse = (Math.sin(hapticPulseTimer * 75) > 0) ? 0.22 : 0.05;
                    weakMag = Math.max(weakMag, absPulse);
                }
            }

            // 3. 輪胎極限與過彎 G 力
            if (car.tires) {
                let maxSlipDeg = 0;
                for (let i = 0; i < 4; i++) {
                    const tire = car.tires[i];
                    if (tire && Math.abs(tire.slipAngle || 0) > maxSlipDeg) {
                        maxSlipDeg = Math.abs(tire.slipAngle);
                    }
                }

                if (maxSlipDeg > 3.0) {
                    weakMag += Math.min(0.20, (maxSlipDeg - 3.0) / 18.0);
                }

                if (car.isDrifting || (car.prevRearWheelSpin > 0.02)) {
                    weakMag += 0.18;
                    strongMag += 0.14;
                }
            }

            // 4. 手煞車鎖死
            if (car.handbrakeHolding) {
                strongMag = Math.max(strongMag, 0.35);
                weakMag = Math.max(weakMag, 0.18);
            }

            // 5. 碰撞衝擊
            if (car.wallRecoverTimer > 0) {
                strongMag = 0.50;
                weakMag = 0.35;
            }

            // 6. 高轉速斷油脈衝震動
            const maxRpm = (car.model && car.model.maxRpm) ? car.model.maxRpm : 8000;
            const currentRpm = car.engineRpm || car.rpm || 0;
            if (currentRpm >= maxRpm * 0.96 && (car.currentThrottleInput > 0.2 || (typeof keys !== 'undefined' && keys && (keys['w'] || keys['arrowup'])))) {
                const revPulse = (Math.sin(hapticPulseTimer * 90) > 0) ? 0.38 : 0.08;
                weakMag = Math.max(weakMag, revPulse);
                strongMag = Math.max(strongMag, revPulse * 0.75);
            }
        }

        weakMag = Math.min(1.0, Math.max(0.0, weakMag * userIntensity));
        strongMag = Math.min(1.0, Math.max(0.0, strongMag * userIntensity));

        const magChanged = Math.abs(weakMag - lastWeakMag) > 0.05 || Math.abs(strongMag - lastStrongMag) > 0.05;
        if (now - lastVibTime < 100 && !magChanged) return;

        if (weakMag > 0.01 || strongMag > 0.01) {
            lastVibTime = now;
            lastWeakMag = weakMag;
            lastStrongMag = strongMag;

            const effectType = actuator.type || 'dual-rumble';
            if (typeof actuator.playEffect === 'function') {
                actuator.playEffect(effectType, {
                    startDelay: 0,
                    duration: 150,
                    weakMagnitude: weakMag,
                    strongMagnitude: strongMag
                }).catch(() => {});
            } else if (typeof actuator.pulse === 'function') {
                actuator.pulse(Math.max(weakMag, strongMag), 150).catch(() => {});
            }
        } else if (lastWeakMag > 0 || lastStrongMag > 0) {
            lastWeakMag = 0;
            lastStrongMag = 0;
            if (typeof actuator.reset === 'function') {
                actuator.reset().catch(() => {});
            }
        }
    }

    function triggerTestVibration(gameSettings = {}) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (pad && pad.connected) {
                const actuator = pad.vibrationActuator || (pad.hapticActuators && pad.hapticActuators[0]);
                if (actuator) {
                    const intensity = (gameSettings.vibrationIntensity !== undefined) ? gameSettings.vibrationIntensity : 0.10;
                    const effectType = actuator.type || 'dual-rumble';
                    if (typeof actuator.playEffect === 'function') {
                        actuator.playEffect(effectType, {
                            startDelay: 0,
                            duration: 200,
                            weakMagnitude: Math.min(1.0, 0.25 * intensity),
                            strongMagnitude: Math.min(1.0, 0.40 * intensity)
                        }).catch((err) => { console.warn('Vib test error:', err); });
                    } else if (typeof actuator.pulse === 'function') {
                        actuator.pulse(Math.min(1.0, 0.35 * intensity), 200).catch(() => {});
                    }
                }
            }
        }
    }

    function pollGamepad(gameState, targetCars = [], gameSettings = {}) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let pad = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                pad = gamepads[i];
                break;
            }
        }
        if (!pad) {
            if (gamepadState.connected) {
                gamepadState.connected = false;
                gamepadState.id = '';
                updateGamepadStatusUI(false);
            }
            return null;
        }

        if (gameState === 'playing' && targetCars.length > 0) {
            const player = targetCars.find(c => c.isPlayer) || targetCars[0];
            updateGamepadVibration(player, pad, 0.016, gameSettings);
        }

        if (!gamepadState.connected) {
            gamepadState.connected = true;
            gamepadState.id = pad.id;
            updateGamepadStatusUI(true, pad.id);
        }

        const isBtnPressed = (idx) => pad.buttons[idx] && (pad.buttons[idx].pressed || pad.buttons[idx].value > 0.4);
        const getBtnValue = (idx) => pad.buttons[idx] ? pad.buttons[idx].value : 0;

        const justPressed = (idx) => {
            const pressed = isBtnPressed(idx);
            const wasPressed = gamepadState.prevButtons[idx] || false;
            return pressed && !wasPressed;
        };

        // 手把選單導航由 CyberRaceUI 主導管理

        let steer = 0;
        const stickX = pad.axes[0] || 0;
        if (Math.abs(stickX) > 0.15) {
            const sign = Math.sign(stickX);
            const norm = (Math.abs(stickX) - 0.15) / 0.85;
            steer = -sign * norm;
        } else if (isBtnPressed(14)) {
            steer = 1;
        } else if (isBtnPressed(15)) {
            steer = -1;
        }

        const throttle = Math.max(getBtnValue(7), isBtnPressed(7) ? 1 : 0);
        const brake = Math.max(getBtnValue(6), isBtnPressed(6) ? 1 : 0);
        const clutch = Math.max(getBtnValue(4), isBtnPressed(4) ? 1 : 0);
        const handbrake = isBtnPressed(0);
        const camTrigger = justPressed(5);
        const shiftDownTrigger = justPressed(2); // X button
        const shiftUpTrigger = justPressed(1);   // B button
        const pauseTrigger = justPressed(9);
        const telemetryTrigger = justPressed(13); // D-pad Down
        const nitroTrigger = isBtnPressed(3);     // Y button

        for (let i = 0; i < pad.buttons.length; i++) {
            gamepadState.prevButtons[i] = pad.buttons[i].pressed || pad.buttons[i].value > 0.4;
        }

        return {
            steer,
            throttle,
            brake,
            clutch,
            handbrake,
            camTrigger,
            shiftDownTrigger,
            shiftUpTrigger,
            pauseTrigger,
            telemetryTrigger,
            nitroTrigger
        };
    }

    return {
        GEAR_MAX_SPEEDS,
        GEAR_ACCEL_MULS,
        menuFocusManager,
        showShiftToast,
        getGearDisplayString,
        cleanGamepadName,
        updateGamepadStatusUI,
        setTransmissionMode,
        getTransmissionMode,
        updateTransModeButtonsUI,
        updateGamepadVibration,
        triggerTestVibration,
        pollGamepad
    };
})();
window.CyberRaceInputHaptics = CyberRaceInputHaptics;
window.getGearDisplayString = CyberRaceInputHaptics.getGearDisplayString;
