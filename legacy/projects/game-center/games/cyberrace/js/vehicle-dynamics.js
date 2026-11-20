/**
 * CyberRaceVehicleDynamics - 車輛動態計算與 AI 駕駛決策模組
 * 負責處理玩家輸入解析、變速箱排檔、17 個物理步驟 (Pacejka 側向力、重心轉移、懸吊 Pitch/Roll、Nitro)、
 * 賽道/岔路邊界碰撞、車車碰撞反彈、以及 AI 巡航避障決策。
 */
window.CyberRaceVehicleDynamics = (() => {
    'use strict';

    function normalizeAngle(a) {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
    }

    function angleDiff(target, current) {
        return normalizeAngle(target - current);
    }

    function moveAngleTowards(current, target, maxStep) {
        const diff = angleDiff(target, current);
        if (Math.abs(diff) <= maxStep) return target;
        return current + Math.sign(diff) * maxStep;
    }

    function angleToDir(angle) {
        return { x: Math.sin(angle), z: Math.cos(angle) };
    }

    function dirToAngle(x, z) {
        return Math.atan2(x, z);
    }

    /**
     * 建立一輛車輛物件狀態
     */
    function createCar(index, startT, lateralOffset, modelKey, ctx) {
        const {
            selectedCarKey,
            CAR_MODELS,
            DEFAULT_CAR_MODEL,
            trackCurve,
            scene,
            CyberRaceCarBuilder,
            CyberRacePhysics,
            THREE
        } = ctx;

        const aiModelKeys = ['fd3s_early', 'fc3s_early', 'gc8_sti', 'ae86_stock'];
        const assignedKey = (index === 0)
            ? (modelKey || selectedCarKey || 'ae86_race')
            : (aiModelKeys[(index - 1) % aiModelKeys.length]);

        const carModel = CAR_MODELS[assignedKey] || CAR_MODELS.ae86_race || DEFAULT_CAR_MODEL;
        const mesh = CyberRaceCarBuilder.createCarMesh(assignedKey, CAR_MODELS, THREE);
        if (scene) scene.add(mesh);

        const pt = trackCurve.getPoint(startT);
        const tan = trackCurve.getTangent(startT).normalize();
        const normal = new THREE.Vector3(-tan.z, 0, tan.x);
        const heading = Math.atan2(tan.x, tan.z);

        mesh.position.set(
            pt.x + normal.x * lateralOffset,
            pt.y,
            pt.z + normal.z * lateralOffset
        );
        mesh.rotation.y = heading;

        const camF = carModel.tireCamberF || -1.0;
        const camR = carModel.tireCamberR || -0.5;

        return {
            mesh,
            modelKey: assignedKey,
            model: carModel,
            heading,
            velAngle: heading,
            speed: 0,
            isDrifting: false,
            driftCharge: 0,
            driftDir: 0,
            handbrakeHolding: false,
            handbrakeCharge: 0,
            nitroEnergy: 0,
            nitroActive: false,
            boostTimer: 0,
            boostPower: 0,
            lap: 0,
            lastT: startT,
            totalProgress: 0,
            crossed: false,
            lapReady: true,
            lapTimes: [],
            currentLapStartTime: 0,
            started: false,
            isPlayer: index === 0,
            name: carModel.name,
            finishTime: 0,
            finished: false,
            wallRecoverTimer: 0,
            checkpointsPassed: [false, false, false],
            checkpointTimes: [0, 0, 0],
            smoothY: pt.y,
            gear: 1,
            clutch: 0.0,
            engineRpm: carModel.idleRpm || 900,
            currentBoostPSI: 0,
            calibrationFactor: CyberRacePhysics.getCalibrationFactor(carModel),
            prevAccelMS2: 0,
            prevLateralAccMS2: 0,
            currentSteerInput: 0,
            tires: [
                CyberRacePhysics.createTireState(camF),
                CyberRacePhysics.createTireState(camF),
                CyberRacePhysics.createTireState(camR),
                CyberRacePhysics.createTireState(camR)
            ],
            aiData: {
                targetT: startT,
                lateralTarget: lateralOffset,
                speedMul: 0.88 + Math.random() * 0.22,
                driftCooldown: 0,
                steerSmooth: 0
            }
        };
    }

    /**
     * 玩家賽車物理更新
     */
    function updatePhysics(car, dt, ctx) {
        const {
            keys,
            gamepadInput,
            gameState,
            transmissionMode,
            CAR_MODELS,
            PHYSICS,
            TIRE_COMPOUNDS,
            CyberRacePhysics,
            CyberRaceInputHaptics,
            CyberRaceCamera,
            gameSettings,
            trackSamples,
            trackTangents,
            TRACK_SAMPLES,
            getClosestTrackInfo,
            consumePressedKey,
            togglePause
        } = ctx;

        const gp = gamepadInput;

        // === 1. 讀取輸入與平滑化 ===
        let rawSteer = (keys['a'] || keys['arrowleft']) ? 1 : (keys['d'] || keys['arrowright']) ? -1 : 0;
        if (gp && Math.abs(gp.steer) > 0.05) rawSteer = gp.steer;

        car.smoothSteer = car.smoothSteer || 0;
        car.smoothSteer += (rawSteer - car.smoothSteer) * Math.min(1.0, 15.0 * dt);
        let steerInput = car.smoothSteer;

        car.lastRawSteer = car.lastRawSteer || 0;
        car.feintTimer = car.feintTimer || 0;
        const steerDeltaRate = Math.abs(rawSteer - car.lastRawSteer) / Math.max(0.001, dt);
        if (steerDeltaRate > 5.5 && rawSteer !== 0 && Math.sign(rawSteer) !== Math.sign(car.lastRawSteer) && Math.abs(car.speed) > 0.12) {
            car.feintTimer = 0.50;
        }
        if (car.feintTimer > 0) car.feintTimer -= dt;
        car.lastRawSteer = rawSteer;

        let throttleInput = (keys['w'] || keys['arrowup']) ? 1 : 0;
        if (gp && gp.throttle > 0.05) throttleInput = Math.max(throttleInput, gp.throttle);

        let brakeInput = (keys['s'] || keys['arrowdown']) ? 1 : 0;
        if (gp && gp.brake > 0.05) brakeInput = Math.max(brakeInput, gp.brake);

        let clutchInput = (keys['c'] || keys['shift'] || keys['l']) ? 1 : 0;
        if (gp && gp.clutch > 0.05) clutchInput = Math.max(clutchInput, gp.clutch);
        car.clutch = clutchInput;

        const driftKey = keys[' '] || (gp && gp.handbrake);
        const handbrakeActive = !!driftKey;
        const nitroKeyHeld = keys['r'] || keys['n'] || keys['f'] || (gp && gp.nitroTrigger);

        if (gp && gp.camTrigger && gameState === 'playing') {
            CyberRaceCamera.cycleMode(car);
        }
        if (gp && gp.pauseTrigger && (gameState === 'playing' || gameState === 'paused') && togglePause) {
            togglePause();
        }

        const shiftUpTrigger = consumePressedKey('e') || consumePressedKey('pageup') || consumePressedKey('.') || (gp && gp.shiftUpTrigger);
        const shiftDownTrigger = consumePressedKey('q') || consumePressedKey('pagedown') || consumePressedKey(',') || (gp && gp.shiftDownTrigger);

        if (consumePressedKey('t') || (gp && gp.telemetryTrigger && gameState === 'playing')) {
            const nextVis = !gameSettings.telemetryVisible;
            if (typeof window.setTelemetryVisible === 'function') {
                window.setTelemetryVisible(nextVis);
            } else {
                gameSettings.telemetryVisible = nextVis;
                try { localStorage.setItem('telemetryVisible', nextVis ? 'true' : 'false'); } catch (e) {}
                const telPanel = document.getElementById('telemetryPanel');
                if (telPanel) {
                    telPanel.style.display = nextVis ? 'block' : 'none';
                    telPanel.classList.toggle('active', nextVis);
                }
            }
            CyberRaceInputHaptics.showShiftToast(gameSettings.telemetryVisible ? '📊 輪胎遙測: 開啟' : '📊 輪胎遙測: 關閉');
        }

        car.currentSteerInput = steerInput;
        car.currentThrottleInput = throttleInput;
        car.currentBrakeInput = brakeInput;

        // === 2. 取得車輛模型與當前狀態 ===
        const model = car.model || CAR_MODELS.ae86_stock;
        const mass = model.weight || 1000;
        const isAWD = model.driveType === 'AWD';
        const isFF = model.driveType === 'FF';
        const isFR = model.driveType === 'FR' || model.driveType === 'MR';
        const maxGear = model.maxGear || 5;

        const speedKMH = Math.abs(car.speed) * PHYSICS.speedToKMH;
        const speedMS = speedKMH / 3.6;

        // === 3. 變速箱邏輯 ===
        let throttle = 0;
        let brake = 0;
        const isClutchDisengaged = (transmissionMode === 'manual_clutch') && (clutchInput > 0.3);

        if (transmissionMode === 'auto') {
            if (car.speed < -0.01) {
                car.gear = -1;
                if (brakeInput > 0) {
                    throttle = brakeInput;
                    brake = 0;
                } else if (throttleInput > 0) {
                    brake = throttleInput;
                    throttle = 0;
                }
            } else if (Math.abs(car.speed) <= 0.02) {
                if (brakeInput > 0 && throttleInput <= 0) {
                    car.gear = -1;
                    throttle = brakeInput;
                    brake = 0;
                } else {
                    if (car.gear <= 0) car.gear = 1;
                    throttle = throttleInput;
                    brake = brakeInput;
                }
            } else {
                if (car.gear <= 0) car.gear = 1;
                throttle = throttleInput;
                brake = brakeInput;

                // 自排依 RPM 自動升降檔 (97% 升檔，32% 退檔，並加 0.45s 換檔冷卻鎖定避免抖動)
                car.autoShiftCooldown = (car.autoShiftCooldown || 0) - dt;
                if ((car.autoShiftCooldown || 0) <= 0) {
                    const rpmPctAuto = (car.engineRpm || 900) / (model.maxRpm || 8000);
                    if (rpmPctAuto >= 0.97 && car.gear < maxGear) {
                        car.gear += 1;
                        car.autoShiftCooldown = 0.45;
                    } else if (rpmPctAuto <= 0.32 && car.gear > 1) {
                        car.gear -= 1;
                        car.autoShiftCooldown = 0.45;
                    }
                }
            }
        } else {
            throttle = throttleInput;
            brake = brakeInput;

            if (shiftUpTrigger) {
                if (transmissionMode === 'manual_clutch' && clutchInput < 0.3) {
                    CyberRaceInputHaptics.showShiftToast('⚠️ 離合器未踩下！', true);
                } else if (car.gear < maxGear) {
                    car.gear += 1;
                }
            } else if (shiftDownTrigger) {
                if (transmissionMode === 'manual_clutch' && clutchInput < 0.3) {
                    CyberRaceInputHaptics.showShiftToast('⚠️ 離合器未踩下！', true);
                } else if (car.gear > -1) {
                    car.gear -= 1;
                }
            }
        }

        // === 4. 引擎 RPM 計算 ===
        const gearRatios = model.gearRatios || { '-1': 3.48, '1': 2.47, '2': 1.70, '3': 1.24, '4': 1.00, '5': 0.86 };
        const currentGearRatio = gearRatios[car.gear.toString()] || 1.0;
        const finalDrive = model.finalDrive || 4.1;
        const tireR = model.tireRadius || 0.29;
        const idleRpm = model.idleRpm || 900;
        const maxRpm = model.maxRpm || 8000;

        let rpm;
        if (isClutchDisengaged || car.gear === 0) {
            rpm = idleRpm + throttle * (maxRpm - idleRpm) * 0.9;
            car.launchRpmSmooth = idleRpm;
        } else if (car.gear === -1) {
            rpm = idleRpm + Math.abs(speedMS) * Math.abs(gearRatios['-1'] || 3.48) * finalDrive * 60 / (2 * Math.PI * tireR);
            car.launchRpmSmooth = idleRpm;
        } else {
            const wheelRpm = CyberRacePhysics.speedToRPM(speedMS, currentGearRatio, finalDrive, tireR);
            if (car.gear === 1 && throttle > 0.05) {
                const targetRevRpm = idleRpm + throttle * 600.0 + wheelRpm * 1.08;
                car.launchRpmSmooth = car.launchRpmSmooth || idleRpm;
                car.launchRpmSmooth = Math.max(car.launchRpmSmooth, Math.max(targetRevRpm, wheelRpm));
                rpm = car.launchRpmSmooth;
            } else {
                car.launchRpmSmooth = idleRpm;
                rpm = wheelRpm;
            }
        }
        rpm = Math.max(idleRpm, Math.min(maxRpm, rpm));
        car.engineRpm = rpm;

        // === 5. 引擎扭力 + 增壓 ===
        const baseTorque = CyberRacePhysics.getEngineTorque(rpm, model);
        const boostMul = CyberRacePhysics.updateTurboBoost(car, throttle, rpm, dt);
        const engineTorque = baseTorque * boostMul;

        // === 6. 輪上驅動力 ===
        let driveForce = 0;
        if (!isClutchDisengaged && car.gear !== 0 && throttle > 0) {
            if (car.gear === -1) {
                const revRatio = Math.abs(gearRatios['-1'] || 3.48);
                driveForce = -(engineTorque * revRatio * finalDrive * PHYSICS.drivetrainEfficiency) / tireR;
                driveForce *= throttle * car.calibrationFactor;
            } else if (car.gear > 0) {
                driveForce = (engineTorque * currentGearRatio * finalDrive * PHYSICS.drivetrainEfficiency) / tireR;
                driveForce *= throttle * car.calibrationFactor;

                if (rpm >= maxRpm * 0.98) {
                    driveForce *= 0.1;
                }
            }
        }

        // === 7. 煞車力與手煞車 ===
        const maxBrakeDecel = ((97/3.6) * (97/3.6)) / (2 * (model.braking97Dist || 45.4));
        const maxBrakeForce = mass * maxBrakeDecel;
        let brakeForce = 0;
        if (brake > 0) {
            brakeForce = maxBrakeForce * brake * 0.85;
        }

        let handbrakeForce = 0;
        if (handbrakeActive) {
            handbrakeForce = maxBrakeForce * 0.75;
            if (!car.handbrakeHolding) {
                car.handbrakeHolding = true;
                if (steerInput !== 0) car.driftDir = Math.sign(steerInput);
                else car.driftDir = 1;
            }
            if (steerInput !== 0) car.driftDir = Math.sign(steerInput);
        } else if (car.handbrakeHolding) {
            car.handbrakeHolding = false;
        }

        // === 8. 空氣動力學 ===
        const aero = CyberRacePhysics.calculateAeroForces(model, speedMS);
        const rollingResistance = PHYSICS.rollingResistanceCoeff * mass * 9.81;

        // === 9. 重心轉移 ===
        const loads = CyberRacePhysics.calculateWeightTransfer(model, car.prevAccelMS2 || 0, car.prevLateralAccMS2 || 0);
        const dfPerWheel = aero.downforce / 4;
        loads.FL = Math.max(100, loads.FL + dfPerWheel);
        loads.FR = Math.max(100, loads.FR + dfPerWheel);
        loads.RL = Math.max(100, loads.RL + dfPerWheel);
        loads.RR = Math.max(100, loads.RR + dfPerWheel);

        car.tires[0].load = loads.FL;
        car.tires[1].load = loads.FR;
        car.tires[2].load = loads.RL;
        car.tires[3].load = loads.RR;

        // === 10. 速度感知轉向角 ===
        const maxSteerRad = PHYSICS.maxSteerAngleDeg * (Math.PI / 180);
        const speedSteerFactor = Math.max(0.18, 1.0 / (1.0 + Math.pow(speedKMH / 65.0, 1.35)));
        const steerAngle = steerInput * maxSteerRad * speedSteerFactor;

        // === 11. 滑移角 ===
        const headingDiff = angleDiff(car.heading, car.velAngle);
        const bodySlipAngleDeg = headingDiff * (180 / Math.PI);
        const frontSlipDeg = bodySlipAngleDeg + steerAngle * (180 / Math.PI);
        const rearSlipDeg = bodySlipAngleDeg;

        // === 12. 四輪 Pacejka 力與輪胎動態 ===
        const compound = model.tireCompound || 'sport';
        const gripBase = model.tireGripBase || 1.0;
        const isCorneringLeft = steerInput > 0.1;
        const isCorneringRight = steerInput < -0.1;

        const totalDriveDemand = Math.abs(driveForce);
        const totalRearNormalLoad = loads.RL + loads.RR;
        const maxRearTraction = totalRearNormalLoad * (TIRE_COMPOUNDS[compound]?.gripMul || 1.0) * gripBase;
        const rearWheelSpin = (isFR && totalDriveDemand > maxRearTraction) ? (totalDriveDemand - maxRearTraction) / Math.max(1, maxRearTraction) : 0;
        car.prevRearWheelSpin = rearWheelSpin;

        let totalLateralForce = 0;
        let totalFrontLateral = 0;
        let totalRearLateral = 0;
        let totalDriveForceActual = 0;

        for (let i = 0; i < 4; i++) {
            const tire = car.tires[i];
            const isFront = i < 2;
            const isLeftSide = (i === 0 || i === 2);

            const isOutside = (isCorneringLeft && !isLeftSide) || (isCorneringRight && isLeftSide);
            const camberEffect = CyberRacePhysics.getCamberGripEffect(tire.camber, isOutside);

            const tempMul = CyberRacePhysics.getTireTemperatureGripMultiplier(tire, compound);
            const pressureMul = CyberRacePhysics.getTirePressureGripMultiplier(tire.pressure);
            const wearMul = CyberRacePhysics.getTireWearGripMultiplier(tire);

            const slipDeg = isFront ? frontSlipDeg : rearSlipDeg;
            tire.slipAngle = slipDeg;

            const Fy = CyberRacePhysics.pacejkaTireForce(slipDeg, tire.load, compound, gripBase, tempMul, pressureMul, wearMul, camberEffect);
            tire.lateralForce = Fy;

            if (isFront) totalFrontLateral += Fy;
            else totalRearLateral += Fy;
            totalLateralForce += Fy;

            let wheelDrive = 0;
            if (isAWD) {
                const frontSplit = model.awdSplit || 0.40;
                wheelDrive = driveForce * (isFront ? frontSplit / 2 : (1 - frontSplit) / 2);
            } else if (isFF && isFront) {
                wheelDrive = driveForce / 2;
            } else if (isFR && !isFront) {
                wheelDrive = driveForce / 2;
            }

            const tc = TIRE_COMPOUNDS[compound] || TIRE_COMPOUNDS.sport;
            const longitudinalBoost = Math.abs(steerInput) < 0.15 ? 1.35 : 1.0;
            const maxTractionForce = tire.load * tc.gripMul * gripBase * tempMul * pressureMul * wearMul * longitudinalBoost;
            const combinedDemand = Math.sqrt(Fy * Fy + wheelDrive * wheelDrive);

            if (combinedDemand > maxTractionForce && maxTractionForce > 0) {
                const scale = maxTractionForce / combinedDemand;
                wheelDrive *= scale;
                tire.lateralForce *= scale;
            }

            let handbrakeLockSlip = 0;
            if (handbrakeActive && !isFront) {
                wheelDrive = 0;
                tire.lateralForce *= 0.38;
                if (Math.abs(speedMS) > 0.8) {
                    handbrakeLockSlip = 1.2 + Math.min(2.0, Math.abs(speedMS) / 7.0);
                }
            }

            tire.longitudinalForce = wheelDrive;
            totalDriveForceActual += wheelDrive;

            let footBrakeSlip = (isFront && brake > 0.05) ? (brake * Math.min(1.8, Math.abs(speedMS) / 4.5)) : 0.0;
            let slipMag = Math.abs(slipDeg) / 12.0 + footBrakeSlip;
            if (!isFront) slipMag += rearWheelSpin * 2.5 + handbrakeLockSlip;
            tire.slipMag = slipMag;

            if (car.isPlayer) {
                const isTurnLeft = steerInput > 0.08 || (car.isDrifting && car.driftDir > 0);
                const isTurnRight = steerInput < -0.08 || (car.isDrifting && car.driftDir < 0);
                const isOuterWheel = (isTurnLeft && !isLeftSide) || (isTurnRight && isLeftSide);
                const isInnerWheel = (isTurnLeft && isLeftSide) || (isTurnRight && !isLeftSide);

                CyberRacePhysics.updateTireTemperature(tire, slipMag, speedMS, dt, compound, isFront, model.driveType, isOuterWheel, isInnerWheel, throttle);
                CyberRacePhysics.updateTirePressure(tire, dt);
                CyberRacePhysics.updateTireWear(tire, slipMag, tire.load, dt, compound);
            }
        }

        if (car.isPlayer) {
            const frontLeft = car.tires[0], frontRight = car.tires[1];
            const rearLeft = car.tires[2], rearRight = car.tires[3];
            const zones = ['inner', 'mid', 'outer'];

            for (const zone of zones) {
                const rearDiff = (rearLeft.temperature[zone] - rearRight.temperature[zone]) * 0.05 * dt;
                rearLeft.temperature[zone] -= rearDiff;
                rearRight.temperature[zone] += rearDiff;

                const frontDiff = (frontLeft.temperature[zone] - frontRight.temperature[zone]) * 0.04 * dt;
                frontLeft.temperature[zone] -= frontDiff;
                frontRight.temperature[zone] += frontDiff;
            }
        }

        // === 13. 地形斜坡坡度與合成縱向加速度 ===
        const trackInfo = getClosestTrackInfo(car.mesh.position.x, car.mesh.position.z, Math.round(car.lastT * TRACK_SAMPLES));
        const trackSampleIdx = trackInfo ? trackInfo.idx : 0;
        const tanDir = (trackTangents && trackTangents[trackSampleIdx]) ? trackTangents[trackSampleIdx] : null;
        let rawSlopeY = tanDir ? tanDir.y : 0;
        if (tanDir) {
            const headingX = Math.sin(car.heading);
            const headingZ = Math.cos(car.heading);
            const dot = headingX * tanDir.x + headingZ * tanDir.z;
            if (dot < 0) rawSlopeY = -rawSlopeY;
        }
        const slopeForce = -mass * 9.81 * rawSlopeY;

        let netLongForce = totalDriveForceActual - aero.drag - rollingResistance * Math.sign(car.speed) + slopeForce;

        if (brakeForce > 0) {
            if (car.speed > 0) netLongForce -= brakeForce;
            else if (car.speed < 0) netLongForce += brakeForce;
        }
        if (handbrakeForce > 0) {
            if (car.speed > 0) netLongForce -= handbrakeForce * 0.28;
            else if (car.speed < 0) netLongForce += handbrakeForce * 0.28;
        }

        if (throttle < 0.05 && !brake && !handbrakeActive && Math.abs(car.speed) > 0.01) {
            const engineBrake = mass * 0.8;
            if (car.speed > 0) netLongForce -= engineBrake;
            else netLongForce += engineBrake;
        }

        const accelMS2 = netLongForce / mass;
        const accelGameUnits = (accelMS2 * 3.6) / PHYSICS.speedToKMH;

        car.speed += accelGameUnits * dt;

        const topSpdGame = model.topSpeedKMH / PHYSICS.speedToKMH;
        if (car.gear > 0 && currentGearRatio > 0) {
            const gearRedlineMS = (maxRpm * 2 * Math.PI * tireR) / (currentGearRatio * finalDrive * 60);
            const gearRedlineGame = (gearRedlineMS * 3.6) / PHYSICS.speedToKMH;
            if (car.speed > gearRedlineGame && throttle > 0) {
                car.speed = gearRedlineGame;
            }
        }
        car.speed = Math.max(-0.45, Math.min(topSpdGame * 1.05, car.speed));

        if (Math.abs(car.speed) < 0.003 && throttle < 0.05 && !brake) car.speed = 0;

        // === 14. 側向動態與轉向 ===
        const totalLateralForceOnBody = totalLateralForce;
        const lateralAccMS2 = totalLateralForceOnBody / mass;

        car.prevAccelMS2 = accelMS2;
        car.prevLateralAccMS2 = lateralAccMS2;

        if (Math.abs(car.speed) > 0.01) {
            const turnRate = (speedMS > 0.5)
                ? steerAngle * speedMS / (model.wheelbase || 2.40)
                : steerAngle * 2.0;
            car.heading += turnRate * dt;

            const rearGripRatio = Math.abs(totalRearLateral) /
                (Math.max(1, loads.RL + loads.RR) * (TIRE_COMPOUNDS[compound]?.gripMul || 1.0) * gripBase * 0.8);

            const gripFollowRate = (car.isDrifting || car.feintTimer > 0) ? (isAWD ? 4.5 : 2.2) : (rearGripRatio < 1.0 ? (isAWD ? 10.0 : 6.0) : (isAWD ? 5.0 : 3.5));
            car.velAngle += angleDiff(car.heading, car.velAngle) * gripFollowRate * dt;

            if (handbrakeActive && Math.abs(car.speed) > 0.05) {
                const hbSteerScale = Math.min(1.4, Math.abs(speedMS) / 11.0);
                const hbYawRate = (steerInput !== 0)
                    ? (turnRate * 1.35 + steerInput * hbSteerScale * 0.85)
                    : (car.driftDir * 0.35 * hbSteerScale);

                car.heading += hbYawRate * dt;
                const hbGripRate = isAWD ? 0.85 : 0.45;
                car.velAngle += angleDiff(car.heading, car.velAngle) * hbGripRate * dt;
            } else if (car.feintTimer > 0 && Math.abs(car.speed) > 0.05) {
                const feintSteerFactor = steerInput !== 0 ? steerInput * 1.8 : 0;
                car.heading += feintSteerFactor * dt;
            }
        }

        const isPowerOversteer = isFR && (rearWheelSpin > 0.08 || (throttle > 0.35 && Math.abs(steerInput) > 0.20)) && Math.abs(bodySlipAngleDeg) > 4.5;
        const isInertiaDrift = (car.feintTimer > 0) && Math.abs(steerInput) > 0.18;

        if ((handbrakeActive || isPowerOversteer || isInertiaDrift || Math.abs(bodySlipAngleDeg) > 9.5) && Math.abs(car.speed) > 0.12) {
            car.isDrifting = true;
            car.driftCharge += dt;
        } else if (Math.abs(bodySlipAngleDeg) < 4.5 && car.feintTimer <= 0) {
            car.isDrifting = false;
            car.driftCharge = Math.max(0, car.driftCharge - dt * 2);
        }

        // === 15. Nitro 系統 ===
        if (car.isDrifting && Math.abs(car.speed) > 0.15) {
            const slipFactor = Math.min(1.0, Math.abs(bodySlipAngleDeg) / 30);
            car.nitroEnergy = Math.min(1.0, (car.nitroEnergy || 0) + (PHYSICS.nitroChargeBase + slipFactor * PHYSICS.nitroChargeAngleBonus) * dt);
        }

        if (nitroKeyHeld && car.nitroEnergy > 0) {
            car.nitroActive = true;
            car.nitroEnergy -= PHYSICS.nitroDrainRate * dt;
            const nitroAccel = (PHYSICS.nitroBoostForce / mass) * 3.6 / PHYSICS.speedToKMH;
            car.speed += nitroAccel * dt;
            if (car.nitroEnergy <= 0) {
                car.nitroEnergy = 0;
                car.nitroActive = false;
            }
        } else {
            car.nitroActive = false;
        }

        // === 16. 牆壁恢復 ===
        if (car.wallRecoverTimer > 0) {
            car.wallRecoverTimer = Math.max(0, car.wallRecoverTimer - dt);
            const recoverInfo = getClosestTrackInfo(car.mesh.position.x, car.mesh.position.z, Math.round(car.lastT * TRACK_SAMPLES));
            car.heading = moveAngleTowards(car.heading, recoverInfo.trackAngle, dt * 4.5);
            car.velAngle = moveAngleTowards(car.velAngle, recoverInfo.trackAngle, dt * 6.5);
        }

        // === 17. 位移更新與車身懸吊姿態 ===
        car.mesh.position.x += Math.sin(car.velAngle) * car.speed * dt * PHYSICS.speedScale;
        car.mesh.position.z += Math.cos(car.velAngle) * car.speed * dt * PHYSICS.speedScale;
        const infoY = getClosestTrackInfo(car.mesh.position.x, car.mesh.position.z, Math.round(car.lastT * TRACK_SAMPLES), car.speed, true);
        const targetY = trackSamples[infoY.idx].y;
        car.smoothY += (targetY - car.smoothY) * Math.min(1.0, 18 * dt);
        car.mesh.position.y = car.smoothY;

        const longG = (car.prevAccelMS2 || 0) / 9.81;
        const latG = (car.prevLateralAccMS2 || 0) / 9.81;
        const targetPitch = -longG * 0.045;
        const targetRoll = latG * 0.060;

        car.smoothPitch = (car.smoothPitch || 0) + (targetPitch - (car.smoothPitch || 0)) * Math.min(1.0, 15 * dt);
        car.smoothRoll = (car.smoothRoll || 0) + (targetRoll - (car.smoothRoll || 0)) * Math.min(1.0, 15 * dt);

        car.mesh.rotation.set(car.smoothPitch, car.heading, car.smoothRoll, 'YXZ');
    }

    /**
     * AI 賽車巡航與決策
     */
    function updateAI(car, dt, ctx) {
        const {
            trackCurve,
            trackType,
            trackWidthsLeft,
            trackWidthsRight,
            TRACK_SAMPLES,
            trackSamples,
            AI_DIFFICULTY,
            aiDifficulty,
            CAR_MODELS,
            PHYSICS,
            CyberRacePhysics,
            THREE,
            getClosestTrackInfo
        } = ctx;

        const ai = car.aiData;
        const diffConfig = AI_DIFFICULTY[aiDifficulty] || AI_DIFFICULTY.normal || { aiSpeedMul: 0.86, aiCount: 3, label: '普通' };
        const model = car.model || CAR_MODELS.ae86_stock;

        const lookAhead = 0.04 + car.speed * 0.015;
        let targetT;
        if (trackType === 'linear') {
            targetT = Math.min(0.998, car.lastT + lookAhead);
        } else {
            targetT = (car.lastT + lookAhead) % 1;
            if (targetT < 0) targetT += 1;
        }

        const targetPt = trackCurve.getPoint(targetT);

        ai.driftCooldown -= dt;
        if (ai.driftCooldown <= 0) {
            const currentIdx = Math.round(car.lastT * TRACK_SAMPLES) % TRACK_SAMPLES;
            const localW = Math.min(trackWidthsLeft[currentIdx], trackWidthsRight[currentIdx]);
            ai.lateralTarget = (Math.random() - 0.5) * localW * 0.8;
            ai.driftCooldown = 1.5 + Math.random() * 2;
        }

        const targetTan = trackCurve.getTangent(targetT).normalize();
        const targetNormal = new THREE.Vector3(-targetTan.z, 0, targetTan.x);
        const finalTarget = new THREE.Vector3(
            targetPt.x + targetNormal.x * ai.lateralTarget,
            0,
            targetPt.z + targetNormal.z * ai.lateralTarget
        );

        const dx = finalTarget.x - car.mesh.position.x;
        const dz = finalTarget.z - car.mesh.position.z;
        const targetAngle = Math.atan2(dx, dz);
        let angleDiffVal = targetAngle - car.heading;
        while (angleDiffVal > Math.PI) angleDiffVal -= Math.PI * 2;
        while (angleDiffVal < -Math.PI) angleDiffVal += Math.PI * 2;

        const steerRate = PHYSICS.steerSpeed || 3.5;
        ai.steerSmooth += (angleDiffVal * 3 - ai.steerSmooth) * 5 * dt;
        ai.steerSmooth = Math.max(-steerRate, Math.min(steerRate, ai.steerSmooth));
        car.heading += ai.steerSmooth * dt;
        car.velAngle = car.heading;

        const aiTopSpeedGame = (model.topSpeedKMH / PHYSICS.speedToKMH) * diffConfig.aiSpeedMul * ai.speedMul;
        const turnSharpness = Math.abs(angleDiffVal);

        let targetSpeed = aiTopSpeedGame;
        if (turnSharpness > 0.3) {
            const lateralGLimit = model.lateralG97 || 0.91;
            const cornerFactor = Math.max(0.40, 1 - turnSharpness * 0.5 / lateralGLimit);
            targetSpeed *= cornerFactor;
        }

        if (turnSharpness > 0.5 && car.speed > aiTopSpeedGame * 0.5) {
            if (!car.isDrifting && Math.random() < 0.02) {
                car.isDrifting = true;
                car.driftCharge = 0;
                car.driftDir = angleDiffVal > 0 ? 1 : -1;
            }
        }

        if (car.isDrifting) {
            car.driftCharge += dt;
            if (car.driftCharge > 1.2 + Math.random() * 1.5 || turnSharpness < 0.2) {
                car.isDrifting = false;
                car.driftCharge = 0;
            }
        }

        const speedKMH = Math.abs(car.speed) * PHYSICS.speedToKMH;
        const speedMS = speedKMH / 3.6;
        const mass = model.weight || 1000;

        if (car.speed < targetSpeed) {
            const v97 = 97 / 3.6;
            const baseAccel = v97 / (model.accel0to97Sec || 7.0);
            const dragFactor = 1.0 - Math.pow(speedKMH / (model.topSpeedKMH || 250), 1.5);
            const accelMS2 = baseAccel * Math.max(0.1, dragFactor);
            const accelGame = (accelMS2 / 3.6) * (PHYSICS.speedToKMH / PHYSICS.speedScale);
            car.speed = Math.min(targetSpeed, car.speed + accelGame * dt);
        } else {
            const aero = CyberRacePhysics.calculateAeroForces(model, speedMS);
            const decelForce = aero.drag + mass * 0.5;
            const decelMS2 = decelForce / mass;
            const decelGame = (decelMS2 / 3.6) * (PHYSICS.speedToKMH / PHYSICS.speedScale);
            car.speed = Math.max(targetSpeed * 0.9, car.speed - decelGame * dt);
        }

        car.mesh.position.x += Math.sin(car.velAngle) * car.speed * dt * PHYSICS.speedScale;
        car.mesh.position.z += Math.cos(car.velAngle) * car.speed * dt * PHYSICS.speedScale;
        const infoY = getClosestTrackInfo(car.mesh.position.x, car.mesh.position.z, Math.round(car.lastT * TRACK_SAMPLES), car.speed, true);
        const targetY = trackSamples[infoY.idx].y;
        car.smoothY += (targetY - car.smoothY) * Math.min(1.0, 18 * dt);
        car.mesh.position.y = car.smoothY;

        const longG_ai = (car.prevAccelMS2 || 0) / 9.81;
        const latG_ai = (car.prevLateralAccMS2 || 0) / 9.81;
        const targetPitch_ai = -longG_ai * 0.045;
        const targetRoll_ai = latG_ai * 0.060;
        car.smoothPitch = (car.smoothPitch || 0) + (targetPitch_ai - (car.smoothPitch || 0)) * Math.min(1.0, 15 * dt);
        car.smoothRoll = (car.smoothRoll || 0) + (targetRoll_ai - (car.smoothRoll || 0)) * Math.min(1.0, 15 * dt);

        car.mesh.rotation.set(car.smoothPitch, car.heading, car.smoothRoll, 'YXZ');
    }

    /**
     * 車輛與賽道邊界碰撞處理
     */
    function handleCollisions(car, ctx) {
        const {
            trackWidth,
            altRouteSamples,
            altRouteJunctions,
            trackSamples,
            trackNormals,
            trackTangents,
            trackWidthsLeft,
            trackWidthsRight,
            TRACK_SAMPLES,
            PHYSICS,
            cars,
            getClosestTrackInfo
        } = ctx;

        const carPos = car.mesh.position;
        const hw = (trackWidth || 18) / 2;

        let activeAltSample = null;
        let minAltDist = Infinity;
        if (altRouteSamples && altRouteSamples.length > 0) {
            altRouteSamples.forEach((samples, arIdx) => {
                samples.forEach(sample => {
                    const d = carPos.distanceTo(sample.pt);
                    if (d < minAltDist) {
                        const arDir = sample.tan;
                        const velDir = angleToDir(car.velAngle);
                        const alignDot = velDir.x * arDir.x + velDir.z * arDir.z;
                        if (alignDot > 0.25 || d < hw * 0.6) {
                            minAltDist = d;
                            activeAltSample = sample;
                        }
                    }
                });
            });
        }

        const info = getClosestTrackInfo(carPos.x, carPos.z, Math.round(car.lastT * TRACK_SAMPLES), car.speed, true);
        const mainPt = trackSamples[info.idx];
        const mainDist = carPos.distanceTo(mainPt);

        if (activeAltSample && minAltDist < mainDist && minAltDist < hw + 2.5) {
            const dx = carPos.x - activeAltSample.pt.x;
            const dz = carPos.z - activeAltSample.pt.z;
            const scNorm = activeAltSample.norm;
            const scLateral = dx * scNorm.x + dz * scNorm.z;

            if (Math.abs(scLateral) > hw - 0.55) {
                const sign = scLateral > 0 ? 1 : -1;
                const pushBack = sign * (hw - 1.1);
                carPos.x = activeAltSample.pt.x + scNorm.x * pushBack;
                carPos.z = activeAltSample.pt.z + scNorm.z * pushBack;
                car.speed = Math.max(PHYSICS.wallMinSpeed, Math.abs(car.speed) * PHYSICS.wallBounce);

                const scAngle = Math.atan2(activeAltSample.tan.x, activeAltSample.tan.z);
                car.velAngle = moveAngleTowards(car.velAngle, scAngle, 0.5);
                car.heading = moveAngleTowards(car.heading, scAngle, 0.4);
            }
        } else {
            const wl = trackWidthsLeft[info.idx];
            const wr = trackWidthsRight[info.idx];

            let effWl = wl, effWr = wr;
            if (altRouteJunctions && altRouteJunctions.length > 0) {
                for (const junc of altRouteJunctions) {
                    const nearStart = carPos.distanceTo(junc.startPt) < junc.openRadius * 1.2;
                    const nearEnd   = carPos.distanceTo(junc.endPt)   < junc.openRadius * 1.2;
                    if (nearStart) {
                        if (junc.startSide === 1) effWl += (trackWidth || 18);
                        else effWr += (trackWidth || 18);
                    }
                    if (nearEnd) {
                        if (junc.endSide === 1) effWl += (trackWidth || 18);
                        else effWr += (trackWidth || 18);
                    }
                }
            }

            const boundary = info.lateral > 0 ? effWl : effWr;

            if (Math.abs(info.lateral) > boundary - 0.55) {
                const sign = info.lateral > 0 ? 1 : -1;
                const n = trackNormals[info.idx];
                const pushBack = sign * (boundary - 1.1);
                const pt = trackSamples[info.idx];
                car.mesh.position.x = pt.x + n.x * pushBack;
                car.mesh.position.z = pt.z + n.z * pushBack;
                const collidedSpeed = Math.abs(car.speed) * PHYSICS.wallBounce;
                car.speed = Math.max(PHYSICS.wallMinSpeed, collidedSpeed);

                const wallNx = n.x * sign;
                const wallNz = n.z * sign;
                const velDir = angleToDir(car.velAngle);
                const incoming = velDir.x * wallNx + velDir.z * wallNz;

                if (incoming > 0) {
                    let rx = velDir.x - 2 * incoming * wallNx;
                    let rz = velDir.z - 2 * incoming * wallNz;

                    const trackForward = trackTangents[info.idx];
                    if (rx * trackForward.x + rz * trackForward.z < 0) {
                        rx = trackForward.x;
                        rz = trackForward.z;
                    }

                    const len = Math.hypot(rx, rz) || 1;
                    rx /= len; rz /= len;

                    const blendX = rx * 0.4 + trackForward.x * 0.6;
                    const blendZ = rz * 0.4 + trackForward.z * 0.6;
                    const blendLen = Math.hypot(blendX, blendZ) || 1;
                    const stableAngle = dirToAngle(blendX / blendLen, blendZ / blendLen);

                    car.velAngle = stableAngle;
                    car.heading = moveAngleTowards(car.heading, stableAngle, 0.5);
                } else {
                    car.velAngle = moveAngleTowards(car.velAngle, info.trackAngle, 0.4);
                    car.heading = moveAngleTowards(car.heading, info.trackAngle, 0.3);
                }

                const escape = trackTangents[info.idx];
                car.mesh.position.x += escape.x * 0.45;
                car.mesh.position.z += escape.z * 0.45;

                if (car.isPlayer) {
                    car.isDrifting = false;
                    car.driftCharge = 0;
                    car.wallRecoverTimer = Math.max(car.wallRecoverTimer, 0.35);
                }
            }
        }

        // 車輛間碰撞
        if (cars && cars.length > 1) {
            for (const other of cars) {
                if (other === car) continue;
                const dx = car.mesh.position.x - other.mesh.position.x;
                const dz = car.mesh.position.z - other.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist < PHYSICS.carCollisionDist && dist > 0.01) {
                    const nx = dx / dist, nz = dz / dist;
                    const overlap = PHYSICS.carCollisionDist - dist;

                    car.mesh.position.x += nx * overlap * 0.5;
                    car.mesh.position.z += nz * overlap * 0.5;
                    other.mesh.position.x -= nx * overlap * 0.5;
                    other.mesh.position.z -= nz * overlap * 0.5;

                    const relSpeed = car.speed - other.speed;
                    car.speed -= relSpeed * PHYSICS.carBounce * 0.5;
                    other.speed += relSpeed * PHYSICS.carBounce * 0.5;
                }
            }
        }
    }

    return {
        createCar,
        updatePhysics,
        updateAI,
        handleCollisions,
        normalizeAngle,
        angleDiff,
        moveAngleTowards,
        angleToDir,
        dirToAngle
    };
})();
