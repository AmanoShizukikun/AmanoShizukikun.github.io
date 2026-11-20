'use strict';
(function () {
    const ANIMATE_TIME = 30;
    const OPACITY_STEP = 1 / ANIMATE_TIME;
    const MOUSE_RADIUS = 60;
    const REPEL_FORCE = 0.85;
    const PIXEL_GAP = 4;       // default gap for text/draw sources
    const IMG_PIXEL_GAP = 5;   // slightly sparser for photo/portrait images
    const PARTICLE_SIZE = 1.2;

    /* ============================================================
       ArkParticle — Individual particle
       ============================================================ */
    class ArkParticle {
        constructor(totalX, totalY, canvasW, canvasH, time, color) {
            this.x = (Math.random() * canvasW) >> 0;
            this.y = (Math.random() * canvasH) >> 0;
            this.totalX = totalX;
            this.totalY = totalY;
            this.time = time;
            this.r = PARTICLE_SIZE;
            this.color = [color[0], color[1], color[2], color[3]];
            this.opacity = 0;
            this.vx = 0;
            this.vy = 0;
        }

        draw(ctx) {
            ctx.fillStyle = 'rgba(' + this.color[0] + ',' + this.color[1] + ',' + this.color[2] + ',' + this.opacity + ')';
            ctx.fillRect(this.x, this.y, this.r * 2, this.r * 2);
        }

        update(mouseX, mouseY) {
            var mx = this.totalX - this.x;
            var my = this.totalY - this.y;
            this.vx = mx / this.time;
            this.vy = my / this.time;

            if (mouseX && mouseY) {
                var dx = mouseX - this.x;
                var dy = mouseY - this.y;
                var distance = Math.sqrt(dx * dx + dy * dy);
                var disPercent = MOUSE_RADIUS / distance;
                if (disPercent > 7) disPercent = 7;
                var angle = Math.atan2(dy, dx);
                this.vx += Math.cos(angle) * disPercent * -REPEL_FORCE;
                this.vy += Math.sin(angle) * disPercent * -REPEL_FORCE;
            }

            this.x += this.vx;
            this.y += this.vy;
            if (this.opacity < 1) this.opacity += OPACITY_STEP;
        }

        change(x, y, color) {
            this.totalX = x;
            this.totalY = y;
            this.color = [color[0], color[1], color[2], color[3]];
        }
    }

    /* ============================================================
       ArkSource — Particle data source
       ============================================================ */
    class ArkSource {
        constructor(name) {
            this.name = name;
            this.particleData = [];
            this.loaded = false;
        }

        /**
         * Create a source from an image URL.
         * Image is drawn into a temp canvas, pixels are sampled.
         * @param {string} src - Image URL or relative path
         * @param {string} name - Display name
         * @param {number} canvasW - Target canvas width
         * @param {number} canvasH - Target canvas height
         * @param {number} [pixelGap] - Sampling gap (default IMG_PIXEL_GAP)
         * @param {string} [bgColor] - Optional background color to skip (e.g.'#ffb6c1' to filter pink bg)
         */
        static fromImage(src, name, canvasW, canvasH, pixelGap, bgColor) {
            var gap = pixelGap || IMG_PIXEL_GAP;
            var source = new ArkSource(name);
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = src;
            img.onload = function () {
                var imgW = canvasW;
                var imgH = ~~(canvasW * (img.height / img.width));
                var offsetY = Math.max(0, (canvasH - imgH) / 2);
                try {
                    source._extract(imgW, imgH, function (ctx) {
                        ctx.drawImage(img, 0, 0, imgW, imgH);
                    }, offsetY, gap, bgColor);
                } catch (e) {
                    // SecurityError on file:// — fallback to 'NS' text
                    console.warn('[ArkParticles] Canvas tainted (file:// CORS). Falling back to text source. Error:', e.message);
                    var fallback = ArkSource.fromText('NS', 'bold 160px Orbitron, monospace', '#ff69b4', canvasW, canvasH);
                    fallback.particleData.forEach(function (p) { source.particleData.push(p); });
                    source.loaded = true;
                }
            };
            img.onerror = function () {
                console.warn('[ArkParticles] Image load failed:', src);
                // Fallback: use 'NS' text source so canvas is not empty
                var fallback = ArkSource.fromText('NS', 'bold 160px Orbitron, monospace', '#ff69b4', canvasW, canvasH);
                fallback.particleData.forEach(function(p) { source.particleData.push(p); });
                source.loaded = true;
            };
            return source;
        }

        /**
         * Create a source from rendered text.
         */
        static fromText(text, font, fillStyle, canvasW, canvasH) {
            var source = new ArkSource(text);
            source._extract(canvasW, canvasH, function (ctx) {
                ctx.fillStyle = fillStyle;
                ctx.font = font;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, canvasW / 2, canvasH / 2);
            }, 0);
            return source;
        }

        /**
         * Create a source from a custom drawing function.
         */
        static fromDraw(name, canvasW, canvasH, drawFn) {
            var source = new ArkSource(name);
            source._extract(canvasW, canvasH, drawFn, 0);
            return source;
        }

        /** Internal: extract pixel data from a temp canvas
         * @param {number} w - canvas width
         * @param {number} h - canvas height
         * @param {Function} drawFn - function(ctx, w, h) that draws onto the canvas
         * @param {number} offsetY - vertical offset for centering
         * @param {number} [gap] - sampling gap (default PIXEL_GAP)
         * @param {string} [bgColor] - optional background color to exclude (hex)
         */
        _extract(w, h, drawFn, offsetY, gap, bgColor) {
            var step = gap || PIXEL_GAP;
            var tmp = document.createElement('canvas');
            tmp.width = w;
            tmp.height = h;
            var ctx = tmp.getContext('2d');
            drawFn(ctx, w, h);
            var data = ctx.getImageData(0, 0, w, h).data;

            // Parse bgColor hex to rgb for exclusion (optional)
            var bgR = -1, bgG = -1, bgB = -1, bgTol = 30;
            if (bgColor) {
                var hex = bgColor.replace('#', '');
                bgR = parseInt(hex.substring(0, 2), 16);
                bgG = parseInt(hex.substring(2, 4), 16);
                bgB = parseInt(hex.substring(4, 6), 16);
            }

            for (var y = 0; y < h; y += step) {
                for (var x = 0; x < w; x += step) {
                    var idx = (x + y * w) * 4;
                    var r = data[idx];
                    var g = data[idx + 1];
                    var b = data[idx + 2];
                    var a = data[idx + 3];
                    // Skip nearly transparent pixels
                    if (a < 30) continue;
                    // Skip near-background color if specified
                    if (bgR >= 0 &&
                        Math.abs(r - bgR) < bgTol &&
                        Math.abs(g - bgG) < bgTol &&
                        Math.abs(b - bgB) < bgTol) continue;
                    // Skip very dark near-black pixels (no visual info)
                    if (r + g + b < 30) continue;
                    this.particleData.push({
                        totalX: x,
                        totalY: y + offsetY,
                        color: [r, g, b, Math.min(255, a)]
                    });
                }
            }
            this.loaded = true;
        }
    }

    /* ============================================================
       ArkParticleCanvas — Canvas controller with mouse repulsion
       ============================================================ */
    class ArkParticleCanvas {
        constructor(canvasEl) {
            this.canvas = canvasEl;
            this.ctx = canvasEl.getContext('2d');
            this.width = canvasEl.width;
            this.height = canvasEl.height;
            this.particles = [];
            this.mouseX = 0;
            this.mouseY = 0;
            this._running = false;
            this._raf = null;

            var self = this;
            this.canvas.addEventListener('mousemove', function (e) {
                var rect = self.canvas.getBoundingClientRect();
                var scaleX = self.width / rect.width;
                var scaleY = self.height / rect.height;
                self.mouseX = (e.clientX - rect.left) * scaleX;
                self.mouseY = (e.clientY - rect.top) * scaleY;
            });
            this.canvas.addEventListener('mouseleave', function () {
                self.mouseX = 0;
                self.mouseY = 0;
            });
        }

        /**
         * Switch to a new particle source with smooth transition.
         * Existing particles morph to new positions; new/removed particles are handled.
         */
        changeImg(source) {
            if (!source || !source.loaded || source.particleData.length === 0) return;

            if (this.particles.length > 0) {
                var newData = source.particleData;
                var newLen = newData.length;
                var arr = this.particles;

                for (var i = 0; i < newLen; i++) {
                    var d = newData[i];
                    if (arr[i]) {
                        arr[i].change(d.totalX, d.totalY, d.color);
                    } else {
                        arr[i] = new ArkParticle(d.totalX, d.totalY, this.width, this.height, ANIMATE_TIME, d.color);
                    }
                }

                if (newLen < arr.length) {
                    this.particles = arr.splice(0, newLen);
                }

                // Shuffle target positions for natural transition
                var shuffled = this.particles;
                var len = shuffled.length;
                while (len) {
                    var ri = ~~(Math.random() * len--);
                    var rp = shuffled[ri];
                    var tx = rp.totalX, ty = rp.totalY, tc = rp.color;
                    rp.totalX = shuffled[len].totalX;
                    rp.totalY = shuffled[len].totalY;
                    rp.color = shuffled[len].color;
                    shuffled[len].totalX = tx;
                    shuffled[len].totalY = ty;
                    shuffled[len].color = tc;
                }
            } else {
                var self = this;
                this.particles = source.particleData.map(function (item) {
                    return new ArkParticle(item.totalX, item.totalY, self.width, self.height, ANIMATE_TIME, item.color);
                });
            }
        }

        /** Draw one frame */
        draw() {
            this.ctx.clearRect(0, 0, this.width, this.height);
            var mx = this.mouseX;
            var my = this.mouseY;
            for (var i = 0, len = this.particles.length; i < len; i++) {
                this.particles[i].update(mx, my);
                this.particles[i].draw(this.ctx);
            }
        }

        /** Start self-running animation loop */
        start() {
            if (this._running) return;
            this._running = true;
            var self = this;
            function loop() {
                if (!self._running) return;
                self.draw();
                self._raf = requestAnimationFrame(loop);
            }
            loop();
        }

        /** Stop animation loop */
        stop() {
            this._running = false;
            if (this._raf) {
                cancelAnimationFrame(this._raf);
                this._raf = null;
            }
        }

        /** Resize canvas */
        resize(w, h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.width = w;
            this.height = h;
        }
    }

    /* ============================================================
       ArkController — High-level controller to set up the full
       particle animation with source switching
       ============================================================ */
    class ArkController {
        constructor(canvasEl, btnContainer) {
            this.canvasEl = canvasEl;
            this.btnContainer = btnContainer;
            this.arkCanvas = null;
            this.sources = [];
            this.activeIdx = -1;
        }

        init() {
            var w = this.canvasEl.width;
            var h = this.canvasEl.height;

            this.arkCanvas = new ArkParticleCanvas(this.canvasEl);

            // Create particle sources
            this.sources = [
                // 0) NS-V2.png portrait → pixel-sampled colour particles
                ArkSource.fromImage(
                    'images/NS-V2.png',
                    'PORTRAIT',
                    w, h,
                               // sample every 5px
                ),
                // 1) "NS" logo text
                ArkSource.fromText(
                    'NS',
                    'bold 160px Orbitron, monospace',
                    '#ff69b4',
                    w, h
                ),
                // 2) "SAKURA" text
                ArkSource.fromText(
                    'SAKURA',
                    'bold 72px Orbitron, monospace',
                    '#00d4ff',
                    w, h
                ),
                // 3) "長門櫻" CJK text
                ArkSource.fromText(
                    '長門櫻',
                    'bold 100px "Noto Sans TC", sans-serif',
                    '#ff69b4',
                    w, h
                ),
                // 4) Fox silhouette (drawn programmatically)
                ArkSource.fromDraw('FOX', w, h, function (ctx, cw, ch) {
                    var cx = cw / 2, cy = ch / 2;
                    ctx.strokeStyle = '#ff69b4';
                    ctx.fillStyle = '#ff69b4';
                    ctx.lineWidth = 3;

                    // Fox ears
                    ctx.beginPath();
                    ctx.moveTo(cx - 80, cy - 130);
                    ctx.lineTo(cx - 40, cy - 30);
                    ctx.lineTo(cx - 15, cy - 60);
                    ctx.closePath();
                    ctx.fill();

                    ctx.beginPath();
                    ctx.moveTo(cx + 80, cy - 130);
                    ctx.lineTo(cx + 40, cy - 30);
                    ctx.lineTo(cx + 15, cy - 60);
                    ctx.closePath();
                    ctx.fill();

                    // Head
                    ctx.beginPath();
                    ctx.arc(cx, cy - 10, 55, 0, Math.PI * 2);
                    ctx.fill();

                    // Eyes
                    ctx.fillStyle = '#00d4ff';
                    ctx.beginPath();
                    ctx.ellipse(cx - 22, cy - 20, 10, 7, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(cx + 22, cy - 20, 10, 7, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Body
                    ctx.fillStyle = '#ff69b4';
                    ctx.beginPath();
                    ctx.moveTo(cx - 45, cy + 30);
                    ctx.quadraticCurveTo(cx - 55, cy + 80, cx - 45, cy + 140);
                    ctx.lineTo(cx + 45, cy + 140);
                    ctx.quadraticCurveTo(cx + 55, cy + 80, cx + 45, cy + 30);
                    ctx.closePath();
                    ctx.fill();

                    // Tail
                    ctx.lineWidth = 8;
                    ctx.strokeStyle = '#ff69b4';
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(cx + 40, cy + 90);
                    ctx.quadraticCurveTo(cx + 100, cy + 40, cx + 110, cy);
                    ctx.quadraticCurveTo(cx + 115, cy - 30, cx + 95, cy - 15);
                    ctx.stroke();
                }),
                // 5) Hexagon logo
                ArkSource.fromDraw('HEX', w, h, function (ctx, cw, ch) {
                    var cx = cw / 2, cy = ch / 2;
                    var r = 120;
                    ctx.strokeStyle = '#ff69b4';
                    ctx.lineWidth = 4;

                    // Outer hex
                    ctx.beginPath();
                    for (var i = 0; i < 6; i++) {
                        var angle = (Math.PI / 3) * i - Math.PI / 2;
                        var px = cx + r * Math.cos(angle);
                        var py = cy + r * Math.sin(angle);
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();

                    // Inner hex
                    var r2 = 80;
                    ctx.strokeStyle = 'rgba(255,105,180,0.6)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (var i = 0; i < 6; i++) {
                        var angle = (Math.PI / 3) * i - Math.PI / 2;
                        var px = cx + r2 * Math.cos(angle);
                        var py = cy + r2 * Math.sin(angle);
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();

                    // "NS" text in center
                    ctx.fillStyle = '#ff69b4';
                    ctx.font = 'bold 60px Orbitron, monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('NS', cx, cy);

                    // Decorative dots at vertices
                    ctx.fillStyle = '#00d4ff';
                    for (var i = 0; i < 6; i++) {
                        var angle = (Math.PI / 3) * i - Math.PI / 2;
                        var px = cx + r * Math.cos(angle);
                        var py = cy + r * Math.sin(angle);
                        ctx.beginPath();
                        ctx.arc(px, py, 5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                })
            ];

            // Bind button clicks
            var self = this;
            if (this.btnContainer) {
                var btns = this.btnContainer.querySelectorAll('.ark-btn');
                btns.forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var idx = parseInt(btn.getAttribute('data-ark-idx'), 10);
                        self.switchTo(idx);
                        // Update active btn
                        btns.forEach(function (b) { b.classList.remove('active'); });
                        btn.classList.add('active');
                    });
                });
            }

            // Start animation loop
            this.arkCanvas.start();

            // Auto-select first source after a short delay (fonts need to load)
            setTimeout(function () { self.switchTo(0); }, 300);
        }

        switchTo(idx) {
            if (idx < 0 || idx >= this.sources.length) return;
            if (!this.sources[idx].loaded) {
                // Retry after a moment if not yet loaded (image sources)
                var self = this;
                setTimeout(function () { self.switchTo(idx); }, 200);
                return;
            }
            this.activeIdx = idx;
            this.arkCanvas.changeImg(this.sources[idx]);
        }

        resize(w, h) {
            if (this.arkCanvas) {
                this.arkCanvas.resize(w, h);
                // Re-generate sources at new size
                // (For simplicity, we don't regenerate; the particle positions are absolute)
            }
        }

        destroy() {
            if (this.arkCanvas) this.arkCanvas.stop();
        }
    }

    /* ---- Export ---- */
    window.ArkParticles = {
        ArkParticle: ArkParticle,
        ArkSource: ArkSource,
        ArkParticleCanvas: ArkParticleCanvas,
        ArkController: ArkController
    };
})();
