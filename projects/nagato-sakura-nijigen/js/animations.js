/* ==========================================================
   NAGATO SAKURA NIJIGEN — Animation Controllers
   ========================================================== */
'use strict';

/* ============================================================
   LOADING CONTROLLER
   ============================================================ */
class LoadingController {
    constructor() {
        this.screen = document.getElementById('loading-screen');
        this.barTop = document.getElementById('bar-top');
        this.barBottom = document.getElementById('bar-bottom');
        this.percentEl = document.getElementById('loading-percent');
        this.statusEl = document.getElementById('loading-status-text');
        this.progress = 0;
        this.targetProgress = 0;
        this.done = false;
        this.loadingBg = null;
        this.messages = [
            'CONNECTING TO AI CORE...',
            'LOADING LLM MODULES...',
            'INITIALIZING IMAGE CHARM...',
            'CALIBRATING IQA ENGINE...',
            'ACTIVATING TOOL CALLING...',
            'BOOT SEQUENCE COMPLETE',
        ];
    }
    init() {
        const canv = document.getElementById('loading-canvas');
        if (canv && window.ParticleSystems) {
            this.loadingBg = new window.ParticleSystems.LoadingBackground(canv);
        }
        this._animate();
        this._simulateProgress();
    }
    _simulateProgress() {
        const steps = [
            { t: 200, p: 15 },
            { t: 600, p: 30 },
            { t: 1000, p: 55 },
            { t: 1500, p: 75 },
            { t: 2000, p: 90 },
            { t: 2500, p: 100 },
        ];
        steps.forEach(({ t, p }, i) => {
            setTimeout(() => {
                this.targetProgress = p;
                if (i < this.messages.length) this.statusEl.textContent = this.messages[i];
            }, t);
        });
    }
    _animate() {
        if (this.done) return;
        this.progress = _lerp(this.progress, this.targetProgress, 0.08);
        const p = Math.min(Math.round(this.progress), 100);
        this.percentEl.textContent = p;
        const w = p + '%';
        this.barTop.style.width = w;
        this.barBottom.style.width = w;

        if (this.loadingBg) {
            this.loadingBg.update();
            this.loadingBg.draw();
        }

        if (p >= 100 && !this.done) {
            this.done = true;
            setTimeout(() => this._hide(), 400);
        } else {
            requestAnimationFrame(() => this._animate());
        }
    }
    _hide() {
        this.screen.style.opacity = '0';
        this.screen.style.transition = 'opacity 0.6s ease';
        setTimeout(() => {
            this.screen.style.display = 'none';
            document.body.classList.add('loaded');
            // Trigger fadeline entrance
            window.dispatchEvent(new CustomEvent('loading-done'));
        }, 600);
    }
}

function _lerp(a, b, t) { return a + (b - a) * t; }

/* ============================================================
   FADELINE OBSERVER (NIKKE staggered entrance)
   ============================================================ */
class FadelineController {
    constructor() {
        this.items = document.querySelectorAll('.fadeline');
    }
    init() {
        // On loading done, animate hero fadelines
        window.addEventListener('loading-done', () => {
            const heroItems = document.querySelectorAll('.section-hero .fadeline');
            heroItems.forEach(el => el.classList.add('in'));
        });
    }
}

/* ============================================================
   SECTION REVEAL OBSERVER
   ============================================================ */
class SectionRevealController {
    constructor() {
        this.sections = document.querySelectorAll('.section');
    }
    init() {
        const opts = { threshold: 0.15, rootMargin: '-50px' };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                }
            });
        }, opts);
        this.sections.forEach(s => observer.observe(s));
    }
}

/* ============================================================
   NAV SCROLL CONTROLLER
   ============================================================ */
