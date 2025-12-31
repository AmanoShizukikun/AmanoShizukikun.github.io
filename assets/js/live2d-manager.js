// Centralized Live2D manager (extracted from index.html)
// Provides: load(), show(), hide(), isAvailable(), setQuitVisible(), isQuitVisible()
window.live2dManager = (function () {
    const config = {
        cubism2Path: '/assets/live2d/live2d.min.js',
        cubism5Path: '/assets/live2d/live2dcubismcore.min.js',
        tools: ['hitokoto','switch-model','switch-texture','photo','info','quit'],
        logLevel: 'info',
        drag: true,
        models: [
            { name: 'WL2D-01', paths: ['/assets/live2d/model/WL2D-01_vts/WL2D-01.model3.json'], message: '嗨，我是 WL2D-01（本機模型）' }
        ],
        waifuPath: '/assets/live2d/waifu-config.json'
    };

    let loaded = false;
    let available = false;

    const assetUrl = (p) => {
        if (p.startsWith('/')) return p;
        return (location.origin + '/' + p.replace(/^\//, ''));
    };

    async function checkAsset() {
        try {
            const r = await fetch(config.waifuPath, { method: 'HEAD' });
            return r.ok;
        } catch (e) {
            return false;
        }
    }

    function injectExtraStyles() {
        if (document.getElementById('live2d-extra-style')) return;
        const css = `
#waifu { z-index: 19990 !important; pointer-events: none !important; }
#waifu #waifu-tips { position: absolute !important; z-index: 19988 !important; pointer-events: none !important; }
#waifu #waifu-tips.waifu-tips-active { pointer-events: auto !important; }
#waifu #waifu-canvas { position: relative !important; z-index: 19992 !important; pointer-events: auto !important; }
#waifu #live2d { position: relative !important; z-index: 19993 !important; pointer-events: auto !important; }
#waifu #waifu-tool { z-index: 19994 !important; pointer-events: auto !important; }
header { position: relative; z-index: 20050 !important; }
.nav-overlay { z-index: 19995 !important; }
#waifu, #waifu * { transform: translateZ(0); }
#waifu { bottom: 0 !important; transform: translateY(110%) !important; transition: transform 360ms cubic-bezier(.22,.9,.31,1) !important; will-change: transform; backface-visibility: hidden; }
#waifu.waifu-active { transform: translateY(0) !important; }
#waifu:hover { transform: translateY(0) !important; }
#waifu #live2d, #waifu #waifu-canvas { will-change: transform; backface-visibility: hidden; transform: translateZ(0); -webkit-transform: translateZ(0); }
        `;
        const s = document.createElement('style');
        s.id = 'live2d-extra-style';
        s.appendChild(document.createTextNode(css));
        document.head.appendChild(s);
    }

    async function loadScriptModule() {
        if (loaded) return true;
        const exists = await checkAsset();
        if (!exists) return false;

        try {
            // 確保 live2d CSS
            if (!document.querySelector('link[href$="assets/live2d/live2d.css"]')) {
                const l = document.createElement('link');
                l.rel = 'stylesheet';
                l.href = '/assets/live2d/live2d.css';
                document.head.appendChild(l);
            }

            // inject helpful page-level styles
            injectExtraStyles();

            // 動態 import waifu-tips module (it will load the heavy libs as needed)
            await import(assetUrl('assets/live2d/waifu-tips.js'));
            loaded = true;
            available = true;
            return true;
        } catch (e) {
            console.warn('Live2D 模組載入失敗：', e);
            available = false;
            return false;
        }
    }

    async function ensureLoaded() {
        if (loaded) return true;
        return await loadScriptModule();
    }

    function removeBuiltInToggle() {
        document.getElementById('waifu-toggle')?.remove();
    }

    async function show() {
        const ok = await ensureLoaded();
        if (!ok) return false;

        if (!window.entryAnimationsCompleted) {
            // Wait for entry animations, but don't hang indefinitely on pages that have no such event
            await Promise.race([
                new Promise(resolve => window.addEventListener('animations:entryComplete', () => resolve(), { once: true })),
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
        }

        try {
            if (localStorage.getItem('waifu-display')) {
                localStorage.removeItem('waifu-display');
                console.info('Live2D: removed persisted waifu-display to force load');
            }

            if (typeof window.initWidget === 'function') {
                const existing = document.getElementById('waifu');
                if (existing) {
                    try { existing.remove(); } catch (e) { console.warn('Live2D: failed to remove existing DOM', e); }
                }

                window.initWidget(config);
            }
        } catch (e) {
            console.warn('initWidget 呼叫失敗：', e);
        }

        await Promise.race([
            new Promise((resolve) => {
                const handler = () => { document.removeEventListener('live2d:modelReady', handler); resolve(); };
                document.addEventListener('live2d:modelReady', handler, { once: true });
            }),
            new Promise(r => setTimeout(r, 3000))
        ]);

        removeBuiltInToggle();

        await new Promise(r => setTimeout(r, 80));

        const quitPref = localStorage.getItem('live2dQuitEnabled');
        if (quitPref === 'false') {
            document.getElementById('waifu-tool-quit')?.remove();
        }

        const w = document.getElementById('waifu');
        if (w) {
            w.classList.remove('waifu-hidden');
            setTimeout(() => w.classList.add('waifu-active'), 0);
            return true;
        }

        console.warn('Live2D: widget DOM (#waifu) 未被建立，顯示失敗');
        return false;
    }

    async function hide() {
        if (!loaded) return false;

        const quitEl = document.getElementById('waifu-tool-quit');
        if (quitEl) {
            try { quitEl.click(); return true; } catch (e) { console.warn('Live2D: fail to trigger quit tool, fallback to hide', e); }
        }

        const w = document.getElementById('waifu');
        if (w) {
            localStorage.setItem('waifu-display', Date.now().toString());
            w.classList.remove('waifu-active');
            setTimeout(() => {
                try { w.classList.add('waifu-hidden'); } catch (e) {}
                setTimeout(() => { try { w.remove(); console.info('Live2D: widget DOM removed after hide to avoid partial reinitialization'); } catch (e) {} }, 800);
            }, 420);
            return true;
        }
        return false;
    }

    return {
        load: loadScriptModule,
        show,
        hide,
        isAvailable: () => available || loaded,
        setQuitVisible: (visible) => {
            localStorage.setItem('live2dQuitEnabled', visible ? 'true' : 'false');
            const el = document.getElementById('waifu-tool-quit');
            if (el && !visible) el.remove();
            return visible;
        },
        isQuitVisible: () => (localStorage.getItem('live2dQuitEnabled') !== 'false')
    };
})();
