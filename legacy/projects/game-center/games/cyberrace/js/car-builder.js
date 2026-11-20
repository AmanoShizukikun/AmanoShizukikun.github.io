/**
 * CyberRaceCarBuilder - 車輛 3D 幾何建造模組
 * 負責根據車型與配置建立 Three.js Group 網格 (AE86, FD3S, FC3S, GC8 等)
 */
window.CyberRaceCarBuilder = (() => {
    'use strict';

    /**
     * 建立 3D 車輛網格
     * @param {string} modelKey 車型代碼 (例如 'ae86_race', 'fd3s_project_d', 'fc3s_early', 'gc8_sti')
     * @param {Object} CAR_MODELS 車輛設定庫
     * @param {Object} THREE_LIB Three.js 實例 (若未傳入則取 window.THREE)
     * @returns {THREE.Group}
     */
    function createCarMesh(modelKey, CAR_MODELS = {}, THREE_LIB = null) {
        const THREE = THREE_LIB || window.THREE;
        if (!THREE) {
            console.error('[CarBuilder] THREE is not defined');
            return null;
        }

        const group = new THREE.Group();
        const model = CAR_MODELS[modelKey] || (CAR_MODELS.ae86_race || { color: 0xffffff });
        const mainColor = (model && model.color != null) ? model.color : 0xffffff;

        const bodyMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(mainColor),
            roughness: 0.25,
            metalness: 0.45
        });

        if (modelKey.startsWith('ae86')) {
            // AE86 Sprinter Trueno (上白下黑 Panda 雙色)
            const upperBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 3.4), bodyMat);
            upperBody.position.y = 0.5;
            group.add(upperBody);

            const lowerBody = new THREE.Mesh(
                new THREE.BoxGeometry(1.72, 0.22, 3.42),
                new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })
            );
            lowerBody.position.y = 0.25;
            group.add(lowerBody);

            const hoodMat = (model && model.isCarbonHood)
                ? new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.85 })
                : bodyMat;
            const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.1), hoodMat);
            hood.position.set(0, 0.62, 0.9);
            group.add(hood);

            // 掀燈 (Pop-up headlights)
            const popLightGeo = new THREE.BoxGeometry(0.35, 0.12, 0.2);
            const popLightMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            const leftPop = new THREE.Mesh(popLightGeo, popLightMat);
            leftPop.position.set(-0.55, 0.68, 1.35);
            const rightPop = leftPop.clone();
            rightPop.position.x = 0.55;
            group.add(leftPop, rightPop);

        } else if (modelKey.startsWith('fd3s')) {
            // RX-7 FD3S (流線跑車體)
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.52, 3.6), bodyMat);
            body.position.y = 0.48;
            group.add(body);

            if (model && model.isReAmemiya) {
                const wideKit = new THREE.Mesh(
                    new THREE.BoxGeometry(1.94, 0.35, 3.2),
                    new THREE.MeshStandardMaterial({ color: 0x151515 })
                );
                wideKit.position.y = 0.35;
                group.add(wideKit);
            }

            // GT 尾翼
            const wing = new THREE.Mesh(
                new THREE.BoxGeometry(1.9, 0.06, 0.3),
                new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 })
            );
            wing.position.set(0, 1.05, -1.65);
            group.add(wing);

            const wingP1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            wingP1.position.set(0.65, 0.8, -1.65);
            const wingP2 = wingP1.clone(); wingP2.position.x = -0.65;
            group.add(wingP1, wingP2);

        } else if (modelKey.startsWith('fc3s')) {
            // RX-7 FC3S (白色刀鋒跑車體)
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.52, 3.5), bodyMat);
            body.position.y = 0.48;
            group.add(body);

            const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            scoop.position.set(-0.3, 0.64, 0.7);
            group.add(scoop);

            const wing = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 0.22), bodyMat);
            wing.position.set(0, 0.82, -1.6);
            group.add(wing);

        } else if (modelKey === 'gc8_sti') {
            // Impreza GC8 (拉力藍)
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.56, 3.45), bodyMat);
            body.position.y = 0.5;
            group.add(body);

            const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.45), new THREE.MeshStandardMaterial({ color: 0x0033aa }));
            scoop.position.set(0, 0.72, 0.7);
            group.add(scoop);

            const wing = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.1, 0.35), bodyMat);
            wing.position.set(0, 1.15, -1.55);
            group.add(wing);

            const wingP1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.2), bodyMat);
            wingP1.position.set(0.65, 0.85, -1.55);
            const wingP2 = wingP1.clone(); wingP2.position.x = -0.65;
            group.add(wingP1, wingP2);
        } else {
            // 通用預設車體
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.52, 3.45), bodyMat);
            body.position.y = 0.5;
            group.add(body);
        }

        // 座艙玻璃
        const cockpit = new THREE.Mesh(
            new THREE.BoxGeometry(1.3, 0.48, 1.25),
            new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 })
        );
        cockpit.position.set(0, 0.88, -0.2);
        group.add(cockpit);

        // 尾燈
        const tailLight = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.14, 0.08),
            new THREE.MeshStandardMaterial({ color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 0.9 })
        );
        tailLight.position.set(0, 0.52, -1.74);
        group.add(tailLight);

        // 輪圈
        const wheelColor = (modelKey === 'gc8_sti') ? 0xffcc00 : 0x333333;
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
        const wheelMat = new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.3, metalness: 0.7 });
        [[-0.88, 0.32, 1.05], [0.88, 0.32, 1.05], [-0.88, 0.32, -1.15], [0.88, 0.32, -1.15]].forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...pos);
            group.add(wheel);
        });

        return group;
    }

    return {
        createCarMesh
    };
})();
