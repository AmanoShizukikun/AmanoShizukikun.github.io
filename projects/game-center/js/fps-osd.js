/* ========== FPS 即時效能監控面板引擎 (Enhanced FPS OSD Engine) ========== */
/**
 * 支援三種顯示模式：
 * 1. FPS 模式 ('fps')：顯示即時 FPS 大字體與狀態標籤
 * 2. 進階模式 ('advanced')：顯示 FPS、幀延遲 (ms)、FPS 波動即時折線波形圖 (Sparkline)
 * 3. 完整模式 ('full')：顯示 FPS、幀延遲、記憶體 (RAM MB)、1% Low FPS、系統時間與即時波形圖
 * 支援功能：自由拖曳、自由放大縮小 (resize)、尺寸/座標持久化記憶
 */

(function () {
    let fpsCount = 60;
    let onePercentLow = 60;
    let lastTime = performance.now();
    let lastFrameTime = performance.now();
    let frameDelta = 16.6;
    let frameCount = 0;
    let isMonitorActive = false;
    let currentMode = 'fps'; // 'fps', 'advanced', 'full'
    let fpsHistory = new Array(35).fill(60);
    let frameDeltas = [];

    const SafeStorage = {
        getItem(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        setItem(key, val) {
            try { localStorage.setItem(key, val); } catch (e) {}
        }
    };

    function updateFPS(now) {
        if (!isMonitorActive) return;

        frameCount++;
        const delta = now - lastFrameTime;
        lastFrameTime = now;
        frameDelta = delta.toFixed(1);
        if (delta > 0 && delta < 500) {
            frameDeltas.push(delta);
            if (frameDeltas.length > 200) frameDeltas.shift();
        }

        // 監控更新頻率改為 1 秒 1 次 (1000ms)
        if (now - lastTime >= 1000) {
            fpsCount = Math.round((frameCount * 1000) / (now - lastTime));
            frameCount = 0;
            lastTime = now;

            // 計算 1% Low FPS（取最慢 1% 幀延遲的平均換算幀率）
            if (frameDeltas.length > 0) {
                const sorted = [...frameDeltas].sort((a, b) => b - a);
                const count1Pct = Math.max(1, Math.ceil(sorted.length * 0.01));
                let sumWorst = 0;
                for (let i = 0; i < count1Pct; i++) {
                    sumWorst += sorted[i];
                }
                const avgWorstDelta = sumWorst / count1Pct;
                onePercentLow = avgWorstDelta > 0 ? Math.min(fpsCount, Math.round(1000 / avgWorstDelta)) : fpsCount;
            } else {
                onePercentLow = fpsCount;
            }

            fpsHistory.push(fpsCount);
            if (fpsHistory.length > 35) fpsHistory.shift();

            renderOSDContent();
        }

        requestAnimationFrame(updateFPS);
    }

    function drawSparkline(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width = canvas.parentElement.clientWidth || 220;
        const h = canvas.height = canvas.parentElement.clientHeight || 46;
        if (w === 0 || h === 0) return;

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        // 繪製背景參考格線 (30 FPS & 60 FPS)
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // 60 FPS 基準線 (約頂部 20%)
        const y60 = h - (60 / 75) * h;
        ctx.beginPath();
        ctx.moveTo(0, y60);
        ctx.lineTo(w, y60);
        ctx.stroke();

        // 30 FPS 基準線 (約底部 40%)
        const y30 = h - (30 / 75) * h;
        ctx.beginPath();
        ctx.moveTo(0, y30);
        ctx.lineTo(w, y30);
        ctx.stroke();

        ctx.setLineDash([]); // 恢復實線

        // 折線繪製
        const normalColor = isLight ? '#0088cc' : '#00f0ff';
        const warnColor = isLight ? '#d97706' : '#f59e0b';
        const dangerColor = isLight ? '#dc2626' : '#ef4444';
        const fpsColor = fpsCount >= 50 ? normalColor : (fpsCount >= 30 ? warnColor : dangerColor);
        ctx.strokeStyle = fpsColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = isLight ? 2 : 6;
        ctx.shadowColor = fpsColor;
        ctx.beginPath();

        const step = w / (fpsHistory.length - 1);
        fpsHistory.forEach((val, i) => {
            const normY = Math.max(0, Math.min(1, val / 75));
            const y = h - (normY * h);
            const x = i * step;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // 漸層填充
        ctx.shadowBlur = 0;
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, fpsColor + (isLight ? '28' : '33'));
        grad.addColorStop(1, fpsColor + '00');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    function renderOSDContent() {
        const contentContainer = document.getElementById('osdContent');
        const fpsGlobalValue = document.getElementById('fpsValue');
        if (fpsGlobalValue) fpsGlobalValue.innerText = String(fpsCount).padStart(3, '0');
        if (!contentContainer) return;

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const valColor = isLight ? '#0088bb' : '#00f0ff';
        const memoryMB = (performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : 42;

        if (currentMode === 'fps') {
            // 1. FPS 模式：極簡純淨，無進度條
            contentContainer.innerHTML = `
                <div class="osd-item" style="padding: 4px 0; justify-content: space-between; align-items: center;">
                    <span class="osd-label" style="font-size: 0.8rem;">即時幀率</span>
                    <div style="display: flex; align-items: baseline; gap: 4px;">
                        <span class="osd-value" style="color: ${valColor}; font-size: 1.45rem; font-weight: 800;">${fpsCount}</span>
                        <span class="osd-unit" style="font-size: 0.75rem; font-weight: 700;">FPS</span>
                    </div>
                </div>
            `;
        } else if (currentMode === 'advanced') {
            // 2. 進階模式：顯示 FPS、幀延遲、FPS 波型圖，統一數值顏色
            contentContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="osd-card">
                        <div style="display: flex; flex-direction: column;">
                            <span class="osd-label">FPS</span>
                            <span class="osd-value" style="color: ${valColor}; font-size: 1.3rem;">${fpsCount} <span class="osd-unit" style="font-size: 0.7rem;">FPS</span></span>
                        </div>
                    </div>
                    <div class="osd-card">
                        <div style="display: flex; flex-direction: column;">
                            <span class="osd-label">幀延遲</span>
                            <span class="osd-value" style="color: ${valColor}; font-size: 1.3rem;">${frameDelta} <span class="osd-unit" style="font-size: 0.7rem;">ms</span></span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="osd-label">FPS 波形</span>
                    </div>
                    <div class="osd-sparkline-box" style="height: 48px;">
                        <canvas id="osdSparklineAdvanced" style="width: 100%; height: 100%; display: block;"></canvas>
                    </div>
                </div>
            `;
            drawSparkline('osdSparklineAdvanced');
        } else {
            // 3. 完整模式：顯示 FPS、幀延遲、記憶體、1% Low、系統時間、波型圖，統一數值顏色
            const nowTime = new Date();
            const timeStr = String(nowTime.getHours()).padStart(2, '0') + ':' + String(nowTime.getMinutes()).padStart(2, '0') + ':' + String(nowTime.getSeconds()).padStart(2, '0');

            contentContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
                    <div class="osd-card">
                        <span class="osd-label">FPS</span>
                        <span class="osd-value" style="color: ${valColor}; font-size: 1.15rem;">${fpsCount}</span>
                    </div>
                    <div class="osd-card">
                        <span class="osd-label">幀延遲</span>
                        <span class="osd-value" style="color: ${valColor}; font-size: 1.15rem;">${frameDelta}<span class="osd-unit" style="font-size: 0.65rem">ms</span></span>
                    </div>
                    <div class="osd-card">
                        <span class="osd-label">記憶體</span>
                        <span class="osd-value" style="color: ${valColor}; font-size: 1.15rem;">${memoryMB}<span class="osd-unit" style="font-size: 0.65rem">MB</span></span>
                    </div>
                    <div class="osd-card">
                        <span class="osd-label">1% Low</span>
                        <span class="osd-value" style="color: ${valColor}; font-size: 1.15rem;">${onePercentLow}</span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="osd-label">FPS 波形</span>
                        <span class="osd-unit" style="font-size: 0.65rem;">時間: ${timeStr}</span>
                    </div>
                    <div class="osd-sparkline-box" style="height: 42px;">
                        <canvas id="osdSparklineFull" style="width: 100%; height: 100%; display: block;"></canvas>
                    </div>
                </div>
            `;
            drawSparkline('osdSparklineFull');
        }
    }

    function drawCurrentSparkline() {
        if (currentMode === 'advanced') {
            drawSparkline('osdSparklineAdvanced');
        } else if (currentMode === 'full') {
            drawSparkline('osdSparklineFull');
        }
    }

    window.toggleFPSMonitor = function (show) {
        const osd = document.getElementById('fpsOSD');
        if (!osd) return;

        isMonitorActive = typeof show === 'boolean' ? show : !isMonitorActive;
        osd.classList.toggle('active', isMonitorActive);
        SafeStorage.setItem('fpsOSDActive', isMonitorActive ? 'true' : 'false');

        const fpsToggleBtn = document.getElementById('fpsOSDToggle');
        if (fpsToggleBtn) {
            fpsToggleBtn.classList.toggle('active', isMonitorActive);
        }

        if (isMonitorActive) {
            lastTime = performance.now();
            lastFrameTime = performance.now();
            frameCount = 0;
            renderOSDContent();
            requestAnimationFrame(updateFPS);
            clampOSDPosition(osd, false);
        }
    };

    function getHeaderHeight() {
        const header = document.querySelector('header') || document.querySelector('.site-header') || document.querySelector('#header');
        if (header && header.offsetHeight > 0) {
            return header.offsetHeight;
        }
        const computed = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
        if (computed) {
            const parsed = parseInt(computed);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        return 75; // 預設 Header 高度
    }

    // 取得主要內容顯示區塊的邊界範圍 (Main Content Area Bounds)
    function getMainContentBounds() {
        const mainArea = document.querySelector('.game-center-container, .game-container');
        if (mainArea) {
            const rect = mainArea.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
                return {
                    left: Math.max(0, rect.left),
                    top: Math.max(0, rect.top),
                    right: Math.min(window.innerWidth, rect.right),
                    bottom: Math.min(window.innerHeight, rect.bottom),
                    width: rect.width,
                    height: rect.height
                };
            }
        }

        const headerHeight = getHeaderHeight();
        const sidebar = document.getElementById('gcSidebar') || document.querySelector('.gc-sidebar');
        let sidebarRight = 0;
        if (sidebar && sidebar.offsetWidth > 0 && !sidebar.classList.contains('hidden-sidebar') && !sidebar.classList.contains('hidden')) {
            sidebarRight = Math.max(0, sidebar.getBoundingClientRect().right);
        }

        return {
            left: sidebarRight,
            top: headerHeight,
            right: window.innerWidth,
            bottom: window.innerHeight,
            width: window.innerWidth - sidebarRight,
            height: window.innerHeight - headerHeight
        };
    }

    // 取得 OSD 面板在主內容區塊內的合法座標範圍 (帶 8px 安全邊距)
    function getOSDBounds(osd) {
        const main = getMainContentBounds();
        const margin = 8;
        const osdWidth = osd.offsetWidth || 250;
        const osdHeight = osd.offsetHeight || 120;

        const minLeft = main.left + margin;
        const minTop = main.top + margin;
        const maxLeft = Math.max(minLeft, main.right - osdWidth - margin);
        const maxTop = Math.max(minTop, main.bottom - osdHeight - margin);

        return { minLeft, minTop, maxLeft, maxTop };
    }

    // 設定 OSD 座標，並加上最高優先級以克服任何外部 CSS 衝突
    function applyOSDPosition(osd, left, top) {
        osd.style.setProperty('right', 'auto', 'important');
        osd.style.setProperty('bottom', 'auto', 'important');
        osd.style.setProperty('left', `${Math.round(left)}px`, 'important');
        osd.style.setProperty('top', `${Math.round(top)}px`, 'important');
    }

    // 限制 OSD 位置於主內容顯示區塊內
    function clampOSDPosition(osd, saveToStorage = true) {
        if (!osd) return;
        const bounds = getOSDBounds(osd);

        let currentLeft = parseInt(osd.style.left);
        let currentTop = parseInt(osd.style.top);

        if (isNaN(currentLeft) || isNaN(currentTop)) {
            const rect = osd.getBoundingClientRect();
            if (isNaN(currentLeft)) currentLeft = rect.left;
            if (isNaN(currentTop)) currentTop = rect.top;
        }

        const clampedLeft = Math.max(bounds.minLeft, Math.min(bounds.maxLeft, currentLeft));
        const clampedTop = Math.max(bounds.minTop, Math.min(bounds.maxTop, currentTop));

        applyOSDPosition(osd, clampedLeft, clampedTop);

        if (saveToStorage) {
            SafeStorage.setItem('fpsOSD_left', clampedLeft);
            SafeStorage.setItem('fpsOSD_top', clampedTop);
        }
    }

    function initOSDControls() {
        const osd = document.getElementById('fpsOSD');
        if (!osd) return;

        // 1. 恢復儲存的尺寸與位置
        const savedLeft = SafeStorage.getItem('fpsOSD_left');
        const savedTop = SafeStorage.getItem('fpsOSD_top');
        const savedWidth = SafeStorage.getItem('fpsOSD_width');
        const savedHeight = SafeStorage.getItem('fpsOSD_height');
        const savedMode = SafeStorage.getItem('fpsOSD_mode') || 'fps';

        if (savedWidth) {
            const w = Math.max(190, Math.min(window.innerWidth - 20, parseInt(savedWidth)));
            osd.style.width = `${w}px`;
        }
        if (savedHeight) {
            const h = Math.max(110, Math.min(window.innerHeight - 20, parseInt(savedHeight)));
            osd.style.height = `${h}px`;
        }

        if (savedLeft !== null && savedTop !== null && !isNaN(parseInt(savedLeft)) && !isNaN(parseInt(savedTop))) {
            applyOSDPosition(osd, parseInt(savedLeft), parseInt(savedTop));
            clampOSDPosition(osd, true);
        } else {
            requestAnimationFrame(() => {
                clampOSDPosition(osd, false);
            });
        }

        // 2. 恢復模式選擇
        currentMode = savedMode;
        const modeBtns = osd.querySelectorAll('.osd-mode-btn');
        modeBtns.forEach(btn => {
            const m = btn.getAttribute('data-mode');
            if (m === currentMode) btn.classList.add('active');
            else btn.classList.remove('active');

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.getAttribute('data-mode') || 'fps';
                SafeStorage.setItem('fpsOSD_mode', currentMode);
                renderOSDContent();
            });
        });

        // 3. 恢復開關狀態
        if (SafeStorage.getItem('fpsOSDActive') === 'true') {
            window.toggleFPSMonitor(true);
        }

        // 4. 平滑拖曳機制 (Smooth Draggable Header)
        const header = osd.querySelector('.osd-header');
        if (header) {
            let isDragging = false;
            let startX = 0, startY = 0;
            let initLeft = 0, initTop = 0;

            function startDrag(clientX, clientY) {
                isDragging = true;
                startX = clientX;
                startY = clientY;

                const rect = osd.getBoundingClientRect();
                initLeft = rect.left;
                initTop = rect.top;

                applyOSDPosition(osd, initLeft, initTop);
                document.body.classList.add('osd-dragging');
                header.style.cursor = 'grabbing';
            }

            function moveDrag(clientX, clientY) {
                if (!isDragging) return;
                const dx = clientX - startX;
                const dy = clientY - startY;

                const bounds = getOSDBounds(osd);
                let targetLeft = initLeft + dx;
                let targetTop = initTop + dy;

                targetLeft = Math.max(bounds.minLeft, Math.min(bounds.maxLeft, targetLeft));
                targetTop = Math.max(bounds.minTop, Math.min(bounds.maxTop, targetTop));

                applyOSDPosition(osd, targetLeft, targetTop);
            }

            function endDrag() {
                if (!isDragging) return;
                isDragging = false;
                document.body.classList.remove('osd-dragging');
                header.style.cursor = 'move';
                clampOSDPosition(osd, true);
            }

            // 滑鼠拖曳 (左鍵)
            header.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.osd-mode-switcher')) return;
                e.preventDefault();

                startDrag(e.clientX, e.clientY);

                function onMouseMove(me) {
                    me.preventDefault();
                    moveDrag(me.clientX, me.clientY);
                }

                function onMouseUp() {
                    endDrag();
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            // 觸控拖曳支援 (Touch Support)
            header.addEventListener('touchstart', (e) => {
                if (e.target.closest('.osd-mode-switcher')) return;
                if (e.touches.length !== 1) return;
                const touch = e.touches[0];

                startDrag(touch.clientX, touch.clientY);

                function onTouchMove(te) {
                    if (!isDragging) return;
                    te.preventDefault();
                    const t = te.touches[0];
                    moveDrag(t.clientX, t.clientY);
                }

                function onTouchEnd() {
                    endDrag();
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onTouchEnd);
                    document.removeEventListener('touchcancel', onTouchEnd);
                }

                document.addEventListener('touchmove', onTouchMove, { passive: false });
                document.addEventListener('touchend', onTouchEnd);
                document.addEventListener('touchcancel', onTouchEnd);
            }, { passive: true });
        }

        // 5. 監聽視窗 Resize 與側邊欄展開/折疊事件，確保 OSD 永不跑出主內容顯示區塊
        window.addEventListener('resize', () => {
            clampOSDPosition(osd, false);
            drawCurrentSparkline();
        });

        // 監聽側邊欄摺疊/展開與顯示切換事件，自動即時校準位置
        window.addEventListener('sidebarCollapseChange', () => {
            clampOSDPosition(osd, true);
            setTimeout(() => clampOSDPosition(osd, true), 350);
        });

        window.addEventListener('sidebarVisibilityChange', () => {
            clampOSDPosition(osd, true);
            setTimeout(() => clampOSDPosition(osd, true), 350);
        });

        const sidebarEl = document.getElementById('gcSidebar') || document.querySelector('.gc-sidebar');
        if (sidebarEl) {
            sidebarEl.addEventListener('transitionend', () => {
                clampOSDPosition(osd, true);
            });
        }

        const mainContainerEl = document.querySelector('.game-center-container, .game-container');
        if (mainContainerEl) {
            mainContainerEl.addEventListener('transitionend', () => {
                clampOSDPosition(osd, true);
            });
        }

        // 6. 監聽 OSD Resize 事件並儲存尺寸
        if (window.ResizeObserver) {
            const ro = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    if (isMonitorActive) {
                        SafeStorage.setItem('fpsOSD_width', Math.round(osd.offsetWidth));
                        SafeStorage.setItem('fpsOSD_height', Math.round(osd.offsetHeight));
                        clampOSDPosition(osd, true);
                        drawCurrentSparkline();
                    }
                }
            });
            ro.observe(osd);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOSDControls);
    } else {
        initOSDControls();
    }
})();
