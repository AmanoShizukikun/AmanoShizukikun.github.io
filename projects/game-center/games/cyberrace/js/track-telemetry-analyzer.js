const TrackAnalyzer = {
    rawPoints: [],
    startIdx: 0,
    finishIdx: 0,
    checkPoints: [],
    altRoutes: [],
    isCircuit: false,
    currentDirection: 'forward',
    cachedDataObj: null,
    routeCurve: null,
    totalTrackLength: 0,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    pathRibbonMesh: null,
    edgeLinesGroup: null,
    heightWallMesh: null,
    altRoutesGroup: null,
    gridHelper: null,
    waypointReticlesGroup: null,
    hairpinPhotosGroup: null,
    pulsingRingsList: [],
    tracerLight: null,
    tracerMesh: null,
    isPlaying: true,
    progressT: 0,
    cameraMode: 'iso',
    currentCompassDeg: 0,
    smoothedCamDir: null,
    isInitialized: false,
    resizeObserver: null,
    pendingData: null,
    lastCanvasWidth: 0,
    lastCanvasHeight: 0,

    init() {
        if (this.isInitialized) return;
        const container = document.getElementById('analyzer-canvas-container');
        if (!container) return;

        if (typeof THREE !== 'undefined') {
            this.smoothedCamDir = new THREE.Vector3(0, 0, -1);
        }

        if (window.lucide && lucide.createIcons) {
            try { lucide.createIcons(); } catch(e){}
        }

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x040b16);
        this.scene.fog = new THREE.FogExp2(0x040b16, 0.00028);

        const width = container.clientWidth || 400;
        const height = container.clientHeight || 300;

        this.camera = new THREE.PerspectiveCamera(45, (width / (height || 1)), 1, 10000);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        container.appendChild(this.renderer.domElement);

        let OrbitControlsClass = null;
        if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
            OrbitControlsClass = THREE.OrbitControls;
        } else if (typeof OrbitControls !== 'undefined') {
            OrbitControlsClass = OrbitControls;
        }

        if (OrbitControlsClass) {
            this.controls = new OrbitControlsClass(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.addEventListener('start', () => {
                if (this.cameraMode !== 'free') {
                    this.setCameraMode('free');
                }
            });
        }

        const ambientLight = new THREE.AmbientLight(0xd8ecff, 0.95);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
        dirLight.position.set(500, 1000, 500);
        this.scene.add(dirLight);

        this.gridHelper = new THREE.GridHelper(4800, 96, 0x00f0ff, 0x0a1a2f);
        this.gridHelper.position.y = -10;
        this.scene.add(this.gridHelper);

        // 2D Cyan Disc + Black Outline Tracer
        this.tracerMesh = new THREE.Group();

        const blackBorderGeo = new THREE.CircleGeometry(9.0, 32);
        const blackBorderMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true
        });
        const blackBorder = new THREE.Mesh(blackBorderGeo, blackBorderMat);
        blackBorder.renderOrder = 9998;
        this.tracerMesh.add(blackBorder);

        const blueCoreGeo = new THREE.CircleGeometry(6.8, 32);
        const blueCoreMat = new THREE.MeshBasicMaterial({ 
            color: 0x00f0ff, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true
        });
        const blueCore = new THREE.Mesh(blueCoreGeo, blueCoreMat);
        blueCore.position.z = 0.01;
        blueCore.renderOrder = 9999;
        this.tracerMesh.add(blueCore);

        this.scene.add(this.tracerMesh);

        this.tracerLight = new THREE.PointLight(0x00f0ff, 5.0, 400);
        this.tracerMesh.add(this.tracerLight);

        this.setupEventListeners();

        // Automatic Resize Observer for dynamic visibility/modal container sizing
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.onWindowResize();
            });
            this.resizeObserver.observe(container);
            if (container.parentElement) {
                this.resizeObserver.observe(container.parentElement);
            }
        }
        window.addEventListener('resize', () => this.onWindowResize());

        this.isInitialized = true;
        if (this.pendingData) {
            const { dataObj, direction } = this.pendingData;
            this.pendingData = null;
            this.loadRouteData(dataObj, direction);
        }

        this.animate();
    },

    createHeightWallTexture(glowColor = '#00f0ff') {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0.00, 'rgba(0, 160, 220, 0.20)');
        grad.addColorStop(0.12, glowColor === '#ffcc00' ? 'rgba(255, 204, 0, 0.92)' : 'rgba(0, 240, 255, 0.92)');
        grad.addColorStop(0.35, glowColor === '#ffcc00' ? 'rgba(255, 170, 0, 0.35)' : 'rgba(0, 160, 240, 0.35)');
        grad.addColorStop(0.75, 'rgba(0, 50, 150, 0.08)');
        grad.addColorStop(1.00, 'rgba(4, 11, 22, 0.0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = glowColor === '#ffcc00' ? 'rgba(255, 204, 0, 0.35)' : 'rgba(0, 240, 255, 0.25)';
        ctx.lineWidth = 1.5;
        for (let x = 0; x < canvas.width; x += 16) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    },

    loadRouteData(dataObj, direction = 'forward') {
        if (!this.isInitialized) {
            this.pendingData = { dataObj, direction };
            this.init();
            return true;
        }
        if (!dataObj) return false;

        this.cachedDataObj = dataObj;
        this.currentDirection = direction;

        let pts = dataObj.points || dataObj;
        if (!Array.isArray(pts) || pts.length < 2) return false;

        this.rawPoints = pts.map(p => {
            if (p instanceof THREE.Vector3) return [p.x, p.y, p.z];
            if (Array.isArray(p)) return p;
            return [p.x || 0, p.y || 0, p.z || 0];
        });

        const isClosed = dataObj.type === 'Circuit' || dataObj.type === 'circuit';
        this.isCircuit = isClosed;

        const origStart = dataObj.startIndex !== undefined ? dataObj.startIndex : 0;
        const origFinish = dataObj.finishIndex !== undefined ? dataObj.finishIndex : this.rawPoints.length - 1;

        if (isClosed) {
            // 環道：起終點重疊於同一個點 (index 0)，不需要檢查點
            this.startIdx = 0;
            this.finishIdx = 0;
            this.checkPoints = [];
        } else {
            if (direction === 'reverse') {
                // PTP 逆向 (復路)：起點為原終點 (finishIndex)，終點為原起點 (startIndex)
                this.startIdx = origFinish;
                this.finishIdx = origStart;
                if (dataObj.checkpoints && dataObj.checkpoints.length > 0) {
                    this.checkPoints = dataObj.checkpoints.slice().reverse();
                } else {
                    this.checkPoints = [
                        Math.floor(this.rawPoints.length * 0.82),
                        Math.floor(this.rawPoints.length * 0.58),
                        Math.floor(this.rawPoints.length * 0.28)
                    ];
                }
            } else {
                // PTP 正向 (往路)：起點為 startIndex，終點為 finishIndex
                this.startIdx = origStart;
                this.finishIdx = origFinish;
                this.checkPoints = (dataObj.checkpoints && dataObj.checkpoints.length > 0) ? dataObj.checkpoints.slice() : [
                    Math.floor(this.rawPoints.length * 0.28),
                    Math.floor(this.rawPoints.length * 0.58),
                    Math.floor(this.rawPoints.length * 0.82)
                ];
            }
        }

        // 讀取並處理捷徑 (altRoutes / shortcuts)
        const rawAltRoutes = dataObj.altRoutes || dataObj.shortcuts || [];
        this.altRoutes = rawAltRoutes.map(ar => {
            let arPts = (ar.points || ar).map(p => {
                if (p instanceof THREE.Vector3) return [p.x, p.y, p.z];
                if (Array.isArray(p)) return p;
                return [p.x || 0, p.y || 0, p.z || 0];
            });
            if (direction === 'reverse') {
                arPts = arPts.slice().reverse();
            }
            return { points: arPts };
        });

        const vectors = this.rawPoints.map(p => new THREE.Vector3(p[0], p[1], p[2]));

        this.routeCurve = new THREE.CatmullRomCurve3(vectors, isClosed);
        this.routeCurve.curveType = 'catmullrom';
        this.routeCurve.tension = 0.35;

        this.totalTrackLength = 0;
        for (let i = 1; i < vectors.length; i++) {
            this.totalTrackLength += vectors[i].distanceTo(vectors[i-1]);
        }
        if (isClosed && vectors.length > 1) {
            this.totalTrackLength += vectors[0].distanceTo(vectors[vectors.length - 1]);
        }

        this.rebuildRouteMeshes();
        this.setCameraMode(this.cameraMode);

        this.progressT = 0;
        this.onWindowResize();
        return true;
    },

    getRouteCenter() {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
        this.rawPoints.forEach(p => {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
            if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
        });
        return new THREE.Vector3((minX + maxX)/2, (minY + maxY)/2, (minZ + maxZ)/2);
    },

    getRouteBoundingBox() {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
        this.rawPoints.forEach(p => {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[2] < minZ) minZ = p[2]; if (p[2] > maxZ) maxZ = p[2];
            if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
        });
        return {
            center: new THREE.Vector3((minX + maxX)/2, (minY + maxY)/2, (minZ + maxZ)/2),
            sizeX: maxX - minX,
            sizeZ: maxZ - minZ,
            sizeY: maxY - minY
        };
    },

    fitTopDownCamera() {
        if (!this.rawPoints || this.rawPoints.length < 2 || !this.camera) return;
        const bounds = this.getRouteBoundingBox();
        const padding = 1.05;
        const fovRad = (this.camera.fov * Math.PI) / 180;
        const tanFov = Math.tan(fovRad / 2);
        const heightForZ = (bounds.sizeZ * padding) / (2 * tanFov);
        const heightForX = (bounds.sizeX * padding) / (2 * tanFov * this.camera.aspect);
        const fitHeight = Math.max(heightForZ, heightForX, 420);

        this.camera.position.set(bounds.center.x, bounds.center.y + fitHeight, bounds.center.z + 0.1);
        if (this.controls) {
            this.controls.target.copy(bounds.center);
            this.controls.update();
        }
    },

    createOnTrackReticleMesh(colorHex) {
        const group = new THREE.Group();

        const discGeo = new THREE.CircleGeometry(4.5, 32);
        const discMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, depthTest: true });
        const discMesh = new THREE.Mesh(discGeo, discMat);
        discMesh.rotation.x = Math.PI / 2;
        group.add(discMesh);

        const borderGeo = new THREE.RingGeometry(5.2, 6.2, 32);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
        const borderMesh = new THREE.Mesh(borderGeo, borderMat);
        borderMesh.rotation.x = Math.PI / 2;
        group.add(borderMesh);

        const pulseGeo = new THREE.BufferGeometry();
        const thetaSegments = 32;
        const positions = new Float32Array((thetaSegments + 1) * 2 * 3);
        pulseGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const indices = [];
        for (let i = 0; i < thetaSegments; i++) {
            const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
            indices.push(a, b, c, b, d, c);
        }
        pulseGeo.setIndex(indices);

        const pulseMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        pulseMesh.rotation.x = Math.PI / 2;
        group.add(pulseMesh);
        this.pulsingRingsList.push(pulseMesh);

        return group;
    },

    rebuildRouteMeshes() {
        if (!this.scene) return;
        if (this.pathRibbonMesh) this.scene.remove(this.pathRibbonMesh);
        if (this.edgeLinesGroup) this.scene.remove(this.edgeLinesGroup);
        if (this.heightWallMesh) this.scene.remove(this.heightWallMesh);
        if (this.altRoutesGroup) this.scene.remove(this.altRoutesGroup);
        if (this.waypointReticlesGroup) this.scene.remove(this.waypointReticlesGroup);
        if (this.hairpinPhotosGroup) this.scene.remove(this.hairpinPhotosGroup);

        this.pulsingRingsList = [];

        const numSamples = 1200;
        const roadWidth = 20.0;
        const upVec = new THREE.Vector3(0, 1, 0);

        const roadPositions = [];
        const roadUvs = [];
        const roadIndices = [];

        const leftEdgePoints = [];
        const rightEdgePoints = [];

        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const pt = this.routeCurve.getPoint(t);
            const tangent = this.routeCurve.getTangent(t).normalize();

            let right = new THREE.Vector3().crossVectors(tangent, upVec).normalize();
            if (right.lengthSq() < 0.0001) right.set(1, 0, 0);

            const leftPt = pt.clone().sub(right.clone().multiplyScalar(roadWidth / 2));
            const rightPt = pt.clone().add(right.clone().multiplyScalar(roadWidth / 2));
            leftPt.y += 0.4;
            rightPt.y += 0.4;

            leftEdgePoints.push(leftPt);
            rightEdgePoints.push(rightPt);

            roadPositions.push(leftPt.x, leftPt.y, leftPt.z);
            roadPositions.push(rightPt.x, rightPt.y, rightPt.z);
            roadUvs.push(0, t * 12);
            roadUvs.push(1, t * 12);

            if (i < numSamples) {
                const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
                roadIndices.push(a, b, c, b, d, c);
            }
        }

        const ribbonGeo = new THREE.BufferGeometry();
        ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
        ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
        ribbonGeo.setIndex(roadIndices);

        const ribbonMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.98, depthWrite: true, fog: false
        });
        this.pathRibbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
        this.pathRibbonMesh.renderOrder = 10;
        this.scene.add(this.pathRibbonMesh);

        this.edgeLinesGroup = new THREE.Group();
        const leftLineGeo = new THREE.BufferGeometry().setFromPoints(leftEdgePoints);
        const rightLineGeo = new THREE.BufferGeometry().setFromPoints(rightEdgePoints);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, opacity: 0.95, transparent: true, linewidth: 2, fog: false });

        this.edgeLinesGroup.add(new THREE.Line(leftLineGeo, edgeMat));
        this.edgeLinesGroup.add(new THREE.Line(rightLineGeo, edgeMat));
        this.edgeLinesGroup.renderOrder = 20;
        this.scene.add(this.edgeLinesGroup);

        const wallGeo = new THREE.BufferGeometry();
        const wallVertices = [];
        const wallUvs = [];
        const wallIndices = [];
        const wallTexture = this.createHeightWallTexture('#00f0ff');
        const minLevel = -10;

        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            const lPt = leftEdgePoints[i];
            const rPt = rightEdgePoints[i];

            wallVertices.push(lPt.x, lPt.y + 0.1, lPt.z); wallUvs.push(t * 24, 1);
            wallVertices.push(lPt.x, minLevel, lPt.z); wallUvs.push(t * 24, 0);
            wallVertices.push(rPt.x, rPt.y + 0.1, rPt.z); wallUvs.push(t * 24, 1);
            wallVertices.push(rPt.x, minLevel, rPt.z); wallUvs.push(t * 24, 0);
        }

        for (let i = 0; i < numSamples; i++) {
            const base = i * 4;
            const lTop1 = base + 0, lBot1 = base + 1, rTop1 = base + 2, rBot1 = base + 3;
            const lTop2 = base + 4, lBot2 = base + 5, rTop2 = base + 6, rBot2 = base + 7;

            wallIndices.push(lTop1, lBot1, lTop2, lBot1, lBot2, lTop2);
            wallIndices.push(rTop1, rTop2, rBot1, rBot1, rTop2, rBot2);
        }

        wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallVertices, 3));
        wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
        wallGeo.setIndex(wallIndices);

        const wallMat = new THREE.MeshBasicMaterial({
            map: wallTexture, side: THREE.DoubleSide, transparent: true, depthWrite: false, opacity: 0.85, fog: false
        });
        this.heightWallMesh = new THREE.Mesh(wallGeo, wallMat);
        this.heightWallMesh.renderOrder = 1;
        this.scene.add(this.heightWallMesh);

        // ===== 捷徑 (Alt Routes / Shortcuts) 3D 渲染 =====
        this.altRoutesGroup = new THREE.Group();
        if (this.altRoutes && this.altRoutes.length > 0) {
            const altWallTexture = this.createHeightWallTexture('#ffcc00');
            const altRibbonMat = new THREE.MeshBasicMaterial({
                color: 0xffea00, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: true, fog: false
            });
            const altEdgeMat = new THREE.LineBasicMaterial({
                color: 0xffcc00, opacity: 0.95, transparent: true, linewidth: 2, fog: false
            });
            const altWallMat = new THREE.MeshBasicMaterial({
                map: altWallTexture, side: THREE.DoubleSide, transparent: true, depthWrite: false, opacity: 0.85, fog: false
            });

            this.altRoutes.forEach((ar) => {
                if (!ar.points || ar.points.length < 2) return;
                const arVectors = ar.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
                const arCurve = new THREE.CatmullRomCurve3(arVectors, false);
                arCurve.curveType = 'catmullrom';
                arCurve.tension = 0.35;

                const arSamples = Math.max(40, Math.min(300, ar.points.length * 15));
                const arWidth = 14.0;
                const arRoadPos = [];
                const arRoadUvs = [];
                const arRoadIndices = [];
                const arLeftEdge = [];
                const arRightEdge = [];
                const arWallVertices = [];
                const arWallUvs = [];
                const arWallIndices = [];

                for (let i = 0; i <= arSamples; i++) {
                    const t = i / arSamples;
                    const pt = arCurve.getPoint(t);
                    const tan = arCurve.getTangent(t).normalize();
                    let right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
                    if (right.lengthSq() < 0.0001) right.set(1, 0, 0);

                    const lPt = pt.clone().sub(right.clone().multiplyScalar(arWidth / 2));
                    const rPt = pt.clone().add(right.clone().multiplyScalar(arWidth / 2));
                    lPt.y += 0.45;
                    rPt.y += 0.45;

                    arLeftEdge.push(lPt);
                    arRightEdge.push(rPt);

                    arRoadPos.push(lPt.x, lPt.y, lPt.z, rPt.x, rPt.y, rPt.z);
                    arRoadUvs.push(0, t * 8, 1, t * 8);

                    if (i < arSamples) {
                        const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
                        arRoadIndices.push(a, b, c, b, d, c);
                    }

                    arWallVertices.push(lPt.x, lPt.y + 0.1, lPt.z); arWallUvs.push(t * 16, 1);
                    arWallVertices.push(lPt.x, minLevel, lPt.z); arWallUvs.push(t * 16, 0);
                    arWallVertices.push(rPt.x, rPt.y + 0.1, rPt.z); arWallUvs.push(t * 16, 1);
                    arWallVertices.push(rPt.x, minLevel, rPt.z); arWallUvs.push(t * 16, 0);
                }

                for (let i = 0; i < arSamples; i++) {
                    const base = i * 4;
                    const lTop1 = base + 0, lBot1 = base + 1, rTop1 = base + 2, rBot1 = base + 3;
                    const lTop2 = base + 4, lBot2 = base + 5, rTop2 = base + 6, rBot2 = base + 7;

                    arWallIndices.push(lTop1, lBot1, lTop2, lBot1, lBot2, lTop2);
                    arWallIndices.push(rTop1, rTop2, rBot1, rBot1, rTop2, rBot2);
                }

                const arRibbonGeo = new THREE.BufferGeometry();
                arRibbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(arRoadPos, 3));
                arRibbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(arRoadUvs, 2));
                arRibbonGeo.setIndex(arRoadIndices);
                const arMesh = new THREE.Mesh(arRibbonGeo, altRibbonMat);
                arMesh.renderOrder = 12;
                this.altRoutesGroup.add(arMesh);

                const arLeftGeo = new THREE.BufferGeometry().setFromPoints(arLeftEdge);
                const arRightGeo = new THREE.BufferGeometry().setFromPoints(arRightEdge);
                this.altRoutesGroup.add(new THREE.Line(arLeftGeo, altEdgeMat));
                this.altRoutesGroup.add(new THREE.Line(arRightGeo, altEdgeMat));

                const arWallGeo = new THREE.BufferGeometry();
                arWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(arWallVertices, 3));
                arWallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(arWallUvs, 2));
                arWallGeo.setIndex(arWallIndices);
                const arWallMesh = new THREE.Mesh(arWallGeo, altWallMat);
                arWallMesh.renderOrder = 2;
                this.altRoutesGroup.add(arWallMesh);
            });
        }
        this.scene.add(this.altRoutesGroup);

        // ===== 戰術地標光圈 (Waypoint Reticles) =====
        this.waypointReticlesGroup = new THREE.Group();
        if (this.isCircuit) {
            // 環道：起終點重疊於同一個點，不需檢查點
            const loopStartPt = this.rawPoints[0];
            if (loopStartPt) {
                const startFinishReticle = this.createOnTrackReticleMesh("#00ff88");
                startFinishReticle.position.set(loopStartPt[0], loopStartPt[1] + 1.2, loopStartPt[2]);
                this.waypointReticlesGroup.add(startFinishReticle);
            }
        } else {
            // PTP：起點 (綠)、終點 (紅)、檢查點 (黃)
            const startPt = this.rawPoints[this.startIdx];
            const finishPt = this.rawPoints[this.finishIdx];

            if (startPt) {
                const startReticle = this.createOnTrackReticleMesh("#00ff88");
                startReticle.position.set(startPt[0], startPt[1] + 1.2, startPt[2]);
                this.waypointReticlesGroup.add(startReticle);
            }
            if (finishPt) {
                const finishReticle = this.createOnTrackReticleMesh("#ff2a5f");
                finishReticle.position.set(finishPt[0], finishPt[1] + 1.2, finishPt[2]);
                this.waypointReticlesGroup.add(finishReticle);
            }
            this.checkPoints.forEach((idx) => {
                if (this.rawPoints[idx]) {
                    const pt = this.rawPoints[idx];
                    const cpReticle = this.createOnTrackReticleMesh("#ffcc00");
                    cpReticle.position.set(pt[0], pt[1] + 1.2, pt[2]);
                    this.waypointReticlesGroup.add(cpReticle);
                }
            });
        }

        // 捷徑入口戰術光圈
        if (this.altRoutes && this.altRoutes.length > 0) {
            this.altRoutes.forEach(ar => {
                if (ar.points && ar.points.length > 0) {
                    const entryPt = ar.points[0];
                    const scReticle = this.createOnTrackReticleMesh("#ffea00");
                    scReticle.position.set(entryPt[0], entryPt[1] + 1.2, entryPt[2]);
                    this.waypointReticlesGroup.add(scReticle);
                }
            });
        }

        this.scene.add(this.waypointReticlesGroup);
    },

    updateHudOverlay() {
        const svg = document.getElementById('hud-svg-overlay');
        if (!svg) return;

        const toggleNodes = document.getElementById('toggle-nodes');
        if (toggleNodes && !toggleNodes.checked) {
            svg.style.display = 'none';
            return;
        }
        svg.style.display = 'block';

        const container = document.getElementById('analyzer-canvas-container');
        if (!container || !this.camera) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width <= 0 || height <= 0) return;

        const nodesData = [];

        if (this.isCircuit) {
            // 環道：只有起終點合一標籤，不需要檢查點
            nodesData.push({
                key: 'start_finish',
                title: 'START / FINISH',
                subtitle: '起終點',
                color: '#00ff88',
                pt: this.rawPoints[0]
            });
        } else {
            // PTP：起點、檢查點、終點
            nodesData.push({ key: 'start', title: 'START LINE', subtitle: '起點', color: '#00ff88', pt: this.rawPoints[this.startIdx] });
            if (this.checkPoints[0] !== undefined) nodesData.push({ key: 'cp1', title: 'CHECK POINT 1', subtitle: '檢查點 1', color: '#ffcc00', pt: this.rawPoints[this.checkPoints[0]] });
            if (this.checkPoints[1] !== undefined) nodesData.push({ key: 'cp2', title: 'CHECK POINT 2', subtitle: '檢查點 2', color: '#ffcc00', pt: this.rawPoints[this.checkPoints[1]] });
            if (this.checkPoints[2] !== undefined) nodesData.push({ key: 'cp3', title: 'CHECK POINT 3', subtitle: '檢查點 3', color: '#ffcc00', pt: this.rawPoints[this.checkPoints[2]] });
            nodesData.push({ key: 'finish', title: 'FINISH LINE', subtitle: '終點', color: '#ff2a5f', pt: this.rawPoints[this.finishIdx] });
        }

        // 捷徑標籤
        if (this.altRoutes && this.altRoutes.length > 0) {
            this.altRoutes.forEach((ar, idx) => {
                if (ar.points && ar.points.length > 0) {
                    nodesData.push({
                        key: 'shortcut_' + idx,
                        title: this.altRoutes.length > 1 ? `SHORTCUT ${idx + 1}` : 'SHORTCUT',
                        subtitle: '捷徑',
                        color: '#ffea00',
                        pt: ar.points[0]
                    });
                }
            });
        }

        let svgContent = '';
        nodesData.forEach(node => {
            if (!node.pt) return;
            const vec = new THREE.Vector3(node.pt[0], node.pt[1] + 1.2, node.pt[2]);
            vec.project(this.camera);

            if (vec.z > 1.0) return;

            const x0 = (vec.x * 0.5 + 0.5) * width;
            const y0 = (-vec.y * 0.5 + 0.5) * height;

            if (x0 < -150 || x0 > width + 150 || y0 < -150 || y0 > height + 150) return;

            const x1 = x0 + 25, y1 = y0 - 45;
            const x2 = x0 + 75, y2 = y0 - 45;
            const dotX = x0 + 84, dotY = y0 - 45;
            const textX = x0 + 96, textY = y0 - 52;

            svgContent += `
                <g class="hud-node-group">
                    <polyline points="${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" 
                              stroke="${node.color}" stroke-width="2" fill="none" opacity="0.9" />
                    <circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="5" fill="${node.color}" />
                    <text x="${textX.toFixed(1)}" y="${textY.toFixed(1)}" fill="#ffffff" 
                          font-family="Orbitron, sans-serif" font-weight="900" font-size="18" 
                          style="filter: drop-shadow(0 0 6px rgba(255,255,255,0.9));">${node.title}</text>
                    <text x="${textX.toFixed(1)}" y="${(textY + 22).toFixed(1)}" fill="${node.color}" 
                          font-family="'Noto Sans TC', sans-serif" font-weight="700" font-size="14" 
                          style="filter: drop-shadow(0 0 4px ${node.color});">${node.subtitle}</text>
                </g>
            `;
        });
        svg.innerHTML = svgContent;
    },

    updateCompass() {
        if (!this.camera) return;
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);

        let targetRad = Math.atan2(dir.x, -dir.z);
        let rawDeg = targetRad * (180 / Math.PI);
        if (rawDeg < 0) rawDeg += 360;

        let diff = rawDeg - (this.currentCompassDeg % 360);
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        this.currentCompassDeg += diff * 0.2;

        const compassDial = document.getElementById('compass-dial');
        if (compassDial) {
            compassDial.style.transform = `perspective(350px) rotateX(52deg) rotateZ(${this.currentCompassDeg}deg)`;
        }
    },

    updateTracerPosition() {
        if (!this.routeCurve || !this.rawPoints || this.rawPoints.length < 2) return;

        let clampT = 0;
        let isReverseMotion = (this.currentDirection === 'reverse');

        if (this.isCircuit) {
            clampT = isReverseMotion 
                ? (1.0 - this.progressT) % 1.0 
                : Math.min(1.0, Math.max(0.0, this.progressT));
        } else {
            // 從起跑點 (startIdx) 出發，巡航至終點 (finishIdx)
            const startFrac = this.startIdx / (this.rawPoints.length - 1);
            const finishFrac = this.finishIdx / (this.rawPoints.length - 1);
            const mappedT = startFrac + this.progressT * (finishFrac - startFrac);
            clampT = Math.min(1.0, Math.max(0.0, mappedT));
            isReverseMotion = (finishFrac < startFrac);
        }

        const pt = this.routeCurve.getPoint(clampT);

        if (this.tracerMesh) {
            this.tracerMesh.position.copy(pt);
            this.tracerMesh.position.y += 0.8;

            const tangent = this.routeCurve.getTangent(clampT).normalize();
            const moveDir = isReverseMotion ? tangent.clone().negate() : tangent.clone();
            const upVec = new THREE.Vector3(0, 1, 0);
            let rightVec = new THREE.Vector3().crossVectors(moveDir, upVec).normalize();
            if (rightVec.lengthSq() < 0.0001) rightVec.set(1, 0, 0);
            const normalVec = new THREE.Vector3().crossVectors(rightVec, moveDir).normalize();

            const orientMat = new THREE.Matrix4().makeBasis(rightVec, moveDir, normalVec);
            this.tracerMesh.rotation.setFromRotationMatrix(orientMat);
        }

        const scrubberSlider = document.getElementById('scrubber-slider');
        if (scrubberSlider) scrubberSlider.value = Math.floor(this.progressT * 1000);

        const progressPercent = document.getElementById('progress-percent');
        if (progressPercent) progressPercent.innerText = `${(this.progressT * 100).toFixed(1)}%`;

        if (this.cameraMode === 'follow' && this.camera && this.controls) {
            let aheadT = 0;
            if (this.isCircuit) {
                aheadT = isReverseMotion 
                    ? (clampT - 0.015 + 1.0) % 1.0 
                    : (clampT + 0.015) % 1.0;
            } else {
                aheadT = isReverseMotion 
                    ? Math.max(0.0, clampT - 0.015)
                    : Math.min(1.0, clampT + 0.015);
            }
            const aheadPt = this.routeCurve.getPoint(aheadT);

            const targetMoveDir = aheadPt.clone().sub(pt).normalize();

            if (targetMoveDir.lengthSq() > 0.0001) {
                this.smoothedCamDir.lerp(targetMoveDir, 0.04).normalize();
            } else {
                this.smoothedCamDir.lerp(moveDir, 0.04).normalize();
            }

            const camDist = 280;
            const camHeight = 150;

            const targetCamPos = pt.clone()
                .sub(this.smoothedCamDir.clone().multiplyScalar(camDist))
                .add(new THREE.Vector3(0, camHeight, 0));

            const targetLookAt = pt.clone()
                .add(this.smoothedCamDir.clone().multiplyScalar(50))
                .add(new THREE.Vector3(0, 10, 0));

            this.camera.position.lerp(targetCamPos, 0.05);
            this.controls.target.lerp(targetLookAt, 0.06);
        }
    },

    setCameraMode(mode) {
        this.cameraMode = mode;
        const camBtns = { 'iso': 'cam-iso', 'follow': 'cam-follow', 'top': 'cam-top', 'free': 'cam-free' };

        Object.keys(camBtns).forEach(m => {
            const btn = document.getElementById(camBtns[m]);
            if (btn) {
                btn.removeAttribute('style');
                if (m === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });

        if (this.heightWallMesh) {
            this.heightWallMesh.material.opacity = (mode === 'top') ? 0.35 : 0.85;
        }

        if (!this.rawPoints || this.rawPoints.length < 2) return;
        const center = this.getRouteCenter();
        const bounds = this.getRouteBoundingBox();
        if (mode === 'iso' && this.camera && this.controls) {
            const fitSpan = Math.max(bounds.sizeX, bounds.sizeZ, 600);
            this.camera.position.copy(center.clone().add(new THREE.Vector3(fitSpan * 0.9, fitSpan * 0.8, fitSpan * 1.2)));
            this.controls.target.copy(center);
            this.controls.update();
        } else if (mode === 'top') {
            this.fitTopDownCamera();
        } else if (mode === 'follow' && this.routeCurve) {
            const startT = this.isCircuit ? 0 : (this.startIdx / (this.rawPoints.length - 1));
            const isReverse = this.isCircuit ? (this.currentDirection === 'reverse') : (this.finishIdx < this.startIdx);
            const pt = this.routeCurve.getPoint(startT);
            const tangent = this.routeCurve.getTangent(startT).normalize();
            const moveDir = isReverse ? tangent.clone().negate() : tangent.clone();
            this.smoothedCamDir.copy(moveDir);

            if (this.camera && this.controls) {
                const camDist = 280;
                const camHeight = 150;
                this.camera.position.copy(pt.clone().sub(moveDir.clone().multiplyScalar(camDist)).add(new THREE.Vector3(0, camHeight, 0)));
                this.controls.target.copy(pt.clone().add(moveDir.clone().multiplyScalar(50)).add(new THREE.Vector3(0, 10, 0)));
                this.controls.update();
            }
        }
    },

    setupEventListeners() {
        const addListener = (id, event, callback) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, callback);
        };

        addListener('btn-play-pause', 'click', () => {
            this.isPlaying = !this.isPlaying;
            const icon = document.getElementById('play-icon');
            if (icon) icon.setAttribute('data-lucide', this.isPlaying ? 'pause' : 'play');
            if (window.lucide && lucide.createIcons) {
                try { lucide.createIcons(); } catch(e){}
            }
        });

        addListener('btn-restart', 'click', () => { this.progressT = 0; });

        addListener('scrubber-slider', 'input', (e) => {
            this.progressT = parseInt(e.target.value) / 1000;
            this.updateTracerPosition();
        });

        addListener('btn-toggle-scrubber', 'click', () => {
            const scrubber = document.getElementById('scrubber-wrapper');
            const icon = document.getElementById('toggle-scrubber-icon');
            if (!scrubber || !icon) return;
            const isCollapsed = scrubber.classList.contains('max-w-0');
            if (isCollapsed) {
                scrubber.classList.remove('max-w-0', 'opacity-0', 'pointer-events-none');
                scrubber.classList.add('max-w-xs', 'opacity-100', 'pointer-events-auto');
                icon.setAttribute('data-lucide', 'chevron-left');
            } else {
                scrubber.classList.add('max-w-0', 'opacity-0', 'pointer-events-none');
                scrubber.classList.remove('max-w-xs', 'opacity-100', 'pointer-events-auto');
                icon.setAttribute('data-lucide', 'sliders-horizontal');
            }
            if (window.lucide && lucide.createIcons) {
                try { lucide.createIcons(); } catch(e){}
            }
        });

        addListener('btn-toggle-perspective', 'click', () => {
            const perspectiveWrapper = document.getElementById('perspective-wrapper');
            const icon = document.getElementById('toggle-perspective-icon');
            if (!perspectiveWrapper || !icon) return;
            const isCollapsed = perspectiveWrapper.classList.contains('max-h-0');
            if (isCollapsed) {
                perspectiveWrapper.classList.remove('max-h-0', 'opacity-0', 'pointer-events-none');
                perspectiveWrapper.classList.add('max-h-96', 'opacity-100', 'pointer-events-auto');
                icon.setAttribute('data-lucide', 'chevron-down');
            } else {
                perspectiveWrapper.classList.add('max-h-0', 'opacity-0', 'pointer-events-none');
                perspectiveWrapper.classList.remove('max-h-96', 'opacity-100', 'pointer-events-auto');
                icon.setAttribute('data-lucide', 'camera');
            }
            if (window.lucide && lucide.createIcons) {
                try { lucide.createIcons(); } catch(e){}
            }
        });

        const camBtns = { 'cam-iso': 'iso', 'cam-follow': 'follow', 'cam-top': 'top', 'cam-free': 'free' };
        Object.keys(camBtns).forEach(btnId => {
            addListener(btnId, 'click', () => this.setCameraMode(camBtns[btnId]));
        });

        addListener('toggle-wall', 'change', (e) => { if (this.heightWallMesh) this.heightWallMesh.visible = e.target.checked; });
        addListener('toggle-grid', 'change', (e) => { if (this.gridHelper) this.gridHelper.visible = e.target.checked; });
        addListener('toggle-nodes', 'change', (e) => { if (this.waypointReticlesGroup) this.waypointReticlesGroup.visible = e.target.checked; });
    },

    onWindowResize() {
        const container = document.getElementById('analyzer-canvas-container');
        if (!container || !this.renderer || !this.camera) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width <= 0 || height <= 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);

        if (this.cameraMode === 'top') {
            this.fitTopDownCamera();
        }
    },

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isPlaying) {
            this.progressT += 0.00007;
            if (this.progressT > 1) this.progressT = 0;
        }

        const duration = 2.8;
        const timeSec = performance.now() * 0.001;
        const cycleProgress = (timeSec % duration) / duration;

        this.pulsingRingsList.forEach(ring => {
            const posAttr = ring.geometry.attributes.position;
            const posArray = posAttr.array;
            const thetaSegments = 32;
            let innerR = 0, outerR = 0;

            if (cycleProgress < 0.75) {
                const p = cycleProgress / 0.75;
                innerR = 6.0 + p * 18.0;
                outerR = innerR + 3.5 * (1.0 - p);
            } else {
                innerR = 0; outerR = 0;
            }

            for (let i = 0; i <= thetaSegments; i++) {
                const theta = (i / thetaSegments) * Math.PI * 2;
                const cos = Math.cos(theta);
                const sin = Math.sin(theta);

                posArray[i * 6] = cos * innerR;
                posArray[i * 6 + 1] = sin * innerR;
                posArray[i * 6 + 2] = 0;
                posArray[i * 6 + 3] = cos * outerR;
                posArray[i * 6 + 4] = sin * outerR;
                posArray[i * 6 + 5] = 0;
            }

            posAttr.needsUpdate = true;
        });

        this.updateTracerPosition();
        this.updateCompass();

        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);

        this.updateHudOverlay();
    }
};

window.TrackAnalyzer = TrackAnalyzer;