class NavController {
    constructor() {
        this.links = document.querySelectorAll('.nav-link');
        this.sections = document.querySelectorAll('.section');
        this.counterEl = document.getElementById('nav-current');
        this.active = 0;
    }
    init() {
        // Scroll detection
        const opts = { threshold: 0.3 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const idx = Array.from(this.sections).indexOf(entry.target);
                    if (idx >= 0) this._setActive(idx);
                }
            });
        }, opts);
        this.sections.forEach(s => observer.observe(s));

        // Click navigation
        this.links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    // Close mobile nav
                    document.querySelector('.main-nav')?.classList.remove('open');
                }
            });
        });
    }
    _setActive(idx) {
        if (idx === this.active) return;
        this.active = idx;
        this.links.forEach((l, i) => l.classList.toggle('active', i === idx));
        if (this.counterEl) {
            this.counterEl.textContent = String(idx + 1).padStart(2, '0');
        }
    }
}

/* ============================================================
   ABILITY TABS CONTROLLER
   ============================================================ */
class AbilityTabsController {
    constructor() {
        this.tabs = document.querySelectorAll('.atab');
        this.panels = document.querySelectorAll('.apanel');
    }
    init() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const idx = tab.dataset.tab;
                this.tabs.forEach(t => t.classList.remove('active'));
                this.panels.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.querySelector(`.apanel[data-panel="${idx}"]`);
                if (panel) panel.classList.add('active');
            });
        });
    }
}

/* ============================================================
   VOICE ITEM CONTROLLER
   ============================================================ */
class VoiceController {
    constructor() {
        this.items = document.querySelectorAll('.voice-item');
    }
    init() {
        this.items.forEach(item => {
            item.addEventListener('click', () => {
                this.items.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }
}

/* ============================================================
   CUSTOM CURSOR CONTROLLER
   ============================================================ */
class CursorController {
    constructor() {
        this.el = document.getElementById('cursor-follower');
        this.mx = 0; this.my = 0;
        this.cx = 0; this.cy = 0;
    }
    init() {
        if (!this.el || window.innerWidth < 1024) return;
        document.addEventListener('mousemove', (e) => {
            this.mx = e.clientX; this.my = e.clientY;
        });
        // Hover state
        const hoverEls = document.querySelectorAll('a, button, .voice-item, .atab, .gal-item, .tl-card, .flow-step, .sys-node.sat, .btn-primary, .btn-ghost');
        hoverEls.forEach(el => {
            el.addEventListener('mouseenter', () => this.el.classList.add('hover'));
            el.addEventListener('mouseleave', () => this.el.classList.remove('hover'));
        });
        this._animate();
    }
    _animate() {
        this.cx += (this.mx - this.cx) * 0.12;
        this.cy += (this.my - this.cy) * 0.12;
        this.el.style.transform = `translate(${this.cx}px, ${this.cy}px)`;
        requestAnimationFrame(() => this._animate());
    }
}

/* ============================================================
   MOBILE NAV TOGGLE
   ============================================================ */
class MobileNavController {
    constructor() {
        this.btn = document.getElementById('mobile-toggle');
        this.nav = document.querySelector('.main-nav');
    }
    init() {
        if (!this.btn || !this.nav) return;
        this.btn.addEventListener('click', () => {
            this.nav.classList.toggle('open');
            this.btn.classList.toggle('active');
        });
    }
}

/* ============================================================
   SCROLL HINT
   ============================================================ */
class ScrollHintController {
    constructor() {
        this.el = document.getElementById('scroll-hint');
    }
    init() {
        if (!this.el) return;
        const scrollContainer = document.getElementById('main-content') || window;
        scrollContainer.addEventListener('scroll', () => {
            const scrollTop = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
            if (scrollTop > 100) {
                this.el.style.opacity = '0';
                this.el.style.pointerEvents = 'none';
            } else {
                this.el.style.opacity = '1';
                this.el.style.pointerEvents = 'auto';
            }
        }, { passive: true });
    }
}

/* ============================================================
   EXPORTS
   ============================================================ */
window.AnimControllers = {
    LoadingController,
    FadelineController,
    SectionRevealController,
    NavController,
    AbilityTabsController,
    VoiceController,
    CursorController,
    MobileNavController,
    ScrollHintController,
};
