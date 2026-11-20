// ==================== CYBER RACER - 擬真物理引擎模組 (Physics Engine Module) ====================
// 從 cyberrace.html 分離，透過 window.CyberRacePhysics 暴露給主程式 Game 使用
// 主程式需在 IIFE 頂部解構：const { PHYSICS, TIRE_COMPOUNDS, ... } = window.CyberRacePhysics;

(function () {
    'use strict';

    // ===== 擬真車輛物理引擎常數 (Realistic Vehicle Physics Engine) =====
    const PHYSICS = {
        wallBounce: 0.62,
        wallMinSpeed: 0.35,
        carBounce: 0.5,
        carCollisionDist: 2.8,
        airDensity: 1.225,
        rollingResistanceCoeff: 0.012,
        drivetrainEfficiency: 0.85,
        cgHeightRatio: 0.45,
        cgHeight: 0.48,
        maxSteerAngleDeg: 33,
        steerSpeed: 3.5,
        speedScale: 60,
        speedToKMH: 120,
        boostThreshold1: 0.8,
        boostThreshold2: 1.8,
        boostThreshold3: 3.0,
        boostMaxSpeed: 2.25,
        nitroChargeBase: 0.08,
        nitroChargeAngleBonus: 0.72,
        nitroDrainRate: 0.24,
        nitroBoostForce: 3500,
    };

    const TIRE_COMPOUNDS = {
        street:    { gripMul: 0.85, optTempMin: 70, optTempMax: 105, wearRate: 0.6,  heatRate: 0.8,  B: 10, C: 1.3, D: 1.0, E: -0.5 },
        sport:     { gripMul: 1.00, optTempMin: 75, optTempMax: 105, wearRate: 1.0,  heatRate: 1.0,  B: 12, C: 1.5, D: 1.0, E: -0.2 },
        semiSlick: { gripMul: 1.12, optTempMin: 80, optTempMax: 108, wearRate: 1.5,  heatRate: 1.3,  B: 14, C: 1.6, D: 1.0, E: 0.0 },
        slick:     { gripMul: 1.25, optTempMin: 85, optTempMax: 110, wearRate: 2.2,  heatRate: 1.6,  B: 16, C: 1.7, D: 1.0, E: 0.1 },
    };

    // --- 引擎扭力曲線 (Engine Torque Curve) ---
    function getEngineTorque(rpm, model) {
        const idleRpm = model.idleRpm || 900;
        const maxRpm = model.maxRpm || 8000;
        const peakTqRpm = model.peakTorqueRpm || 5000;
        const peakTq = model.torqueNm || 200;
        const redlineRpm = model.redlineRpm || 7500;

        if (rpm < idleRpm) rpm = idleRpm;
        if (rpm > maxRpm) return peakTq * 0.05; // 斷油點 Rev limiter cutoff

        // 拋物線扭力曲線模型
        const rpmNorm = (rpm - idleRpm) / (maxRpm - idleRpm);
        const peakTqNorm = (peakTqRpm - idleRpm) / (maxRpm - idleRpm);
        const k = 1.0 / Math.max(0.01, peakTqNorm * peakTqNorm + (1 - peakTqNorm) * (1 - peakTqNorm));
        let curve = 1.0 - k * (rpmNorm - peakTqNorm) * (rpmNorm - peakTqNorm);
        curve = Math.max(0.65, Math.min(1.0, curve));

        // 紅線超轉劇烈衰退 + 高頻斷油爆音跳動
        if (rpm > redlineRpm) {
            const overrevRatio = (rpm - redlineRpm) / (maxRpm - redlineRpm);
            const flutter = 0.78 + Math.random() * 0.40 * (1.0 - overrevRatio * 0.4);
            curve *= Math.max(0.20, 1.0 - overrevRatio * 0.55) * flutter;
        }

        return peakTq * curve;
    }

    // --- 4大進氣與增壓模式模擬 (NA, Single Turbo, Sequential Twin Turbo, Supercharger) ---
    function updateTurboBoost(car, throttle, rpm, dt) {
        const model = car.model;
        if (!model || model.aspirationType === 'NA') {
            car.currentBoostPSI = 0;
            return 1.0;
        }

        const asp = model.aspirationType || 'SingleTurbo';
        const maxBoost = model.boostPSI || 10;
        const idleRpm = model.idleRpm || 900;
        const lagSec = Math.max(0.05, (model.boostLagMs || 300) / 1000);

        let targetBoost = 0;

        if (asp === 'Supercharger') {
            const rpmRatio = Math.min(1.0, Math.max(0.1, (rpm - idleRpm) / 4500));
            targetBoost = maxBoost * throttle * rpmRatio;
            car.currentBoostPSI = targetBoost;
        } else if (asp === 'SequentialTwinTurbo' || asp === 'TwinTurbo') {
            const primaryBoost = Math.min(1.0, Math.max(0.0, (rpm - 1800) / 2200));
            const secondaryBoost = Math.min(1.0, Math.max(0.0, (rpm - 3800) / 2200));
            const combinedSpool = 0.55 * primaryBoost + 0.45 * secondaryBoost;
            targetBoost = maxBoost * throttle * combinedSpool;
            const rate = targetBoost > (car.currentBoostPSI || 0) ? (1.5 / lagSec) : (4.0 / lagSec);
            car.currentBoostPSI = (car.currentBoostPSI || 0) + (targetBoost - (car.currentBoostPSI || 0)) * Math.min(1.0, rate * dt);
        } else {
            const singleSpool = Math.pow(Math.min(1.0, Math.max(0.0, (rpm - 2800) / 2600)), 1.8);
            targetBoost = maxBoost * throttle * singleSpool;
            const rate = targetBoost > (car.currentBoostPSI || 0) ? (1.0 / lagSec) : (3.0 / lagSec);
            car.currentBoostPSI = (car.currentBoostPSI || 0) + (targetBoost - (car.currentBoostPSI || 0)) * Math.min(1.0, rate * dt);
        }

        return 1.0 + (car.currentBoostPSI || 0) * 0.065;
    }

    // --- 簡化 Pacejka 輪胎模型 (Simplified Magic Formula Tire Model) ---
    function pacejkaTireForce(slipAngleDeg, normalLoad, compound, gripBase, tempMul, pressureMul, wearMul, camberEffect) {
        const tc = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.sport;
        const B = tc.B;
        const C = tc.C;
        const D = normalLoad * tc.D * tc.gripMul * gripBase * tempMul * pressureMul * wearMul * camberEffect;
        const E = tc.E;
        const alpha = slipAngleDeg * (Math.PI / 180);
        const Balpha = B * alpha;
        const Fy = D * Math.sin(C * Math.atan(Balpha - E * (Balpha - Math.atan(Balpha))));
        return Fy;
    }

    // --- 輪胎溫度模型 ---
    function updateTireTemperature(tire, slipMagnitude, speedMS, dt, compound, isFront, driveType, isOuterWheel, isInnerWheel, throttle) {
        isFront = isFront || false;
        driveType = driveType || 'FR';
        isOuterWheel = isOuterWheel || false;
        isInnerWheel = isInnerWheel || false;
        throttle = throttle !== undefined ? throttle : 1.0;

        const tc = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.sport;
        const ambientTemp = 25;

        let effectiveSlip = slipMagnitude;
        if (isFront && (driveType === 'FR' || driveType === 'MR' || driveType === 'AWD')) {
            effectiveSlip *= 0.50;
        }
        if (throttle < 0.8) {
            effectiveSlip *= (throttle <= 0.05 ? 0.0 : throttle);
        }

        const zones = ['inner', 'mid', 'outer'];
        for (const zone of zones) {
            let heatGeneration = effectiveSlip * 20.0 * tc.heatRate;

            if (isOuterWheel) {
                if (zone === 'outer') heatGeneration *= 1.50;
                if (zone === 'mid')   heatGeneration *= 1.28;
                if (zone === 'inner') heatGeneration *= 0.75;
            } else if (isInnerWheel) {
                if (zone === 'outer') heatGeneration *= 0.60;
                if (zone === 'mid')   heatGeneration *= 0.70;
                if (zone === 'inner') heatGeneration *= 0.85;
            } else {
                if (zone === 'inner') heatGeneration *= 1.10;
                if (zone === 'mid')   heatGeneration *= 1.00;
                if (zone === 'outer') heatGeneration *= 0.90;
            }

            const tempDiff = Math.max(0.0, tire.temperature[zone] - ambientTemp);
            const windFactor = 1.0 + (speedMS * 3.6 / 80.0);
            const highTempBurst = Math.max(0.0, tempDiff - 55.0) * 0.12;
            const coolingRate = tempDiff * (0.10 + 0.05 * windFactor) + highTempBurst;

            tire.temperature[zone] += (heatGeneration - coolingRate) * dt;
            tire.temperature[zone] = Math.max(ambientTemp, Math.min(220, tire.temperature[zone]));
        }
    }

    // --- 輪胎溫度對抓地力乘數 ---
    function getTireTemperatureGripMultiplier(tire, compound) {
        const tc = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.sport;
        const avgTemp = (tire.temperature.inner + tire.temperature.mid + tire.temperature.outer) / 3;
        const minTemp = tc.optTempMin || 70;
        const maxTemp = tc.optTempMax || 105;

        if (avgTemp >= minTemp && avgTemp <= maxTemp) return 1.0;
        if (avgTemp > maxTemp) {
            return Math.max(0.62, 1.0 - (avgTemp - maxTemp) * 0.007);
        }
        return Math.max(0.85, 1.0 - (minTemp - avgTemp) * 0.004);
    }

    // --- 輪胎壓力模型 ---
    function updateTirePressure(tire, dt) {
        const avgTemp = (tire.temperature.inner + tire.temperature.mid + tire.temperature.outer) / 3;
        const basePressure = 220;
        const baseTemp = 25 + 273.15;
        tire.pressure = basePressure * ((avgTemp + 273.15) / baseTemp);
    }

    // --- 輪胎壓力對抓地力乘數 ---
    function getTirePressureGripMultiplier(pressure) {
        const optPressure = 240;
        const diff = pressure - optPressure;
        if (diff > 10) {
            return Math.max(0.70, 1.0 - (diff - 10) * 0.0055);
        }
        if (diff < -15) {
            return Math.max(0.85, 1.0 - Math.abs(diff + 15) * 0.003);
        }
        return 1.0;
    }

    // --- 輪胎損耗模型 (gameSettings 由外部傳入) ---
    function updateTireWear(tire, slipMagnitude, load, dt, compound, gameSettings) {
        if (!gameSettings || !gameSettings.tireWearEnabled) return;
        const tc = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.sport;
        const avgTemp = (tire.temperature.inner + tire.temperature.mid + tire.temperature.outer) / 3;
        const tempFactor = avgTemp > 100 ? 1.5 : (avgTemp > 80 ? 1.0 : 0.7);
        const baseWear = slipMagnitude * load * 0.0000002 * tc.wearRate * tempFactor * dt;

        const zones = ['inner', 'mid', 'outer'];
        for (const zone of zones) {
            let zoneFactor = 1.0;
            if (zone === 'inner') zoneFactor += Math.abs(tire.camber) * 0.15;
            if (zone === 'outer') zoneFactor -= Math.abs(tire.camber) * 0.08;
            const pDiff = tire.pressure - 240;
            if (zone === 'mid' && pDiff > 10) zoneFactor += pDiff * 0.005;
            if (zone !== 'mid' && pDiff < -10) zoneFactor += Math.abs(pDiff) * 0.004;
            tire.wear[zone] = Math.max(0, tire.wear[zone] - baseWear * zoneFactor);
        }
    }

    // --- 輪胎磨損對抓地力乘數 ---
    function getTireWearGripMultiplier(tire, gameSettings) {
        if (!gameSettings || !gameSettings.tireWearEnabled) return 1.0;
        const avgWear = (tire.wear.inner + tire.wear.mid + tire.wear.outer) / 3;
        if (avgWear > 0.5) return 1.0;
        return 0.6 + avgWear * 0.8;
    }

    // --- 外傾角效果 ---
    function getCamberGripEffect(camberDeg, isCorneringOutside) {
        if (isCorneringOutside && camberDeg < 0) {
            return 1.0 + Math.min(0.08, Math.abs(camberDeg) * 0.025);
        }
        if (camberDeg < 0) {
            return 1.0 - Math.abs(camberDeg) * 0.008;
        }
        return 1.0;
    }

    // --- 重心轉移 (Weight Transfer) ---
    function calculateWeightTransfer(model, accelMS2, lateralAccMS2) {
        const mass = model.weight || 1000;
        const g = 9.81;
        const wheelbase = model.wheelbase || 2.40;
        const trackW = model.trackWidthAxle || 1.45;
        const cgH = PHYSICS.cgHeight;
        const fwr = model.frontWeightRatio || 0.50;
        const staticFrontTotal = mass * g * fwr;
        const staticRearTotal = mass * g * (1 - fwr);
        const longTransfer = (mass * accelMS2 * cgH) / wheelbase;
        const latTransfer = (mass * lateralAccMS2 * cgH) / trackW;
        const frontRollDist = (model.antiRollF || 0.5) / ((model.antiRollF || 0.5) + (model.antiRollR || 0.3));

        return {
            FL: (staticFrontTotal / 2) - (longTransfer / 2) + latTransfer * frontRollDist,
            FR: (staticFrontTotal / 2) - (longTransfer / 2) - latTransfer * frontRollDist,
            RL: (staticRearTotal / 2) + (longTransfer / 2) + latTransfer * (1 - frontRollDist),
            RR: (staticRearTotal / 2) + (longTransfer / 2) - latTransfer * (1 - frontRollDist),
        };
    }

    // --- 空氣動力學 (Aerodynamics) ---
    function calculateAeroForces(model, speedMS) {
        const rho = PHYSICS.airDensity;
        const Cd = model.dragCoefficient || 0.34;
        const A = model.frontalArea || 1.80;
        const Cl = model.downforceCoefficient || 0.05;
        const v2 = speedMS * speedMS;
        return {
            drag: 0.5 * rho * Cd * A * v2,
            downforce: 0.5 * rho * Cl * A * v2,
        };
    }

    // --- 煞車力計算 ---
    function calculateBrakeForce(model) {
        const braking97Dist = model.braking97Dist || 45.4;
        const v97 = 97 / 3.6;
        const brakeDecel = (v97 * v97) / (2 * braking97Dist);
        return (model.weight || 1000) * brakeDecel;
    }

    // --- 初始化輪胎狀態 ---
    function createTireState(camberDeg) {
        return {
            slipAngle: 0,
            slipRatio: 0,
            load: 0,
            lateralForce: 0,
            longitudinalForce: 0,
            temperature: { inner: 60, mid: 60, outer: 60 },
            pressure: 220,
            wear: { inner: 1.0, mid: 1.0, outer: 1.0 },
            camber: camberDeg || 0,
        };
    }

    // --- 從車速反推 RPM ---
    function speedToRPM(speedMS, gearRatio, finalDrive, tireRadius) {
        if (gearRatio <= 0) return 0;
        return (speedMS * gearRatio * finalDrive * 60) / (2 * Math.PI * tireRadius);
    }

    // --- 校準用加速力倍率 ---
    function getCalibrationFactor(model) {
        const hp = model.hp || 180;
        if (hp >= 400) return 2.65;
        if (hp >= 300) return 2.35;
        if (hp >= 250) return 2.10;
        if (hp >= 200) return 1.85;
        return 1.65;
    }

    // ===== 暴露至全域 =====
    window.CyberRacePhysics = {
        PHYSICS,
        TIRE_COMPOUNDS,
        getEngineTorque,
        updateTurboBoost,
        pacejkaTireForce,
        updateTireTemperature,
        getTireTemperatureGripMultiplier,
        updateTirePressure,
        getTirePressureGripMultiplier,
        updateTireWear,
        getTireWearGripMultiplier,
        getCamberGripEffect,
        calculateWeightTransfer,
        calculateAeroForces,
        calculateBrakeForce,
        createTireState,
        speedToRPM,
        getCalibrationFactor,
    };

})();
