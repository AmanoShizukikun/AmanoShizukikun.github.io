/**
 * 核心功能模組
 * 粒子系統、背景效果、通用工具函數
 */

const Core = {
    /**
     * 初始化粒子系統
     * 簡單直接,不搞花裡胡哨的
     */
    initParticles(container, count = 70) {
        if (!container) return;
        console.debug('Core.initParticles called', { containerExists: !!container, backgroundMode: (this.BackgroundManager && this.BackgroundManager.current) });
        // 如果 BackgroundManager 已經存在且目前樣式不是 'dom'，避免建立粒子（會造成切換時殘留）
        if (this.BackgroundManager && this.BackgroundManager.current && this.BackgroundManager.current !== 'dom') {
            // 同時隱藏粒子容器，確保切換到 canvas 顯示不會看到舊有粒子
            try { container.style.display = 'none'; } catch (e) {}
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 15}s`;
            particle.style.setProperty('--random-x', Math.random());
            fragment.appendChild(particle);
        }
        
        container.appendChild(fragment);
    },

    /**
     * 初始化背景系統
     * 創建網格和粒子效果
     */
    initBackground() {
        // 確保背景基底圖層存在（cyber-bg / grid-overlay）
        if (!document.querySelector('.cyber-bg')) {
            const bg = document.createElement('div');
            bg.className = 'cyber-bg';
            document.body.insertBefore(bg, document.body.firstChild);
        }

        if (!document.querySelector('.grid-overlay')) {
            const grid = document.createElement('div');
            grid.className = 'grid-overlay';
            document.body.insertBefore(grid, document.body.firstChild);
        }

        // 確保粒子容器存在（BackgroundManager 會負責填充或清除）
        let particlesContainer = document.querySelector('.particles');
        if (!particlesContainer) {
            particlesContainer = document.createElement('div');
            particlesContainer.className = 'particles';
            document.body.insertBefore(particlesContainer, document.body.firstChild);
        } else {
            // 清空，交給 BackgroundManager 決定要建立哪些 DOM
            particlesContainer.innerHTML = '';
        }

        // 根據儲存的偏好套用背景樣式
        const style = this.storage.get('backgroundStyle') || 'dom';
        const savedStrength = (typeof this.storage.get('animationStrength') === 'number') ? this.storage.get('animationStrength') : 2;
        // 延後套用以確保 DOM 已經穩定（eg. 在內容載入階段）
        if (!this.BackgroundManager) this._createBackgroundManager();
        // 先將強度套用到 manager，以決定是否啟動 network
        if (typeof this.BackgroundManager.setStrength === 'function') this.BackgroundManager.setStrength(savedStrength);
        // 讀取並套用滑鼠互動設定（預設允許）
        const savedMouseEnabled = this.storage.get('backgroundMouseEnabled');
        if (typeof this.BackgroundManager.setMouseEnabled === 'function') this.BackgroundManager.setMouseEnabled(savedMouseEnabled !== false);
        this.BackgroundManager.apply(style, { container: particlesContainer });
    },

    /**
     * 背景樣式管理器
     * 支援：dom (預設粒子)、network (canvas 連線粒子)、magnet (磁力連線)、off (關閉)
     */
    _createBackgroundManager() {
        // avoid recreating
        if (this.BackgroundManager) return;

        const mgr = {
            current: null,
            rafId: null,
            canvas: null,
            ctx: null,
            particles: [],
            mouse: { x: -10000, y: -10000 },
            connectionDist: 140,
            mouseDist: 300,
            _mouseEnabled: true, // new: 是否允許滑鼠影響背景（可由設定切換）
            dpr: 1,

            apply(style, opts = {}) {
                if (this.current === style) return;
                this.stop();
                this.current = style;

                const container = opts.container || document.querySelector('.particles');

                if (style === 'dom') {
                    if (container) {
                        // 使用 canvas 實作的粒子風暴（更穩定且效能更佳）
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        const baseCount = Math.max(30, Math.floor((w * h) / 10000));
                        const count = (this._strength === 1) ? Math.ceil(baseCount / 2) : baseCount;
                        // 停掉其他 canvas 背景以避免衝突
                        try { this.stopNetwork(); } catch (e) {}
                        try { this.stopMagnet(); } catch (e) {}
                        try { if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}
                        // 隱藏 legacy DOM 粒子容器（保留以便套用樣式或備援）
                        try { container.style.display = 'none'; container.innerHTML = ''; } catch (e) {}
                        // 啟動 canvas-based 的 dom 粒子
                        this.startDomCanvas({ count });
                        // 恢復 gridOverlay 可見性（若先前被隱藏）
                        const grid = document.querySelector('.grid-overlay'); if (grid) grid.style.display = '';
                    }
                } else if (style === 'network') {
                    // 如果強度為 0，則不啟動 network
                    if (this._strength === 0) return;
                    if (container) try { container.style.display = 'none'; } catch (e) {}
                    this.startNetwork(opts);
                } else if (style === 'magnet') {
                    // 磁力連線：如果強度為 0，則不啟動
                    if (this._strength === 0) return;
                    if (container) try { container.style.display = 'none'; } catch (e) {}
                    this.startMagnet(opts);
                } else if (style === 'star') {
                    // 宇宙星圖：canvas-based 深空星空 + 閃爍星 + 流星 + 星雲
                    this.startStar(opts);
                } else if (style === 'bubble') {
                    // 氣泡派對：空心圓環粒子隨機出現、淡入放大、隨機漂移、漸變色、淡出縮小
                    if (container) try { container.style.display = 'none'; } catch (e) {}
                    this.startBubble(opts);
                    // 保留原本的漸層背景與網格線
                    const grid = document.querySelector('.grid-overlay'); if (grid) grid.style.display = '';
                } else if (style === 'circuit') {
                    // 電路脈衝：PCB電路板流光
                    this.startCircuit(opts);
                } else if (style === 'sakura') {
                    // 櫻花飄落：賽博風格櫻花
                    this.startSakura(opts);
                } else if (style === 'glitch') {
                    // 故障雜訊：數位故障效果
                    this.startGlitch(opts);
                } else if (style === 'laser') {
                    // 雷射禁地：交叉雷射光束
                    this.startLaser(opts);
                } else if (style === 'fleet') {
                    // 宇宙戰艦：太空戰艦群穿梭
                    this.startFleet(opts);
                } else if (style === 'off') {
                    // nothing to show
                    if (container) try { container.style.display = 'none'; } catch (e) {}
                }
            },


            startNetwork(opts = {}) {
                // 建立 canvas
                if (!this.canvas) {
                    this.canvas = document.getElementById('bg-network-canvas') || document.createElement('canvas');
                    this.canvas.id = 'bg-network-canvas';
                    this.canvas.style.position = 'fixed';
                    this.canvas.style.inset = '0';
                    this.canvas.style.width = '100%';
                    this.canvas.style.height = '100%';
                    this.canvas.style.display = 'block';
                    this.canvas.style.zIndex = '0';
                    this.canvas.style.pointerEvents = 'none';
                    this.canvas.setAttribute('aria-hidden', 'true');
                    document.body.insertBefore(this.canvas, document.body.firstChild);
                }

                this.ctx = this.canvas.getContext('2d');

                // 讀取 CSS 變數色票，保持與 site 主題一致
                const css = getComputedStyle(document.documentElement || document.body);
                const primaryHex = (css.getPropertyValue('--primary-cyan') || '#00d4ff').trim();
                const secondaryHex = (css.getPropertyValue('--primary-magenta') || '#ff0080').trim();
                const accentHex = (css.getPropertyValue('--accent-purple') || '#8b5cf6').trim();

                function hexToRgb(hex) {
                    hex = (hex || '').replace('#', '').trim();
                    if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
                    const n = parseInt(hex, 16);
                    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
                }

                this._bgColors = {
                    primary: hexToRgb(primaryHex),
                    secondary: hexToRgb(secondaryHex),
                    accent: hexToRgb(accentHex)
                };
                // 粒子顏色池
                const colorPool = [this._bgColors.primary, this._bgColors.secondary, this._bgColors.accent];

                // 產生粒子時隨機分配顏色
                const createParticle = () => {
                    // 調整顏色權重：將主色（primary）提高到約 80%，
                    // 次色與次要色各自降為約 10%（減少次色數量）
                    let color;
                    const roll = Math.random();
                    if (roll < 0.8) color = colorPool[0];
                    else if (roll < 0.9) color = colorPool[1];
                    else color = colorPool[2];
                    return {
                        x: Math.random() * window.innerWidth,
                        y: Math.random() * window.innerHeight,
                        // 降低速度
                        vx: (Math.random() - 0.5) * 0.28,
                        vy: (Math.random() - 0.5) * 0.28,
                        // 再縮小粒子尺寸: 0.4 ~ 1.0
                        size: 0.4 + Math.random() * 0.6,
                        color
                    };
                };

                const resize = () => {
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    // 限制 DPR 上限以減少高 DPI 螢幕的 GPU 負載
                    this.dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
                    this.canvas.width = Math.round(w * this.dpr);
                    this.canvas.height = Math.round(h * this.dpr);
                    this.canvas.style.width = w + 'px';
                    this.canvas.style.height = h + 'px';
                    // scale the drawing context so we can work in CSS pixels
                    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

                    // 計算粒子密度（與 dot.html 保持相容）
                    const count = Math.max(20, Math.floor((w * h) / 10000));
                    if (this.particles.length < count) {
                        for (let i = this.particles.length; i < count; i++) this.particles.push(createParticle());
                    } else if (this.particles.length > count) {
                        this.particles.length = count;
                    }
                };

                // basic event handlers
                this._resizeHandler = Core.debounce(resize, 120);
                this._mouseHandler = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
                window.addEventListener('resize', this._resizeHandler);
                // Only bind mouse move if mouse interactions are enabled
                if (this._mouseEnabled !== false) window.addEventListener('mousemove', this._mouseHandler);

                // 修正：依據目前的強度決定初始速度，不寫死 1
                const s = (typeof this._strength === 'number') ? this._strength : 2;
                this._speedMult = (s === 1) ? 0.45 : 1;

                resize();

                const tick = () => {
                    // do NOT clear with solid fill to allow .cyber-bg to show through
                    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

                    // update particles
                    for (let p of this.particles) {
                        p.x += p.vx * this._speedMult;
                        p.y += p.vy * this._speedMult;

                        if (p.x < -10) p.x = window.innerWidth + 10;
                        if (p.x > window.innerWidth + 10) p.x = -10;
                        if (p.y < -10) p.y = window.innerHeight + 10;
                        if (p.y > window.innerHeight + 10) p.y = -10;

                        // fade and draw (用各自顏色)
                        this.ctx.beginPath();
                        const c = p.color || this._bgColors.primary;
                        this.ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.85)`;
                        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        this.ctx.fill();
                    }

                    // draw connections
                    const conn2 = this.connectionDist * this.connectionDist;
                    this.ctx.lineWidth = 1;
                    for (let i = 0; i < this.particles.length; i++) {
                        const a = this.particles[i];
                        for (let j = i + 1; j < this.particles.length; j++) {
                            const b = this.particles[j];
                            const dx = a.x - b.x;
                            const dy = a.y - b.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < conn2) {
                                const alpha = 1 - Math.sqrt(d2) / this.connectionDist;
                                // 連線顏色：兩端粒子顏色混合
                                const mix = (c1, c2, t) => ({
                                    r: Math.round(c1.r * (1 - t) + c2.r * t),
                                    g: Math.round(c1.g * (1 - t) + c2.g * t),
                                    b: Math.round(c1.b * (1 - t) + c2.b * t)
                                });
                                // 以 a 為起點，b 為終點，t=0.5
                                const rgb = mix(a.color, b.color, 0.5);
                                this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(alpha * 0.42).toFixed(3)})`;
                                this.ctx.beginPath();
                                this.ctx.moveTo(a.x, a.y);
                                this.ctx.lineTo(b.x, b.y);
                                this.ctx.stroke();
                            }
                        }
                    }

                    // mouse interaction (lines to mouse + slight repulsion)
                    if (this.mouse.x > -1000) {
                        const md2 = this.mouseDist * this.mouseDist;
                        for (let p of this.particles) {
                            const dx = p.x - this.mouse.x;
                            const dy = p.y - this.mouse.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < md2) {
                                const alpha = 1 - Math.sqrt(d2) / this.mouseDist;
                                // 滑鼠連線用粒子本身顏色
                                const rgb = p.color || this._bgColors.primary;
                                this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(alpha * 0.22).toFixed(3)})`;
                                this.ctx.beginPath();
                                this.ctx.moveTo(p.x, p.y);
                                this.ctx.lineTo(this.mouse.x, this.mouse.y);
                                this.ctx.stroke();

                                // gentle push
                                p.vx += (dx / Math.max(1, Math.sqrt(d2))) * 0.0005;
                                p.vy += (dy / Math.max(1, Math.sqrt(d2))) * 0.0005;
                            }
                        }
                    }

                    this.rafId = requestAnimationFrame(tick);
                };

                tick();
            },

            startMagnet(opts = {}) {
                // 磁力連線 (mouse attracts particles, stronger connections)
                if (!this.canvas) {
                    this.canvas = document.getElementById('bg-magnet-canvas') || document.createElement('canvas');
                    this.canvas.id = 'bg-magnet-canvas';
                    this.canvas.style.position = 'fixed';
                    this.canvas.style.inset = '0';
                    this.canvas.style.width = '100%';
                    this.canvas.style.height = '100%';
                    this.canvas.style.display = 'block';
                    this.canvas.style.zIndex = '0';
                    this.canvas.style.pointerEvents = 'none';
                    this.canvas.setAttribute('aria-hidden', 'true');
                    document.body.insertBefore(this.canvas, document.body.firstChild);
                }

                this.ctx = this.canvas.getContext('2d');

                const css = getComputedStyle(document.documentElement || document.body);
                const primaryHex = (css.getPropertyValue('--primary-cyan') || '#00d4ff').trim();
                const secondaryHex = (css.getPropertyValue('--primary-magenta') || '#ff0080').trim();
                const accentHex = (css.getPropertyValue('--accent-purple') || '#8b5cf6').trim();

                function hexToRgb(hex) {
                    hex = (hex || '').replace('#', '').trim();
                    if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
                    const n = parseInt(hex, 16);
                    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
                }

                this._bgColors = {
                    primary: hexToRgb(primaryHex),
                    secondary: hexToRgb(secondaryHex),
                    accent: hexToRgb(accentHex)
                };
                const colorPool = [this._bgColors.primary, this._bgColors.secondary, this._bgColors.accent];

                const createParticle = () => {
                    const roll = Math.random();
                    const color = (roll < 0.7) ? colorPool[0] : (roll < 0.9 ? colorPool[1] : colorPool[2]);
                    return {
                        x: Math.random() * window.innerWidth,
                        y: Math.random() * window.innerHeight,
                        vx: (Math.random() - 0.5) * 0.6,
                        vy: (Math.random() - 0.5) * 0.6,
                        size: 0.6 + Math.random() * 1.2,
                        color
                    };
                };

                const resize = () => {
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    // 限制 DPR 上限以減少高 DPI 螢幕的 GPU 負載
                    this.dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
                    this.canvas.width = Math.round(w * this.dpr);
                    this.canvas.height = Math.round(h * this.dpr);
                    this.canvas.style.width = w + 'px';
                    this.canvas.style.height = h + 'px';
                    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

                    const baseCount = Math.max(16, Math.floor((w * h) / 8000));
                    const multiplier = (this._strength === 1) ? 0.6 : 1.2;
                    const count = Math.ceil(baseCount * multiplier);
                    if (this.particles.length < count) {
                        for (let i = this.particles.length; i < count; i++) this.particles.push(createParticle());
                    } else if (this.particles.length > count) {
                        this.particles.length = count;
                    }

                    // parameters depending on strength
                    this._magnetParams = {
                        connectionDist: (this._strength === 1) ? 110 : 180,
                        attractForce: (this._strength === 1) ? 0.02 : 0.06,
                        lineAlpha: (this._strength === 1) ? 0.28 : 0.6
                    };
                };

                this._resizeHandler = Core.debounce(resize, 120);
                this._mouseHandler = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
                window.addEventListener('resize', this._resizeHandler);
                // Only bind mouse move if mouse interactions are enabled
                if (this._mouseEnabled !== false) window.addEventListener('mousemove', this._mouseHandler);

                this._speedMult = (typeof this._strength === 'number') ? ((this._strength === 1) ? 0.45 : 1) : 1;

                resize();

                const tickMagnet = () => {
                    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

                    // update particles with attraction to mouse
                    for (let p of this.particles) {
                        // attraction to mouse
                        if (this.mouse.x > -1000) {
                            const dxm = this.mouse.x - p.x;
                            const dym = this.mouse.y - p.y;
                            const d2m = dxm * dxm + dym * dym;
                            const md2 = this.mouseDist * this.mouseDist;
                            if (d2m < md2) {
                                const d = Math.sqrt(d2m) || 1;
                                const alpha = 1 - d / this.mouseDist;
                                const f = this._magnetParams.attractForce * alpha * this._speedMult;
                                p.vx += (dxm / d) * f;
                                p.vy += (dym / d) * f;
                            }
                        }

                        p.x += p.vx * this._speedMult;
                        p.y += p.vy * this._speedMult;

                        // wrap edges
                        if (p.x < -10) p.x = window.innerWidth + 10;
                        if (p.x > window.innerWidth + 10) p.x = -10;
                        if (p.y < -10) p.y = window.innerHeight + 10;
                        if (p.y > window.innerHeight + 10) p.y = -10;

                        // friction
                        p.vx *= 0.995;
                        p.vy *= 0.995;

                        // draw particle
                        this.ctx.beginPath();
                        const c = p.color || this._bgColors.primary;
                        this.ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.95)`;
                        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        this.ctx.fill();
                    }

                    // draw stronger connections
                    const conn2 = this._magnetParams.connectionDist * this._magnetParams.connectionDist;
                    this.ctx.lineWidth = (this._strength === 1) ? 1 : 1.5;
                    for (let i = 0; i < this.particles.length; i++) {
                        const a = this.particles[i];
                        for (let j = i + 1; j < this.particles.length; j++) {
                            const b = this.particles[j];
                            const dx = a.x - b.x;
                            const dy = a.y - b.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < conn2) {
                                const alpha = 1 - Math.sqrt(d2) / this._magnetParams.connectionDist;
                                const mix = (c1, c2, t) => ({
                                    r: Math.round(c1.r * (1 - t) + c2.r * t),
                                    g: Math.round(c1.g * (1 - t) + c2.g * t),
                                    b: Math.round(c1.b * (1 - t) + c2.b * t)
                                });
                                const rgb = mix(a.color, b.color, 0.5);
                                this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(alpha * this._magnetParams.lineAlpha).toFixed(3)})`;
                                this.ctx.beginPath();
                                this.ctx.moveTo(a.x, a.y);
                                this.ctx.lineTo(b.x, b.y);
                                this.ctx.stroke();
                            }
                        }
                    }

                    // connections to mouse (if present)
                    if (this.mouse.x > -1000) {
                        const md2 = this.mouseDist * this.mouseDist;
                        for (let p of this.particles) {
                            const dx = p.x - this.mouse.x;
                            const dy = p.y - this.mouse.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < md2) {
                                const alpha = 1 - Math.sqrt(d2) / this.mouseDist;
                                const rgb = p.color || this._bgColors.primary;
                                this.ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(alpha * (this._magnetParams.lineAlpha * 0.9)).toFixed(3)})`;
                                this.ctx.beginPath();
                                this.ctx.moveTo(p.x, p.y);
                                this.ctx.lineTo(this.mouse.x, this.mouse.y);
                                this.ctx.stroke();
                            }
                        }
                    }

                    this.rafId = requestAnimationFrame(tickMagnet);
                };

                tickMagnet();
            },
            startDomCanvas(opts = {}) {
                // canvas-based DOM 粒子風暴 - 以 canvas 渲染提升效能並避免被 stacking context 隱藏
                try {
                    // Ensure previous dom canvas resources are fully stopped before creating a new one
                    if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas();
                    if (!this.domCanvas) {
                        this.domCanvas = document.getElementById('bg-dom-canvas') || document.createElement('canvas');
                        this.domCanvas.id = 'bg-dom-canvas';
                        this.domCanvas.style.position = 'fixed';
                        this.domCanvas.style.inset = '0';
                        this.domCanvas.style.width = '100%';
                        this.domCanvas.style.height = '100%';
                        this.domCanvas.style.display = 'block';
                        this.domCanvas.style.zIndex = '-7';
                        this.domCanvas.style.pointerEvents = 'none';
                        this.domCanvas.setAttribute('aria-hidden', 'true');
                        document.body.insertBefore(this.domCanvas, document.body.firstChild);
                    }
                    this.domCtx = this.domCanvas.getContext('2d');

                    // Performance and sprite setup
                    // Cap devicePixelRatio to limit GPU pixel load on high-DPI screens
                    this.domDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));

                    const css = getComputedStyle(document.documentElement || document.body);
                    const primaryHex = (css.getPropertyValue('--primary-cyan') || '#00d4ff').trim();
                    const secondaryHex = (css.getPropertyValue('--primary-magenta') || '#ff0080').trim();
                    const accentHex = (css.getPropertyValue('--accent-purple') || '#8b5cf6').trim();

                    // create small reusable sprite canvases (primary / secondary / accent)
                    const createSprite = (r,g,b, size = 64) => {
                        const sc = document.createElement('canvas');
                        sc.width = size; sc.height = size;
                        const sctx = sc.getContext('2d');
                        const grad = sctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
                        grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
                        grad.addColorStop(0.2, `rgba(${r},${g},${b},0.7)`);
                        grad.addColorStop(0.5, `rgba(${r},${g},${b},0.25)`);
                        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
                        sctx.fillStyle = grad;
                        sctx.fillRect(0,0,size,size);
                        return sc;
                    };

                    function hexToRgb(hex) {
                        hex = (hex || '').replace('#', '').trim();
                        if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
                        const n = parseInt(hex, 16);
                        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
                    }

                    this._domColors = {
                        primary: hexToRgb(primaryHex),
                        secondary: hexToRgb(secondaryHex),
                        accent: hexToRgb(accentHex)
                    };

                    // build sprites
                    this.domSpritePrimary = createSprite(this._domColors.primary.r, this._domColors.primary.g, this._domColors.primary.b);
                    this.domSpriteSecondary = createSprite(this._domColors.secondary.r, this._domColors.secondary.g, this._domColors.secondary.b);
                    this.domSpriteAccent = createSprite(this._domColors.accent.r, this._domColors.accent.g, this._domColors.accent.b);

                    // performance tracking
                    this.domPerfAvg = this.domPerfAvg || 0;
                    this.domPerfAlpha = 0.06;
                    this.domDesiredCount = opts.count || Math.max(30, Math.floor((window.innerWidth * window.innerHeight) / 10000));
                    this.domFrameCounter = 0;
                    this.domSkipFrames = 0;

                    // visibility handler to pause rendering when tab is hidden
                    this._domVisibilityHandler = () => {
                        if (document.hidden) {
                            if (this.domRaf) { cancelAnimationFrame(this.domRaf); this.domRaf = null; }
                        } else {
                            if (!this.domRaf) loop();
                        }
                    };
                    document.addEventListener('visibilitychange', this._domVisibilityHandler);

                    const createParticle = () => {
                        const roll = Math.random();
                        const colorName = (roll < 0.8) ? 'primary' : (roll < 0.95 ? 'secondary' : 'accent');
                        const color = this._domColors[colorName];
                        const w = window.innerWidth; const h = window.innerHeight;
                        // 更小的尺寸：0.4 ~ 1.6
                        const size = 0.4 + Math.random() * 1.2;
                        // upward base velocity (negative = upward)
                        const baseVy = - (0.16 + Math.random() * 0.7);
                        return {
                            x: Math.random() * w,
                            // 更傾向從畫面下半部或畫面外底部產生，形成自然上飄效果
                            y: (Math.random() < 0.6) ? (h * Math.random()) : (h + Math.random() * 200),
                            vx: (Math.random() - 0.5) * 0.25,
                            baseVy,
                            vy: baseVy,
                            size,
                            color,
                            colorName,
                            // 微調 alpha 範圍以減弱強烈光暈
                            alpha: 0.35 + Math.random() * 0.45,
                            // sway parameters for smooth horizontal oscillation (subtler)
                            swayPhase: Math.random() * Math.PI * 2,
                            swayFreq: 0.6 + Math.random() * 1.4,
                            swayAmp: 4 + Math.random() * 8
                        };
                    }; 

                    const resize = () => {
                        const w = window.innerWidth;
                        const h = window.innerHeight;
                        // 與初始化一致：限制 DPR 上限以減少高 DPI 螢幕的 GPU 負載
                        this.domDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
                        this.domCanvas.width = Math.round(w * this.domDpr);
                        this.domCanvas.height = Math.round(h * this.domDpr);
                        this.domCanvas.style.width = w + 'px';
                        this.domCanvas.style.height = h + 'px';
                        this.domCtx.setTransform(this.domDpr, 0, 0, this.domDpr, 0, 0);

                        const desired = opts.count || Math.max(30, Math.floor((w * h) / 10000));
                        if (!this.domParticles) this.domParticles = [];
                        if (this.domParticles.length < desired) {
                            for (let i = this.domParticles.length; i < desired; i++) this.domParticles.push(createParticle());
                        } else if (this.domParticles.length > desired) {
                            this.domParticles.length = desired;
                        }
                    };

                    this._domResize = Core.debounce(resize, 120);
                    this._domMouse = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };

                    window.addEventListener('resize', this._domResize);
                    if (this._mouseEnabled) window.addEventListener('mousemove', this._domMouse);

                    const loop = () => {
                        const start = performance.now();
                        try {
                            const ctx = this.domCtx;
                            const w = this.domCanvas.width / this.domDpr;
                            const h = this.domCanvas.height / this.domDpr;
                            // full clear
                            ctx.clearRect(0, 0, w, h);
                            ctx.globalCompositeOperation = 'lighter';

                            // decide if we should skip drawing this frame (light update only)
                            this.domFrameCounter = (this.domFrameCounter || 0) + 1;
                            const shouldSkip = this.domSkipFrames && (this.domFrameCounter % (this.domSkipFrames + 1) !== 0);

                            const t2 = performance.now() / 1000;
                            const spP = this.domSpritePrimary, spS = this.domSpriteSecondary, spA = this.domSpriteAccent;

                            if (shouldSkip) {
                                // light update: update positions only
                                this.domParticles.forEach(p => {
                                    const sway2 = Math.sin(t2 * p.swayFreq + p.swayPhase) * p.swayAmp;
                                    p.x += (p.vx + sway2 * 0.006);
                                    p.vy = p.baseVy * (1 + Math.sin(t2 * (p.swayFreq * 0.35 + 0.2) + p.swayPhase) * 0.08);
                                    p.y += p.vy;
                                    if (p.x < -20) p.x = w + 20;
                                    if (p.x > w + 20) p.x = -20;
                                    if (p.y < -30) {
                                        p.x = Math.random() * w;
                                        p.y = h + (10 + Math.random() * 200);
                                    }
                                });
                            } else {
                                // full update + draw using sprites (much cheaper than per-particle shadows)
                                this.domParticles.forEach(p => {
                                    const sway2 = Math.sin(t2 * p.swayFreq + p.swayPhase) * p.swayAmp;
                                    p.x += (p.vx + sway2 * 0.006);
                                    p.vy = p.baseVy * (1 + Math.sin(t2 * (p.swayFreq * 0.35 + 0.2) + p.swayPhase) * 0.08);
                                    p.y += p.vy;
                                    if (p.x < -20) p.x = w + 20;
                                    if (p.x > w + 20) p.x = -20;
                                    if (p.y < -30) {
                                        p.x = Math.random() * w;
                                        p.y = h + (10 + Math.random() * 200);
                                        p.baseVy = - (0.16 + Math.random() * 0.7);
                                        p.size = 0.4 + Math.random() * 1.6;
                                        p.alpha = 0.35 + Math.random() * 0.45;
                                        p.swayPhase = Math.random() * Math.PI * 2;
                                        p.swayFreq = 0.6 + Math.random() * 1.4;
                                        p.swayAmp = 4 + Math.random() * 8;
                                    }

                                    let sprite = spP;
                                    if (p.colorName === 'secondary') sprite = spS;
                                    else if (p.colorName === 'accent') sprite = spA;

                                    ctx.globalAlpha = p.alpha;
                                    const drawSize = Math.max(2, p.size * 6);
                                    ctx.drawImage(sprite, p.x - drawSize / 2, p.y - drawSize / 2, drawSize, drawSize);
                                    ctx.globalAlpha = 1;
                                });
                            }

                            // adaptive performance control
                            const frameTime = performance.now() - start;
                            this.domPerfAvg = this.domPerfAvg * (1 - this.domPerfAlpha) + frameTime * this.domPerfAlpha;
                            if (this.domPerfAvg > 30 && this.domParticles && this.domParticles.length > Math.max(10, Math.floor(this.domDesiredCount * 0.4))) {
                                const reduce = Math.max(1, Math.ceil(this.domParticles.length * 0.1));
                                this.domParticles.length = Math.max(Math.floor(this.domParticles.length - reduce), Math.max(10, Math.floor(this.domDesiredCount * 0.4)));
                                this.domSkipFrames = Math.min(4, (this.domSkipFrames || 0) + 1);
                            } else if (this.domPerfAvg < 18 && this.domParticles && this.domParticles.length < this.domDesiredCount) {
                                const add = Math.max(1, Math.ceil((this.domDesiredCount - this.domParticles.length) * 0.08));
                                for (let i = 0; i < add; i++) this.domParticles.push(createParticle());
                                this.domSkipFrames = Math.max(0, (this.domSkipFrames || 0) - 1);
                            }

                            // 重置合成模式，避免狀態洩漏到其他繪製操作
                            ctx.globalCompositeOperation = 'source-over';
                        } catch (e) {
                            console.warn('dom particle loop error', e);
                        }
                        this.domRaf = requestAnimationFrame(loop);
                    };

                    resize();
                    loop();
                } catch (e) {
                    console.warn('startDomCanvas error', e);
                }
            },

            stopDomCanvas() {
                if (this.domRaf) { cancelAnimationFrame(this.domRaf); this.domRaf = null; }
                window.removeEventListener('resize', this._domResize);
                // 無論目前 _mouseEnabled 狀態如何，都移除監聽器以避免洩漏
                try { window.removeEventListener('mousemove', this._domMouse); } catch (e) {}
                if (this._domVisibilityHandler) document.removeEventListener('visibilitychange', this._domVisibilityHandler);
                if (this.domCanvas) { try { this.domCanvas.remove(); } catch (e) {} this.domCanvas = null; this.domCtx = null; }
                // remove sprite caches
                this.domSpritePrimary = null; this.domSpriteSecondary = null; this.domSpriteAccent = null;
                this.domParticles = [];
            },
            startStar(opts = {}) {
                // === 超酷宇宙星圖 v2 ===
                // 多層視差星場 + 呼吸星雲 + 星座連線 + 能量脈衝 + 戲劇化流星 + 滑鼠視差
                // 保留 cyber-bg 漸層 & grid-overlay 網格（canvas 以透明 + lighter 混合疊加）
                if (this._starActive) return;

                // 防禦性停止其他 canvas 動畫
                try { this.stopNetwork(); } catch (e) {}
                try { this.stopMagnet(); } catch (e) {}
                try { if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas(); } catch (e) {}
                try { if (typeof this.stopBubble === 'function') this.stopBubble(); } catch (e) {}

                // 隱藏 DOM 粒子容器（避免與 canvas 衝突）
                const particles = document.querySelector('.particles');
                this._prevParticlesDisplay = particles ? particles.style.display : null;
                if (particles) particles.style.display = 'none';

                // ★ 保留 grid-overlay & cyber-bg — 不再隱藏

                // 建立 canvas
                if (!this.starCanvas) {
                    this.starCanvas = document.createElement('canvas');
                    this.starCanvas.id = 'bg-star-canvas';
                    this.starCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:-7;pointer-events:none;';
                    this.starCanvas.setAttribute('aria-hidden', 'true');
                    document.body.insertBefore(this.starCanvas, document.body.firstChild);
                }
                this.starCtx = this.starCanvas.getContext('2d');
                this.starDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));

                // ═══════════════════════════════════════
                // 色彩方案 — 與網站青/洋紅/紫主題一致
                // ═══════════════════════════════════════
                const starColors = [
                    { r: 220, g: 235, b: 255 },  // 冰藍白
                    { r: 255, g: 245, b: 240 },  // 暖白
                    { r: 160, g: 200, b: 255 },  // 天青
                    { r: 0, g: 212, b: 255 },    // 青 (primary-cyan)
                    { r: 255, g: 0, b: 128 },    // 洋紅 (primary-magenta)
                    { r: 139, g: 92, b: 246 },   // 紫 (accent-purple)
                    { r: 255, g: 180, b: 220 },  // 淡粉
                    { r: 100, g: 160, b: 255 },  // 電藍
                    { r: 0, g: 255, b: 200 },    // 青綠
                    { r: 255, g: 120, b: 60 },   // 琥珀（稀有暖星）
                ];

                // 星雲色彩 — 更鮮豔
                const nebulaColors = [
                    { r: 0, g: 80, b: 160, a: 0.06 },    // 深藍
                    { r: 120, g: 0, b: 160, a: 0.05 },   // 紫
                    { r: 0, g: 140, b: 130, a: 0.04 },   // 青
                    { r: 180, g: 0, b: 80, a: 0.045 },   // 洋紅
                    { r: 60, g: 0, b: 200, a: 0.035 },   // 靛藍
                    { r: 0, g: 200, b: 180, a: 0.03 },   // 螢光青
                ];

                // ═══════════════════════════════════════
                // 粒子工廠
                // ═══════════════════════════════════════

                // 3 層視差星星（深/中/淺）
                const LAYERS = [
                    { speed: 0.2, sizeMin: 0.2, sizeMax: 0.6, alphaMin: 0.1, alphaMax: 0.35, brightChance: 0.02 },
                    { speed: 0.6, sizeMin: 0.4, sizeMax: 1.2, alphaMin: 0.2, alphaMax: 0.55, brightChance: 0.08 },
                    { speed: 1.0, sizeMin: 0.8, sizeMax: 2.4, alphaMin: 0.5, alphaMax: 1.0, brightChance: 0.18 },
                ];

                const createStar = (w, h, layerIdx) => {
                    const L = LAYERS[layerIdx];
                    const color = starColors[Math.floor(Math.random() * starColors.length)];
                    const isBright = Math.random() < L.brightChance;
                    const size = isBright
                        ? (L.sizeMax + Math.random() * 1.5)
                        : (L.sizeMin + Math.random() * (L.sizeMax - L.sizeMin));
                    return {
                        x: Math.random() * w,
                        y: Math.random() * h,
                        size,
                        baseAlpha: isBright
                            ? (0.7 + Math.random() * 0.3)
                            : (L.alphaMin + Math.random() * (L.alphaMax - L.alphaMin)),
                        alpha: 0,
                        color,
                        twinkleSpeed: 0.2 + Math.random() * 2.5,
                        twinklePhase: Math.random() * Math.PI * 2,
                        isBright,
                        layer: layerIdx,
                        layerSpeed: L.speed,
                        vx: (Math.random() - 0.5) * 0.02 * L.speed,
                        vy: (Math.random() - 0.5) * 0.015 * L.speed,
                    };
                };

                // 流星 — 更戲劇化
                const createShootingStar = (w, h) => {
                    const edge = Math.random();
                    let x, y, angle;
                    if (edge < 0.4) {
                        x = Math.random() * w * 1.3 - w * 0.15;
                        y = -20;
                        angle = Math.PI * (0.12 + Math.random() * 0.4);
                    } else if (edge < 0.8) {
                        x = w + 20;
                        y = Math.random() * h * 0.5;
                        angle = Math.PI * (0.55 + Math.random() * 0.3);
                    } else {
                        x = -20;
                        y = Math.random() * h * 0.3;
                        angle = Math.PI * (0.05 + Math.random() * 0.2);
                    }
                    const speed = 6 + Math.random() * 12;
                    const ci = Math.floor(Math.random() * 4);
                    const color = starColors[ci];
                    return {
                        x, y, angle, speed,
                        length: 60 + Math.random() * 120,
                        life: 0,
                        maxLife: 50 + Math.random() * 80,
                        alpha: 0.7 + Math.random() * 0.3,
                        thickness: 1.2 + Math.random() * 2,
                        color,
                        active: true,
                        sparks: [],
                        sparkTimer: 0,
                    };
                };

                // 能量脈衝環
                const createPulseRing = (w, h) => {
                    const ci = Math.floor(Math.random() * 6);
                    const c = [starColors[3], starColors[4], starColors[5], starColors[8], starColors[2], starColors[7]][ci];
                    return {
                        x: Math.random() * w,
                        y: Math.random() * h,
                        radius: 0,
                        maxRadius: 80 + Math.random() * 200,
                        speed: 0.6 + Math.random() * 1.5,
                        alpha: 0.15 + Math.random() * 0.2,
                        color: c,
                        life: 0,
                        active: true,
                    };
                };

                // ═══════════════════════════════════════
                // Sprite 預繪快取
                // ═══════════════════════════════════════
                const createStarSprite = (radius, color, glow) => {
                    const s = Math.ceil(radius * 8);
                    const sc = document.createElement('canvas');
                    sc.width = s; sc.height = s;
                    const sctx = sc.getContext('2d');
                    const cx = s / 2, cy = s / 2;
                    if (glow) {
                        const grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, s / 2);
                        grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},1)`);
                        grad.addColorStop(0.08, `rgba(${color.r},${color.g},${color.b},0.85)`);
                        grad.addColorStop(0.25, `rgba(${color.r},${color.g},${color.b},0.35)`);
                        grad.addColorStop(0.5, `rgba(${color.r},${color.g},${color.b},0.08)`);
                        grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
                        sctx.fillStyle = grad;
                        sctx.fillRect(0, 0, s, s);
                    } else {
                        const grad = sctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
                        grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},1)`);
                        grad.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},0.5)`);
                        grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
                        sctx.fillStyle = grad;
                        sctx.beginPath();
                        sctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
                        sctx.fill();
                    }
                    return sc;
                };

                this._starSprites = {};
                starColors.forEach((c, i) => {
                    this._starSprites['dot_' + i] = createStarSprite(2, c, false);
                    this._starSprites['glow_' + i] = createStarSprite(8, c, true);
                });

                // 星雲 sprites — 更大、更鮮豔、會呼吸
                const createNebulaSprite = (size) => {
                    const nc = document.createElement('canvas');
                    nc.width = size; nc.height = size;
                    const nctx = nc.getContext('2d');
                    const blobs = 4 + Math.floor(Math.random() * 4);
                    for (let i = 0; i < blobs; i++) {
                        const cx = size * (0.2 + Math.random() * 0.6);
                        const cy = size * (0.2 + Math.random() * 0.6);
                        const r = size * (0.15 + Math.random() * 0.35);
                        const nc2 = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
                        const grad = nctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                        grad.addColorStop(0, `rgba(${nc2.r},${nc2.g},${nc2.b},${nc2.a * 2})`);
                        grad.addColorStop(0.3, `rgba(${nc2.r},${nc2.g},${nc2.b},${nc2.a * 1.2})`);
                        grad.addColorStop(0.6, `rgba(${nc2.r},${nc2.g},${nc2.b},${nc2.a * 0.4})`);
                        grad.addColorStop(1, `rgba(${nc2.r},${nc2.g},${nc2.b},0)`);
                        nctx.fillStyle = grad;
                        nctx.fillRect(0, 0, size, size);
                    }
                    return nc;
                };

                this._nebulaSprites = [];
                const nebulaCount = 4 + Math.floor(Math.random() * 3);
                for (let i = 0; i < nebulaCount; i++) {
                    const size = 300 + Math.random() * 500;
                    this._nebulaSprites.push({
                        sprite: createNebulaSprite(Math.round(size)),
                        x: Math.random(),
                        y: Math.random(),
                        size,
                        breathSpeed: 0.15 + Math.random() * 0.3,
                        breathPhase: Math.random() * Math.PI * 2,
                        driftVx: (Math.random() - 0.5) * 0.003,
                        driftVy: (Math.random() - 0.5) * 0.002,
                    });
                }

                // ═══════════════════════════════════════
                // 滑鼠視差追蹤
                // ═══════════════════════════════════════
                this._starMouse = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 };
                this._starMouseHandler = (e) => {
                    this._starMouse.targetX = e.clientX / window.innerWidth;
                    this._starMouse.targetY = e.clientY / window.innerHeight;
                };
                if (this._mouseEnabled !== false) {
                    window.addEventListener('mousemove', this._starMouseHandler);
                }

                // ═══════════════════════════════════════
                // 初始化 resize
                // ═══════════════════════════════════════
                const resize = () => {
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    this.starDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
                    this.starCanvas.width = Math.round(w * this.starDpr);
                    this.starCanvas.height = Math.round(h * this.starDpr);
                    this.starCanvas.style.width = w + 'px';
                    this.starCanvas.style.height = h + 'px';
                    this.starCtx.setTransform(this.starDpr, 0, 0, this.starDpr, 0, 0);

                    // 每層星星數量
                    const area = w * h;
                    const layerCounts = [
                        Math.min(300, Math.max(40, Math.floor(area / 5000))),   // 深層：多而暗
                        Math.min(200, Math.max(30, Math.floor(area / 8000))),   // 中層
                        Math.min(100, Math.max(15, Math.floor(area / 15000))),  // 近層：少而亮
                    ];

                    if (!this.starLayers) this.starLayers = [[], [], []];
                    for (let li = 0; li < 3; li++) {
                        const desired = layerCounts[li];
                        while (this.starLayers[li].length < desired) this.starLayers[li].push(createStar(w, h, li));
                        if (this.starLayers[li].length > desired) this.starLayers[li].length = desired;
                        this.starLayers[li].forEach(s => {
                            if (s.x > w) s.x = Math.random() * w;
                            if (s.y > h) s.y = Math.random() * h;
                        });
                    }
                };

                this._starResize = Core.debounce(resize, 120);
                window.addEventListener('resize', this._starResize);

                // 流星、脈衝環
                this.shootingStars = [];
                this._starShootTimer = 0;
                this.pulseRings = [];
                this._pulseTimer = 0;
                this._starSpeedMult = (this._strength === 0) ? 0 : (this._strength === 1) ? 0.4 : 1;

                // 可見性處理
                this._starVisibility = () => {
                    if (document.hidden) {
                        if (this.starRaf) { cancelAnimationFrame(this.starRaf); this.starRaf = null; }
                    } else {
                        if (!this.starRaf && this._starActive) starTick();
                    }
                };
                document.addEventListener('visibilitychange', this._starVisibility);

                resize();

                // ═══════════════════════════════════════
                // 主渲染循環
                // ═══════════════════════════════════════
                const self = this;

                const starTick = () => {
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const ctx = self.starCtx;
                    const t = performance.now() / 1000;
                    const spd = self._starSpeedMult;

                    // 透明清除 — 讓 cyber-bg 漸層 + grid-overlay 透出
                    ctx.clearRect(0, 0, w, h);

                    // 使用 lighter 混合模式 — 星光疊加在背景上閃耀
                    ctx.globalCompositeOperation = 'lighter';

                    // 平滑滑鼠追蹤
                    const mx = self._starMouse;
                    mx.x += (mx.targetX - mx.x) * 0.03;
                    mx.y += (mx.targetY - mx.y) * 0.03;
                    const parallaxX = (mx.x - 0.5);
                    const parallaxY = (mx.y - 0.5);

                    // ─── 繪製星雲（呼吸動畫 + 緩慢漂移）───
                    if (self._nebulaSprites) {
                        self._nebulaSprites.forEach(n => {
                            const breathScale = 1 + Math.sin(t * n.breathSpeed + n.breathPhase) * 0.08;
                            const breathAlpha = 0.6 + Math.sin(t * n.breathSpeed * 0.7 + n.breathPhase) * 0.3;
                            if (spd > 0) {
                                n.x += n.driftVx * spd * 0.016;
                                n.y += n.driftVy * spd * 0.016;
                                if (n.x < -0.3) n.x = 1.3;
                                if (n.x > 1.3) n.x = -0.3;
                                if (n.y < -0.3) n.y = 1.3;
                                if (n.y > 1.3) n.y = -0.3;
                            }
                            const drawSize = n.size * breathScale;
                            const px = n.x * w - drawSize / 2 + parallaxX * 8;
                            const py = n.y * h - drawSize / 2 + parallaxY * 8;
                            ctx.globalAlpha = breathAlpha;
                            ctx.drawImage(n.sprite, px, py, drawSize, drawSize);
                        });
                    }

                    // ─── 繪製 3 層視差星場 ───
                    const allBrightStars = [];
                    for (let li = 0; li < 3; li++) {
                        const layer = self.starLayers[li];
                        if (!layer) continue;
                        const pOffsetX = parallaxX * (li === 0 ? 4 : li === 1 ? 15 : 35);
                        const pOffsetY = parallaxY * (li === 0 ? 3 : li === 1 ? 10 : 25);

                        for (let i = 0; i < layer.length; i++) {
                            const s = layer[i];

                            // 閃爍
                            const twinkle = Math.sin(t * s.twinkleSpeed + s.twinklePhase);
                            const flickerRange = s.isBright ? 0.4 : 0.2;
                            s.alpha = s.baseAlpha + twinkle * flickerRange;
                            s.alpha = Math.max(0.03, Math.min(1, s.alpha));

                            // 漂移
                            if (spd > 0) {
                                s.x += s.vx * spd;
                                s.y += s.vy * spd;
                                if (s.x < -10) s.x = w + 10;
                                if (s.x > w + 10) s.x = -10;
                                if (s.y < -10) s.y = h + 10;
                                if (s.y > h + 10) s.y = -10;
                            }

                            const drawX = s.x + pOffsetX;
                            const drawY = s.y + pOffsetY;

                            ctx.globalAlpha = s.alpha;
                            const ci = starColors.indexOf(s.color);
                            const key = ci >= 0 ? ci : 0;

                            if (s.isBright) {
                                const sprite = self._starSprites['glow_' + key];
                                if (sprite) {
                                    const ds = s.size * 7;
                                    ctx.drawImage(sprite, drawX - ds / 2, drawY - ds / 2, ds, ds);
                                }
                                // 十字星芒 — 旋轉動畫
                                if (s.size > 1.8) {
                                    const armLen = s.size * 5;
                                    const rot = t * 0.15 + s.twinklePhase;
                                    ctx.save();
                                    ctx.translate(drawX, drawY);
                                    ctx.rotate(rot);
                                    ctx.strokeStyle = `rgba(${s.color.r},${s.color.g},${s.color.b},${(s.alpha * 0.35).toFixed(3)})`;
                                    ctx.lineWidth = 0.6;
                                    ctx.beginPath();
                                    ctx.moveTo(-armLen, 0);
                                    ctx.lineTo(armLen, 0);
                                    ctx.moveTo(0, -armLen);
                                    ctx.lineTo(0, armLen);
                                    const armLen2 = armLen * 0.5;
                                    ctx.moveTo(-armLen2, -armLen2);
                                    ctx.lineTo(armLen2, armLen2);
                                    ctx.moveTo(armLen2, -armLen2);
                                    ctx.lineTo(-armLen2, armLen2);
                                    ctx.stroke();
                                    ctx.restore();
                                }
                                if (li >= 1) allBrightStars.push({ x: drawX, y: drawY, color: s.color, alpha: s.alpha });
                            } else {
                                const sprite = self._starSprites['dot_' + key];
                                if (sprite) {
                                    const ds = Math.max(1.5, s.size * 2.5);
                                    ctx.drawImage(sprite, drawX - ds / 2, drawY - ds / 2, ds, ds);
                                }
                            }
                        }
                    }

                    // ─── 星座連線（亮星之間的脈衝連線）───
                    if (allBrightStars.length > 1) {
                        const maxConnDist = 200;
                        const maxConnDist2 = maxConnDist * maxConnDist;
                        ctx.lineWidth = 0.6;
                        for (let i = 0; i < allBrightStars.length; i++) {
                            let connections = 0;
                            const a = allBrightStars[i];
                            for (let j = i + 1; j < allBrightStars.length && connections < 2; j++) {
                                const b = allBrightStars[j];
                                const dx = a.x - b.x;
                                const dy = a.y - b.y;
                                const d2 = dx * dx + dy * dy;
                                if (d2 < maxConnDist2) {
                                    const dist = Math.sqrt(d2);
                                    const distAlpha = 1 - dist / maxConnDist;
                                    const pulse = 0.5 + Math.sin(t * 1.5 + i * 0.7 + j * 0.3) * 0.5;
                                    const lineAlpha = distAlpha * pulse * Math.min(a.alpha, b.alpha) * 0.25;
                                    if (lineAlpha < 0.01) continue;
                                    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                                    grad.addColorStop(0, `rgba(${a.color.r},${a.color.g},${a.color.b},${lineAlpha.toFixed(3)})`);
                                    grad.addColorStop(1, `rgba(${b.color.r},${b.color.g},${b.color.b},${lineAlpha.toFixed(3)})`);
                                    ctx.strokeStyle = grad;
                                    ctx.beginPath();
                                    ctx.moveTo(a.x, a.y);
                                    ctx.lineTo(b.x, b.y);
                                    ctx.stroke();
                                    connections++;
                                }
                            }
                        }
                    }

                    // ─── 能量脈衝環 ───
                    if (spd > 0) {
                        self._pulseTimer += spd;
                        if (self._pulseTimer > 300 + Math.random() * 400) {
                            self._pulseTimer = 0;
                            if (self.pulseRings.length < 3) {
                                self.pulseRings.push(createPulseRing(w, h));
                            }
                        }
                    }
                    for (let i = self.pulseRings.length - 1; i >= 0; i--) {
                        const ring = self.pulseRings[i];
                        if (!ring.active) { self.pulseRings.splice(i, 1); continue; }
                        ring.radius += ring.speed * spd;
                        if (ring.radius >= ring.maxRadius) { ring.active = false; continue; }
                        const progress = ring.radius / ring.maxRadius;
                        const ringAlpha = ring.alpha * (1 - progress) * (1 - progress);
                        if (ringAlpha < 0.005) { ring.active = false; continue; }
                        ctx.globalAlpha = ringAlpha;
                        ctx.strokeStyle = `rgba(${ring.color.r},${ring.color.g},${ring.color.b},1)`;
                        ctx.lineWidth = 1.5 * (1 - progress * 0.5);
                        ctx.beginPath();
                        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
                        ctx.stroke();
                        if (progress < 0.4) {
                            const innerGrad = ctx.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, ring.radius);
                            innerGrad.addColorStop(0, `rgba(${ring.color.r},${ring.color.g},${ring.color.b},${(ringAlpha * 0.3).toFixed(3)})`);
                            innerGrad.addColorStop(1, `rgba(${ring.color.r},${ring.color.g},${ring.color.b},0)`);
                            ctx.fillStyle = innerGrad;
                            ctx.beginPath();
                            ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }

                    // ─── 流星 + 火花尾跡 ───
                    if (spd > 0) {
                        self._starShootTimer += spd;
                        if (self._starShootTimer > 120 + Math.random() * 200) {
                            self._starShootTimer = 0;
                            if (self.shootingStars.length < 4) {
                                self.shootingStars.push(createShootingStar(w, h));
                            }
                        }
                    }

                    for (let i = self.shootingStars.length - 1; i >= 0; i--) {
                        const m = self.shootingStars[i];
                        if (!m.active) { self.shootingStars.splice(i, 1); continue; }
                        m.life += spd;
                        if (m.life >= m.maxLife) { m.active = false; continue; }
                        const progress = m.life / m.maxLife;
                        const fadeAlpha = progress < 0.1 ? (progress / 0.1) : (progress > 0.65 ? (1 - (progress - 0.65) / 0.35) : 1);
                        const ma = m.alpha * fadeAlpha;

                        const mvx = Math.cos(m.angle) * m.speed * spd;
                        const mvy = Math.sin(m.angle) * m.speed * spd;
                        m.x += mvx;
                        m.y += mvy;

                        // 產生火花
                        m.sparkTimer += spd;
                        if (m.sparkTimer > 2 && ma > 0.2) {
                            m.sparkTimer = 0;
                            m.sparks.push({
                                x: m.x, y: m.y,
                                vx: (Math.random() - 0.5) * 1.5,
                                vy: (Math.random() - 0.5) * 1.5 + 0.3,
                                life: 0,
                                maxLife: 15 + Math.random() * 20,
                                size: 0.5 + Math.random() * 1,
                            });
                        }
                        if (m.sparks.length > 30) m.sparks.splice(0, m.sparks.length - 30);

                        // 繪製火花
                        for (let si = m.sparks.length - 1; si >= 0; si--) {
                            const sp = m.sparks[si];
                            sp.life += spd;
                            if (sp.life >= sp.maxLife) { m.sparks.splice(si, 1); continue; }
                            sp.x += sp.vx * spd * 0.5;
                            sp.y += sp.vy * spd * 0.5;
                            const sparkAlpha = ma * (1 - sp.life / sp.maxLife) * 0.5;
                            ctx.globalAlpha = sparkAlpha;
                            ctx.fillStyle = `rgba(${m.color.r},${m.color.g},${m.color.b},1)`;
                            ctx.beginPath();
                            ctx.arc(sp.x, sp.y, sp.size * (1 - sp.life / sp.maxLife), 0, Math.PI * 2);
                            ctx.fill();
                        }

                        // 流星主體 — 漸層尾巴
                        const tailLen = m.length * (1 - progress * 0.3);
                        const tailX = m.x - Math.cos(m.angle) * tailLen;
                        const tailY = m.y - Math.sin(m.angle) * tailLen;

                        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
                        grad.addColorStop(0, `rgba(255,255,255,${(ma).toFixed(3)})`);
                        grad.addColorStop(0.1, `rgba(${m.color.r},${m.color.g},${m.color.b},${(ma * 0.9).toFixed(3)})`);
                        grad.addColorStop(0.4, `rgba(${m.color.r},${m.color.g},${m.color.b},${(ma * 0.4).toFixed(3)})`);
                        grad.addColorStop(1, `rgba(${m.color.r},${m.color.g},${m.color.b},0)`);

                        ctx.globalAlpha = 1;
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = m.thickness;
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.moveTo(m.x, m.y);
                        ctx.lineTo(tailX, tailY);
                        ctx.stroke();

                        // 頭部爆發光暈
                        ctx.globalAlpha = ma;
                        const headGrad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.thickness * 4);
                        headGrad.addColorStop(0, `rgba(255,255,255,${(ma * 0.9).toFixed(3)})`);
                        headGrad.addColorStop(0.3, `rgba(${m.color.r},${m.color.g},${m.color.b},${(ma * 0.5).toFixed(3)})`);
                        headGrad.addColorStop(1, `rgba(${m.color.r},${m.color.g},${m.color.b},0)`);
                        ctx.fillStyle = headGrad;
                        ctx.beginPath();
                        ctx.arc(m.x, m.y, m.thickness * 4, 0, Math.PI * 2);
                        ctx.fill();

                        if (m.x < -150 || m.x > w + 150 || m.y > h + 150) m.active = false;
                    }

                    // 重置混合模式
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = 1;

                    self.starRaf = requestAnimationFrame(starTick);
                };

                this._starActive = true;
                starTick();
            },

            // 控制星圖速度：0=凍結、1=慢速、2=正常
            _setStarSpeed(strength) {
                if (strength === 0) this._starSpeedMult = 0;
                else if (strength === 1) this._starSpeedMult = 0.4;
                else this._starSpeedMult = 1;
            },

            stopStar() {
                if (this.starRaf) { cancelAnimationFrame(this.starRaf); this.starRaf = null; }
                if (this._starResize) { window.removeEventListener('resize', this._starResize); }
                if (this._starVisibility) { document.removeEventListener('visibilitychange', this._starVisibility); }
                try { window.removeEventListener('mousemove', this._starMouseHandler); } catch (e) {}
                if (this.starCanvas) { try { this.starCanvas.remove(); } catch (e) {} this.starCanvas = null; this.starCtx = null; }
                this._starSprites = null;
                this._nebulaSprites = null;
                this.starLayers = null;
                this.shootingStars = null;
                this.pulseRings = null;
                this._starMouse = null;
                // 恢復粒子容器可見性
                const particles = document.querySelector('.particles');
                if (particles) particles.style.display = (this._prevParticlesDisplay === null || this._prevParticlesDisplay === undefined) ? '' : this._prevParticlesDisplay;
                delete this._prevParticlesDisplay;
                this._starActive = false;
            },

            // ============================================
            // 電路脈衝 (circuit) — PCB 電路板流光
            // ============================================
            startCircuit(opts = {}) {
                if (this._circuitActive) return;

                // 防禦性停止其他背景
                try { this.stopNetwork(); } catch (e) {}
                try { this.stopMagnet(); } catch (e) {}
                try { if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas(); } catch (e) {}
                try { if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}
                try { if (typeof this.stopBubble === 'function') this.stopBubble(); } catch (e) {}

                const particles = document.querySelector('.particles');
                this._prevParticlesDisplay_circuit = particles ? particles.style.display : null;
                if (particles) particles.style.display = 'none';

                if (!this.circuitCanvas) {
                    this.circuitCanvas = document.createElement('canvas');
                    this.circuitCanvas.id = 'bg-circuit-canvas';
                    this.circuitCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:-7;pointer-events:none;';
                    this.circuitCanvas.setAttribute('aria-hidden', 'true');
                    document.body.appendChild(this.circuitCanvas);
                }
                const canvas = this.circuitCanvas;
                const ctx = canvas.getContext('2d');
                this.circuitCtx = ctx;

                const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                let W, H;

                // CSS 色彩
                const css = getComputedStyle(document.documentElement);
                const colors = [
                    (css.getPropertyValue('--primary-cyan') || '#00d4ff').trim(),
                    (css.getPropertyValue('--primary-magenta') || '#ff0080').trim(),
                    (css.getPropertyValue('--accent-purple') || '#8b5cf6').trim(),
                    '#00ff88', '#ffaa00'
                ];

                function hexToRGB(hex) {
                    hex = hex.replace('#', '');
                    if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
                    const n = parseInt(hex, 16);
                    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
                }
                const rgbColors = colors.map(hexToRGB);

                // 速度倍率
                this._circuitSpeedMult = (this._strength === 0) ? 0 : (this._strength === 1) ? 0.4 : 1;

                // 電路節點與路徑
                let nodes = [];
                let paths = [];
                let pulses = [];
                let mouseRipples = [];

                const GRID = 90; // 增大網格間距以降低密度

                function generateCircuit() {
                    nodes = [];
                    paths = [];
                    pulses = [];

                    const cols = Math.ceil(W / GRID) + 1;
                    const rows = Math.ceil(H / GRID) + 1;

                    // 建立網格節點（較低密度 + 較大偏移讓佈局更自然）
                    for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                            if (Math.random() < 0.22) { // 22% 機率放節點
                                const x = c * GRID + (Math.random() - 0.5) * GRID * 0.6;
                                const y = r * GRID + (Math.random() - 0.5) * GRID * 0.6;
                                const color = rgbColors[Math.floor(Math.random() * rgbColors.length)];
                                nodes.push({
                                    x, y,
                                    size: 1.5 + Math.random() * 2,
                                    color,
                                    pulse: Math.random() * Math.PI * 2,
                                    pulseSpeed: 0.02 + Math.random() * 0.03
                                });
                            }
                        }
                    }

                    // 連線：自然曲線路徑（貝茲曲線或斜線而非直角）
                    for (let i = 0; i < nodes.length; i++) {
                        const a = nodes[i];
                        let connections = 0;
                        for (let j = i + 1; j < nodes.length && connections < 2; j++) {
                            const b = nodes[j];
                            const dx = b.x - a.x;
                            const dy = b.y - a.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < GRID * 2.2 && dist > GRID * 0.4) {
                                const color = rgbColors[Math.floor(Math.random() * rgbColors.length)];
                                // 自然路徑：直線或帶控制點的貝茲曲線
                                const style = Math.random();
                                let cp1, cp2; // 控制點
                                if (style < 0.35) {
                                    // 直線（直接連接）
                                    cp1 = cp2 = null;
                                } else if (style < 0.7) {
                                    // 單控制點二次曲線
                                    const perpX = -dy * (0.15 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1);
                                    const perpY = dx * (0.15 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1);
                                    cp1 = { x: (a.x + b.x) / 2 + perpX, y: (a.y + b.y) / 2 + perpY };
                                    cp2 = null;
                                } else {
                                    // 雙控制點三次曲線
                                    const off1 = (Math.random() - 0.5) * dist * 0.3;
                                    const off2 = (Math.random() - 0.5) * dist * 0.3;
                                    cp1 = { x: a.x + dx * 0.33 + (-dy / dist) * off1, y: a.y + dy * 0.33 + (dx / dist) * off1 };
                                    cp2 = { x: a.x + dx * 0.66 + (-dy / dist) * off2, y: a.y + dy * 0.66 + (dx / dist) * off2 };
                                }
                                paths.push({
                                    ax: a.x, ay: a.y,
                                    bx: b.x, by: b.y,
                                    cp1, cp2,
                                    color,
                                    alpha: 0.08 + Math.random() * 0.12,
                                    width: 0.5 + Math.random() * 1
                                });
                                connections++;
                            }
                        }
                    }

                    // 生成初始脈衝
                    const maxInit = Math.min(paths.length, 20);
                    for (let i = 0; i < maxInit; i++) {
                        if (Math.random() < 0.5) {
                            spawnPulse(i);
                        }
                    }
                }

                // 沿路徑取得位置（支援直線 / 二次 / 三次曲線）
                function getPointOnPath(p, t) {
                    if (!p.cp1) {
                        // 直線
                        return { x: p.ax + (p.bx - p.ax) * t, y: p.ay + (p.by - p.ay) * t };
                    } else if (!p.cp2) {
                        // 二次貝茲
                        const s = 1 - t;
                        return {
                            x: s * s * p.ax + 2 * s * t * p.cp1.x + t * t * p.bx,
                            y: s * s * p.ay + 2 * s * t * p.cp1.y + t * t * p.by
                        };
                    } else {
                        // 三次貝茲
                        const s = 1 - t;
                        return {
                            x: s * s * s * p.ax + 3 * s * s * t * p.cp1.x + 3 * s * t * t * p.cp2.x + t * t * t * p.bx,
                            y: s * s * s * p.ay + 3 * s * s * t * p.cp1.y + 3 * s * t * t * p.cp2.y + t * t * t * p.by
                        };
                    }
                }

                function spawnPulse(pathIdx) {
                    if (pathIdx >= paths.length) return;
                    const p = paths[pathIdx];
                    const color = p.color;
                    pulses.push({
                        pathIdx,
                        progress: 0,
                        speed: 0.003 + Math.random() * 0.007,
                        size: 2 + Math.random() * 3,
                        color,
                        trail: []
                    });
                }

                // 滑鼠互動
                this._circuitMouse = { x: -1000, y: -1000 };
                this._circuitMouseHandler = (e) => {
                    this._circuitMouse.x = e.clientX * dpr;
                    this._circuitMouse.y = e.clientY * dpr;
                    // 生成波紋
                    if (mouseRipples.length < 5) {
                        mouseRipples.push({
                            x: e.clientX * dpr,
                            y: e.clientY * dpr,
                            radius: 0,
                            maxRadius: 80 + Math.random() * 60,
                            alpha: 0.6,
                            color: rgbColors[Math.floor(Math.random() * rgbColors.length)]
                        });
                    }
                };
                if (this._mouseEnabled !== false) {
                    window.addEventListener('mousemove', this._circuitMouseHandler);
                }

                const resize = () => {
                    W = Math.round(window.innerWidth * dpr);
                    H = Math.round(window.innerHeight * dpr);
                    canvas.width = W;
                    canvas.height = H;
                    generateCircuit();
                };

                this._circuitResize = resize;
                window.addEventListener('resize', resize);

                this._circuitVisibility = () => {
                    if (document.hidden) {
                        if (this.circuitRaf) { cancelAnimationFrame(this.circuitRaf); this.circuitRaf = null; }
                    } else if (!this.circuitRaf && this._circuitActive) {
                        circuitTick();
                    }
                };
                document.addEventListener('visibilitychange', this._circuitVisibility);

                // 主動畫循環
                const circuitTick = () => {
                    this.circuitRaf = requestAnimationFrame(circuitTick);
                    const sm = this._circuitSpeedMult;
                    if (sm === 0) return; // 凍結

                    ctx.clearRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'lighter';

                    // 繪製路徑（自然曲線電路線）— 批量繪製減少狀態切換
                    for (const path of paths) {
                        const c = path.color;
                        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${path.alpha})`;
                        ctx.lineWidth = path.width;
                        ctx.beginPath();
                        ctx.moveTo(path.ax, path.ay);
                        if (!path.cp1) {
                            ctx.lineTo(path.bx, path.by);
                        } else if (!path.cp2) {
                            ctx.quadraticCurveTo(path.cp1.x, path.cp1.y, path.bx, path.by);
                        } else {
                            ctx.bezierCurveTo(path.cp1.x, path.cp1.y, path.cp2.x, path.cp2.y, path.bx, path.by);
                        }
                        ctx.stroke();
                    }

                    // 繪製節點（無 shadowBlur，改用多層圓圈模擬光暈提升效能）
                    for (const node of nodes) {
                        node.pulse += node.pulseSpeed * sm;
                        const glow = 0.3 + 0.4 * Math.sin(node.pulse);
                        const c = node.color;

                        // 外層光暈（大半透明圓）
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${glow * 0.15})`;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, node.size * 3, 0, Math.PI * 2);
                        ctx.fill();

                        // 核心亮點
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${glow})`;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // 更新與繪製脈衝
                    for (let i = pulses.length - 1; i >= 0; i--) {
                        const pulse = pulses[i];
                        pulse.progress += pulse.speed * sm;

                        if (pulse.progress >= 1) {
                            pulses.splice(i, 1);
                            if (paths.length > 0 && Math.random() < 0.7) {
                                spawnPulse(Math.floor(Math.random() * paths.length));
                            }
                            continue;
                        }

                        const path = paths[pulse.pathIdx];
                        if (!path) { pulses.splice(i, 1); continue; }

                        // 計算脈衝在曲線路徑上的位置
                        const pt = getPointOnPath(path, pulse.progress);
                        const px = pt.x, py = pt.y;

                        // 記錄軌跡
                        pulse.trail.push({ x: px, y: py });
                        if (pulse.trail.length > 8) pulse.trail.shift();

                        const c = pulse.color;

                        // 用單一漸層路徑繪製軌跡（減少 stroke 次數）
                        if (pulse.trail.length > 1) {
                            ctx.beginPath();
                            ctx.moveTo(pulse.trail[0].x, pulse.trail[0].y);
                            for (let t2 = 1; t2 < pulse.trail.length; t2++) {
                                ctx.lineTo(pulse.trail[t2].x, pulse.trail[t2].y);
                            }
                            ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.35)`;
                            ctx.lineWidth = pulse.size * 0.8;
                            ctx.stroke();
                        }

                        // 脈衝頭（無 shadowBlur，改用雙層圓）
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.3)`;
                        ctx.beginPath();
                        ctx.arc(px, py, pulse.size * 2.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.9)`;
                        ctx.beginPath();
                        ctx.arc(px, py, pulse.size, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // 控制脈衝數量
                    const desiredPulses = (this._strength === 1) ? 10 : 25;
                    if (pulses.length < desiredPulses && paths.length > 0 && Math.random() < 0.05 * sm) {
                        spawnPulse(Math.floor(Math.random() * paths.length));
                    }

                    // 滑鼠互動：鄰近節點增亮（無 shadowBlur）
                    const mx = this._circuitMouse.x;
                    const my = this._circuitMouse.y;
                    for (const node of nodes) {
                        const dx2 = node.x - mx;
                        const dy2 = node.y - my;
                        const md = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                        if (md < 120) {
                            const bright = (1 - md / 120) * 0.7;
                            const c = node.color;
                            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${bright * 0.2})`;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, node.size * 4, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${bright})`;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, node.size * 1.8, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }

                    // 波紋效果
                    for (let i = mouseRipples.length - 1; i >= 0; i--) {
                        const rp = mouseRipples[i];
                        rp.radius += 1.5 * sm;
                        rp.alpha -= 0.008 * sm;
                        if (rp.alpha <= 0 || rp.radius >= rp.maxRadius) {
                            mouseRipples.splice(i, 1); continue;
                        }
                        const c = rp.color;
                        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${rp.alpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                };

                resize();
                this._circuitActive = true;
                circuitTick();
            },

            _setCircuitSpeed(strength) {
                if (strength === 0) this._circuitSpeedMult = 0;
                else if (strength === 1) this._circuitSpeedMult = 0.4;
                else this._circuitSpeedMult = 1;
            },

            stopCircuit() {
                if (this.circuitRaf) { cancelAnimationFrame(this.circuitRaf); this.circuitRaf = null; }
                if (this._circuitResize) window.removeEventListener('resize', this._circuitResize);
                if (this._circuitVisibility) document.removeEventListener('visibilitychange', this._circuitVisibility);
                try { window.removeEventListener('mousemove', this._circuitMouseHandler); } catch (e) {}
                if (this.circuitCanvas) { try { this.circuitCanvas.remove(); } catch (e) {} this.circuitCanvas = null; this.circuitCtx = null; }
                this._circuitMouse = null;
                const particles = document.querySelector('.particles');
                if (particles) particles.style.display = (this._prevParticlesDisplay_circuit === null || this._prevParticlesDisplay_circuit === undefined) ? '' : this._prevParticlesDisplay_circuit;
                delete this._prevParticlesDisplay_circuit;
                this._circuitActive = false;
            },

            // ============================================
            // 櫻花飄落 (sakura) — 賽博龐克風格櫻花
            // ============================================
            startSakura(opts = {}) {
                if (this._sakuraActive) return;

                try { this.stopNetwork(); } catch (e) {}
                try { this.stopMagnet(); } catch (e) {}
                try { if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas(); } catch (e) {}
                try { if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}
                try { if (typeof this.stopBubble === 'function') this.stopBubble(); } catch (e) {}
                try { if (typeof this.stopCircuit === 'function') this.stopCircuit(); } catch (e) {}

                const particlesEl = document.querySelector('.particles');
                this._prevParticlesDisplay_sakura = particlesEl ? particlesEl.style.display : null;
                if (particlesEl) particlesEl.style.display = 'none';

                if (!this.sakuraCanvas) {
                    this.sakuraCanvas = document.createElement('canvas');
                    this.sakuraCanvas.id = 'bg-sakura-canvas';
                    this.sakuraCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:-7;pointer-events:none;';
                    this.sakuraCanvas.setAttribute('aria-hidden', 'true');
                    document.body.appendChild(this.sakuraCanvas);
                }
                const canvas = this.sakuraCanvas;
                const ctx = canvas.getContext('2d');
                this.sakuraCtx = ctx;

                const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                let W, H;

                // 賽博櫻花色彩 — 純粉色系
                const petalColors = [
                    { r: 255, g: 120, b: 180 },  // 粉紅
                    { r: 255, g: 80, b: 150 },   // 深粉
                    { r: 255, g: 160, b: 200 },  // 淺粉
                    { r: 255, g: 140, b: 190 },  // 中粉
                    { r: 255, g: 200, b: 220 },  // 淡粉
                    { r: 255, g: 100, b: 170 },  // 櫻粉
                    { r: 240, g: 130, b: 190 }   // 柔粉
                ];

                this._sakuraSpeedMult = (this._strength === 0) ? 0 : (this._strength === 1) ? 0.4 : 1;

                let petals = [];
                let glowParticles = [];

                const createPetal = (forceTop) => {
                    const color = petalColors[Math.floor(Math.random() * petalColors.length)];
                    const size = 4 + Math.random() * 10;
                    return {
                        x: Math.random() * W,
                        y: forceTop ? -size * 2 : Math.random() * H,
                        size,
                        color,
                        rotation: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.04,
                        fallSpeed: 0.3 + Math.random() * 0.8,
                        swayAmp: 30 + Math.random() * 50,
                        swaySpeed: 0.005 + Math.random() * 0.01,
                        swayPhase: Math.random() * Math.PI * 2,
                        alpha: 0.4 + Math.random() * 0.5,
                        type: Math.random() < 0.7 ? 'petal' : 'leaf', // 花瓣或葉片
                        flipPhase: Math.random() * Math.PI * 2,
                        flipSpeed: 0.02 + Math.random() * 0.03
                    };
                };

                const createGlow = () => ({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    size: 1 + Math.random() * 2,
                    color: petalColors[Math.floor(Math.random() * petalColors.length)],
                    alpha: 0.2 + Math.random() * 0.4,
                    pulse: Math.random() * Math.PI * 2,
                    pulseSpeed: 0.02 + Math.random() * 0.04,
                    drift: { x: (Math.random() - 0.5) * 0.2, y: 0.1 + Math.random() * 0.3 }
                });

                // 滑鼠：靠近花瓣會被吹散
                this._sakuraMouse = { x: -1000, y: -1000 };
                this._sakuraMouseHandler = (e) => {
                    this._sakuraMouse.x = e.clientX * dpr;
                    this._sakuraMouse.y = e.clientY * dpr;
                };
                if (this._mouseEnabled !== false) {
                    window.addEventListener('mousemove', this._sakuraMouseHandler);
                }

                const resize = () => {
                    W = Math.round(window.innerWidth * dpr);
                    H = Math.round(window.innerHeight * dpr);
                    canvas.width = W;
                    canvas.height = H;
                    const baseCount = Math.max(25, Math.floor((W * H) / 22000));
                    const count = (this._strength === 1) ? Math.ceil(baseCount * 0.5) : baseCount;
                    petals = [];
                    for (let i = 0; i < count; i++) petals.push(createPetal(false));
                    glowParticles = [];
                    for (let i = 0; i < Math.ceil(count * 0.35); i++) glowParticles.push(createGlow());
                };

                this._sakuraResize = resize;
                window.addEventListener('resize', resize);

                this._sakuraVisibility = () => {
                    if (document.hidden) {
                        if (this.sakuraRaf) { cancelAnimationFrame(this.sakuraRaf); this.sakuraRaf = null; }
                    } else if (!this.sakuraRaf && this._sakuraActive) {
                        sakuraTick();
                    }
                };
                document.addEventListener('visibilitychange', this._sakuraVisibility);

                // 繪製花瓣（心形+葉形）— 無 shadowBlur，改用多層模擬光暈
                const drawPetal = (p) => {
                    const c = p.color;
                    const flipScale = Math.cos(p.flipPhase); // 3D 翻轉效果
                    const absFlip = Math.abs(flipScale);
                    if (absFlip < 0.05) return; // 幾乎垂直時跳過繪製

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation);
                    ctx.scale(flipScale, 1);

                    if (p.type === 'petal') {
                        const s = p.size;
                        // 外層光暈（大半透明版本代替 shadowBlur）
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${p.alpha * 0.12 * absFlip})`;
                        ctx.beginPath();
                        ctx.moveTo(0, -s * 1.6);
                        ctx.bezierCurveTo(s * 1.3, -s * 1.3, s * 1.6, s * 0.5, 0, s * 1.6);
                        ctx.bezierCurveTo(-s * 1.6, s * 0.5, -s * 1.3, -s * 1.3, 0, -s * 1.6);
                        ctx.fill();
                        // 核心花瓣
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${p.alpha * absFlip})`;
                        ctx.beginPath();
                        ctx.moveTo(0, -s);
                        ctx.bezierCurveTo(s * 0.8, -s * 0.8, s, s * 0.3, 0, s);
                        ctx.bezierCurveTo(-s, s * 0.3, -s * 0.8, -s * 0.8, 0, -s);
                        ctx.fill();
                    } else {
                        const s = p.size * 0.6;
                        // 外層光暈
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${p.alpha * 0.1 * absFlip})`;
                        ctx.beginPath();
                        ctx.ellipse(0, 0, s * 1.8, s * 0.8, 0, 0, Math.PI * 2);
                        ctx.fill();
                        // 核心葉片
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${p.alpha * 0.7 * absFlip})`;
                        ctx.beginPath();
                        ctx.ellipse(0, 0, s, s * 0.4, 0, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                };

                const sakuraTick = () => {
                    this.sakuraRaf = requestAnimationFrame(sakuraTick);
                    const sm = this._sakuraSpeedMult;
                    if (sm === 0) return;

                    ctx.clearRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'lighter';

                    const mx = this._sakuraMouse.x;
                    const my = this._sakuraMouse.y;

                    // 更新花瓣
                    for (let i = 0; i < petals.length; i++) {
                        const p = petals[i];
                        p.swayPhase += p.swaySpeed * sm;
                        p.y += p.fallSpeed * sm;
                        p.x += Math.sin(p.swayPhase) * p.swayAmp * 0.01 * sm;
                        p.rotation += p.rotSpeed * sm;
                        p.flipPhase += p.flipSpeed * sm;

                        // 滑鼠吹散
                        if (this._mouseEnabled !== false) {
                            const dx = p.x - mx;
                            const dy = p.y - my;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < 100 && dist > 0) {
                                const force = (1 - dist / 100) * 3 * sm;
                                p.x += (dx / dist) * force;
                                p.y += (dy / dist) * force * 0.5;
                                p.rotSpeed += (Math.random() - 0.5) * 0.01;
                            }
                        }

                        // 超出畫面回收
                        if (p.y > H + p.size * 2) {
                            petals[i] = createPetal(true);
                            petals[i].x = Math.random() * W;
                        }
                        if (p.x < -50) p.x = W + 50;
                        if (p.x > W + 50) p.x = -50;

                        drawPetal(p);
                    }

                    // 發光微粒（花粉般的光點）— 無 shadowBlur，多層圓模擬
                    for (let i = 0; i < glowParticles.length; i++) {
                        const g = glowParticles[i];
                        g.pulse += g.pulseSpeed * sm;
                        g.x += g.drift.x * sm;
                        g.y += g.drift.y * sm;

                        if (g.y > H + 10) {
                            glowParticles[i] = createGlow();
                            glowParticles[i].y = -5;
                        }
                        if (g.x < -10 || g.x > W + 10) {
                            glowParticles[i] = createGlow();
                        }

                        const a = g.alpha * (0.5 + 0.5 * Math.sin(g.pulse));
                        const c = g.color;
                        // 外層光暈
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a * 0.15})`;
                        ctx.beginPath();
                        ctx.arc(g.x, g.y, g.size * 4, 0, Math.PI * 2);
                        ctx.fill();
                        // 核心亮點
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
                        ctx.beginPath();
                        ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                };

                resize();
                this._sakuraActive = true;
                sakuraTick();
            },

            _setSakuraSpeed(strength) {
                if (strength === 0) this._sakuraSpeedMult = 0;
                else if (strength === 1) this._sakuraSpeedMult = 0.4;
                else this._sakuraSpeedMult = 1;
            },

            stopSakura() {
                if (this.sakuraRaf) { cancelAnimationFrame(this.sakuraRaf); this.sakuraRaf = null; }
                if (this._sakuraResize) window.removeEventListener('resize', this._sakuraResize);
                if (this._sakuraVisibility) document.removeEventListener('visibilitychange', this._sakuraVisibility);
                try { window.removeEventListener('mousemove', this._sakuraMouseHandler); } catch (e) {}
                if (this.sakuraCanvas) { try { this.sakuraCanvas.remove(); } catch (e) {} this.sakuraCanvas = null; this.sakuraCtx = null; }
                this._sakuraMouse = null;
                const particles = document.querySelector('.particles');
                if (particles) particles.style.display = (this._prevParticlesDisplay_sakura === null || this._prevParticlesDisplay_sakura === undefined) ? '' : this._prevParticlesDisplay_sakura;
                delete this._prevParticlesDisplay_sakura;
                this._sakuraActive = false;
            },

            // ============================================
            // 故障雜訊 (glitch) — 數位故障/掃描線效果
            // ============================================
            startGlitch(opts = {}) {
                if (this._glitchActive) return;

                try { this.stopNetwork(); } catch (e) {}
                try { this.stopMagnet(); } catch (e) {}
                try { if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas(); } catch (e) {}
                try { if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}
                try { if (typeof this.stopBubble === 'function') this.stopBubble(); } catch (e) {}
                try { if (typeof this.stopCircuit === 'function') this.stopCircuit(); } catch (e) {}
                try { if (typeof this.stopSakura === 'function') this.stopSakura(); } catch (e) {}

                const particlesEl = document.querySelector('.particles');
                this._prevParticlesDisplay_glitch = particlesEl ? particlesEl.style.display : null;
                if (particlesEl) particlesEl.style.display = 'none';

                if (!this.glitchCanvas) {
                    this.glitchCanvas = document.createElement('canvas');
                    this.glitchCanvas.id = 'bg-glitch-canvas';
                    this.glitchCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:-7;pointer-events:none;';
                    this.glitchCanvas.setAttribute('aria-hidden', 'true');
                    document.body.appendChild(this.glitchCanvas);
                }
                const canvas = this.glitchCanvas;
                const ctx = canvas.getContext('2d');
                this.glitchCtx = ctx;

                const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                let W, H;

                const css = getComputedStyle(document.documentElement);
                const glitchColors = [
                    { r: 0, g: 212, b: 255 },     // cyan
                    { r: 255, g: 0, b: 128 },      // magenta
                    { r: 139, g: 92, b: 246 },     // purple
                    { r: 0, g: 255, b: 136 },      // green
                    { r: 255, g: 255, b: 255 }     // white (static)
                ];

                this._glitchSpeedMult = (this._strength === 0) ? 0 : (this._strength === 1) ? 0.4 : 1;

                let scanlines = [];
                let glitchBlocks = [];
                let dataStreams = [];
                let hexCodes = [];
                let frame = 0;

                // 故障區塊
                const createGlitchBlock = () => {
                    const color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
                    return {
                        x: Math.random() * W,
                        y: Math.random() * H,
                        w: 20 + Math.random() * 200,
                        h: 2 + Math.random() * 15,
                        color,
                        alpha: 0.05 + Math.random() * 0.15,
                        life: 0.5 + Math.random() * 1.5,
                        age: 0,
                        offsetX: (Math.random() - 0.5) * 30,
                        flickerRate: 0.1 + Math.random() * 0.3
                    };
                };

                // 數據流（垂直下落的字符）
                const createDataStream = () => {
                    const color = glitchColors[Math.floor(Math.random() * 3)]; // cyan/magenta/purple
                    return {
                        x: Math.floor(Math.random() * (W / 14)) * 14,
                        y: -Math.random() * H,
                        speed: 1 + Math.random() * 3,
                        chars: [],
                        charCount: 5 + Math.floor(Math.random() * 15),
                        color,
                        alpha: 0.15 + Math.random() * 0.3,
                        charSize: 10 + Math.random() * 4
                    };
                };

                // HEX 碼
                const hexChars = '0123456789ABCDEF';
                const createHexCode = () => {
                    const color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
                    let code = '0x';
                    for (let i = 0; i < 4; i++) code += hexChars[Math.floor(Math.random() * 16)];
                    return {
                        x: Math.random() * W,
                        y: Math.random() * H,
                        code,
                        color,
                        alpha: 0,
                        maxAlpha: 0.15 + Math.random() * 0.25,
                        fadeIn: true,
                        life: 1 + Math.random() * 3,
                        age: 0,
                        size: 8 + Math.random() * 4
                    };
                };

                // 滑鼠：點擊製造故障區域
                this._glitchMouse = { x: -1000, y: -1000, active: false };
                this._glitchMouseHandler = (e) => {
                    this._glitchMouse.x = e.clientX * dpr;
                    this._glitchMouse.y = e.clientY * dpr;
                    this._glitchMouse.active = true;
                    // 在點擊位置附近製造故障
                    if (glitchBlocks.length < 30) {
                        for (let i = 0; i < 5; i++) {
                            const b = createGlitchBlock();
                            b.x = e.clientX * dpr + (Math.random() - 0.5) * 150;
                            b.y = e.clientY * dpr + (Math.random() - 0.5) * 80;
                            b.alpha *= 2;
                            glitchBlocks.push(b);
                        }
                    }
                };
                if (this._mouseEnabled !== false) {
                    window.addEventListener('click', this._glitchMouseHandler);
                }

                const resize = () => {
                    W = Math.round(window.innerWidth * dpr);
                    H = Math.round(window.innerHeight * dpr);
                    canvas.width = W;
                    canvas.height = H;
                    glitchBlocks = [];
                    dataStreams = [];
                    const streamCount = (this._strength === 1) ? 8 : 15;
                    for (let i = 0; i < streamCount; i++) dataStreams.push(createDataStream());
                    hexCodes = [];
                    for (let i = 0; i < 12; i++) hexCodes.push(createHexCode());
                };

                this._glitchResize = resize;
                window.addEventListener('resize', resize);

                this._glitchVisibility = () => {
                    if (document.hidden) {
                        if (this.glitchRaf) { cancelAnimationFrame(this.glitchRaf); this.glitchRaf = null; }
                    } else if (!this.glitchRaf && this._glitchActive) {
                        glitchTick();
                    }
                };
                document.addEventListener('visibilitychange', this._glitchVisibility);

                const glitchTick = () => {
                    this.glitchRaf = requestAnimationFrame(glitchTick);
                    const sm = this._glitchSpeedMult;
                    if (sm === 0) return;
                    frame++;

                    ctx.clearRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'lighter';

                    // 故障區塊
                    for (let i = glitchBlocks.length - 1; i >= 0; i--) {
                        const b = glitchBlocks[i];
                        b.age += 0.016 * sm;
                        if (b.age >= b.life) { glitchBlocks.splice(i, 1); continue; }
                        const flicker = Math.sin(b.age * b.flickerRate * 60) > 0;
                        if (!flicker) continue;
                        const c = b.color;
                        const fadeAlpha = b.alpha * (1 - b.age / b.life);
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${fadeAlpha})`;
                        ctx.fillRect(b.x + b.offsetX * Math.sin(b.age * 5), b.y, b.w, b.h);
                    }

                    // 隨機產生故障區塊
                    if (glitchBlocks.length < 15 && Math.random() < 0.03 * sm) {
                        glitchBlocks.push(createGlitchBlock());
                    }

                    // 數據流
                    ctx.font = '12px monospace';
                    for (let i = 0; i < dataStreams.length; i++) {
                        const ds = dataStreams[i];
                        ds.y += ds.speed * sm;
                        const c = ds.color;
                        for (let j = 0; j < ds.charCount; j++) {
                            const charY = ds.y - j * ds.charSize;
                            if (charY < -20 || charY > H + 20) continue;
                            const a = ds.alpha * (1 - j / ds.charCount);
                            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
                            // 隨機字元（數字+符號）
                            const ch = (Math.random() < 0.1) ?
                                String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)) : // 片假名
                                hexChars[Math.floor(Math.random() * 16)];
                            ctx.fillText(ch, ds.x, charY);
                        }
                        if (ds.y - ds.charCount * ds.charSize > H) {
                            dataStreams[i] = createDataStream();
                        }
                    }

                    // HEX 碼浮動顯示
                    ctx.font = '10px monospace';
                    for (let i = 0; i < hexCodes.length; i++) {
                        const h = hexCodes[i];
                        h.age += 0.016 * sm;
                        if (h.fadeIn && h.alpha < h.maxAlpha) {
                            h.alpha += 0.005 * sm;
                            if (h.alpha >= h.maxAlpha) h.fadeIn = false;
                        }
                        if (h.age >= h.life) {
                            h.alpha -= 0.01 * sm;
                            if (h.alpha <= 0) { hexCodes[i] = createHexCode(); continue; }
                        }
                        // 隨機更新碼值
                        if (Math.random() < 0.02 * sm) {
                            h.code = '0x';
                            for (let k = 0; k < 4; k++) h.code += hexChars[Math.floor(Math.random() * 16)];
                        }
                        const c = h.color;
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${h.alpha})`;
                        ctx.fillText(h.code, h.x, h.y);
                    }

                };

                resize();
                this._glitchActive = true;
                glitchTick();
            },

            _setGlitchSpeed(strength) {
                if (strength === 0) this._glitchSpeedMult = 0;
                else if (strength === 1) this._glitchSpeedMult = 0.4;
                else this._glitchSpeedMult = 1;
            },

            stopGlitch() {
                if (this.glitchRaf) { cancelAnimationFrame(this.glitchRaf); this.glitchRaf = null; }
                if (this._glitchResize) window.removeEventListener('resize', this._glitchResize);
                if (this._glitchVisibility) document.removeEventListener('visibilitychange', this._glitchVisibility);
                try { window.removeEventListener('click', this._glitchMouseHandler); } catch (e) {}
                if (this.glitchCanvas) { try { this.glitchCanvas.remove(); } catch (e) {} this.glitchCanvas = null; this.glitchCtx = null; }
                this._glitchMouse = null;
                const particles = document.querySelector('.particles');
                if (particles) particles.style.display = (this._prevParticlesDisplay_glitch === null || this._prevParticlesDisplay_glitch === undefined) ? '' : this._prevParticlesDisplay_glitch;
                delete this._prevParticlesDisplay_glitch;
                this._glitchActive = false;
            },

            // ============================================
            // 雷射禁地 (laser) — 交叉雷射光束
            // ============================================
            startLaser(opts = {}) {
                if (this._laserActive) return;

                try { this.stopNetwork(); } catch (e) {}
                try { this.stopMagnet(); } catch (e) {}
                try { if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas(); } catch (e) {}
                try { if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}
                try { if (typeof this.stopBubble === 'function') this.stopBubble(); } catch (e) {}
                try { if (typeof this.stopCircuit === 'function') this.stopCircuit(); } catch (e) {}
                try { if (typeof this.stopSakura === 'function') this.stopSakura(); } catch (e) {}
                try { if (typeof this.stopGlitch === 'function') this.stopGlitch(); } catch (e) {}

                const particlesEl = document.querySelector('.particles');
                this._prevParticlesDisplay_laser = particlesEl ? particlesEl.style.display : null;
                if (particlesEl) particlesEl.style.display = 'none';

                if (!this.laserCanvas) {
                    this.laserCanvas = document.createElement('canvas');
                    this.laserCanvas.id = 'bg-laser-canvas';
                    this.laserCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:-7;pointer-events:none;';
                    this.laserCanvas.setAttribute('aria-hidden', 'true');
                    document.body.appendChild(this.laserCanvas);
                }
                const canvas = this.laserCanvas;
                const ctx = canvas.getContext('2d');
                this.laserCtx = ctx;

                const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                let W, H;

                const laserColors = [
                    { r: 0, g: 150, b: 255 },      // 藍
                    { r: 0, g: 212, b: 255 },      // 淺藍
                    { r: 255, g: 30, b: 30 },       // 紅
                    { r: 255, g: 0, b: 80 }         // 深紅
                ];

                this._laserSpeedMult = (this._strength === 0) ? 0 : (this._strength === 1) ? 0.4 : 1;

                let beams = [];
                let sparks = [];
                let sweepBeams = [];
                let fogPatches = [];

                // 靜態雷射束
                const createBeam = () => {
                    const color = laserColors[Math.floor(Math.random() * laserColors.length)];
                    const dir = Math.random();
                    let startX, startY, angle;
                    if (dir < 0.25) {
                        startX = 0; startY = Math.random() * H; angle = (Math.random() - 0.5) * 0.6;
                    } else if (dir < 0.5) {
                        startX = W; startY = Math.random() * H; angle = Math.PI + (Math.random() - 0.5) * 0.6;
                    } else if (dir < 0.75) {
                        startX = Math.random() * W; startY = 0; angle = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
                    } else {
                        startX = Math.random() * W; startY = H; angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
                    }
                    const length = Math.max(W, H) * 1.5;
                    return {
                        x1: startX, y1: startY,
                        x2: startX + Math.cos(angle) * length,
                        y2: startY + Math.sin(angle) * length,
                        color, width: 0.5 + Math.random() * 2,
                        alpha: 0, maxAlpha: 0.1 + Math.random() * 0.2,
                        pulse: Math.random() * Math.PI * 2,
                        pulseSpeed: 0.008 + Math.random() * 0.015,
                        life: 8 + Math.random() * 12,
                        age: 0,
                        fadeInTime: 1.2 + Math.random() * 1.5
                    };
                };

                // 掃描/旋轉雷射
                const createSweepBeam = () => {
                    const color = laserColors[Math.floor(Math.random() * laserColors.length)];
                    return {
                        cx: Math.random() * W,
                        cy: Math.random() * H,
                        angle: Math.random() * Math.PI * 2,
                        rotSpeed: (Math.random() - 0.5) * 0.002,
                        length: Math.max(W, H) * 0.8,
                        color,
                        width: 0.5 + Math.random() * 1.5,
                        alpha: 0.08 + Math.random() * 0.14,
                        pulse: Math.random() * Math.PI * 2,
                        pulseSpeed: 0.01 + Math.random() * 0.02
                    };
                };

                // 火花（雷射交叉處）
                const createSpark = (x, y) => {
                    const color = laserColors[Math.floor(Math.random() * laserColors.length)];
                    return {
                        x, y,
                        vx: (Math.random() - 0.5) * 1.2,
                        vy: (Math.random() - 0.5) * 1.2,
                        size: 1 + Math.random() * 2.5,
                        color, alpha: 0.7,
                        life: 1.0 + Math.random() * 2.5,
                        age: 0
                    };
                };

                // 氛圍霧氣
                const createFogPatch = () => {
                    const color = laserColors[Math.floor(Math.random() * laserColors.length)];
                    return {
                        x: Math.random() * W,
                        y: Math.random() * H,
                        radius: 150 + Math.random() * 350,
                        color,
                        alpha: 0.012 + Math.random() * 0.02,
                        vx: (Math.random() - 0.5) * 0.2,
                        vy: (Math.random() - 0.5) * 0.2,
                        pulse: Math.random() * Math.PI * 2,
                        pulseSpeed: 0.003 + Math.random() * 0.006
                    };
                };

                // 滑鼠：從滑鼠位置發射雷射
                this._laserMouse = { x: W / 2, y: H / 2 };
                this._laserMouseHandler = (e) => {
                    this._laserMouse.x = e.clientX * dpr;
                    this._laserMouse.y = e.clientY * dpr;
                };
                if (this._mouseEnabled !== false) {
                    window.addEventListener('mousemove', this._laserMouseHandler);
                }

                const resize = () => {
                    W = Math.round(window.innerWidth * dpr);
                    H = Math.round(window.innerHeight * dpr);
                    canvas.width = W;
                    canvas.height = H;
                    beams = [];
                    const beamCount = (this._strength === 1) ? 6 : 12;
                    for (let i = 0; i < beamCount; i++) beams.push(createBeam());
                    sweepBeams = [];
                    const sweepCount = (this._strength === 1) ? 2 : 4;
                    for (let i = 0; i < sweepCount; i++) sweepBeams.push(createSweepBeam());
                    sparks = [];
                    fogPatches = [];
                    const fogCount = (this._strength === 1) ? 4 : 7;
                    for (let i = 0; i < fogCount; i++) fogPatches.push(createFogPatch());
                };

                this._laserResize = resize;
                window.addEventListener('resize', resize);

                this._laserVisibility = () => {
                    if (document.hidden) {
                        if (this.laserRaf) { cancelAnimationFrame(this.laserRaf); this.laserRaf = null; }
                    } else if (!this.laserRaf && this._laserActive) {
                        laserTick();
                    }
                };
                document.addEventListener('visibilitychange', this._laserVisibility);

                const laserTick = () => {
                    this.laserRaf = requestAnimationFrame(laserTick);
                    const sm = this._laserSpeedMult;
                    if (sm === 0) return;

                    ctx.clearRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'lighter';

                    // 氛圍霧氣層
                    for (const fog of fogPatches) {
                        fog.x += fog.vx * sm;
                        fog.y += fog.vy * sm;
                        fog.pulse += fog.pulseSpeed * sm;
                        if (fog.x < -fog.radius) fog.x = W + fog.radius;
                        if (fog.x > W + fog.radius) fog.x = -fog.radius;
                        if (fog.y < -fog.radius) fog.y = H + fog.radius;
                        if (fog.y > H + fog.radius) fog.y = -fog.radius;
                        const fa = fog.alpha * (0.6 + 0.4 * Math.sin(fog.pulse));
                        const fc = fog.color;
                        const grd = ctx.createRadialGradient(fog.x, fog.y, 0, fog.x, fog.y, fog.radius);
                        grd.addColorStop(0, `rgba(${fc.r},${fc.g},${fc.b},${fa})`);
                        grd.addColorStop(1, `rgba(${fc.r},${fc.g},${fc.b},0)`);
                        ctx.fillStyle = grd;
                        ctx.beginPath();
                        ctx.arc(fog.x, fog.y, fog.radius, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // 靜態雷射束（會出現/消失）
                    for (let i = beams.length - 1; i >= 0; i--) {
                        const b = beams[i];
                        b.age += 0.016 * sm;
                        b.pulse += b.pulseSpeed * sm;

                        // 淡入
                        if (b.age < b.fadeInTime) {
                            b.alpha = b.maxAlpha * (b.age / b.fadeInTime);
                        } else if (b.age > b.life - 2.0) {
                            b.alpha = b.maxAlpha * ((b.life - b.age) / 2.0);
                        } else {
                            b.alpha = b.maxAlpha * (0.7 + 0.3 * Math.sin(b.pulse));
                        }

                        if (b.age >= b.life) {
                            beams[i] = createBeam();
                            continue;
                        }

                        if (b.alpha <= 0) continue;

                        const c = b.color;
                        // 外層光暈（寬而半透明）
                        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${b.alpha * 0.15})`;
                        ctx.lineWidth = b.width * 6;
                        ctx.beginPath();
                        ctx.moveTo(b.x1, b.y1);
                        ctx.lineTo(b.x2, b.y2);
                        ctx.stroke();
                        // 中層光束
                        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${b.alpha})`;
                        ctx.lineWidth = b.width;
                        ctx.beginPath();
                        ctx.moveTo(b.x1, b.y1);
                        ctx.lineTo(b.x2, b.y2);
                        ctx.stroke();
                        // 核心光（更亮更細）
                        ctx.strokeStyle = `rgba(255,255,255,${b.alpha * 0.4})`;
                        ctx.lineWidth = b.width * 0.3;
                        ctx.beginPath();
                        ctx.moveTo(b.x1, b.y1);
                        ctx.lineTo(b.x2, b.y2);
                        ctx.stroke();

                        // 起點光暈
                        const gs = b.width * 5;
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${b.alpha * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(b.x1, b.y1, gs, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = `rgba(255,255,255,${b.alpha * 0.25})`;
                        ctx.beginPath();
                        ctx.arc(b.x1, b.y1, gs * 0.35, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // 掃描旋轉雷射
                    for (const sw of sweepBeams) {
                        sw.angle += sw.rotSpeed * sm;
                        sw.pulse += sw.pulseSpeed * sm;
                        const a = sw.alpha * (0.5 + 0.5 * Math.sin(sw.pulse));
                        const c = sw.color;
                        const ex = sw.cx + Math.cos(sw.angle) * sw.length;
                        const ey = sw.cy + Math.sin(sw.angle) * sw.length;
                        const ex2 = sw.cx - Math.cos(sw.angle) * sw.length;
                        const ey2 = sw.cy - Math.sin(sw.angle) * sw.length;

                        // 掃描軌跡殘影
                        const trailSpan = sw.rotSpeed * sm * 15;
                        if (Math.abs(trailSpan) > 0.0001) {
                            ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a * 0.035})`;
                            ctx.beginPath();
                            ctx.moveTo(sw.cx, sw.cy);
                            ctx.arc(sw.cx, sw.cy, sw.length, sw.angle - trailSpan, sw.angle, sw.rotSpeed < 0);
                            ctx.closePath();
                            ctx.fill();
                            ctx.beginPath();
                            ctx.moveTo(sw.cx, sw.cy);
                            ctx.arc(sw.cx, sw.cy, sw.length, sw.angle + Math.PI - trailSpan, sw.angle + Math.PI, sw.rotSpeed < 0);
                            ctx.closePath();
                            ctx.fill();
                        }

                        // 外層光暈
                        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${a * 0.12})`;
                        ctx.lineWidth = sw.width * 5;
                        ctx.beginPath();
                        ctx.moveTo(ex2, ey2);
                        ctx.lineTo(ex, ey);
                        ctx.stroke();
                        // 核心雷射
                        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${a})`;
                        ctx.lineWidth = sw.width;
                        ctx.beginPath();
                        ctx.moveTo(ex2, ey2);
                        ctx.lineTo(ex, ey);
                        ctx.stroke();

                        // 旋轉軸心光暈
                        const ps = sw.width * 4;
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${a * 0.5})`;
                        ctx.beginPath();
                        ctx.arc(sw.cx, sw.cy, ps, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = `rgba(255,255,255,${a * 0.2})`;
                        ctx.beginPath();
                        ctx.arc(sw.cx, sw.cy, ps * 0.3, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // 滑鼠雷射（從滑鼠發射4條雷射到角落）
                    if (this._mouseEnabled !== false) {
                        const mx = this._laserMouse.x;
                        const my = this._laserMouse.y;
                        const corners = [[0, 0], [W, 0], [W, H], [0, H]];
                        for (let ci = 0; ci < corners.length; ci++) {
                            const [cx, cy] = corners[ci];
                            const c = laserColors[ci % laserColors.length];
                            // 外層光暈
                            ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.04)`;
                            ctx.lineWidth = 4;
                            ctx.beginPath();
                            ctx.moveTo(mx, my);
                            ctx.lineTo(cx, cy);
                            ctx.stroke();
                            // 核心線
                            ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.1)`;
                            ctx.lineWidth = 0.5;
                            ctx.beginPath();
                            ctx.moveTo(mx, my);
                            ctx.lineTo(cx, cy);
                            ctx.stroke();
                        }
                    }

                    // 火花更新
                    for (let i = sparks.length - 1; i >= 0; i--) {
                        const s = sparks[i];
                        s.age += 0.016 * sm;
                        s.x += s.vx * sm;
                        s.y += s.vy * sm;
                        s.alpha = 0.8 * (1 - s.age / s.life);
                        if (s.age >= s.life) { sparks.splice(i, 1); continue; }
                        const c = s.color;
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${s.alpha})`;
                        ctx.beginPath();
                        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // 隨機產生火花在雷射交叉處
                    if (sparks.length < 20 && Math.random() < 0.02 * sm) {
                        const rx = Math.random() * W;
                        const ry = Math.random() * H;
                        for (let i = 0; i < 3; i++) sparks.push(createSpark(rx, ry));
                    }
                };

                resize();
                this._laserActive = true;
                laserTick();
            },

            _setLaserSpeed(strength) {
                if (strength === 0) this._laserSpeedMult = 0;
                else if (strength === 1) this._laserSpeedMult = 0.4;
                else this._laserSpeedMult = 1;
            },

            stopLaser() {
                if (this.laserRaf) { cancelAnimationFrame(this.laserRaf); this.laserRaf = null; }
                if (this._laserResize) window.removeEventListener('resize', this._laserResize);
                if (this._laserVisibility) document.removeEventListener('visibilitychange', this._laserVisibility);
                try { window.removeEventListener('mousemove', this._laserMouseHandler); } catch (e) {}
                if (this.laserCanvas) { try { this.laserCanvas.remove(); } catch (e) {} this.laserCanvas = null; this.laserCtx = null; }
                this._laserMouse = null;
                const particles = document.querySelector('.particles');
                if (particles) particles.style.display = (this._prevParticlesDisplay_laser === null || this._prevParticlesDisplay_laser === undefined) ? '' : this._prevParticlesDisplay_laser;
                delete this._prevParticlesDisplay_laser;
                this._laserActive = false;
            },

            // ============================================
            // 宇宙戰艦 (fleet) — 太空戰艦群穿梭飛行
            // ============================================
            startFleet(opts = {}) {
                if (this._fleetActive) return;

                try { this.stopNetwork(); } catch (e) {}
                try { this.stopMagnet(); } catch (e) {}
                try { if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas(); } catch (e) {}
                try { if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}
                try { if (typeof this.stopBubble === 'function') this.stopBubble(); } catch (e) {}
                try { if (typeof this.stopCircuit === 'function') this.stopCircuit(); } catch (e) {}
                try { if (typeof this.stopSakura === 'function') this.stopSakura(); } catch (e) {}
                try { if (typeof this.stopGlitch === 'function') this.stopGlitch(); } catch (e) {}
                try { if (typeof this.stopLaser === 'function') this.stopLaser(); } catch (e) {}

                const particlesEl = document.querySelector('.particles');
                this._prevParticlesDisplay_fleet = particlesEl ? particlesEl.style.display : null;
                if (particlesEl) particlesEl.style.display = 'none';

                if (!this.fleetCanvas) {
                    this.fleetCanvas = document.createElement('canvas');
                    this.fleetCanvas.id = 'bg-fleet-canvas';
                    this.fleetCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:-7;pointer-events:none;';
                    this.fleetCanvas.setAttribute('aria-hidden', 'true');
                    document.body.appendChild(this.fleetCanvas);
                }
                const canvas = this.fleetCanvas;
                const ctx = canvas.getContext('2d');
                this.fleetCtx = ctx;

                const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                let W, H;

                const fleetColors = [
                    { r: 0, g: 212, b: 255 },
                    { r: 255, g: 0, b: 128 },
                    { r: 139, g: 92, b: 246 },
                    { r: 0, g: 255, b: 136 },
                    { r: 255, g: 170, b: 0 }
                ];

                this._fleetSpeedMult = (this._strength === 0) ? 0 : (this._strength === 1) ? 0.4 : 1;

                let ships = [];
                let stars = []; // 背景高速星星（速度線）
                let exhaustParticles = [];

                // 戰艦造型繪製器
                const drawShip = (ship) => {
                    const c = ship.color;
                    const s = ship.size;
                    ctx.save();
                    ctx.translate(ship.x, ship.y);
                    ctx.rotate(ship.angle);

                    ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.6)`;
                    ctx.shadowBlur = 10;

                    if (ship.type === 0) {
                        // 三角戰機
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${ship.alpha})`;
                        ctx.beginPath();
                        ctx.moveTo(s, 0);
                        ctx.lineTo(-s * 0.7, -s * 0.5);
                        ctx.lineTo(-s * 0.4, 0);
                        ctx.lineTo(-s * 0.7, s * 0.5);
                        ctx.closePath();
                        ctx.fill();
                        // 引擎光
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${ship.alpha * 0.8})`;
                        ctx.beginPath();
                        ctx.ellipse(-s * 0.6, 0, s * 0.15, s * 0.25, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (ship.type === 1) {
                        // 菱形巡洋艦
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${ship.alpha * 0.8})`;
                        ctx.beginPath();
                        ctx.moveTo(s * 1.2, 0);
                        ctx.lineTo(0, -s * 0.35);
                        ctx.lineTo(-s * 0.8, 0);
                        ctx.lineTo(0, s * 0.35);
                        ctx.closePath();
                        ctx.fill();
                        // 頂部裝甲線
                        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${ship.alpha * 0.5})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(s * 0.6, 0);
                        ctx.lineTo(0, -s * 0.2);
                        ctx.lineTo(-s * 0.4, 0);
                        ctx.lineTo(0, s * 0.2);
                        ctx.closePath();
                        ctx.stroke();
                    } else {
                        // 小型無人機
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${ship.alpha})`;
                        ctx.beginPath();
                        ctx.moveTo(s * 0.5, 0);
                        ctx.lineTo(-s * 0.3, -s * 0.3);
                        ctx.lineTo(-s * 0.3, s * 0.3);
                        ctx.closePath();
                        ctx.fill();
                    }
                    ctx.restore();
                };

                const createShip = () => {
                    const color = fleetColors[Math.floor(Math.random() * fleetColors.length)];
                    const type = Math.floor(Math.random() * 3);
                    const size = type === 1 ? 8 + Math.random() * 6 : type === 0 ? 5 + Math.random() * 5 : 3 + Math.random() * 3;
                    // 從左邊出發向右飛行（可有輕微角度偏移）
                    const angle = (Math.random() - 0.5) * 0.3;
                    return {
                        x: -size * 3,
                        y: Math.random() * H,
                        size, color, type, angle,
                        speed: 0.5 + Math.random() * 2,
                        alpha: 0.3 + Math.random() * 0.5,
                        wobble: Math.random() * Math.PI * 2,
                        wobbleSpeed: 0.01 + Math.random() * 0.02,
                        wobbleAmp: 0.5 + Math.random() * 1.5
                    };
                };

                const createSpeedStar = () => ({
                    x: W + 5,
                    y: Math.random() * H,
                    length: 10 + Math.random() * 40,
                    speed: 3 + Math.random() * 8,
                    alpha: 0.1 + Math.random() * 0.3,
                    width: 0.5 + Math.random()
                });

                // 滑鼠：船隻迴避或跟隨
                this._fleetMouse = { x: -1000, y: -1000 };
                this._fleetMouseHandler = (e) => {
                    this._fleetMouse.x = e.clientX * dpr;
                    this._fleetMouse.y = e.clientY * dpr;
                };
                if (this._mouseEnabled !== false) {
                    window.addEventListener('mousemove', this._fleetMouseHandler);
                }

                const resize = () => {
                    W = Math.round(window.innerWidth * dpr);
                    H = Math.round(window.innerHeight * dpr);
                    canvas.width = W;
                    canvas.height = H;
                    ships = [];
                    const shipCount = (this._strength === 1) ? 8 : 16;
                    for (let i = 0; i < shipCount; i++) {
                        const s = createShip();
                        s.x = Math.random() * W; // 初始散佈在畫面中
                        ships.push(s);
                    }
                    stars = [];
                    const starCount = (this._strength === 1) ? 20 : 50;
                    for (let i = 0; i < starCount; i++) {
                        const st = createSpeedStar();
                        st.x = Math.random() * W;
                        stars.push(st);
                    }
                    exhaustParticles = [];
                };

                this._fleetResize = resize;
                window.addEventListener('resize', resize);

                this._fleetVisibility = () => {
                    if (document.hidden) {
                        if (this.fleetRaf) { cancelAnimationFrame(this.fleetRaf); this.fleetRaf = null; }
                    } else if (!this.fleetRaf && this._fleetActive) {
                        fleetTick();
                    }
                };
                document.addEventListener('visibilitychange', this._fleetVisibility);

                const fleetTick = () => {
                    this.fleetRaf = requestAnimationFrame(fleetTick);
                    const sm = this._fleetSpeedMult;
                    if (sm === 0) return;

                    ctx.clearRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'lighter';

                    // 背景速度星線
                    for (let i = 0; i < stars.length; i++) {
                        const st = stars[i];
                        st.x -= st.speed * sm;
                        if (st.x + st.length < 0) {
                            stars[i] = createSpeedStar();
                        }
                        ctx.strokeStyle = `rgba(200,220,255,${st.alpha})`;
                        ctx.lineWidth = st.width;
                        ctx.beginPath();
                        ctx.moveTo(st.x, st.y);
                        ctx.lineTo(st.x + st.length, st.y);
                        ctx.stroke();
                    }

                    // 更新與繪製戰艦
                    const mx = this._fleetMouse.x;
                    const my = this._fleetMouse.y;
                    for (let i = 0; i < ships.length; i++) {
                        const ship = ships[i];
                        ship.wobble += ship.wobbleSpeed * sm;
                        const wy = Math.sin(ship.wobble) * ship.wobbleAmp * sm;
                        ship.x += ship.speed * sm;
                        ship.y += wy;

                        // 滑鼠互動：靠近時微微閃避
                        if (this._mouseEnabled !== false) {
                            const dx = ship.x - mx;
                            const dy = ship.y - my;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < 120 && dist > 0) {
                                const force = (1 - dist / 120) * 1.5 * sm;
                                ship.y += (dy / dist) * force;
                            }
                        }

                        // 超出畫面
                        if (ship.x > W + ship.size * 4) {
                            ships[i] = createShip();
                        }
                        if (ship.y < -50) ship.y = H + 50;
                        if (ship.y > H + 50) ship.y = -50;

                        drawShip(ship);

                        // 引擎排氣
                        if (exhaustParticles.length < 200 && Math.random() < 0.3 * sm) {
                            const c = ship.color;
                            exhaustParticles.push({
                                x: ship.x - Math.cos(ship.angle) * ship.size,
                                y: ship.y - Math.sin(ship.angle) * ship.size,
                                vx: -ship.speed * 0.5 + (Math.random() - 0.5),
                                vy: (Math.random() - 0.5) * 0.5,
                                size: ship.size * 0.2 + Math.random() * 1.5,
                                color: c,
                                alpha: 0.4 + Math.random() * 0.3,
                                life: 0.3 + Math.random() * 0.5,
                                age: 0
                            });
                        }
                    }

                    // 排氣粒子
                    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
                        const ep = exhaustParticles[i];
                        ep.age += 0.016 * sm;
                        ep.x += ep.vx * sm;
                        ep.y += ep.vy * sm;
                        ep.alpha *= 0.96;
                        if (ep.age >= ep.life || ep.alpha < 0.01) {
                            exhaustParticles.splice(i, 1); continue;
                        }
                        const c = ep.color;
                        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${ep.alpha})`;
                        ctx.beginPath();
                        ctx.arc(ep.x, ep.y, ep.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                };

                resize();
                this._fleetActive = true;
                fleetTick();
            },

            _setFleetSpeed(strength) {
                if (strength === 0) this._fleetSpeedMult = 0;
                else if (strength === 1) this._fleetSpeedMult = 0.4;
                else this._fleetSpeedMult = 1;
            },

            stopFleet() {
                if (this.fleetRaf) { cancelAnimationFrame(this.fleetRaf); this.fleetRaf = null; }
                if (this._fleetResize) window.removeEventListener('resize', this._fleetResize);
                if (this._fleetVisibility) document.removeEventListener('visibilitychange', this._fleetVisibility);
                try { window.removeEventListener('mousemove', this._fleetMouseHandler); } catch (e) {}
                if (this.fleetCanvas) { try { this.fleetCanvas.remove(); } catch (e) {} this.fleetCanvas = null; this.fleetCtx = null; }
                this._fleetMouse = null;
                const particles = document.querySelector('.particles');
                if (particles) particles.style.display = (this._prevParticlesDisplay_fleet === null || this._prevParticlesDisplay_fleet === undefined) ? '' : this._prevParticlesDisplay_fleet;
                delete this._prevParticlesDisplay_fleet;
                this._fleetActive = false;
            },

            setStrength(value) {
                // value: 0=off,1=low,2=strong
                this._strength = value;
                
                if (value === 0) {
                    // 關閉 canvas 類動畫並移除相關 Canvas
                    this._speedMult = 0;
                    this.stopNetwork();
                    if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas();
                    if (typeof this.stopBubble === 'function') this.stopBubble();
                    // 星圖不停止，僅暫停動畫（保留視覺效果在當前幀凍結）
                    if (this.current === 'star' && this._starActive) {
                        this._setStarSpeed(0);
                    }
                    // 新主題：凍結但不停止
                    if (this.current === 'circuit' && this._circuitActive) this._setCircuitSpeed(0);
                    if (this.current === 'sakura' && this._sakuraActive) this._setSakuraSpeed(0);
                    if (this.current === 'glitch' && this._glitchActive) this._setGlitchSpeed(0);
                    if (this.current === 'laser' && this._laserActive) this._setLaserSpeed(0);
                    if (this.current === 'fleet' && this._fleetActive) this._setFleetSpeed(0);
                    return;
                }

                // 更新速度倍率（只影響 network/magnet 模式）
                this._speedMult = (value === 1) ? 0.45 : 1; // low=45% speed, strong=100%

                // 如果目前是 network 或 magnet 模式但 Canvas 不存在（之前被關閉了），重新啟動
                if (this.current === 'network' && !this.canvas) {
                    this.startNetwork();
                } else if (this.current === 'magnet' && !this.canvas) {
                    this.startMagnet();
                } else if (this.current === 'magnet' && this.canvas) {
                    // 重新啟動 magnet 以應用新的強度參數
                    this.stopNetwork();
                    this.startMagnet();
                }

                // Ensure mouse enabled/disabled state is respected after strength change
                if (typeof this.setMouseEnabled === 'function') {
                    this.setMouseEnabled(this._mouseEnabled !== false);
                }

                // 如果目前是 dom 模式，僅調整粒子數量（不改變速度）
                if (this.current === 'dom') {
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const baseCount = Math.max(30, Math.floor((w * h) / 10000));
                    const count = (value === 1) ? Math.ceil(baseCount / 2) : baseCount;
                    // 如果 canvas 已在執行，直接更新數量；否則啟動 dom canvas
                    if (this.domParticles) {
                        if (this.domParticles.length < count) {
                            // 如果需要更多，呼叫 startDomCanvas 以安全產生新陣列（會先清理舊 listeners）
                            this.startDomCanvas({ count });
                        } else if (this.domParticles.length > count) {
                            this.domParticles.length = count;
                        }
                    } else {
                        this.startDomCanvas({ count });
                    }
                }

                // 如果目前是 star 模式，更新動畫速度/暫停狀態
                if (this.current === 'star') {
                    if (!this._starActive) {
                        this.startStar();
                    } else {
                        this._setStarSpeed(value);
                    }
                }

                // 如果目前是 bubble 模式但 canvas 不存在（被 strength=0 關閉了），重新啟動
                if (this.current === 'bubble' && !this.bubbleCanvas) {
                    const bw = window.innerWidth, bh = window.innerHeight;
                    const baseC = Math.max(25, Math.floor((bw * bh) / 45000));
                    const bCount = (value === 1) ? Math.ceil(baseC * 0.6) : baseC;
                    this.startBubble({ count: bCount });
                } else if (this.current === 'bubble' && this.bubbleParticles) {
                    // 調整粒子數量
                    const bw = window.innerWidth, bh = window.innerHeight;
                    const baseC = Math.max(25, Math.floor((bw * bh) / 45000));
                    const bCount = (value === 1) ? Math.ceil(baseC * 0.6) : baseC;
                    this.bubbleDesiredCount = bCount;
                    if (this.bubbleParticles.length < bCount) {
                        for (let i = this.bubbleParticles.length; i < bCount; i++)
                            this.bubbleParticles.push(this._createBubble(true));
                    } else if (this.bubbleParticles.length > bCount) {
                        this.bubbleParticles.length = bCount;
                    }
                }

                // 如果不是以上模式，不做額外處理（network/magnet 已由 _speedMult 調整）

                // 電路脈衝
                if (this.current === 'circuit') {
                    if (!this._circuitActive) { this.startCircuit(); }
                    else { this._setCircuitSpeed(value); }
                }
                // 櫻花飄落
                if (this.current === 'sakura') {
                    if (!this._sakuraActive) { this.startSakura(); }
                    else { this._setSakuraSpeed(value); }
                }
                // 故障雜訊
                if (this.current === 'glitch') {
                    if (!this._glitchActive) { this.startGlitch(); }
                    else { this._setGlitchSpeed(value); }
                }
                // 雷射禁地
                if (this.current === 'laser') {
                    if (!this._laserActive) { this.startLaser(); }
                    else { this._setLaserSpeed(value); }
                }
                // 宇宙戰艦
                if (this.current === 'fleet') {
                    if (!this._fleetActive) { this.startFleet(); }
                    else { this._setFleetSpeed(value); }
                }
            },



            setMouseEnabled(enabled) {
                this._mouseEnabled = !!enabled;
                if (!this._mouseEnabled) {
                    // 移除所有模式的滑鼠監聽器
                    try { window.removeEventListener('mousemove', this._mouseHandler); } catch (e) {}
                    try { window.removeEventListener('mousemove', this._starMouseHandler); } catch (e) {}
                    try { window.removeEventListener('mousemove', this._domMouse); } catch (e) {}
                    try { window.removeEventListener('mousemove', this._circuitMouseHandler); } catch (e) {}
                    try { window.removeEventListener('mousemove', this._sakuraMouseHandler); } catch (e) {}
                    try { window.removeEventListener('click', this._glitchMouseHandler); } catch (e) {}
                    try { window.removeEventListener('mousemove', this._laserMouseHandler); } catch (e) {}
                    try { window.removeEventListener('mousemove', this._fleetMouseHandler); } catch (e) {}
                    this.mouse = { x: -10000, y: -10000 };
                    // 重置星圖視差位置到中心
                    if (this._starMouse) {
                        this._starMouse.x = 0.5; this._starMouse.y = 0.5;
                        this._starMouse.targetX = 0.5; this._starMouse.targetY = 0.5;
                    }
                    // 重置各模式滑鼠座標
                    if (this._circuitMouse) { this._circuitMouse.x = -1000; this._circuitMouse.y = -1000; }
                    if (this._sakuraMouse) { this._sakuraMouse.x = -1000; this._sakuraMouse.y = -1000; }
                    if (this._glitchMouse) { this._glitchMouse.x = -1000; this._glitchMouse.y = -1000; this._glitchMouse.active = false; }
                    if (this._laserMouse) { this._laserMouse.x = -1000; this._laserMouse.y = -1000; }
                    if (this._fleetMouse) { this._fleetMouse.x = -1000; this._fleetMouse.y = -1000; }
                } else {
                    // 重新掛載目前運行模式的滑鼠監聽器
                    if (this.current === 'network' || this.current === 'magnet') {
                        if (this._mouseHandler) {
                            try { window.addEventListener('mousemove', this._mouseHandler); } catch (e) {}
                        }
                    } else if (this.current === 'star') {
                        if (this._starMouseHandler) {
                            try { window.addEventListener('mousemove', this._starMouseHandler); } catch (e) {}
                        }
                    } else if (this.current === 'dom') {
                        if (this._domMouse) {
                            try { window.addEventListener('mousemove', this._domMouse); } catch (e) {}
                        }
                    } else if (this.current === 'circuit') {
                        if (this._circuitMouseHandler) {
                            try { window.addEventListener('mousemove', this._circuitMouseHandler); } catch (e) {}
                        }
                    } else if (this.current === 'sakura') {
                        if (this._sakuraMouseHandler) {
                            try { window.addEventListener('mousemove', this._sakuraMouseHandler); } catch (e) {}
                        }
                    } else if (this.current === 'glitch') {
                        if (this._glitchMouseHandler) {
                            try { window.addEventListener('click', this._glitchMouseHandler); } catch (e) {}
                        }
                    } else if (this.current === 'laser') {
                        if (this._laserMouseHandler) {
                            try { window.addEventListener('mousemove', this._laserMouseHandler); } catch (e) {}
                        }
                    } else if (this.current === 'fleet') {
                        if (this._fleetMouseHandler) {
                            try { window.addEventListener('mousemove', this._fleetMouseHandler); } catch (e) {}
                        }
                    }
                }
                return this._mouseEnabled;
            },

            // ============================================
            // 氣泡派對 (bubble) — 空心圓環粒子
            // ============================================
            startBubble(opts = {}) {
                try {
                    // 停止其他 canvas 動畫
                    if (typeof this.stopBubble === 'function') this.stopBubble();
                    try { this.stopNetwork(); } catch (e) {}
                    try { this.stopMagnet(); } catch (e) {}
                    try { if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas(); } catch (e) {}
                    try { if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}

                    // 建立 canvas
                    if (!this.bubbleCanvas) {
                        this.bubbleCanvas = document.getElementById('bg-bubble-canvas') || document.createElement('canvas');
                        this.bubbleCanvas.id = 'bg-bubble-canvas';
                        this.bubbleCanvas.style.position = 'fixed';
                        this.bubbleCanvas.style.inset = '0';
                        this.bubbleCanvas.style.width = '100%';
                        this.bubbleCanvas.style.height = '100%';
                        this.bubbleCanvas.style.display = 'block';
                        this.bubbleCanvas.style.zIndex = '-7';
                        this.bubbleCanvas.style.pointerEvents = 'none';
                        this.bubbleCanvas.setAttribute('aria-hidden', 'true');
                        document.body.insertBefore(this.bubbleCanvas, document.body.firstChild);
                    }
                    this.bubbleCtx = this.bubbleCanvas.getContext('2d');
                    this.bubbleDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));

                    // 讀取主題色（僅藍、紫、粉紅三色系）
                    const css = getComputedStyle(document.documentElement || document.body);
                    const cyanHex = (css.getPropertyValue('--primary-cyan') || '#00d4ff').trim();
                    const magentaHex = (css.getPropertyValue('--primary-magenta') || '#ff0080').trim();
                    const accentHex = (css.getPropertyValue('--accent-purple') || '#8b5cf6').trim();

                    function hexToRgb(hex) {
                        hex = (hex || '').replace('#', '').trim();
                        if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
                        const n = parseInt(hex, 16);
                        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
                    }

                    this._bubbleColors = [
                        hexToRgb(cyanHex),      // 藍
                        hexToRgb(magentaHex),    // 粉紅
                        hexToRgb(accentHex)      // 紫
                    ];

                    // 粒子建立（數量適中，避免過多）
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const baseCount = Math.max(25, Math.floor((w * h) / 45000));
                    const count = opts.count || ((this._strength === 1) ? Math.ceil(baseCount * 0.6) : baseCount);
                    this.bubbleDesiredCount = count;

                    const colors = this._bubbleColors;
                    const lerpRgb = (a, b, t) => ({
                        r: Math.round(a.r + (b.r - a.r) * t),
                        g: Math.round(a.g + (b.g - a.g) * t),
                        b: Math.round(a.b + (b.b - a.b) * t)
                    });

                    const createBubble = (isInitial) => {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 0.3 + Math.random() * 1.2;
                        const colorIdx = Math.floor(Math.random() * colors.length);
                        const nextColorIdx = (colorIdx + 1 + Math.floor(Math.random() * (colors.length - 1))) % colors.length;
                        const maxLife = 200 + Math.random() * 250;
                        return {
                            x: Math.random() * w,
                            y: Math.random() * h,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            baseSize: 10 + Math.random() * 25,
                            size: 0,
                            lineWidth: 1 + Math.random() * 3,
                            maxAlpha: 0.55 + Math.random() * 0.4,
                            alpha: 0,
                            colorFrom: colors[colorIdx],
                            colorTo: colors[nextColorIdx],
                            colorProgress: 0,
                            colorSpeed: 0.003 + Math.random() * 0.008, // 漸變速度
                            maxLife: maxLife,
                            life: isInitial ? Math.random() * maxLife : 0
                        };
                    };

                    this.bubbleParticles = [];
                    for (let i = 0; i < count; i++) {
                        this.bubbleParticles.push(createBubble(true));
                    }
                    this._createBubble = createBubble;

                    // resize handler
                    const resize = () => {
                        const rw = window.innerWidth;
                        const rh = window.innerHeight;
                        this.bubbleDpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
                        this.bubbleCanvas.width = Math.round(rw * this.bubbleDpr);
                        this.bubbleCanvas.height = Math.round(rh * this.bubbleDpr);
                        this.bubbleCanvas.style.width = rw + 'px';
                        this.bubbleCanvas.style.height = rh + 'px';
                        this.bubbleCtx.setTransform(this.bubbleDpr, 0, 0, this.bubbleDpr, 0, 0);

                        const newCount = opts.count || ((this._strength === 1)
                            ? Math.ceil(Math.max(25, Math.floor((rw * rh) / 45000)) * 0.6)
                            : Math.max(25, Math.floor((rw * rh) / 45000)));
                        this.bubbleDesiredCount = newCount;
                        if (this.bubbleParticles.length < newCount) {
                            for (let i = this.bubbleParticles.length; i < newCount; i++)
                                this.bubbleParticles.push(createBubble(true));
                        } else if (this.bubbleParticles.length > newCount) {
                            this.bubbleParticles.length = newCount;
                        }
                    };

                    this._bubbleResize = Core.debounce(resize, 120);
                    window.addEventListener('resize', this._bubbleResize);

                    // 動畫迴圈
                    const loop = () => {
                        try {
                            const ctx = this.bubbleCtx;
                            const cw = this.bubbleCanvas.width / this.bubbleDpr;
                            const ch = this.bubbleCanvas.height / this.bubbleDpr;

                            // 完全清除畫布（透明背景，保留原有漸層+網格可見）
                            ctx.clearRect(0, 0, cw, ch);
                            ctx.globalCompositeOperation = 'source-over';

                            for (const p of this.bubbleParticles) {
                                // 位移
                                p.x += p.vx;
                                p.y += p.vy;
                                p.life++;

                                const progress = p.life / p.maxLife;

                                // 淡入+放大 (前 20%) / 淡出+縮小 (後 20%) / 維持
                                if (progress < 0.2) {
                                    const ratio = progress / 0.2;
                                    p.alpha = p.maxAlpha * ratio;
                                    p.size = p.baseSize * ratio;
                                } else if (progress > 0.8) {
                                    const ratio = (1 - progress) / 0.2;
                                    p.alpha = Math.max(0, p.maxAlpha * ratio);
                                    p.size = Math.max(0, p.baseSize * ratio);
                                } else {
                                    p.alpha = p.maxAlpha;
                                    p.size = p.baseSize;
                                }

                                // 顏色漸變（慢慢漸變，非瞬間切換）
                                p.colorProgress += p.colorSpeed;
                                if (p.colorProgress >= 1) {
                                    p.colorProgress = 0;
                                    p.colorFrom = p.colorTo;
                                    const nextIdx = (colors.indexOf(p.colorTo) + 1 + Math.floor(Math.random() * (colors.length - 1))) % colors.length;
                                    p.colorTo = colors[nextIdx];
                                }
                                const c = lerpRgb(p.colorFrom, p.colorTo, p.colorProgress);

                                // 生命結束 → 重置
                                if (p.life >= p.maxLife) {
                                    Object.assign(p, createBubble(false));
                                    p.x = Math.random() * cw;
                                    p.y = Math.random() * ch;
                                    continue;
                                }

                                // 繪製空心圓環（帶霓虹光暈）
                                if (p.size <= 0.5 || p.alpha <= 0.01) continue;
                                ctx.save();
                                ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${(p.alpha * 0.7).toFixed(3)})`;
                                ctx.shadowBlur = 12 + p.size * 0.4;
                                ctx.beginPath();
                                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                                ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${p.alpha.toFixed(3)})`;
                                ctx.lineWidth = p.lineWidth;
                                ctx.stroke();
                                ctx.restore();
                            }
                        } catch (e) {
                            console.warn('bubble loop error', e);
                        }
                        this.bubbleRaf = requestAnimationFrame(loop);
                    };

                    resize();
                    loop();
                } catch (e) {
                    console.warn('startBubble error', e);
                }
            },

            stopBubble() {
                if (this.bubbleRaf) { cancelAnimationFrame(this.bubbleRaf); this.bubbleRaf = null; }
                window.removeEventListener('resize', this._bubbleResize);
                if (this.bubbleCanvas) {
                    try { this.bubbleCanvas.remove(); } catch (e) {}
                    this.bubbleCanvas = null; this.bubbleCtx = null;
                }
                this.bubbleParticles = [];
                this._createBubble = null;
            },

            stopNetwork() {
                if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
                window.removeEventListener('resize', this._resizeHandler);
                window.removeEventListener('mousemove', this._mouseHandler);
                if (this.canvas) {
                    try { this.canvas.remove(); } catch (e) {}
                    this.canvas = null; this.ctx = null;
                }
                this.particles = [];
                this.mouse = { x: -10000, y: -10000 };
            },

            // magnet 與 network 共用相同的 canvas / rafId，清理邏輯一致
            stopMagnet() {
                this.stopNetwork();
            },

            stop() {
                // 停止 network 並清除 DOM 粒子 / canvas
                this.stopNetwork();
                if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas();
                // 停止 star 背景（若存在）
                if (typeof this.stopStar === 'function') this.stopStar();
                // 停止 bubble 背景（若存在）
                if (typeof this.stopBubble === 'function') this.stopBubble();
                // 停止新增主題背景
                if (typeof this.stopCircuit === 'function') this.stopCircuit();
                if (typeof this.stopSakura === 'function') this.stopSakura();
                if (typeof this.stopGlitch === 'function') this.stopGlitch();
                if (typeof this.stopLaser === 'function') this.stopLaser();
                if (typeof this.stopFleet === 'function') this.stopFleet();
                const c = document.querySelector('.particles');
                if (c) c.innerHTML = '';
            }
        };

        this.BackgroundManager = mgr;
    },

    /**
     * 數字計數動畫
     * 用於統計數字的動態展示
     */
    animateNumber(element, target, duration = 2000) {
        if (!element) return;
        
        const start = 0;
        const increment = target / (duration / 16); // 60fps
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current);
            }
        }, 16);
    },

    /**
     * 滾動顯示動畫
     * 元素進入視口時觸發動畫
     */
    initScrollReveal() {
        const reveals = document.querySelectorAll('.scroll-reveal');
        if (reveals.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        });

        reveals.forEach(element => observer.observe(element));
    },

    /**
     * 平滑滾動
     * 點擊錨點平滑滾動到目標位置
     */
    initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#') return;
                
                e.preventDefault();
                const target = document.querySelector(href);
                
                if (target) {
                    // 根據 header 實際高度計算預設 offset，並可由錨點 data-offset 覆蓋（單位 px）
                    const headerEl = document.querySelector('header');
                    const defaultHeaderOffset = headerEl ? headerEl.offsetHeight : 80;
                    const anchorOffset = parseInt(this.getAttribute('data-offset'), 10);
                    const headerOffset = !isNaN(anchorOffset) ? anchorOffset : defaultHeaderOffset;

                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    },


    /**
     * 打字機效果
     * 逐字顯示文字
     */
    typewriter(element, text, speed = 100) {
        if (!element) return;
        
        let i = 0;
        element.textContent = '';
        
        const timer = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(timer);
            }
        }, speed);
    },

    /**
     * 加載圖片
     * 帶錯誤處理的圖片加載
     */
    loadImage(src, fallback = 'assets/images/placeholder.png') {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = () => resolve(fallback);
            img.src = src;
        });
    },

    /**
     * 防抖函數
     * 限制函數執行頻率
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 節流函數
     * 確保函數在指定時間內只執行一次
     */
    throttle(func, limit = 100) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * 獲取查詢參數
     */
    getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    /**
     * 存儲到 localStorage
     */
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage error:', e);
                return false;
            }
        },
        
        get(key) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                console.error('Storage error:', e);
                return null;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Storage error:', e);
                return false;
            }
        }
    },

    /**
     * 複製文字到剪貼簿
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    },

    /**
     * 格式化日期
     */
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    }
};

// 導出供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Core;
}