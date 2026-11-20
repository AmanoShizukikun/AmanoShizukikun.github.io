/**
 * CyberRaceCamera - 賽車相機控制器模組
 * 負責提供 4 大專屬視角 (車後方近、車後方遠、引擎蓋、保險桿) 的動態平滑追蹤、動態 FOV、剛性鏡頭附著與飄移向心偏移
 */
window.CyberRaceCamera = (() => {
    'use strict';

    const CAMERA_MODES = [
        {
            id: 'chase_close',
            name: '車後方 (近)',
            nameEn: 'Chase Close',
            dist: 6.0,
            height: 3.6,        // 高度 3.6m
            lookAhead: 9.0,
            lookHeight: 1.0,
            baseFov: 58,
            maxFovAdd: 4,
            showCar: true,
            isRigid: false,
            followSpeed: 14,
            driftShift: 1.2
        },
        {
            id: 'chase_far',
            name: '車後方 (遠)',
            nameEn: 'Chase Far',
            dist: 8.5,
            height: 4.8,        // 高度 4.8m
            lookAhead: 11.0,
            lookHeight: 1.1,
            baseFov: 62,
            maxFovAdd: 4,
            showCar: true,
            isRigid: false,
            followSpeed: 12,
            driftShift: 1.5
        },
        {
            id: 'hood',
            name: '引擎蓋',
            nameEn: 'Hood View',
            dist: -0.35,
            height: 1.45,
            lookAhead: 18.0,
            lookHeight: 1.0,
            baseFov: 72,
            maxFovAdd: 3,
            showCar: true,
            isRigid: true,
            followSpeed: 60,
            driftShift: 0.2
        },
        {
            id: 'bumper',
            name: '保險桿',
            nameEn: 'Bumper View',
            dist: -2.0,
            height: 1.05,
            lookAhead: 22.0,
            lookHeight: 0.7,
            baseFov: 78,
            maxFovAdd: 3,
            showCar: false,
            isRigid: true,
            followSpeed: 60,
            driftShift: 0.1
        }
    ];

    let camera = null;
    let _THREE = null;
    let cameraModeIndex = 0; // 預設: 車後方 (近)
    let cameraTarget = null;
    let camToastTimeout = null;
    let smoothCamHeading = 0;
    let smoothCamPosY = 0;
    let camHeadingInit = false;

    function init(camInstance, THREE_LIB) {
        camera = camInstance;
        _THREE = THREE_LIB || window.THREE;
        if (_THREE && !cameraTarget) {
            cameraTarget = new _THREE.Vector3();
        }
        camHeadingInit = false;
    }

    function moveAngleTowards(current, target, maxStep) {
        let diff = (target - current) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= maxStep) return target;
        return current + Math.sign(diff) * maxStep;
    }

    function showCameraToast(modeName) {
        const toast = document.getElementById('hudCamToast');
        const nameEl = document.getElementById('camToastName');
        if (toast && nameEl) {
            nameEl.textContent = modeName;
            toast.classList.add('active');
            if (camToastTimeout) clearTimeout(camToastTimeout);
            camToastTimeout = setTimeout(() => {
                toast.classList.remove('active');
            }, 1800);
        }
    }

    function cycleMode(player) {
        cameraModeIndex = (cameraModeIndex + 1) % CAMERA_MODES.length;
        const mode = CAMERA_MODES[cameraModeIndex];

        if (player && player.mesh) {
            player.mesh.visible = mode.showCar;
        }

        const camNameEl = document.getElementById('hudCamName');
        if (camNameEl) camNameEl.textContent = mode.name;

        camHeadingInit = false; // 切換視角時即時重置平滑值
        showCameraToast(mode.name);
        return mode;
    }

    function setMode(index, player) {
        if (index >= 0 && index < CAMERA_MODES.length) {
            cameraModeIndex = index;
            const mode = CAMERA_MODES[cameraModeIndex];
            if (player && player.mesh) {
                player.mesh.visible = mode.showCar;
            }
            camHeadingInit = false;
            return mode;
        }
        return CAMERA_MODES[cameraModeIndex];
    }

    function snapToPlayer(player) {
        if (!camera || !player || !player.mesh) return;
        const THREE = _THREE || window.THREE;
        if (!cameraTarget) cameraTarget = new THREE.Vector3();

        const mode = CAMERA_MODES[cameraModeIndex];
        smoothCamHeading = player.heading;
        smoothCamPosY = player.mesh.position.y;
        camHeadingInit = true;

        const sinH = Math.sin(smoothCamHeading);
        const cosH = Math.cos(smoothCamHeading);

        const targetPos = new THREE.Vector3(
            player.mesh.position.x - sinH * mode.dist,
            smoothCamPosY + mode.height,
            player.mesh.position.z - cosH * mode.dist
        );

        const lookTarget = new THREE.Vector3(
            player.mesh.position.x + sinH * mode.lookAhead,
            smoothCamPosY + mode.lookHeight,
            player.mesh.position.z + cosH * mode.lookAhead
        );

        camera.position.copy(targetPos);
        cameraTarget.copy(lookTarget);
        camera.lookAt(cameraTarget);
        camera.fov = mode.baseFov;
        camera.updateProjectionMatrix();

        if (player.mesh) {
            player.mesh.visible = mode.showCar;
        }
    }

    function update(player, dt, PHYSICS = {}) {
        if (!camera || !player || !player.mesh) return;

        const THREE = _THREE || window.THREE;
        if (!cameraTarget) cameraTarget = new THREE.Vector3();

        const mode = CAMERA_MODES[cameraModeIndex];

        // 首幀立即精準就位，避免從 (0,0,0) 緩慢過渡造成的鏡頭錯位
        if (!camHeadingInit) {
            snapToPlayer(player);
            return;
        }

        // 1. 微幅動態 FOV：速度越快 FOV 微微擴大 (控制在 3-4° 避免車輛變小變遠)
        const boostMaxSpd = PHYSICS.boostMaxSpeed || 2.25;
        const speedRatio = Math.min(1.0, Math.abs(player.speed) / boostMaxSpd);
        const targetFOV = mode.baseFov + (isNaN(speedRatio) ? 0 : speedRatio) * mode.maxFovAdd;
        const newFov = camera.fov + (targetFOV - camera.fov) * Math.min(1.0, 5 * dt);
        if (!isNaN(newFov) && newFov > 0 && isFinite(newFov)) {
            camera.fov = newFov;
            camera.updateProjectionMatrix();
        }

        // 2. 視角車頭 Heading 與高度平滑 (剛性視角 100% 同步，追蹤視角指數平滑防抖動)
        if (mode.isRigid) {
            smoothCamHeading = player.heading;
            smoothCamPosY = player.mesh.position.y;
        } else {
            smoothCamHeading = moveAngleTowards(smoothCamHeading, player.heading, 8 * dt);
            smoothCamPosY += (player.mesh.position.y - smoothCamPosY) * Math.min(1.0, 10 * dt);
        }

        let lateralShift = 0;
        if (player.isDrifting) {
            lateralShift = -player.driftDir * mode.driftShift;
        }

        const sinH = Math.sin(smoothCamHeading);
        const cosH = Math.cos(smoothCamHeading);
        const sinH90 = Math.sin(smoothCamHeading + Math.PI / 2);
        const cosH90 = Math.cos(smoothCamHeading + Math.PI / 2);

        // 3. 計算目標位置 (根據汽車實時位置)
        const targetPos = new THREE.Vector3(
            player.mesh.position.x - sinH * mode.dist + sinH90 * lateralShift,
            smoothCamPosY + mode.height,
            player.mesh.position.z - cosH * mode.dist + cosH90 * lateralShift
        );

        // 4. 計算看向目標 (LookAt Target)
        const lookTarget = new THREE.Vector3(
            player.mesh.position.x + sinH * mode.lookAhead,
            smoothCamPosY + mode.lookHeight,
            player.mesh.position.z + cosH * mode.lookAhead
        );

        if (mode.isRigid) {
            camera.position.copy(targetPos);
            cameraTarget.copy(lookTarget);
        } else {
            const damp = 1 - Math.exp(-mode.followSpeed * dt);
            camera.position.lerp(targetPos, damp);
            cameraTarget.lerp(lookTarget, damp);
        }

        camera.lookAt(cameraTarget);

        // 5. 車體 Mesh 可見度
        if (player.mesh && player.mesh.visible !== mode.showCar) {
            player.mesh.visible = mode.showCar;
        }
    }

    function resetHeading(player) {
        camHeadingInit = false;
        if (player) snapToPlayer(player);
    }

    function getCurrentMode() {
        return CAMERA_MODES[cameraModeIndex];
    }

    return {
        MODES: CAMERA_MODES,
        init,
        cycleMode,
        setMode,
        update,
        snapToPlayer,
        resetHeading,
        getCurrentMode
    };
})();
