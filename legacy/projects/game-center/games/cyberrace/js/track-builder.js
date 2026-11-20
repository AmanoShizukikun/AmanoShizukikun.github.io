/**
 * CyberRace - Track Builder Module (d.html Anime Touge Style - Ultra Smooth 5000 Divisions)
 * 完美移植 d.html 頭文字D 動漫山道風格：
 * 1. 5000 分段極致平滑雙精度弧長取樣 (CatmullRom arcLengthDivisions=5000)
 * 2. 12 橫向細分之動漫日系瀝青路面程序化貼圖 (createAnimeAsphaltTexture)
 * 3. 經典 3D 混凝土下凹排水溝 (溝落とし, gutterW=1.4m, drop=0.25m)
 * 4. 真實波形 W-Beam 雙層金屬護欄與圓柱形立柱 (railOffset=halfW+0.6m)
 * 5. 重工業雙鋼桁架大型門架 (START藍、FINISH紅、CP金黃專屬布旗 + 地面黑白方格貼花)
 * 6. 移除賽道旁突兀岩石，保留清爽純淨山道與遠景山谷燈火點雲
 * 7. 完美保留捷徑出入口開口與相容性
 */

const CyberRaceTrackBuilder = (function () {
    let _ctx = null;

    function init(ctx) {
        _ctx = ctx;
    }

    // ===== 程序化貼圖生成器 (Procedural Textures) =====

    /**
     * 動漫風格日系山道柏油路面貼圖 (Canvas 1024x1024)
     * 包含車道磨耗雙色調漸層、微顆粒噪點、10m/10m 白虛線、雙側白實線
     */
    function createAnimeAsphaltTexture(renderer, trackLength = 5000) {
        const { THREE } = _ctx;
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // 1. 基底柏油色
        ctx.fillStyle = '#1d2629';
        ctx.fillRect(0, 0, 1024, 1024);

        // 2. 橫向車道磨損漸變（兩側輪胎壓痕略深/中心微淺）
        const laneGrad = ctx.createLinearGradient(0, 0, 1024, 0);
        laneGrad.addColorStop(0.0, '#131a1d');
        laneGrad.addColorStop(0.08, '#1f282c');
        laneGrad.addColorStop(0.28, '#171f22');
        laneGrad.addColorStop(0.50, '#20292d');
        laneGrad.addColorStop(0.72, '#171f22');
        laneGrad.addColorStop(0.92, '#1f282c');
        laneGrad.addColorStop(1.0, '#131a1d');
        ctx.fillStyle = laneGrad;
        ctx.fillRect(0, 0, 1024, 1024);

        // 3. 柏油表面微噪點顆粒
        const imgData = ctx.getImageData(0, 0, 1024, 1024);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 10;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);

        // 4. 中央白虛線 (日本山道標準：10m 實線 : 10m 空白，20m 一循環)
        ctx.fillStyle = 'rgba(130, 152, 155, 0.25)';
        ctx.fillRect(500, 0, 26, 512);
        ctx.fillStyle = '#82989b';
        ctx.fillRect(501, 0, 22, 512);

        // 5. 兩側路面邊線 (實線)
        ctx.fillStyle = 'rgba(115, 136, 139, 0.25)';
        ctx.fillRect(64, 0, 26, 1024);
        ctx.fillRect(934, 0, 26, 1024);

        ctx.fillStyle = '#73888b';
        ctx.fillRect(66, 0, 22, 1024);
        ctx.fillRect(936, 0, 22, 1024);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, Math.max(1, trackLength / 20.0));
        if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
        return texture;
    }

    /**
     * 桁架門架專屬大型標牌貼圖 (Canvas 1024x256)
     */
    function createGantryBannerTexture(titleText, subtitleText, type = 'cp') {
        const { THREE } = _ctx;
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const bgGrad = ctx.createLinearGradient(0, 0, 1024, 256);
        let borderColor = '#e2e8f0';
        let innerBorderColor = '#f59e0b';
        let titleColor = '#ffffff';
        let subColor = '#f87171';

        if (type === 'start') {
            // 起點：電光皇家藍 (START)
            bgGrad.addColorStop(0.0, '#091e42');
            bgGrad.addColorStop(0.5, '#1d4ed8');
            bgGrad.addColorStop(1.0, '#091e42');
            borderColor = '#bfdbfe';
            innerBorderColor = '#3b82f6';
            titleColor = '#ffffff';
            subColor = '#93c5fd';
        } else if (type === 'finish') {
            // 終點：熱血赤紅 (FINISH / GOAL)
            bgGrad.addColorStop(0.0, '#450a0a');
            bgGrad.addColorStop(0.5, '#dc2626');
            bgGrad.addColorStop(1.0, '#450a0a');
            borderColor = '#fca5a5';
            innerBorderColor = '#ef4444';
            titleColor = '#ffffff';
            subColor = '#fecaca';
        } else {
            // 檢查點 (CP)：亮琥珀金黃 (CHECKPOINT)
            bgGrad.addColorStop(0.0, '#78350f');
            bgGrad.addColorStop(0.5, '#d97706');
            bgGrad.addColorStop(1.0, '#78350f');
            borderColor = '#fef08a';
            innerBorderColor = '#f59e0b';
            titleColor = '#ffffff';
            subColor = '#fef08a';
        }

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 1024, 256);

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 12;
        ctx.strokeRect(10, 10, 1004, 236);

        ctx.strokeStyle = innerBorderColor;
        ctx.lineWidth = 6;
        ctx.strokeRect(20, 20, 984, 216);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = '900 92px Orbitron, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText(titleText, 514, 118);
        ctx.fillStyle = titleColor;
        ctx.fillText(titleText, 512, 114);

        ctx.font = '700 32px "Noto Sans TC", "Noto Sans JP", sans-serif';
        ctx.fillStyle = subColor;
        ctx.fillText(subtitleText, 512, 192);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * 起跑線 / 終點線黑白方格地面貼花貼圖 (Canvas 512x128)
     */
    function createCheckeredGroundTexture() {
        const { THREE } = _ctx;
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const rows = 2, cols = 16;
        const w = 512 / cols, h = 128 / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.fillStyle = ((r + c) % 2 === 0) ? '#ffffff' : '#090d12';
                ctx.fillRect(c * w, r * h, w, h);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    // ===== 捷徑開口判定輔助函式 =====

    function isNearJunctionOpening(pt, side, altRouteJunctions) {
        if (!altRouteJunctions || altRouteJunctions.length === 0) return false;
        for (let j = 0; j < altRouteJunctions.length; j++) {
            const junc = altRouteJunctions[j];
            const r = junc.openRadius || 22.0;
            if (junc.startSide === side && junc.startPt) {
                if (pt.distanceTo(junc.startPt) < r) return true;
            }
            if (junc.endSide === side && junc.endPt) {
                if (pt.distanceTo(junc.endPt) < r) return true;
            }
        }
        return false;
    }

    // ===== 賽道本體與排水溝 (buildTrackMesh - 5000 Divisions) =====

    function buildTrackMesh() {
        const { scene, THREE, renderer, trackCurve, trackWidth, trackType, altRouteJunctions } = _ctx;

        const isClosed = trackType === 'circuit';
        const trackLength = (trackCurve && typeof trackCurve.getLength === 'function')
            ? trackCurve.getLength()
            : 5000.0;

        // 與 d.html 完全相同的 5000 分段與 12 橫向車道細分
        const divisions = 5000;
        const widthSegments = 12;
        const roadW = trackWidth || 14.0;
        const halfW = roadW / 2;
        const gutterW = 1.4; // 排水溝寬度 1.4m
        const sampleStep = 2;

        // 1. 計算沿曲線平滑法線 right 陣列 (4-step window smoothing 如同 d.html)
        const smoothRights = [];
        const worldUp = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i <= divisions; i++) {
            let iPrev, iNext;
            if (isClosed) {
                iPrev = (i - sampleStep + divisions) % divisions;
                iNext = (i + sampleStep) % divisions;
            } else {
                iPrev = Math.max(0, i - sampleStep);
                iNext = Math.min(divisions, i + sampleStep);
            }

            const pPrev = trackCurve.getPointAt(iPrev / divisions);
            const pNext = trackCurve.getPointAt(iNext / divisions);

            const dir = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
            if (dir.lengthSq() === 0) dir.set(0, 0, 1);
            const right = new THREE.Vector3().crossVectors(worldUp, dir).normalize();
            if (right.lengthSq() === 0) right.set(1, 0, 0);

            smoothRights.push(right);
        }

        // 2. 鋪設動漫柏油路面
        const roadMat = new THREE.MeshStandardMaterial({
            map: createAnimeAsphaltTexture(renderer, trackLength),
            roughness: 0.92,
            metalness: 0.02,
            side: THREE.DoubleSide
        });

        const roadVerts = [];
        const roadUVs = [];
        const roadIndices = [];

        for (let i = 0; i <= divisions; i++) {
            const t = i / divisions;
            const pt = trackCurve.getPointAt(t);
            const right = smoothRights[i];

            for (let s = 0; s <= widthSegments; s++) {
                const factor = (s / widthSegments) - 0.5; // -0.5 (左) 到 +0.5 (右)
                roadVerts.push(
                    pt.x + right.x * (factor * roadW),
                    pt.y,
                    pt.z + right.z * (factor * roadW)
                );
                roadUVs.push(s / widthSegments, t);
            }

            if (i < divisions) {
                for (let s = 0; s < widthSegments; s++) {
                    const row1 = i * (widthSegments + 1) + s;
                    const row2 = (i + 1) * (widthSegments + 1) + s;
                    roadIndices.push(row1, row2, row1 + 1);
                    roadIndices.push(row1 + 1, row2, row2 + 1);
                }
            }
        }

        const roadGeo = new THREE.BufferGeometry();
        roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
        roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
        roadGeo.setIndex(roadIndices);
        roadGeo.computeVertexNormals();
        scene.add(new THREE.Mesh(roadGeo, roadMat));

        // 3. 經典 3D 混凝土下凹排水溝 (溝落とし, gutterW=1.4m, 下凹深度=0.25m)
        const gutterMat = new THREE.MeshStandardMaterial({
            color: 0x1f272c,
            roughness: 0.95,
            side: THREE.DoubleSide
        });

        [1, -1].forEach(side => {
            let currentVerts = [];
            let currentIndices = [];
            let segCount = 0;

            const flushGutter = () => {
                if (currentVerts.length >= 12 && currentIndices.length >= 6) {
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(currentVerts, 3));
                    geo.setIndex(currentIndices);
                    geo.computeVertexNormals();
                    scene.add(new THREE.Mesh(geo, gutterMat));
                }
                currentVerts = [];
                currentIndices = [];
                segCount = 0;
            };

            for (let i = 0; i <= divisions; i++) {
                const t = i / divisions;
                const pt = trackCurve.getPointAt(t);
                const right = smoothRights[i];

                // 檢查是否處於捷徑開口處 (1: 左, -1: 右)
                if (isNearJunctionOpening(pt, side, altRouteJunctions)) {
                    flushGutter();
                    continue;
                }

                // side===1 為左側 (right * -halfW)，side===-1 為右側 (right * +halfW)
                const pEdge = pt.clone().addScaledVector(right, -side * halfW);
                const pGutterOuter = pEdge.clone()
                    .addScaledVector(right, -side * gutterW)
                    .add(new THREE.Vector3(0, -0.25, 0));

                currentVerts.push(pEdge.x, pEdge.y, pEdge.z);
                currentVerts.push(pGutterOuter.x, pGutterOuter.y, pGutterOuter.z);

                if (segCount > 0) {
                    const r1 = (segCount - 1) * 2;
                    const r2 = segCount * 2;
                    if (side === 1) {
                        currentIndices.push(r1, r2, r1 + 1);
                        currentIndices.push(r1 + 1, r2, r2 + 1);
                    } else {
                        currentIndices.push(r1, r1 + 1, r2);
                        currentIndices.push(r1 + 1, r2 + 1, r2);
                    }
                }
                segCount++;
            }
            flushGutter();
        });
    }

    // ===== 波形雙層金屬護欄與立柱 (buildTrackEdges - 5000 Divisions) =====

    function buildTrackEdges() {
        const { scene, THREE, trackCurve, trackWidth, trackType, altRouteJunctions } = _ctx;

        const isClosed = trackType === 'circuit';
        const divisions = 5000;
        const roadW = trackWidth || 14.0;
        const halfW = roadW / 2;
        const railOffset = halfW + 0.6; // 護欄位於路緣外側 0.6m
        const sampleStep = 2;

        const smoothRights = [];
        const worldUp = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i <= divisions; i++) {
            let iPrev, iNext;
            if (isClosed) {
                iPrev = (i - sampleStep + divisions) % divisions;
                iNext = (i + sampleStep) % divisions;
            } else {
                iPrev = Math.max(0, i - sampleStep);
                iNext = Math.min(divisions, i + sampleStep);
            }

            const pPrev = trackCurve.getPointAt(iPrev / divisions);
            const pNext = trackCurve.getPointAt(iNext / divisions);

            const dir = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
            if (dir.lengthSq() === 0) dir.set(0, 0, 1);
            const right = new THREE.Vector3().crossVectors(worldUp, dir).normalize();
            if (right.lengthSq() === 0) right.set(1, 0, 0);

            smoothRights.push(right);
        }

        // 鍍鋅波形鋼護欄材質
        const railMat = new THREE.MeshStandardMaterial({
            color: 0x5a6772,
            metalness: 0.45,
            roughness: 0.42,
            side: THREE.DoubleSide
        });

        // 支撐立柱材質與幾何體
        const postMat = new THREE.MeshStandardMaterial({
            color: 0x333d44,
            metalness: 0.40,
            roughness: 0.60
        });
        const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8);

        // W-Beam 斷面 profile
        const wProfile = [
            { y: 0.74, z: -0.01 },
            { y: 0.67, z: 0.045 },
            { y: 0.57, z: -0.015 },
            { y: 0.47, z: 0.045 },
            { y: 0.40, z: -0.01 }
        ];
        const profLen = wProfile.length;
        const postInterval = 8; // 每 8 個分段（約 12 米）一根立柱

        [1, -1].forEach(side => {
            let currentVerts = [];
            let currentIndices = [];
            let segCount = 0;

            const flushRail = () => {
                if (currentVerts.length >= profLen * 6 && currentIndices.length >= 6) {
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(currentVerts, 3));
                    geo.setIndex(currentIndices);
                    geo.computeVertexNormals();
                    scene.add(new THREE.Mesh(geo, railMat));
                }
                currentVerts = [];
                currentIndices = [];
                segCount = 0;
            };

            for (let i = 0; i <= divisions; i++) {
                const t = i / divisions;
                const pt = trackCurve.getPointAt(t);
                const right = smoothRights[i];

                // 檢查是否處於捷徑開口處 (1: 左, -1: 右)
                if (isNearJunctionOpening(pt, side, altRouteJunctions)) {
                    flushRail();
                    continue;
                }

                const pos = pt.clone().addScaledVector(right, -side * railOffset);

                // 生成 W-Beam 橫向斷面
                wProfile.forEach(p => {
                    const v = pos.clone()
                        .addScaledVector(right, -side * p.z)
                        .add(new THREE.Vector3(0, p.y, 0));
                    currentVerts.push(v.x, v.y, v.z);
                });

                // 間隔生成立柱
                if (i % postInterval === 0) {
                    const post = new THREE.Mesh(postGeo, postMat);
                    post.position.copy(pos)
                        .addScaledVector(right, side * 0.075)
                        .add(new THREE.Vector3(0, 0.35, 0));
                    scene.add(post);
                }

                if (segCount > 0) {
                    for (let j = 0; j < profLen - 1; j++) {
                        const r1 = (segCount - 1) * profLen + j;
                        const r2 = segCount * profLen + j;
                        if (side === 1) {
                            currentIndices.push(r1, r2, r1 + 1);
                            currentIndices.push(r1 + 1, r2, r2 + 1);
                        } else {
                            currentIndices.push(r1, r1 + 1, r2);
                            currentIndices.push(r1 + 1, r2 + 1, r2);
                        }
                    }
                }
                segCount++;
            }
            flushRail();
        });
    }

    // ===== 捷徑分支路面 (buildAltRoutes) =====

    function buildAltRoutes() {
        const { scene, THREE, renderer, altRouteSamples, trackWidth } = _ctx;
        if (!altRouteSamples || altRouteSamples.length === 0) return;

        const hw = (trackWidth || 14) / 2;
        const widthSegments = 8;

        altRouteSamples.forEach((samples) => {
            const N = samples.length;
            if (N < 2) return;

            let totalDist = 0;
            for (let i = 1; i < N; i++) totalDist += samples[i].pt.distanceTo(samples[i - 1].pt);

            const roadPositions = [];
            const roadUVs = [];
            const roadIndices = [];

            const roadMat = new THREE.MeshStandardMaterial({
                map: createAnimeAsphaltTexture(renderer, totalDist),
                roughness: 0.92,
                metalness: 0.02,
                side: THREE.DoubleSide
            });

            for (let i = 0; i < N; i++) {
                const pt = samples[i].pt;
                const n = samples[i].norm;
                const v = (i / (N - 1)) * (totalDist / 20.0);

                for (let s = 0; s <= widthSegments; s++) {
                    const factor = s / widthSegments;
                    const px = (1 - factor) * (pt.x + n.x * hw) + factor * (pt.x - n.x * hw);
                    const py = pt.y + 0.01;
                    const pz = (1 - factor) * (pt.z + n.z * hw) + factor * (pt.z - n.z * hw);

                    roadPositions.push(px, py, pz);
                    roadUVs.push(factor, v);
                }

                if (i < N - 1) {
                    for (let s = 0; s < widthSegments; s++) {
                        const row1 = i * (widthSegments + 1) + s;
                        const row2 = (i + 1) * (widthSegments + 1) + s;
                        roadIndices.push(row1, row2, row1 + 1);
                        roadIndices.push(row1 + 1, row2, row2 + 1);
                    }
                }
            }

            const roadGeo = new THREE.BufferGeometry();
            roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
            roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
            roadGeo.setIndex(roadIndices);
            roadGeo.computeVertexNormals();
            scene.add(new THREE.Mesh(roadGeo, roadMat));
        });
    }

    // ===== 大型鋼構桁架門架 (buildGantryArch) =====

    function buildGantryArch(centerPt, forward, right, roadW, titleText, subtitleText, type = 'cp') {
        const { scene, THREE } = _ctx;
        const archGroup = new THREE.Group();

        const roadUp = new THREE.Vector3().crossVectors(forward, right).normalize();
        const mat = new THREE.Matrix4();
        mat.makeBasis(right, roadUp, forward);
        archGroup.rotation.setFromRotationMatrix(mat);
        archGroup.position.copy(centerPt);

        const archSpan = Math.max(roadW + 3.8, 14.5);
        const archHeight = 6.2;

        const trussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.80, roughness: 0.32 });
        const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.70, roughness: 0.40 });
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.90 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.80, roughness: 0.20 });

        // 1. 混凝土抗震基座
        const baseGeo = new THREE.BoxGeometry(1.3, 1.1, 1.5);
        const baseL = new THREE.Mesh(baseGeo, concreteMat);
        baseL.position.set(-archSpan / 2, 0.55, 0);
        const baseR = baseL.clone();
        baseR.position.x = archSpan / 2;
        archGroup.add(baseL);
        archGroup.add(baseR);

        // 2. 雙鋼桁架立柱
        const pillarGeo = new THREE.CylinderGeometry(0.18, 0.18, archHeight, 8);
        const pillarL1 = new THREE.Mesh(pillarGeo, trussMat);
        pillarL1.position.set(-archSpan / 2 - 0.28, archHeight / 2 + 0.5, 0);
        const pillarL2 = new THREE.Mesh(pillarGeo, trussMat);
        pillarL2.position.set(-archSpan / 2 + 0.28, archHeight / 2 + 0.5, 0);

        const pillarR1 = pillarL1.clone(); pillarR1.position.x = archSpan / 2 - 0.28;
        const pillarR2 = pillarL2.clone(); pillarR2.position.x = archSpan / 2 + 0.28;
        archGroup.add(pillarL1); archGroup.add(pillarL2);
        archGroup.add(pillarR1); archGroup.add(pillarR2);

        // 3. 雙橫向跨樑
        const topBeamGeo = new THREE.CylinderGeometry(0.16, 0.16, archSpan + 1.0, 8);
        topBeamGeo.rotateZ(Math.PI / 2);
        const topBeam1 = new THREE.Mesh(topBeamGeo, trussMat);
        topBeam1.position.set(0, archHeight + 0.15, 0);
        const topBeam2 = new THREE.Mesh(topBeamGeo, trussMat);
        topBeam2.position.set(0, archHeight + 0.95, 0);
        archGroup.add(topBeam1);
        archGroup.add(topBeam2);

        // 4. 金屬告示箱本體與飾框
        const boxGeo = new THREE.BoxGeometry(archSpan - 2.8, 2.2, 0.35);
        const boxMesh = new THREE.Mesh(boxGeo, darkMetalMat);
        boxMesh.position.set(0, archHeight - 0.4, 0);
        archGroup.add(boxMesh);

        let frameMat = goldMat;
        if (type === 'start') {
            frameMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.8, roughness: 0.2 });
        } else if (type === 'cp') {
            frameMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
        } else if (type === 'finish') {
            frameMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8, roughness: 0.2 });
        }

        const goldFrameGeo = new THREE.BoxGeometry(archSpan - 2.6, 2.4, 0.2);
        const goldFrame = new THREE.Mesh(goldFrameGeo, frameMat);
        goldFrame.position.set(0, archHeight - 0.4, -0.05);
        archGroup.add(goldFrame);

        // 5. 告示布旗正面 (面對迎面而來的車輛)
        const bannerTex = createGantryBannerTexture(titleText, subtitleText, type);
        const bannerMat = new THREE.MeshStandardMaterial({
            map: bannerTex,
            roughness: 1.0,
            metalness: 0.0
        });

        const bannerFaceGeo = new THREE.PlaneGeometry(archSpan - 3.0, 2.0);
        const bannerFace = new THREE.Mesh(bannerFaceGeo, bannerMat);
        bannerFace.position.set(0, archHeight - 0.4, -0.19);
        bannerFace.rotation.y = Math.PI;
        archGroup.add(bannerFace);

        // 6. 起跑 / 終點地面黑白方格賽車貼花
        if (type === 'start' || type === 'finish') {
            const groundTex = createCheckeredGroundTexture();
            const groundMat = new THREE.MeshStandardMaterial({
                map: groundTex,
                roughness: 0.8,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                side: THREE.DoubleSide
            });
            const groundDecalGeo = new THREE.PlaneGeometry(roadW, 3.4);
            const groundDecal = new THREE.Mesh(groundDecalGeo, groundMat);
            groundDecal.rotation.x = -Math.PI / 2;
            groundDecal.position.set(0, 0.02, 0);
            archGroup.add(groundDecal);
        }

        scene.add(archGroup);
        return archGroup;
    }

    // ===== 起點與終點門架 (buildStartFinishLine) =====

    function buildStartFinishLine() {
        const { trackCurve, trackType, selectedTrackKey, TRACKS, trackWidth } = _ctx;
        const roadW = trackWidth || 14.0;
        const trackData = (TRACKS && selectedTrackKey) ? TRACKS[selectedTrackKey] : {};
        const trackTitle = trackData.name || '秋名山';

        const uStart = trackType === 'linear' ? 0.008 : 0.0;
        const deltaU = 0.0005;

        const pPrev = trackCurve.getPointAt((uStart - deltaU + 1.0) % 1.0);
        const pNext = trackCurve.getPointAt((uStart + deltaU) % 1.0);
        const centerPt = trackCurve.getPointAt(uStart);

        const forward = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();

        buildGantryArch(centerPt, forward, right, roadW, 'START', `${trackTitle} START`, 'start');

        if (trackType === 'linear') {
            const uEnd = 0.995;
            const pePrev = trackCurve.getPointAt(Math.max(0, uEnd - deltaU));
            const peNext = trackCurve.getPointAt(Math.min(1.0, uEnd + deltaU));
            const endCenterPt = trackCurve.getPointAt(uEnd);

            const endForward = new THREE.Vector3().subVectors(peNext, pePrev).normalize();
            const endRight = new THREE.Vector3().crossVectors(worldUp, endForward).normalize();

            buildGantryArch(endCenterPt, endForward, endRight, roadW, 'FINISH', `${trackTitle} GOAL`, 'finish');
        }
    }

    // ===== 檢查點門架 (buildCheckpoints) =====

    function buildCheckpoints() {
        const { trackCurve, TRACK_SAMPLES, CHECKPOINT_RATIOS, selectedTrackKey, TRACKS, trackWidth, trackType } = _ctx;
        if (trackType === 'circuit') {
            return { checkpointMeshes: [], checkpointIndices: [] };
        }
        const roadW = trackWidth || 14.0;
        const checkpointMeshes = [];
        const checkpointIndices = [];
        const deltaU = 0.0005;
        const worldUp = new THREE.Vector3(0, 1, 0);

        CHECKPOINT_RATIOS.forEach((ratio, cpIdx) => {
            const idx = Math.floor(TRACK_SAMPLES * ratio);
            checkpointIndices.push(idx);

            const u = ratio;
            const pPrev = trackCurve.getPointAt((u - deltaU + 1.0) % 1.0);
            const pNext = trackCurve.getPointAt((u + deltaU) % 1.0);
            const centerPt = trackCurve.getPointAt(u);

            const forward = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
            const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();

            const cpArch = buildGantryArch(
                centerPt,
                forward,
                right,
                roadW,
                `CP ${cpIdx + 1}`,
                `CHECK POINT ${cpIdx + 1}`,
                'cp'
            );

            checkpointMeshes.push(cpArch);
        });

        return { checkpointMeshes, checkpointIndices };
    }

    // ===== 深夜山道環境、遠景山谷燈火與光影 (buildEnvironment - 無路邊岩石，純淨動漫山道) =====

    function buildEnvironment() {
        const { scene, THREE, trackCurve, trackWidth } = _ctx;

        // 1. 夜間大地基底
        const groundGeo = new THREE.PlaneGeometry(3600, 3600);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x090f12, roughness: 0.98 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.15;
        scene.add(ground);

        // 2. 柔和秋名山夜色光源
        const ambientLight = new THREE.AmbientLight(0x22303d, 1.25);
        scene.add(ambientLight);

        const moonLight = new THREE.DirectionalLight(0x4c657e, 1.1);
        moonLight.position.set(-200, 600, -300);
        scene.add(moonLight);

        // 3. 遠方山谷城市點點夜燈 (City Lights Point Cloud)
        const cityGeo = new THREE.BufferGeometry();
        const cityVerts = [];
        for (let k = 0; k < 350; k++) {
            const cx = 350 + (Math.random() - 0.5) * 800;
            const cy = -60 + (Math.random() - 0.5) * 45;
            const cz = -750 + (Math.random() - 0.5) * 600;
            cityVerts.push(cx, cy, cz);
        }
        cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityVerts, 3));
        const cityMat = new THREE.PointsMaterial({
            color: 0xe2d184,
            size: 2.4,
            transparent: true,
            opacity: 0.65
        });
        scene.add(new THREE.Points(cityGeo, cityMat));

        // 注意：依使用者需求，已完全移除地上的山（ConeGeometry 遠山三角錐）及道路兩側岩石，保持平整乾淨動漫風夜景！
    }

    return {
        init,
        buildTrackMesh,
        buildTrackEdges,
        buildAltRoutes,
        buildStartFinishLine,
        buildCheckpoints,
        buildEnvironment
    };
})();

window.CyberRaceTrackBuilder = CyberRaceTrackBuilder;
