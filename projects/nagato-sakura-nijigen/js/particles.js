/* ==========================================================
   NAGATO SAKURA NIJIGEN — Canvas Particle Systems
   ========================================================== */
'use strict';

/* ============================================================
   Utils
   ============================================================ */
const rand = (min, max) => Math.random() * (max - min) + min;
const lerp = (a, b, t) => a + (b - a) * t;

/* ============================================================
   BASE PARTICLE
   ============================================================ */
class Particle {
    constructor(x, y, opts = {}) {
        this.x = x; this.y = y;
        this.vx = opts.vx || 0; this.vy = opts.vy || 0;
        this.life = opts.life || 200;
        this.maxLife = this.life;
        this.size = opts.size || 2;
        this.color = opts.color || '#ff69b4';
        this.alpha = opts.alpha || 1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life--;
        return this.life > 0;
    }
    draw(ctx) {
        const a = (this.life / this.maxLife) * this.alpha;
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }
}

/* ============================================================
   SAKURA PETAL PARTICLE
   ============================================================ */
class SakuraPetal {
    constructor(w, h) {
        this.reset(w, h, true);
    }
    reset(w, h, init = false) {
        this.x = rand(0, w);
        this.y = init ? rand(-h, h) : rand(-50, -10);
        this.size = rand(3, 8);
        this.speedY = rand(0.3, 1);
        this.speedX = rand(-0.5, 0.5);
        this.rotation = rand(0, Math.PI * 2);
        this.rotSpeed = rand(-0.02, 0.02);
        this.alpha = rand(0.1, 0.4);
        this.w = w; this.h = h;
        this.wobble = rand(0, Math.PI * 2);
        this.wobbleSpeed = rand(0.01, 0.03);
    }
    update() {
        this.y += this.speedY;
        this.wobble += this.wobbleSpeed;
        this.x += this.speedX + Math.sin(this.wobble) * 0.3;
        this.rotation += this.rotSpeed;
        if (this.y > this.h + 20) this.reset(this.w, this.h);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.quadraticCurveTo(this.size, -this.size / 2, 0, this.size);
        ctx.quadraticCurveTo(-this.size, -this.size / 2, 0, -this.size);
        ctx.fill();
        ctx.restore();
    }
}

/* ============================================================
   DATA PARTICLE (Background floating data points)
   ============================================================ */
