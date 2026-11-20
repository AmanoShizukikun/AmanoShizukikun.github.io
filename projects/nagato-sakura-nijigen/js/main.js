/* ==========================================================
   NAGATO SAKURA NIJIGEN — Main Orchestrator
   ========================================================== */
'use strict';

(function () {
    const PS = window.ParticleSystems;
    const AC = window.AnimControllers;
    const AK = window.ArkParticles;

    /* ---- Canvas instances ---- */
    let bgParticles = null;
    let heroCanvas = null;
    let arkCtrl = null;
    let cardVisual = null;
    let abilityVisual = null;
    let systemDiagram = null;
    const galleryVisuals = [];

    /* ---- Controllers ---- */
    let loadingCtrl, fadelineCtrl, sectionCtrl, navCtrl;
    let abilityCtrl, voiceCtrl, cursorCtrl, mobileCtrl, scrollCtrl;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        // 1. Loading screen
        loadingCtrl = new AC.LoadingController();
        loadingCtrl.init();

        // 2. After loading completes, setup everything
        window.addEventListener('loading-done', onLoadingDone);
    }

    function onLoadingDone() {
        initCanvases();
        initControllers();
        startRenderLoop();
        setupResize();
    }

    /* ============================================================
       CANVASES
       ============================================================ */
    function initCanvases() {
        // Background particles
        const bgEl = document.getElementById('bg-particles');
        if (bgEl) bgParticles = new PS.BackgroundParticles(bgEl);

        // Hero canvas
        const heroEl = document.getElementById('hero-canvas');
        if (heroEl) heroCanvas = new PS.HeroCanvas(heroEl);

        // Arknights-style particle animation (hero right)
        const arkEl = document.getElementById('ark-canvas');
        const arkBtns = document.getElementById('ark-btns');
        if (arkEl && AK) {
            arkCtrl = new AK.ArkController(arkEl, arkBtns);
            arkCtrl.init();
        }

        // Card visual (profile)
        const cardEl = document.getElementById('card-canvas');
        if (cardEl) cardVisual = new PS.CardVisual(cardEl);

        // Ability visual
        const abilEl = document.getElementById('ability-canvas');
        if (abilEl) abilityVisual = new PS.AbilityVisual(abilEl);

        // System diagram
        const sysEl = document.getElementById('system-canvas');
        if (sysEl) systemDiagram = new PS.SystemDiagram(sysEl);

        // Gallery canvases
        for (let i = 1; i <= 3; i++) {
            const c = document.getElementById(`gal-canvas-${i}`);
            if (c) galleryVisuals.push(new PS.GalleryVisual(c, i - 1));
        }
    }

    /* ============================================================
       CONTROLLERS
       ============================================================ */
    function initControllers() {
        fadelineCtrl = new AC.FadelineController();
        fadelineCtrl.init();

        sectionCtrl = new AC.SectionRevealController();
        sectionCtrl.init();

        navCtrl = new AC.NavController();
        navCtrl.init();

        abilityCtrl = new AC.AbilityTabsController();
        abilityCtrl.init();

        voiceCtrl = new AC.VoiceController();
        voiceCtrl.init();

        cursorCtrl = new AC.CursorController();
        cursorCtrl.init();

        mobileCtrl = new AC.MobileNavController();
        mobileCtrl.init();

        scrollCtrl = new AC.ScrollHintController();
        scrollCtrl.init();

        // PV video controls
        initPVControls();

        // Trigger hero fadeline immediately since loading is done
        setTimeout(() => {
            const heroFadelines = document.querySelectorAll('.section-hero .fadeline');
            heroFadelines.forEach(el => el.classList.add('in'));
        }, 100);
    }

    /* ============================================================
       PV VIDEO CONTROLS
       ============================================================ */
    function initPVControls() {
        const video = document.getElementById('pv-video');
        const muteBtn = document.getElementById('pv-mute-btn');
        const playBtn = document.getElementById('pv-play-btn');
        const iconMuted = document.getElementById('pv-icon-muted');
        const iconSound = document.getElementById('pv-icon-sound');
        const iconPause = document.getElementById('pv-icon-pause');
        const iconPlay = document.getElementById('pv-icon-play');
        if (!video || !muteBtn || !playBtn) return;

        // Mute toggle
        muteBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            iconMuted.style.display = video.muted ? '' : 'none';
            iconSound.style.display = video.muted ? 'none' : '';
            muteBtn.classList.toggle('active', video.muted);
        });

        // Play / Pause toggle
        playBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play();
                iconPause.style.display = '';
                iconPlay.style.display = 'none';
            } else {
                video.pause();
                iconPause.style.display = 'none';
                iconPlay.style.display = '';
            }
        });
    }

    /* ============================================================
       RENDER LOOP
       ============================================================ */
    let animFrame = null;
    function startRenderLoop() {
        function tick() {
            // Background is always visible
            if (bgParticles) {
                bgParticles.update();
                bgParticles.draw();
            }

            // Only draw visible section canvases for performance
            if (heroCanvas && isSectionVisible('hero')) heroCanvas.draw();
            if (cardVisual && isSectionVisible('profile')) cardVisual.draw();
            if (abilityVisual && isSectionVisible('abilities')) abilityVisual.draw();
            if (systemDiagram && isSectionVisible('system')) systemDiagram.draw();
            if (isSectionVisible('gallery')) {
                galleryVisuals.forEach(g => g.draw());
            }

            animFrame = requestAnimationFrame(tick);
        }
        tick();
    }

    // Section visibility cache
    const visibilityCache = {};
    const visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            visibilityCache[entry.target.id] = entry.isIntersecting;
        });
    }, { threshold: 0 });

    function initVisibilityTracking() {
        document.querySelectorAll('.section').forEach(s => {
            visibilityObserver.observe(s);
            visibilityCache[s.id] = false;
        });
        // Hero is visible by default
        visibilityCache['hero'] = true;
    }

    function isSectionVisible(id) {
        return visibilityCache[id] !== false;
    }

    /* ============================================================
       RESIZE
       ============================================================ */
    let resizeTimeout;
    function setupResize() {
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (bgParticles) bgParticles.resize();
                if (heroCanvas) heroCanvas.resize();
                // arkCtrl uses fixed canvas size; no resize needed
                if (cardVisual) cardVisual.resize();
                if (abilityVisual) abilityVisual.resize();
                if (systemDiagram) systemDiagram.resize();
                galleryVisuals.forEach(g => g.resize());
            }, 200);
        });
    }

    /* ============================================================
       BOOT
       ============================================================ */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initVisibilityTracking();
            init();
        });
    } else {
        initVisibilityTracking();
        init();
    }
})();
