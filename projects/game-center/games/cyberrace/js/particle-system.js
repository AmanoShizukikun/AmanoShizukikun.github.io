/**
 * CyberRaceParticles - 粒子特效系統模組
 * 負責管理三階純白胎煙、漂移火花、Nitro 尾焰噴射粒子之發射與幾何生命週期更新
 */
window.CyberRaceParticles = (() => {
    'use strict';

    let driftParticles = null;
    let boostParticles = null;
    let _scene = null;
    let _THREE = null;

    /**
     * 初始化粒子系統
     * @param {THREE.Scene} scene Three.js 場景
     * @param {Object} THREE_LIB Three.js 實例
     */
    function init(scene, THREE_LIB) {
        _scene = scene;
        _THREE = THREE_LIB || window.THREE;
        if (!_scene || !_THREE) return;

        // 清除舊粒子
        clear();

        // 1. 漂移胎煙與火花 (緩衝區 1500 顆支援長效懸浮)
        const driftCount = 1500;
        const driftGeo = new _THREE.BufferGeometry();
        const driftPositions = new Float32Array(driftCount * 3);
        const driftColors = new Float32Array(driftCount * 3);
        const driftSizes = new Float32Array(driftCount);
        driftGeo.setAttribute('position', new _THREE.BufferAttribute(driftPositions, 3));
        driftGeo.setAttribute('color', new _THREE.BufferAttribute(driftColors, 3));
        driftGeo.setAttribute('size', new _THREE.BufferAttribute(driftSizes, 1));

        const driftMat = new _THREE.PointsMaterial({
            size: 1.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.55,
            blending: _THREE.NormalBlending,
            depthWrite: false,
        });

        driftParticles = new _THREE.Points(driftGeo, driftMat);
        driftParticles.frustumCulled = false; // 防止視錐體裁剪
        driftParticles.userData = {
            velocities: new Float32Array(driftCount * 3),
            lifetimes: new Float32Array(driftCount),
            maxLife: new Float32Array(driftCount),
            nextIdx: 0,
        };
        _scene.add(driftParticles);

        // 2. 加速噴射火焰 (300 顆)
        const boostCount = 300;
        const boostGeo = new _THREE.BufferGeometry();
        const boostPositions = new Float32Array(boostCount * 3);
        const boostColorsArr = new Float32Array(boostCount * 3);
        boostGeo.setAttribute('position', new _THREE.BufferAttribute(boostPositions, 3));
        boostGeo.setAttribute('color', new _THREE.BufferAttribute(boostColorsArr, 3));

        const boostMat = new _THREE.PointsMaterial({
            size: 0.85,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: _THREE.AdditiveBlending,
            depthWrite: false,
        });

        boostParticles = new _THREE.Points(boostGeo, boostMat);
        boostParticles.frustumCulled = false;
        boostParticles.userData = {
            velocities: new Float32Array(boostCount * 3),
            lifetimes: new Float32Array(boostCount),
            maxLife: new Float32Array(boostCount),
            nextIdx: 0,
        };
        _scene.add(boostParticles);
    }

    /**
     * 四輪獨立白胎煙發射器 (支持少、中、大 三階純白濃煙)
     */
    function emitTireSmokePerWheel(carPos, heading, wheelIdx, tier = 1) {
        if (!driftParticles) return;
        const data = driftParticles.userData;
        const positions = driftParticles.geometry.attributes.position.array;
        const colors = driftParticles.geometry.attributes.color.array;
        const count = positions.length / 3;

        // 輪胎 3D 空間位置 (0: FL, 1: FR, 2: RL, 3: RR)
        const isFront = wheelIdx < 2;
        const isLeft = (wheelIdx === 0 || wheelIdx === 2);

        const longOffset = isFront ? 1.25 : -1.45;
        const latOffset = isLeft ? -0.82 : 0.82;

        const cosH = Math.cos(heading);
        const sinH = Math.sin(heading);

        // 計算車輪真實 World 座標
        const wX = carPos.x + sinH * longOffset + cosH * latOffset;
        const wZ = carPos.z + cosH * longOffset - sinH * latOffset;

        // 三階煙霧濃度 (1: 微量白煙, 2: 輕中度白煙, 3: 標準大量白煙)
        const particleCount = tier === 3 ? 9 : (tier === 2 ? 5 : 2);
        const spreadMult = tier === 3 ? 1.2 : (tier === 2 ? 0.8 : 0.5);
        const velMult = tier === 3 ? 1.0 : (tier === 2 ? 0.7 : 0.5);

        for (let k = 0; k < particleCount; k++) {
            const i = data.nextIdx;
            data.nextIdx = (data.nextIdx + 1) % count;

            positions[i * 3] = wX + (Math.random() - 0.5) * 0.5 * spreadMult;
            positions[i * 3 + 1] = carPos.y + 0.18 + Math.random() * 0.30 * spreadMult;
            positions[i * 3 + 2] = wZ + (Math.random() - 0.5) * 0.5 * spreadMult;

            data.velocities[i * 3] = (Math.random() - 0.5) * 0.9 * velMult;
            data.velocities[i * 3 + 1] = (0.5 + Math.random() * 0.9) * velMult; // 熱氣與胎煙上升
            data.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.9 * velMult;

            // 滯空停留時間 (1.8s ~ 3.5s 自然飄散)
            data.lifetimes[i] = (tier === 3 ? 2.8 : (tier === 2 ? 2.0 : 1.4)) + Math.random() * 0.8;
            data.maxLife[i] = data.lifetimes[i];

            // 100% 純正白/淺灰橡膠煙霧
            colors[i * 3] = 0.95;
            colors[i * 3 + 1] = 0.95;
            colors[i * 3 + 2] = 0.98;
        }

        driftParticles.geometry.attributes.position.needsUpdate = true;
        driftParticles.geometry.attributes.color.needsUpdate = true;
    }

    /**
     * Nitro 加速尾焰粒子發射
     */
    function emitBoostFlame(carPos, heading) {
        if (!boostParticles) return;
        const data = boostParticles.userData;
        const positions = boostParticles.geometry.attributes.position.array;
        const colors = boostParticles.geometry.attributes.color.array;
        const count = positions.length / 3;

        for (let k = 0; k < 6; k++) {
            const i = data.nextIdx;
            data.nextIdx = (data.nextIdx + 1) % count;

            const backX = carPos.x - Math.sin(heading) * 1.8;
            const backZ = carPos.z - Math.cos(heading) * 1.8;

            positions[i * 3] = backX + (Math.random() - 0.5) * 0.35;
            positions[i * 3 + 1] = carPos.y + 0.45 + (Math.random() - 0.5) * 0.2;
            positions[i * 3 + 2] = backZ + (Math.random() - 0.5) * 0.35;

            const spd = 12 + Math.random() * 6;
            data.velocities[i * 3] = -Math.sin(heading) * spd + (Math.random() - 0.5) * 1.5;
            data.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
            data.velocities[i * 3 + 2] = -Math.cos(heading) * spd + (Math.random() - 0.5) * 1.5;

            data.lifetimes[i] = 0.3 + Math.random() * 0.3;
            data.maxLife[i] = data.lifetimes[i];

            if (k % 2 === 0) {
                colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0;
            } else {
                colors[i * 3] = 0.95; colors[i * 3 + 1] = 0.98; colors[i * 3 + 2] = 1.0;
            }
        }

        boostParticles.geometry.attributes.position.needsUpdate = true;
        boostParticles.geometry.attributes.color.needsUpdate = true;
    }

    /**
     * 每幀更新所有粒子位置與生命週期
     */
    function update(dt) {
        if (driftParticles) {
            const data = driftParticles.userData;
            const positions = driftParticles.geometry.attributes.position.array;
            const count = positions.length / 3;
            for (let i = 0; i < count; i++) {
                if (data.lifetimes[i] <= 0) continue;
                data.lifetimes[i] -= dt;

                positions[i * 3] += data.velocities[i * 3] * dt;
                positions[i * 3 + 1] += data.velocities[i * 3 + 1] * dt;
                positions[i * 3 + 2] += data.velocities[i * 3 + 2] * dt;

                data.velocities[i * 3 + 1] += 0.3 * dt;

                if (data.lifetimes[i] <= 0) {
                    positions[i * 3 + 1] = -99999;
                }
            }
            driftParticles.geometry.attributes.position.needsUpdate = true;
        }

        if (boostParticles) {
            const data = boostParticles.userData;
            const positions = boostParticles.geometry.attributes.position.array;
            const count = positions.length / 3;
            for (let i = 0; i < count; i++) {
                if (data.lifetimes[i] <= 0) continue;
                data.lifetimes[i] -= dt;

                positions[i * 3] += data.velocities[i * 3] * dt;
                positions[i * 3 + 1] += data.velocities[i * 3 + 1] * dt;
                positions[i * 3 + 2] += data.velocities[i * 3 + 2] * dt;

                data.velocities[i * 3 + 1] -= 1.5 * dt;

                if (data.lifetimes[i] <= 0) {
                    positions[i * 3 + 1] = -99999;
                }
            }
            boostParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    /**
     * 清除場景中的粒子
     */
    function clear() {
        if (_scene && driftParticles) {
            _scene.remove(driftParticles);
            driftParticles = null;
        }
        if (_scene && boostParticles) {
            _scene.remove(boostParticles);
            boostParticles = null;
        }
    }

    return {
        init,
        emitTireSmokePerWheel,
        emitBoostFlame,
        update,
        clear
    };
})();