class DataParticle {
    constructor(w, h) {
        this.reset(w, h, true);
    }
    reset(w, h, init = false) {
        this.x = rand(0, w);
        this.y = init ? rand(0, h) : rand(h + 10, h + 50);
        this.size = rand(1, 3);
        this.speed = rand(-0.2, -0.5);
        this.alpha = rand(0.05, 0.2);
        this.w = w; this.h = h;
        this.color = Math.random() > 0.5 ? '#ff69b4' : '#00d4ff';
        this.pulse = rand(0, Math.PI * 2);
        this.pulseSpeed = rand(0.02, 0.05);
    }
    update() {
        this.y += this.speed;
        this.pulse += this.pulseSpeed;
        if (this.y < -20) this.reset(this.w, this.h);
    }
    draw(ctx) {
        const a = this.alpha * (0.5 + Math.sin(this.pulse) * 0.5);
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

/* ============================================================
   NEURAL NETWORK (Connecting lines between nodes)
   ============================================================ */
class NeuralNetwork {
    constructor(w, h, count = 40) {
        this.nodes = [];
        this.w = w; this.h = h;
        for (let i = 0; i < count; i++) {
            this.nodes.push({
                x: rand(0, w), y: rand(0, h),
                vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3),
                size: rand(1, 2.5),
                color: Math.random() > 0.6 ? '#ff69b4' : '#00d4ff',
            });
        }
    }
    resize(w, h) { this.w = w; this.h = h; }
    update() {
        for (const n of this.nodes) {
            n.x += n.vx; n.y += n.vy;
            if (n.x < 0 || n.x > this.w) n.vx *= -1;
            if (n.y < 0 || n.y > this.h) n.vy *= -1;
        }
    }
    draw(ctx) {
        const maxDist = 150;
        for (let i = 0; i < this.nodes.length; i++) {
            const a = this.nodes[i];
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = a.color;
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
            ctx.fill();
            for (let j = i + 1; j < this.nodes.length; j++) {
                const b = this.nodes[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < maxDist) {
                    ctx.globalAlpha = (1 - dist / maxDist) * 0.08;
                    ctx.strokeStyle = a.color;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }
    }
}

/* ============================================================
   MAIN BACKGROUND PARTICLES SYSTEM
   ============================================================ */
class BackgroundParticles {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.petals = [];
        this.dataParticles = [];
        this.network = null;
        this.resize();
    }
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Adjust particle count for performance
        const isMobile = this.w < 768;
        const petalCount = isMobile ? 8 : 20;
        const dataCount = isMobile ? 15 : 40;
        const nodeCount = isMobile ? 15 : 30;

        this.petals = [];
        this.dataParticles = [];
        for (let i = 0; i < petalCount; i++) this.petals.push(new SakuraPetal(this.w, this.h));
        for (let i = 0; i < dataCount; i++) this.dataParticles.push(new DataParticle(this.w, this.h));
        this.network = new NeuralNetwork(this.w, this.h, nodeCount);
    }
    update() {
        for (const p of this.petals) p.update();
        for (const d of this.dataParticles) d.update();
        this.network.update();
    }
    draw() {
        this.ctx.clearRect(0, 0, this.w, this.h);
        this.network.draw(this.ctx);
        for (const d of this.dataParticles) d.draw(this.ctx);
        for (const p of this.petals) p.draw(this.ctx);
        this.ctx.globalAlpha = 1;
    }
}

/* ============================================================
   LOADING SCREEN BACKGROUND
   ============================================================ */
class LoadingBackground {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.resize();
    }
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.particles = [];
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: rand(0, this.w), y: rand(0, this.h),
                size: rand(1, 3),
                speed: rand(0.1, 0.4),
                alpha: rand(0.05, 0.2),
                color: Math.random() > 0.5 ? '#ff69b4' : '#00d4ff',
                angle: rand(0, Math.PI * 2),
                angSpeed: rand(-0.005, 0.005),
            });
        }
    }
    update() {
        for (const p of this.particles) {
            p.angle += p.angSpeed;
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            if (p.x < -10) p.x = this.w + 10;
            if (p.x > this.w + 10) p.x = -10;
            if (p.y < -10) p.y = this.h + 10;
            if (p.y > this.h + 10) p.y = -10;
        }
    }
    draw() {
        this.ctx.clearRect(0, 0, this.w, this.h);
        for (const p of this.particles) {
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        // Draw subtle connecting lines
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i], b = this.particles[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    this.ctx.globalAlpha = (1 - dist / 120) * 0.04;
                    this.ctx.strokeStyle = '#ff69b4';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(a.x, a.y);
                    this.ctx.lineTo(b.x, b.y);
                    this.ctx.stroke();
                }
            }
        }
        this.ctx.globalAlpha = 1;
    }
}

/* ============================================================
   CARD CANVAS (Profile character visual)
   ============================================================ */
class CardVisual {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.t = 0;
        this.resize();
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = rect.width || 280;
        this.h = rect.height || 220;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    draw() {
        this.t += 0.01;
        const { ctx, w, h } = this;
        ctx.clearRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(255,105,180,0.05)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 20) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 20) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Central hex
        const cx = w / 2, cy = h / 2, r = 40;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.t * 0.5);
        ctx.strokeStyle = 'rgba(255,105,180,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 2;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke();
        ctx.restore();

        // Orbiting dots
        for (let i = 0; i < 3; i++) {
            const angle = this.t * 1.5 + (Math.PI * 2 / 3) * i;
            const ox = cx + Math.cos(angle) * 55;
            const oy = cy + Math.sin(angle) * 55;
            ctx.globalAlpha = 0.5 + Math.sin(this.t * 3 + i) * 0.3;
            ctx.fillStyle = i % 2 === 0 ? '#ff69b4' : '#00d4ff';
            ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
        }

        // Pulse rings
        const pulse = (Math.sin(this.t * 2) + 1) / 2;
        ctx.globalAlpha = 0.1 + pulse * 0.1;
        ctx.strokeStyle = '#ff69b4';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, 30 + pulse * 20, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 50 + pulse * 15, 0, Math.PI * 2); ctx.stroke();

        ctx.globalAlpha = 1;
    }
}

