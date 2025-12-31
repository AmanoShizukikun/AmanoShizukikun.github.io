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
                        try { this.stopNetwork(); this.stopMagnet(); if (typeof this.stopStar === 'function') this.stopStar(); } catch (e) {}
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
                    // 特殊背景 - 宇宙星圜
                    this.startStar(opts);
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
                    this.dpr = Math.max(1, window.devicePixelRatio || 1);
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
                    this.dpr = Math.max(1, window.devicePixelRatio || 1);
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
                        this.domDpr = Math.max(1, window.devicePixelRatio || 1);
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
                if (this._mouseEnabled) window.removeEventListener('mousemove', this._domMouse);
                if (this._domVisibilityHandler) document.removeEventListener('visibilitychange', this._domVisibilityHandler);
                if (this.domCanvas) { try { this.domCanvas.remove(); } catch (e) {} this.domCanvas = null; this.domCtx = null; }
                // remove sprite caches
                this.domSpritePrimary = null; this.domSpriteSecondary = null; this.domSpriteAccent = null;
                this.domParticles = [];
            },
            startStar(opts = {}) {
                // 創建或顯示宇宙星圜背景
                if (this._starActive) return;

                const grid = document.querySelector('.grid-overlay');
                const particles = document.querySelector('.particles');

                // 隱藏僅粒子容器（保留網格以便與星圖同時顯示）
                this._prevParticlesDisplay = particles ? particles.style.display : null;
                if (particles) particles.style.display = 'none';

                // 保存並套用 body 背景（讓整體看起來像 star.html）
                this._prevBodyBg = document.body.style.background || '';
                document.body.style.background = 'rgb(0,0,0)';

                // 建立 star DOM
                let starBg = document.getElementById('star-bg');
                if (!starBg) {
                    starBg = document.createElement('div');
                    starBg.id = 'star-bg';
                    starBg.className = 'star-bg';
                    starBg.setAttribute('aria-hidden', 'true');
                    starBg.innerHTML = `
                        <div id="solar-system">
                            <div id="sun"></div>
                            <div id="mercury-wrapper"><div id="mercury" class="planet"></div></div>
                            <div id="venus-wrapper"><div id="venus" class="planet"></div></div>
                            <div id="earth-wrapper"><div id="earth" class="planet"></div></div>
                            <div id="mars-wrapper"><div id="mars" class="planet"></div></div>
                        </div>
                    `;
                    document.body.insertBefore(starBg, document.body.firstChild);
                } else {
                    starBg.style.display = '';
                }

                // 隨機決定哪些行星會閃爍（earth 機率較高），並為其設置隨機持續時間與延遲，避免同步閃爍
                (function assignPlanetBlinks() {
                    try {
                        const chances = { earth: 0.9, venus: 0.4, mercury: 0.3, mars: 0.2 };
                        ['mercury','venus','earth','mars'].forEach(name => {
                            const el = document.getElementById(name);
                            if (!el) return;
                            const chance = chances[name] || 0.3;
                            if (Math.random() < chance) {
                                el.classList.add('blink');
                                // small chance to prefer slow or fast
                                if (Math.random() < 0.25) el.classList.add('slow');
                                else if (Math.random() < 0.25) el.classList.add('fast');
                                // set random duration and delay to de-sync
                                const dur = (1.2 + Math.random() * 2.4).toFixed(2) + 's'; // 1.2 - 3.6s
                                const delay = (Math.random() * 3).toFixed(2) + 's';
                                el.style.setProperty('--blink-duration', dur);
                                el.style.setProperty('--blink-delay', delay);
                            } else {
                                el.classList.remove('blink','slow','fast');
                                el.style.removeProperty('--blink-duration');
                                el.style.removeProperty('--blink-delay');
                            }
                        });
                    } catch (e) { console.warn('assignPlanetBlinks error', e); }
                })();

                this._starActive = true;
            },



            stopStar() {
                const starBg = document.getElementById('star-bg');
                if (starBg) {
                    try { starBg.remove(); } catch (e) {}
                }
                // restore previous display (只恢復粒子容器，網格保持不變)
                const particles = document.querySelector('.particles');
                if (particles) particles.style.display = (this._prevParticlesDisplay === null || this._prevParticlesDisplay === undefined) ? '' : this._prevParticlesDisplay;

                // 恢復 body 背景
                if (typeof this._prevBodyBg !== 'undefined') {
                    document.body.style.background = this._prevBodyBg || '';
                    delete this._prevBodyBg;
                }

                delete this._prevParticlesDisplay;
                this._starActive = false;
            },

            setStrength(value) {
                // value: 0=off,1=low,2=strong
                this._strength = value;
                
                if (value === 0) {
                    // 關閉所有 background 動畫並移除相關 Canvas
                    this._speedMult = 0;
                    this.stopNetwork();
                    if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas();
                    if (typeof this.stopStar === 'function') this.stopStar();
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

                // 如果不是 dom 模式，不做額外處理（network/magnet 已由 _speedMult 調整）
            },



            setMouseEnabled(enabled) {
                this._mouseEnabled = !!enabled;
                // if disabling, clear mouse and remove listener
                if (!this._mouseEnabled) {
                    try { window.removeEventListener('mousemove', this._mouseHandler); } catch (e) {}
                    this.mouse = { x: -10000, y: -10000 };
                } else {
                    // reattach handler if in a running canvas mode
                    if (this._mouseHandler && (this.current === 'network' || this.current === 'magnet')) {
                        try { window.addEventListener('mousemove', this._mouseHandler); } catch (e) {}
                    }
                }
                return this._mouseEnabled;
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

            stop() {
                // 停止 network 並清除 DOM 粒子 / canvas
                this.stopNetwork();
                if (typeof this.stopDomCanvas === 'function') this.stopDomCanvas();
                // 停止 star 背景（若存在）
                if (typeof this.stopStar === 'function') this.stopStar();
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