/* ============================================================
   ABILITY CANVAS (Neural network visualization)
   ============================================================ */
class AbilityVisual {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.t = 0;
        this.nodes = [];
        this.resize();
        this._initNodes();
    }
    _initNodes() {
        this.nodes = [];
        const layers = [3, 5, 5, 3];
        const layerSpacing = this.w / (layers.length + 1);
        for (let l = 0; l < layers.length; l++) {
            const count = layers[l];
            const nodeSpacing = this.h / (count + 1);
            for (let n = 0; n < count; n++) {
                this.nodes.push({
                    x: layerSpacing * (l + 1),
                    y: nodeSpacing * (n + 1),
                    layer: l,
                    pulse: rand(0, Math.PI * 2),
                });
            }
        }
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = rect.width || 250;
        this.h = rect.height || 200;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (this.nodes.length) this._initNodes();
    }
    draw() {
        this.t += 0.02;
        const { ctx, w, h, nodes } = this;
        ctx.clearRect(0, 0, w, h);

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                if (Math.abs(nodes[i].layer - nodes[j].layer) === 1) {
                    const signal = (Math.sin(this.t * 3 + i + j) + 1) / 2;
                    ctx.globalAlpha = 0.05 + signal * 0.1;
                    ctx.strokeStyle = '#ff69b4';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        for (const n of nodes) {
            const pulse = (Math.sin(this.t * 2 + n.pulse) + 1) / 2;
            ctx.globalAlpha = 0.4 + pulse * 0.4;
            ctx.fillStyle = n.layer === 0 || n.layer === 3 ? '#00d4ff' : '#ff69b4';
            ctx.beginPath();
            ctx.arc(n.x, n.y, 3 + pulse * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

/* ============================================================
   SYSTEM DIAGRAM CANVAS (Orbital connections)
   ============================================================ */
class SystemDiagram {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.t = 0;
        this.resize();
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = rect.width || 400;
        this.h = rect.height || 400;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    draw() {
        this.t += 0.005;
        const { ctx, w, h } = this;
        const cx = w / 2, cy = h / 2;
        ctx.clearRect(0, 0, w, h);

        // Orbit circles
        const radii = [80, 120, 160];
        for (const r of radii) {
            ctx.globalAlpha = 0.06;
            ctx.strokeStyle = '#ff69b4';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 8]);
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Radar sweep
        const sweepAngle = this.t * 2;
        const grad = ctx.createConicalGradient ? null : null; // fallback
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 160, sweepAngle, sweepAngle + 0.5);
        ctx.closePath();
        ctx.fill();

        // Signal pulses from center to satellites
        const satCount = 7;
        for (let i = 0; i < satCount; i++) {
            const a = (Math.PI * 2 / satCount) * i;
            const ex = cx + Math.cos(a) * 160;
            const ey = cy + Math.sin(a) * 160;

            // Signal dot
            const signalT = (this.t * 3 + i * 0.5) % 1;
            const sx = lerp(cx, ex, signalT);
            const sy = lerp(cy, ey, signalT);
            ctx.globalAlpha = (1 - signalT) * 0.5;
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();

            // Connection line
            ctx.globalAlpha = 0.04;
            ctx.strokeStyle = '#ff69b4';
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        }

        // Center glow
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
        grd.addColorStop(0, 'rgba(255,105,180,0.1)');
        grd.addColorStop(1, 'rgba(255,105,180,0)');
        ctx.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.3;
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();

        ctx.globalAlpha = 1;
    }
}

/* ============================================================
   GALLERY CANVAS (Showcase items)
   ============================================================ */
class GalleryVisual {
    constructor(canvas, type = 0) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.t = 0;
        this.type = type;
        this.resize();
    }
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = rect.width || 300;
        this.h = rect.height || 160;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    draw() {
        this.t += 0.015;
        const { ctx, w, h, type } = this;
        ctx.clearRect(0, 0, w, h);

        if (type === 0) this._drawCircuitBoard(ctx, w, h);
        else if (type === 1) this._drawWaveform(ctx, w, h);
        else this._drawGrid3D(ctx, w, h);
    }
    _drawCircuitBoard(ctx, w, h) {
        // Circuit paths
        ctx.strokeStyle = 'rgba(255,105,180,0.15)';
        ctx.lineWidth = 1;
        const step = 30;
        for (let x = step; x < w; x += step) {
            const y1 = h / 2 + Math.sin(this.t + x * 0.02) * 30;
            ctx.globalAlpha = 0.15;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y1);
            ctx.lineTo(x + step / 2, y1); ctx.stroke();
            // Node
            ctx.fillStyle = '#ff69b4';
            ctx.globalAlpha = 0.3 + Math.sin(this.t * 3 + x) * 0.2;
            ctx.beginPath(); ctx.arc(x, y1, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
    _drawWaveform(ctx, w, h) {
        const mid = h / 2;
        ctx.lineWidth = 1;
        for (let wave = 0; wave < 3; wave++) {
            ctx.globalAlpha = 0.15 - wave * 0.03;
            ctx.strokeStyle = wave === 0 ? '#ff69b4' : wave === 1 ? '#00d4ff' : '#8b5cf6';
            ctx.beginPath();
            for (let x = 0; x < w; x += 2) {
                const y = mid + Math.sin(x * 0.03 + this.t * (2 + wave) + wave * 2) * (20 + wave * 10);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }
    _drawGrid3D(ctx, w, h) {
        ctx.strokeStyle = 'rgba(0,212,255,0.1)';
        ctx.lineWidth = 0.5;
        const gridSize = 25;
        const perspective = 0.003;
        for (let z = 0; z < 8; z++) {
            const zOff = (z * gridSize + this.t * 30) % (gridSize * 8);
            const scale = 1 / (1 + zOff * perspective);
            ctx.globalAlpha = scale * 0.3;
            const y = h * 0.6 + zOff * 0.3;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        for (let x = 0; x < w; x += gridSize) {
            ctx.globalAlpha = 0.05;
            ctx.beginPath(); ctx.moveTo(x, h * 0.3); ctx.lineTo(x, h); ctx.stroke();
        }
    }
}

/* ============================================================
   HERO CANVAS (Dramatic hero background)
   ============================================================ */
class HeroCanvas {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.t = 0;
        this.resize();
    }
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = this.w * dpr;
        this.canvas.height = this.h * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    draw() {
        this.t += 0.003;
        const { ctx, w, h } = this;
        ctx.clearRect(0, 0, w, h);

        // Geometric constellation
        const cx = w * 0.65, cy = h * 0.5;
        const points = [];
        for (let i = 0; i < 12; i++) {
            const a = (Math.PI * 2 / 12) * i + this.t;
            const r = 100 + Math.sin(this.t * 2 + i) * 30;
            points.push({
                x: cx + Math.cos(a) * r,
                y: cy + Math.sin(a) * r,
            });
        }

        // Connections
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                if ((i + j) % 3 === 0) {
                    ctx.globalAlpha = 0.03;
                    ctx.strokeStyle = '#ff69b4';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(points[i].x, points[i].y);
                    ctx.lineTo(points[j].x, points[j].y);
                    ctx.stroke();
                }
            }
        }

        // Dots
        for (const p of points) {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#ff69b4';
            ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        }

        ctx.globalAlpha = 1;
    }
}

/* ============================================================
   EXPORTS (attach to window)
   ============================================================ */
window.ParticleSystems = {
    BackgroundParticles,
    LoadingBackground,
    CardVisual,
    AbilityVisual,
    SystemDiagram,
    GalleryVisual,
    HeroCanvas,
};
