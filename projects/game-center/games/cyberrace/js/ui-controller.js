/**
 * CyberRaceUI - UI_V3 Arcade 互動導航與選單控制系統
 */
window.CyberRaceUI = (() => {
    "use strict";

    function init() {
        if (typeof Core !== 'undefined') Core.initBackground();
        if (typeof Navigation !== 'undefined') Navigation.init();

        const gameContainer = document.getElementById('game-canvas-container');
        Game.init(gameContainer);

        // 側邊欄狀態
        const sidebar = document.getElementById('gcSidebar');
        const mainGameContainer = document.querySelector('.game-container');
        const showSidebar = localStorage.getItem('showSidebar') !== 'false';

        if (sidebar) {
            if (!showSidebar) {
                sidebar.style.display = 'none';
                applyGameContainerMarginHidden(true);
            } else {
                sidebar.style.display = '';
                const isCollapsed = (localStorage.getItem('sidebarCollapsed') === 'false' || localStorage.getItem('gcSidebarCollapsed') === 'false') ? false : true;
                sidebar.classList.toggle('collapsed', isCollapsed);
                const toggleBtn = document.getElementById('sidebarToggle');
                if (toggleBtn) {
                    toggleBtn.setAttribute('title', isCollapsed ? '展開側邊欄' : '摺疊側邊欄');
                    const toggleSpan = toggleBtn.querySelector('.sidebar-text') || toggleBtn.querySelector('span');
                    if (toggleSpan) toggleSpan.textContent = isCollapsed ? '展開' : '摺疊';
                }
                applyGameContainerMarginHidden(false);
            }
        }

        function applyGameContainerMarginHidden(hidden) {
            if (!mainGameContainer) return;
            if (hidden) mainGameContainer.style.setProperty('margin-left', '0', 'important');
            else mainGameContainer.style.removeProperty('margin-left');
        }

        function syncSidebarState() {
            if (!sidebar) return;
            const isHidden = sidebar.style.display === 'none' || sidebar.classList.contains('hidden-sidebar');
            applyGameContainerMarginHidden(isHidden);
        }

        function updateLayout() {
            syncSidebarState();
            Game.onResize();
        }

        updateLayout();
        let resizeTimer;
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateLayout, 100); });
        window.addEventListener('sidebarToggle', e => { 
            if (sidebar) sidebar.style.display = e.detail.visible ? '' : 'none'; 
            updateLayout(); 
        });
        window.addEventListener('sidebarVisibilityChange', e => { 
            if (sidebar) sidebar.style.display = e.detail.visible ? '' : 'none'; 
            updateLayout(); 
        });
        window.addEventListener('sidebarCollapseChange', e => { 
            if (sidebar && e && e.detail) {
                sidebar.classList.toggle('collapsed', e.detail.collapsed);
            }
            updateLayout(); 
        });
        window.addEventListener('storage', e => { 
            if (e.key === 'showSidebar') { 
                if (sidebar) sidebar.style.display = (e.newValue !== 'false') ? '' : 'none'; 
                updateLayout(); 
            } else if (e.key === 'sidebarCollapsed' || e.key === 'gcSidebarCollapsed') {
                if (sidebar) sidebar.classList.toggle('collapsed', e.newValue !== 'false');
                updateLayout();
            }
        });

        // ========== UI_V3 Arcade Interactive Engine & Navigation ==========
        // Web Audio Synthesizer
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        function playBeep(freq, duration, type='sine') {
            try {
                if(audioCtx.state === 'suspended') audioCtx.resume();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + duration);
            } catch(e) { }
        }

        function sfxMove() { playBeep(600, 0.08, 'triangle'); }
        function sfxConfirm() { 
            playBeep(800, 0.1, 'square'); 
            setTimeout(() => playBeep(1200, 0.15, 'square'), 80);
        }
        function sfxBack() { playBeep(400, 0.12, 'sawtooth'); }

        // Data Models
        let trackData = [];
        async function loadTracksIndex() {
            try {
                const response = await fetch('./data/tracks/tracks_index.json');
                if (response.ok) {
                    const rawIndex = await response.json();
                    trackData = rawIndex.map(item => {
                        const diff = Math.min(5, Math.max(1, item.difficulty || 3));
                        const starsStr = '★'.repeat(diff) + '☆'.repeat(5 - diff);
                        const lenStr = item.len || '5,000m';
                        const numLen = parseInt(lenStr.replace(/,/g, '').replace('m', '')) || 5000;
                        return {
                            id: item.id,
                            name: item.name,
                            nameEn: item.nameEn || '',
                            nameJa: item.nameJa || '',
                            type: item.type || 'PTP',
                            stars: starsStr,
                            difficulty: diff,
                            region: item.region || '日本',
                            len: lenStr,
                            elev: item.elev || '200m'
                        };
                    });
                    if (trackData.length > 0 && typeof selectedTrackObj !== 'undefined') {
                        selectedTrackObj = trackData[0];
                    }
                }
            } catch (err) {
                console.error("Failed to load tracks_index.json:", err);
            }
        }

        let carData = [];
        async function loadCarsIndex() {
            try {
                const response = await fetch('./data/cars/cars_index.json');
                if (response.ok) {
                    carData = await response.json();
                    if (carData.length > 0 && typeof selectedCarObj !== 'undefined') {
                        selectedCarObj = carData[1] || carData[0];
                    }
                }
            } catch (err) {
                console.error("Failed to load cars_index.json:", err);
            }
        }

        const modalGuideData = [
            {
                id: 'announcement',
                num: '01',
                title: '版本更新公告 v3.0',
                content: `
                    <p style="color:#ddd; line-height:1.6; font-size:14px;">
                        1. 全新大型電玩極速 UI：整合賽道預覽 2D 畫布、實時動態座標連線。<br>
                        2. 完整車輛規格展台：支援性能數據柱狀圖、驅動形式標籤與顏色塗裝全預覽。<br>
                        3. 多維度篩選與排序：支援型態 (PTP / 環道)、車廠、年份、難度與馬力高低排序。<br>
                        4. 鍵盤與 Gamepad 全盤適應：直覺導航切換與動態控制提示 Footer。
                    </p>
                `
            },
            {
                id: 'nav',
                num: '01',
                title: '系統與選單操控指南',
                items: [
                    { name: '選單選擇與導航', key: 'WASD / ↑↓←→ / D-PAD' },
                    { name: '切換分頁與標籤', key: 'Q / E / LB / RB' },
                    { name: '切換篩選/排序方式', key: 'Y / X' },
                    { name: '確認選取', key: 'ENTER / Space / A' },
                    { name: '返回上一頁', key: 'ESC / B' },
                    { name: '開啟/關閉內部選單', key: 'ESC / P / ☰' },
                    { name: '系統說明與公告', key: 'H / ⧉' }
                ]
            }
        ];

        // Core Global State Variables
        let currentScreen = 'screen-mode';
        let historyStack = [];
        let trackScreenZone = 'list'; 
        let settingsFocusRow = 0;     
        let focusIndex = 0;
        let currentFocusables = [];
        let lastPadTimestamp = 0;
        let selectedTrackObj = trackData[0];
        let selectedCarObj = carData[1];
        let selectedTrackDirection = 'forward';
        let selectedTrackWeather = 'dry';
        let selectedAIDifficulty = 'normal';
        let selectedGameMode = 'battle'; // 'battle' | 'time_attack'

        function selectMode(mode) {
            selectedGameMode = mode || 'battle';
            sfxConfirm();
            navigateTo('screen-track');
        }

        // Track Filtering & Sorting Data
        const filterModes = [
            { label: '賽道類型', options: ['ALL', 'PTP', 'Circuit'] },
            { label: '難度等級', options: ['ALL', '5', '4', '3', '2'] },
            { label: '地區分類', options: ['ALL', '日本'] }
        ];

        const sortModes = [
            { label: '名稱 A-Z' },
            { label: '名稱 Z-A' },
            { label: '長度: 長→短' },
            { label: '長度: 短→長' },
            { label: '難度: 高→低' },
            { label: '難度: 低→高' }
        ];

        // Car Filtering & Sorting Data
        const carFilterModes = [
            { label: '車廠品牌', options: ['ALL', 'TOYOTA', 'MAZDA', 'SUBARU'] },
            { label: '年份', options: ['ALL', '1980', '1990'] },
            { label: '驅動方式', options: ['ALL', '後驅', '四驅'] }
        ];

        const carSortModes = [
            { label: '名稱 A-Z' },
            { label: '名稱 Z-A' },
            { label: '馬力: 高→低' },
            { label: '馬力: 低→高' },
            { label: '年份: 新→舊' },
            { label: '年份: 舊→新' }
        ];

        let currentFilterModeIndex = 0; 
        let currentFilterValIndex = 0;  
        let currentSortIndex = 0;       

        let currentCarFilterModeIndex = 0;
        let currentCarFilterValIndex = 0;
        let currentCarSortIndex = 0;

        let modalActiveTabIndex = 0;
        let currentInputDevice = 'keyboard';

        function setInputDevice(dev) {
            if (currentInputDevice !== dev) {
                currentInputDevice = dev;
                updateControlHints();
                const statusLabel = document.getElementById('connection-status-label');
                if (statusLabel) {
                    statusLabel.innerText = dev === 'gamepad' ? 'CONNECTED: [GAMEPAD_ACTIVE]' : 'STATUS: [KEYBOARD_ACTIVE]';
                }
            }
        }

        function updateControlHints() {
            const footerContainer = document.getElementById('footer-hints-container');
            if (footerContainer) {
                if (currentInputDevice === 'keyboard') {
                    footerContainer.innerHTML = `
                        <span><span class="key-badge">WASD / ↑↓←→</span> 選擇</span>
                        <span><span class="key-badge" onclick="handleFooterAction('prevTab')">Q</span> / <span class="key-badge" onclick="handleFooterAction('nextTab')">E</span> 切換標籤</span>
                        <span><span class="key-badge" onclick="handleFooterAction('filter')">Y</span> 篩選類別</span>
                        <span><span class="key-badge" onclick="handleFooterAction('sort')">X</span> 排序</span>
                        <span><span class="key-badge" onclick="handleFooterAction('confirm')">ENTER</span> 確認</span>
                        <span><span class="key-badge" onclick="handleFooterAction('back')">ESC</span> 返回</span>
                        <span><span class="key-badge" onclick="handleFooterAction('menu')">ESC / P</span> 選單</span>
                        <span><span class="key-badge" onclick="handleFooterAction('help')">H</span> 操作說明</span>
                    `;
                } else {
                    footerContainer.innerHTML = `
                        <span><span class="key-badge">D-PAD / LS</span> 選擇</span>
                        <span><span class="key-badge" onclick="handleFooterAction('prevTab')">LB</span> / <span class="key-badge" onclick="handleFooterAction('nextTab')">RB</span> 切換標籤</span>
                        <span><span class="key-badge" onclick="handleFooterAction('filter')">Y</span> 篩選類別</span>
                        <span><span class="key-badge" onclick="handleFooterAction('sort')">X</span> 排序</span>
                        <span><span class="key-badge" onclick="handleFooterAction('confirm')">A</span> 確認</span>
                        <span><span class="key-badge" onclick="handleFooterAction('back')">B</span> 返回</span>
                        <span><span class="key-badge" onclick="handleFooterAction('menu')">☰</span> 選單</span>
                        <span><span class="key-badge" onclick="handleFooterAction('help')">⧉</span> 操作說明</span>
                    `;
                }
            }

            const escHintEl = document.getElementById('escHint');
            if (escHintEl) {
                if (currentInputDevice === 'keyboard') {
                    escHintEl.innerHTML = '<span class="key-badge">ESC / P</span> 暫停選單';
                } else {
                    escHintEl.innerHTML = '<span class="key-badge">☰</span> 暫停選單';
                }
            }

            const lbText = currentInputDevice === 'keyboard' ? 'Q' : 'LB';
            const rbText = currentInputDevice === 'keyboard' ? 'E' : 'RB';

            ['track-lb-badge', 'car-lb-badge'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = lbText;
            });
            ['track-rb-badge', 'car-rb-badge'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = rbText;
            });

            updateTrackScreenFocus();
        }

        function renderTrackFilterBar() {
            const container = document.getElementById('filter-tabs-container');
            const sortLabel = document.getElementById('sort-mode-label');
            if (!container) return;

            const currentMode = filterModes[currentFilterModeIndex];
            if (!currentMode) return;

            container.innerHTML = currentMode.options.map((opt, idx) => {
                let label = opt;
                if (opt === 'ALL') label = `ALL (${currentMode.label})`;
                else if (currentMode.label === '難度等級') label = `${opt}★`;

                return `<div class="filter-btn ${idx === currentFilterValIndex ? 'active' : ''}" onclick="selectTrackFilterVal(${idx})">${label}</div>`;
            }).join('');

            if (sortLabel) {
                sortLabel.innerText = `排序: ${sortModes[currentSortIndex].label}`;
            }
        }

        function renderCarFilterBar() {
            const container = document.getElementById('car-filter-tabs-container');
            const sortLabel = document.getElementById('car-sort-mode-label');
            if (!container) return;

            const currentMode = carFilterModes[currentCarFilterModeIndex];
            if (!currentMode) return;

            container.innerHTML = currentMode.options.map((opt, idx) => {
                let label = opt;
                if (opt === 'ALL') label = `ALL (${currentMode.label})`;
                return `<div class="filter-btn ${idx === currentCarFilterValIndex ? 'active' : ''}" onclick="selectCarFilterVal(${idx})">${label}</div>`;
            }).join('');

            if (sortLabel) {
                sortLabel.innerText = `排序: ${carSortModes[currentCarSortIndex].label}`;
            }
        }

        function handleFooterAction(action) {
            sfxMove();
            if (action === 'prevTab') {
                if (currentScreen === 'screen-track') switchTrackFilter(-1);
                else if (currentScreen === 'screen-car') switchCarFilter(-1);
            } else if (action === 'nextTab') {
                if (currentScreen === 'screen-track') switchTrackFilter(1);
                else if (currentScreen === 'screen-car') switchCarFilter(1);
            } else if (action === 'filter') {
                if (currentScreen === 'screen-track') cycleFilterMode();
                else if (currentScreen === 'screen-car') cycleCarFilterMode();
            } else if (action === 'sort') {
                if (currentScreen === 'screen-track') cycleSortMode();
                else if (currentScreen === 'screen-car') cycleCarSortMode();
            } else if (action === 'confirm') {
                if (currentScreen === 'screen-track') {
                    confirmCourse();
                } else if (currentScreen === 'screen-car') {
                    confirmCar();
                } else if (currentFocusables[focusIndex]) {
                    currentFocusables[focusIndex].click();
                }
            } else if (action === 'back') {
                goBack();
            } else if (action === 'menu') {
                const pauseMenu = document.getElementById('pauseHint');
                const isPauseActive = pauseMenu && pauseMenu.classList.contains('active');
                if (isPauseActive) {
                    handlePauseMenuAction('back');
                } else {
                    const isRacing = typeof Game !== 'undefined' && Game.getState && (Game.getState() === 'playing' || Game.getState() === 'paused' || Game.getState() === 'countdown');
                    if (isRacing) {
                        isOpenedFromOutsideRace = false;
                        Game.togglePause();
                    } else {
                        openGameSettingsPage();
                    }
                }
            } else if (action === 'help') {
                toggleModal(true);
            }
        }

        function selectTrackFilterVal(idx) {
            sfxMove();
            currentFilterValIndex = idx;
            renderTrackFilterBar();
            renderTrackList();
        }

        function switchTrackFilter(dir) {
            sfxMove();
            const optsLength = filterModes[currentFilterModeIndex].options.length;
            currentFilterValIndex = (currentFilterValIndex + dir + optsLength) % optsLength;
            renderTrackFilterBar();
            renderTrackList();
        }

        function cycleFilterMode() {
            sfxConfirm();
            currentFilterModeIndex = (currentFilterModeIndex + 1) % filterModes.length;
            currentFilterValIndex = 0;
            renderTrackFilterBar();
            renderTrackList();
        }

        function cycleSortMode() {
            sfxConfirm();
            currentSortIndex = (currentSortIndex + 1) % sortModes.length;
            renderTrackFilterBar();
            renderTrackList();
        }

        function selectCarFilterVal(idx) {
            sfxMove();
            currentCarFilterValIndex = idx;
            renderCarFilterBar();
            renderCarList();
        }

        function switchCarFilter(dir) {
            sfxMove();
            const optsLength = carFilterModes[currentCarFilterModeIndex].options.length;
            currentCarFilterValIndex = (currentCarFilterValIndex + dir + optsLength) % optsLength;
            renderCarFilterBar();
            renderCarList();
        }

        function cycleCarFilterMode() {
            sfxConfirm();
            currentCarFilterModeIndex = (currentCarFilterModeIndex + 1) % carFilterModes.length;
            currentCarFilterValIndex = 0;
            renderCarFilterBar();
            renderCarList();
        }

        function cycleCarSortMode() {
            sfxConfirm();
            currentCarSortIndex = (currentCarSortIndex + 1) % carSortModes.length;
            renderCarFilterBar();
            renderCarList();
        }

        function renderTrackList() {
            const listContainer = document.getElementById('track-list-container');
            if (!listContainer) return;

            const modeObj = filterModes[currentFilterModeIndex];
            const filterVal = modeObj.options[currentFilterValIndex];

            let filtered = trackData.filter(t => {
                if (filterVal.startsWith('ALL')) return true;
                if (currentFilterModeIndex === 0) return t.type === filterVal;
                if (currentFilterModeIndex === 1) return t.difficulty === parseInt(filterVal);
                if (currentFilterModeIndex === 2) return t.region === filterVal;
                return true;
            });

            filtered.sort((a, b) => {
                const lenA = parseInt(a.len.replace(/,/g, ''));
                const lenB = parseInt(b.len.replace(/,/g, ''));

                switch (currentSortIndex) {
                    case 0: return a.name.localeCompare(b.name, 'zh-TW');
                    case 1: return b.name.localeCompare(a.name, 'zh-TW');
                    case 2: return lenB - lenA;
                    case 3: return lenA - lenB;
                    case 4: return b.difficulty - a.difficulty;
                    case 5: return a.difficulty - b.difficulty;
                    default: return 0;
                }
            });

            if (filtered.length === 0) {
                listContainer.innerHTML = '<div style="padding:20px; color:#aaa; font-weight:bold;">查無符合條件之賽道</div>';
                return;
            }

            listContainer.innerHTML = filtered.map((t, idx) => `
                <div class="arcade-card track-item ${idx === 0 ? 'selected' : ''}" data-id="${t.id}" onclick="onTrackCardClick('${t.id}', this)">
                    <div>
                        <span class="track-name">${t.name}</span>
                        <span class="track-type-tag">[${t.type}]</span>
                    </div>
                    <span class="track-stars">${t.stars}</span>
                </div>
            `).join('');

            updateFocusableElements();
            if (filtered[0]) {
                selectTrack(filtered[0], listContainer.children[0]);
            }
        }

        function renderCarList() {
            const listContainer = document.getElementById('car-list-container');
            if (!listContainer) return;

            const modeObj = carFilterModes[currentCarFilterModeIndex];
            const filterVal = modeObj.options[currentCarFilterValIndex];

            let filtered = carData.filter(c => {
                if (filterVal.startsWith('ALL')) return true;
                if (currentCarFilterModeIndex === 0) return c.brand === filterVal;
                if (currentCarFilterModeIndex === 1) {
                    const startYear = parseInt(filterVal.substring(0, 4));
                    return c.year >= startYear && c.year < startYear + 10;
                }
                if (currentCarFilterModeIndex === 2) {
                    if (filterVal.includes('前驅')) return c.drivetrain === 'FF';
                    if (filterVal.includes('後驅')) return c.drivetrain === 'FR';
                    if (filterVal.includes('四驅')) return c.drivetrain === '4WD';
                }
                return true;
            });

            filtered.sort((a, b) => {
                switch (currentCarSortIndex) {
                    case 0: return a.model.localeCompare(b.model, 'zh-TW');
                    case 1: return b.model.localeCompare(a.model, 'zh-TW');
                    case 2: return b.hp - a.hp;
                    case 3: return a.hp - b.hp;
                    case 4: return b.year - a.year;
                    case 5: return a.year - b.year;
                    default: return 0;
                }
            });

            if (filtered.length === 0) {
                listContainer.innerHTML = '<div style="padding:20px; color:#aaa; font-weight:bold;">查無符合條件之車輛</div>';
                return;
            }

            listContainer.innerHTML = filtered.map((c, idx) => `
                <div class="arcade-card car-item ${idx === 0 ? 'selected' : ''}" data-id="${c.id}" onclick="onCarCardClick('${c.id}', this)">
                    <div>
                        <span class="car-item-model">${c.model}</span>
                        <span class="car-item-brand">[${c.brand}]</span>
                    </div>
                    <span class="car-item-drive">${c.drivetrain}</span>
                </div>
            `).join('');

            updateFocusableElements();
            if (filtered[0]) {
                selectCar(filtered[0], listContainer.children[0]);
            }
        }

        function onTrackCardClick(trackId, el) {
            sfxMove();
            const matched = trackData.find(t => t.id === trackId);
            if (matched) {
                const idx = currentFocusables.indexOf(el);
                if (idx !== -1) {
                    focusIndex = idx;
                }
                trackScreenZone = 'list';
                highlightFocused();
                selectTrack(matched, el);
            }
        }

        function onCarCardClick(carId, el) {
            sfxMove();
            const matched = carData.find(c => c.id === carId);
            if (matched) {
                const idx = currentFocusables.indexOf(el);
                if (idx !== -1) {
                    focusIndex = idx;
                }
                highlightFocused();
                selectCar(matched, el);
            }
        }

        function selectTrack(trackObj, el) {
            if (!trackObj) return;
            selectedTrackObj = trackObj;
            
            const titleEl = document.getElementById('preview-track-title');
            const subEl = document.getElementById('preview-track-sub');
            const starsEl = document.getElementById('preview-track-stars');
            const lenEl = document.getElementById('stat-len');
            const elevEl = document.getElementById('stat-elev');

            if (titleEl) titleEl.innerText = trackObj.name || '';
            if (subEl) {
                const subParts = [];
                if (trackObj.nameEn) subParts.push(trackObj.nameEn);
                if (trackObj.nameJa && trackObj.nameJa !== trackObj.name) subParts.push(trackObj.nameJa);
                subEl.innerText = subParts.length > 0 ? `[ ${subParts.join(' | ')} ]` : '';
            }
            const diffVal = trackObj.difficulty !== undefined ? trackObj.difficulty : (typeof trackObj.stars === 'number' ? trackObj.stars : 3);
            if (starsEl) starsEl.innerText = typeof trackObj.stars === 'string' ? trackObj.stars : ('★'.repeat(diffVal) + '☆'.repeat(5 - diffVal));
            if (lenEl) lenEl.innerText = trackObj.len || trackObj.length || '-';
            if (elevEl) elevEl.innerText = trackObj.elev !== undefined ? trackObj.elev : '-';

            drawTrackCanvas(trackObj);
        }

        function selectCar(carObj, el) {
            selectedCarObj = carObj;

            const brandEl = document.getElementById('preview-car-brand');
            const titleEl = document.getElementById('preview-car-title');
            const driveEl = document.getElementById('preview-car-drive');
            const hpEl = document.getElementById('stat-car-hp');
            const weightEl = document.getElementById('stat-car-weight');
            const yearEl = document.getElementById('stat-car-year');

            if (brandEl) brandEl.innerText = carObj.brand;
            if (titleEl) titleEl.innerText = carObj.model;
            if (driveEl) driveEl.innerText = `${carObj.drivetrain} / ${carObj.transmission}`;
            if (hpEl) hpEl.innerText = `${carObj.hp} PS`;
            if (weightEl) weightEl.innerText = carObj.weight;
            if (yearEl) yearEl.innerText = carObj.year;

            const setBar = (id, val) => {
                const bar = document.getElementById(`bar-${id}`);
                const valLabel = document.getElementById(`val-bar-${id}`);
                if (bar) bar.style.width = `${val}%`;
                if (valLabel) valLabel.innerText = val;
            };

            setBar('speed', carObj.topSpeed);
            setBar('accel', carObj.accel);
            setBar('handling', carObj.handling);
            setBar('drift', carObj.drift);

            const colorDotsContainer = document.getElementById('car-color-dots');
            if (colorDotsContainer && carObj.colors) {
                colorDotsContainer.innerHTML = carObj.colors.map(color => `
                    <div class="color-dot" style="background-color: ${color};"></div>
                `).join('');
            }

            drawCarCanvas(carObj);
        }

        const trackDataCache = {};
        async function loadTrackData(trackId) {
            if (!trackId) return null;
            if (trackDataCache[trackId]) return trackDataCache[trackId];
            try {
                const response = await fetch(`./data/tracks/${trackId}.json`);
                if (response.ok) {
                    const data = await response.json();
                    trackDataCache[trackId] = data;
                    return data;
                }
            } catch (err) {
                console.error("Failed to load track data JSON:", trackId, err);
            }
            return null;
        }
        window.loadTrackData = loadTrackData;

        async function drawTrackCanvas(trackObj) {
            if (!trackObj) return;
            const fullTrack = await loadTrackData(trackObj.id);
            if (fullTrack && window.TrackAnalyzer) {
                TrackAnalyzer.loadRouteData(fullTrack, selectedTrackDirection);
            }
        }

        function drawCarCanvas(carObj) {
            const canvas = document.getElementById('carCanvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width || 300;
            canvas.height = rect.height || 180;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const w = canvas.width;
            const h = canvas.height;

            ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 20) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            for (let y = 0; y < h; y += 20) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }

            const cx = w / 2;
            const cy = h / 2 + 10;

            ctx.save();
            ctx.translate(cx, cy);

            ctx.beginPath();
            ctx.ellipse(0, 25, 110, 15, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-110, 15);
            ctx.lineTo(-100, -5);
            ctx.lineTo(-60, -8);
            ctx.lineTo(-30, -28);
            ctx.lineTo(20, -28);
            ctx.lineTo(60, -10);
            ctx.lineTo(100, -2);
            ctx.lineTo(105, 15);
            ctx.closePath();

            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 10;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(-35, -8);
            ctx.lineTo(-25, -24);
            ctx.lineTo(15, -24);
            ctx.lineTo(45, -8);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 0;
            ctx.stroke();

            const drawWheel = (wx) => {
                ctx.beginPath();
                ctx.arc(wx, 15, 14, 0, Math.PI * 2);
                ctx.fillStyle = '#102035';
                ctx.fill();
                ctx.strokeStyle = '#ff6600';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(wx, 15, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#ffea00';
                ctx.fill();
            };

            drawWheel(-65);
            drawWheel(65);

            ctx.font = '12px Orbitron';
            ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
            ctx.fillText(`TELEMETRY: ${carObj.drivetrain} / ${carObj.hp}PS`, -120, -45);

            ctx.restore();
        }

        function renderModalTabs() {
            const sidebar = document.getElementById('modal-tab-container');
            if (!sidebar) return;

            sidebar.innerHTML = modalGuideData.map((t, idx) => `
                <div class="modal-tab-item ${idx === modalActiveTabIndex ? 'active' : ''}" onclick="switchModalTab(${idx})">
                    <span class="tab-num">${t.num}</span>
                    <span>${t.title}</span>
                </div>
            `).join('');

            renderModalContent();
        }

        function switchModalTab(index) {
            sfxMove();
            modalActiveTabIndex = (index + modalGuideData.length) % modalGuideData.length;
            renderModalTabs();
        }

        function renderModalContent() {
            const panel = document.getElementById('modal-detail-content');
            if (!panel) return;

            const activeData = modalGuideData[modalActiveTabIndex];
            if (!activeData) return;

            let html = `<div class="modal-detail-title">${activeData.title}</div>`;

            if (activeData.items) {
                html += activeData.items.map(item => `
                    <div class="key-item">
                        <span style="color:#fff; font-weight:bold;">${item.name}</span>
                        <span class="key-badge">${item.key}</span>
                    </div>
                `).join('');
            } else if (activeData.content) {
                html += activeData.content;
            }

            panel.innerHTML = html;
        }

        function toggleModal(show) {
            if (show) sfxConfirm(); else sfxBack();
            const modal = document.getElementById('modal-controls');
            if (modal) {
                modal.style.display = show ? 'flex' : 'none';
                if (show) {
                    modalActiveTabIndex = 0;
                    renderModalTabs();
                }
            }
        }

        function setOpt(group, val, el) {
            sfxMove();
            const parent = el.parentElement;
            parent.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
            el.classList.add('active');
            if (group === 'dir') {
                selectedTrackDirection = val;
                if (selectedTrackObj) {
                    drawTrackCanvas(selectedTrackObj);
                }
            }
            else if (group === 'weather') selectedTrackWeather = val;
        }

        function confirmCourse() {
            sfxConfirm();
            navigateTo('screen-car');
        }

        function confirmCar() {
            sfxConfirm();
            if (selectedGameMode === 'time_attack') {
                startGame('normal');
            } else {
                navigateTo('screen-ai');
            }
        }

        function navigateTo(screenId) {
            if (currentScreen === screenId) return;
            sfxConfirm();
            historyStack.push(currentScreen);
            document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(screenId);
            if (target) {
                target.classList.add('active');
                currentScreen = screenId;
                trackScreenZone = 'list';
                
                if (screenId === 'screen-car') {
                    renderCarFilterBar();
                    renderCarList();
                }
                updateFocusableElements();
            }
        }

        function goBack() {
            if (historyStack.length > 0) {
                sfxBack();
                const prev = historyStack.pop();
                document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
                const target = document.getElementById(prev);
                if (target) {
                    target.classList.add('active');
                    currentScreen = prev;
                    trackScreenZone = 'list';
                    updateFocusableElements();
                }
            }
        }

        function goBackHome() {
            sfxBack();
            sessionStorage.setItem('skipEntranceAnimation', 'true');
            window.location.href = '../../game-center.html';
        }

        function startGame(diffLevel) {
            currentScreen = 'screen-game';
            sfxConfirm();
            selectedAIDifficulty = diffLevel || 'normal';
            const trackKey = selectedTrackObj ? selectedTrackObj.id : 'akina';
            const carKey = selectedCarObj ? selectedCarObj.id : 'ae86_race';

            document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
            const gameScreen = document.getElementById('screen-game');
            if (gameScreen) {
                gameScreen.classList.add('active');
                gameScreen.style.setProperty('display', 'block', 'important');
                gameScreen.style.setProperty('pointer-events', 'auto', 'important');
            }

            Game.startFromUI(trackKey, selectedTrackDirection, carKey, selectedAIDifficulty, selectedGameMode);
        }

        function restartCurrentRace() {
            sfxConfirm();
            document.getElementById('raceResultPanel').classList.remove('active');
            document.getElementById('exitConfirmPanel').classList.remove('active');
            document.getElementById('pauseHint').classList.remove('active');
            const trackKey = selectedTrackObj ? selectedTrackObj.id : 'akina';
            const carKey = selectedCarObj ? selectedCarObj.id : 'ae86_race';
            Game.startFromUI(trackKey, selectedTrackDirection, carKey, selectedAIDifficulty, selectedGameMode);
        }

        function hideExitConfirm() {
            sfxBack();
            const panel = document.getElementById('exitConfirmPanel');
            if (panel) panel.classList.remove('active');
        }

        function exitToMenu() {
            currentScreen = 'screen-mode';
            sfxBack();
            Game.stop();
            document.getElementById('raceResultPanel').classList.remove('active');
            document.getElementById('exitConfirmPanel').classList.remove('active');
            document.getElementById('pauseHint').classList.remove('active');
            const gameScreen = document.getElementById('screen-game');
            if (gameScreen) {
                gameScreen.classList.remove('active');
                gameScreen.style.setProperty('display', 'none', 'important');
                gameScreen.style.setProperty('pointer-events', 'none', 'important');
            }

            historyStack = [];
            document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
            document.getElementById('screen-mode').classList.add('active');
            currentScreen = 'screen-mode';
            trackScreenZone = 'list';
            updateFocusableElements();
        }

        function updateFocusableElements() {
            const activeScreen = document.querySelector('.menu-screen.active');
            if (!activeScreen) return;
            currentFocusables = Array.from(activeScreen.querySelectorAll('.arcade-card'));
            focusIndex = 0;
            updateTrackScreenFocus();
        }

        function highlightFocused() {
            currentFocusables.forEach((el, idx) => {
                if (idx === focusIndex) {
                    el.classList.add('selected');
                    if (typeof el.scrollIntoView === 'function') {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                    if (currentScreen === 'screen-track' && el.classList.contains('track-item')) {
                        const trackId = el.getAttribute('data-id');
                        if (trackId) {
                            const matched = trackData.find(t => t.id === trackId);
                            if (matched) selectTrack(matched, el);
                        }
                    } else if (currentScreen === 'screen-car' && el.classList.contains('car-item')) {
                        const carId = el.getAttribute('data-id');
                        if (carId) {
                            const matched = carData.find(c => c.id === carId);
                            if (matched) selectCar(matched, el);
                        }
                    } else if (currentScreen === 'screen-mode' && el.getAttribute('data-mode')) {
                        selectedGameMode = el.getAttribute('data-mode');
                    }
                } else {
                    el.classList.remove('selected');
                }
            });
        }

        function updateTrackScreenFocus() {
            const dirGroup = document.getElementById('opt-group-dir');
            const weatherGroup = document.getElementById('opt-group-weather');
            const hintEl = document.getElementById('settings-hint');

            if (dirGroup) dirGroup.classList.remove('focused', 'editing');
            if (weatherGroup) weatherGroup.classList.remove('focused', 'editing');

            if (currentScreen === 'screen-track') {
                highlightFocused();
                if (trackScreenZone === 'settings_nav') {
                    if (hintEl) {
                        hintEl.style.display = 'block';
                        hintEl.innerText = currentInputDevice === 'keyboard'
                            ? '⚙️ 進階設定 [ ←→: 選擇項目 | ENTER: 進入修改 | ESC: 返回賽道 ]'
                            : '⚙️ 進階設定 [ D-PAD ←→: 選擇項目 | A 按鈕: 進入修改 | B 按鈕: 返回賽道 ]';
                    }
                    if (settingsFocusRow === 0 && dirGroup) dirGroup.classList.add('focused');
                    else if (settingsFocusRow === 1 && weatherGroup) weatherGroup.classList.add('focused');
                } else if (trackScreenZone === 'settings_edit') {
                    if (hintEl) {
                        hintEl.style.display = 'block';
                        hintEl.innerText = currentInputDevice === 'keyboard'
                            ? '🔧 修改中 [ ←→ / ENTER: 切換選項 | ESC: 完成選取 ]'
                            : '🔧 修改中 [ D-PAD ←→ / A 按鈕: 切換選項 | B 按鈕: 完成選取 ]';
                    }
                    if (settingsFocusRow === 0 && dirGroup) dirGroup.classList.add('editing');
                    else if (settingsFocusRow === 1 && weatherGroup) weatherGroup.classList.add('editing');
                } else {
                    if (hintEl) hintEl.style.display = 'none';
                }
            } else {
                highlightFocused();
                if (hintEl) hintEl.style.display = 'none';
            }
        }

        function toggleSettingInRow(row) {
            sfxMove();
            if (row === 0) {
                const fwdBtn = document.getElementById('opt-dir-forward');
                const revBtn = document.getElementById('opt-dir-reverse');
                if (fwdBtn && fwdBtn.classList.contains('active')) {
                    setOpt('dir', 'reverse', revBtn);
                } else if (revBtn) {
                    setOpt('dir', 'forward', fwdBtn);
                }
            } else {
                const dryBtn = document.getElementById('opt-weather-dry');
                const wetBtn = document.getElementById('opt-weather-wet');
                if (dryBtn && dryBtn.classList.contains('active')) {
                    setOpt('weather', 'wet', wetBtn);
                } else if (dryBtn) {
                    setOpt('weather', 'dry', dryBtn);
                }
            }
        }

        function navigateDirection(dir) {
            if (currentScreen === 'screen-track') {
                if (trackScreenZone === 'list') {
                    if (dir === 'down') {
                        if (focusIndex < currentFocusables.length - 1) {
                            focusIndex++;
                            sfxMove();
                            updateTrackScreenFocus();
                        }
                    } else if (dir === 'up') {
                        if (focusIndex > 0) {
                            focusIndex--;
                            sfxMove();
                            updateTrackScreenFocus();
                        }
                    } else if (dir === 'right') {
                        trackScreenZone = 'settings_nav';
                        settingsFocusRow = 0;
                        sfxMove();
                        updateTrackScreenFocus();
                    }
                } else if (trackScreenZone === 'settings_nav') {
                    if (dir === 'right') {
                        if (settingsFocusRow < 1) {
                            settingsFocusRow = 1;
                            sfxMove();
                            updateTrackScreenFocus();
                        }
                    } else if (dir === 'left') {
                        if (settingsFocusRow > 0) {
                            settingsFocusRow = 0;
                            sfxMove();
                            updateTrackScreenFocus();
                        }
                    }
                } else if (trackScreenZone === 'settings_edit') {
                    if (dir === 'left' || dir === 'right') {
                        toggleSettingInRow(settingsFocusRow);
                    }
                }
            } else if (currentScreen === 'screen-car') {
                if (dir === 'down') {
                    if (focusIndex < currentFocusables.length - 1) { focusIndex++; sfxMove(); highlightFocused(); }
                } else if (dir === 'up') {
                    if (focusIndex > 0) { focusIndex--; sfxMove(); highlightFocused(); }
                }
            } else { // screen-mode, screen-ai
                if (dir === 'right' || dir === 'down') {
                    if (focusIndex < currentFocusables.length - 1) { focusIndex++; sfxMove(); highlightFocused(); }
                } else if (dir === 'left' || dir === 'up') {
                    if (focusIndex > 0) { focusIndex--; sfxMove(); highlightFocused(); }
                }
            }
        }

        // ==================== 內部暫停與遊戲設定控制邏輯 ====================
        let currentPauseSubPage = 'main'; // 'main' | 'settings'
        let horizonActiveCat = 'controls'; // 'controls' | 'physics' | 'display'
        let horizonSettingsZone = 'category'; // 'category' (左側分類選單) | 'items' (子選單項目列表)
        let horizonCatIndex = 0;
        let pauseFocusIndex = 0;
        let horizonFocusIndex = 0;

        const HORIZON_CATEGORIES = [
            {
                id: 'controls',
                name: '控制與震動',
                descTitle: '🎮 控制與震動設定',
                descText: '設定手把震動開關、震動輸出強度與力回饋效果。支援 Xbox / PlayStation 及通用控制器，在路面摩擦、過彎失控與碰撞時提供即時觸覺回饋。'
            },
            {
                id: 'physics',
                name: '駕駛與物理',
                descTitle: '⚙️ 駕駛與物理設定',
                descText: '調整車輛變速箱模式（自排 / 手排 / 手排含離合器）與輪胎磨損物理系統。真實模擬輪胎抓地力衰退與換檔機械邏輯。'
            },
            {
                id: 'display',
                name: '顯示與遙測',
                descTitle: '📊 顯示與遙測設定',
                descText: '配置賽車即時遙測 HUD、四輪胎溫胎壓與 G 值監控視窗，以及即時畫面更新率 (FPS) 與效能監控 OSD。'
            }
        ];

        const getTransmissionMode = () => (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.getTransmissionMode)
            ? window.CyberRaceInputHaptics.getTransmissionMode()
            : (window.gameSettings?.transmissionMode || localStorage.getItem('transmissionMode') || 'auto');

        const setTransmissionMode = (m) => {
            if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.setTransmissionMode) {
                window.CyberRaceInputHaptics.setTransmissionMode(m);
            } else if (window.Game && window.Game.setTransmissionMode) {
                window.Game.setTransmissionMode(m);
            } else {
                localStorage.setItem('transmissionMode', m);
            }
            if (!window.gameSettings) window.gameSettings = {};
            window.gameSettings.transmissionMode = m;
        };

        const HORIZON_SETTINGS_CONFIG = [
            // 控制與震動
            {
                id: 'vibration',
                category: 'controls',
                label: '🎮 手把震動',
                options: ['開啟 (ON)', '關閉 (OFF)'],
                getValue: () => (window.gameSettings?.vibrationEnabled !== false ? 0 : 1),
                setValue: (idx) => {
                    if (!window.gameSettings) window.gameSettings = {};
                    window.gameSettings.vibrationEnabled = (idx === 0);
                },
                descTitle: '手把震動回饋',
                descText: '設定控制器震動馬達之開關。開啟後在路面摩擦、過彎失控與碰撞時提供物理力回饋感。',
                lockedInRace: false
            },
            {
                id: 'vibIntensity',
                type: 'slider',
                category: 'controls',
                label: '📳 震動強度',
                min: 0,
                max: 100,
                step: 5,
                unit: '%',
                getValue: () => {
                    const val = (window.gameSettings?.vibrationIntensity !== undefined)
                        ? window.gameSettings.vibrationIntensity
                        : 0.10;
                    return Math.round(val * 100);
                },
                setValue: (valPct) => {
                    const clamped = Math.max(0, Math.min(100, Math.round(valPct)));
                    const val = clamped / 100;
                    if (!window.gameSettings) window.gameSettings = {};
                    window.gameSettings.vibrationIntensity = val;
                    localStorage.setItem('vibrationIntensity', val.toString());
                    if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.triggerTestVibration) {
                        window.CyberRaceInputHaptics.triggerTestVibration();
                    }
                },
                descTitle: '手把震動強度滑桿',
                descText: '透過滑桿微調控制器震動輸出強度 (0% ~ 100%)，預設為 10%。可即時感受震動回饋。',
                lockedInRace: false
            },

            // 駕駛與難度 (比賽進行中鎖定，必須在比賽外切換)
            {
                id: 'transmission',
                category: 'physics',
                label: '⚙️ 變速箱模式',
                options: ['自動 (Auto)', '手排 (Manual)', '手排+離合 (Manual+Clutch)'],
                values: ['auto', 'manual', 'manual_clutch'],
                getValue: () => {
                    const mode = getTransmissionMode();
                    const modes = ['auto', 'manual', 'manual_clutch'];
                    const idx = modes.indexOf(mode);
                    return idx >= 0 ? idx : 0;
                },
                setValue: (idx) => {
                    const modes = ['auto', 'manual', 'manual_clutch'];
                    setTransmissionMode(modes[idx]);
                },
                descTitle: '變速箱排檔系統',
                descText: '自動排檔自動換檔；手排與手排加離合可手動控制齒輪比與高轉速引擎輸出。(比賽進行中鎖定，請在賽前選單切換)',
                lockedInRace: true
            },
            {
                id: 'tireWear',
                category: 'physics',
                label: '🛞 輪胎損耗物理',
                options: ['關閉 (Off)', '開啟 (On)'],
                getValue: () => (window.gameSettings?.tireWearEnabled ? 1 : 0),
                setValue: (idx) => {
                    if (!window.gameSettings) window.gameSettings = {};
                    window.gameSettings.tireWearEnabled = (idx === 1);
                },
                descTitle: '輪胎磨損物理擬真',
                descText: '開啟後高強度漂移與高速過彎會逐漸磨損輪胎壽命，降低抓地極限。(注意: 比賽進行中無法切換，請在賽前選單切換)',
                lockedInRace: true
            },

            // 顯示與遙測
            {
                id: 'gaugeStyle',
                category: 'display',
                label: '⚙️ 賽車儀表風格',
                options: ['指針式 (Analog)', '數位式 (Digital)'],
                getValue: () => {
                    const style = (window.CyberRaceHUD && window.CyberRaceHUD.gaugeStyle) || localStorage.getItem('gaugeStyle') || 'analog';
                    return style === 'digital' ? 1 : 0;
                },
                setValue: (idx) => {
                    const style = idx === 1 ? 'digital' : 'analog';
                    if (window.CyberRaceHUD && window.CyberRaceHUD.setGaugeStyle) {
                        window.CyberRaceHUD.setGaugeStyle(style);
                    }
                    if (window._setGaugeStyle) {
                        window._setGaugeStyle(style);
                    }
                    localStorage.setItem('gaugeStyle', style);
                    const analogCanvas = document.getElementById('gaugeCanvas');
                    const digiEl = document.getElementById('gaugeDigital');
                    if (analogCanvas && digiEl) {
                        if (style === 'digital') { analogCanvas.style.display = 'none'; digiEl.style.display = 'flex'; }
                        else { analogCanvas.style.display = 'block'; digiEl.style.display = 'none'; }
                    }
                },
                descTitle: '儀表板視覺風格',
                descText: '指針式提供經典極速針計，數位式提供大字體 RPM、檔位與氮氣條。',
                lockedInRace: false
            },
            {
                id: 'telemetry',
                category: 'display',
                label: '📊 輪胎遙測數據 [T]',
                options: ['隱藏 (Hidden)', '顯示 (Visible)'],
                getValue: () => {
                    if (window.gameSettings && typeof window.gameSettings.telemetryVisible === 'boolean') {
                        return window.gameSettings.telemetryVisible ? 1 : 0;
                    }
                    try {
                        return localStorage.getItem('telemetryVisible') === 'true' ? 1 : 0;
                    } catch (e) {
                        return 0;
                    }
                },
                setValue: (idx) => {
                    const isVisible = (idx === 1);
                    if (typeof window.setTelemetryVisible === 'function') {
                        window.setTelemetryVisible(isVisible);
                    } else {
                        if (!window.gameSettings) window.gameSettings = {};
                        window.gameSettings.telemetryVisible = isVisible;
                        try { localStorage.setItem('telemetryVisible', isVisible ? 'true' : 'false'); } catch (e) {}
                        const panel = document.getElementById('telemetryPanel');
                        if (panel) {
                            panel.classList.toggle('active', isVisible);
                            panel.style.display = isVisible ? 'block' : 'none';
                        }
                    }
                    if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.showShiftToast) {
                        window.CyberRaceInputHaptics.showShiftToast(isVisible ? '📊 輪胎遙測: 開啟' : '📊 輪胎遙測: 關閉');
                    }
                },
                descTitle: '四輪胎溫與 G 值遙測',
                descText: '在比賽畫面左側即時顯示四輪胎溫、胎壓、磨損%與車輛加速度 G 值動態資訊。可按 [T] 快速切換。',
                lockedInRace: false
            },
            {
                id: 'fpsOSD',
                category: 'display',
                label: '🖥️ FPS 效能 OSD [F]',
                options: ['隱藏 (Hidden)', '顯示 (Visible)'],
                getValue: () => {
                    const osd = document.getElementById('fpsOSD');
                    if (osd && osd.classList.contains('active')) return 1;
                    try {
                        return (localStorage.getItem('fpsOSDActive') === 'true' || localStorage.getItem('fpsOSDVisible') === 'true') ? 1 : 0;
                    } catch (e) {
                        return 0;
                    }
                },
                setValue: (idx) => {
                    const isVisible = (idx === 1);
                    try {
                        localStorage.setItem('fpsOSDActive', isVisible ? 'true' : 'false');
                        localStorage.setItem('fpsOSDVisible', isVisible ? 'true' : 'false');
                    } catch (e) {}
                    if (typeof window.toggleFPSMonitor === 'function') {
                        window.toggleFPSMonitor(isVisible);
                    } else {
                        const osd = document.getElementById('fpsOSD');
                        if (osd) osd.classList.toggle('active', isVisible);
                    }
                    if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.showShiftToast) {
                        window.CyberRaceInputHaptics.showShiftToast(isVisible ? '🖥️ FPS 監控: 開啟' : '🖥️ FPS 監控: 關閉');
                    }
                },
                descTitle: '即時 FPS 與效能監控',
                descText: '在螢幕右上角浮報當前畫面更新率 (FPS)、畫格時間 (ms) 與硬體負載資訊。可按 [F] 鍵快速開關。',
                lockedInRace: false
            }
        ];

        function updatePauseGamepadHints() {
            const hintsEl = document.getElementById('pauseGamepadHints');
            if (!hintsEl) return;

            if (currentPauseSubPage === 'main') {
                hintsEl.innerHTML = `
                    <span><span class="key-badge">↑↓ / WS</span> 選擇</span>
                    <span><span class="key-badge">A / ENTER</span> 確認</span>
                    <span><span class="key-badge">B / ESC</span> 繼續比賽</span>
                `;
            } else if (currentPauseSubPage === 'settings') {
                if (horizonSettingsZone === 'category') {
                    hintsEl.innerHTML = `
                        <span><span class="key-badge">↑↓ / WS</span> 選擇分類</span>
                        <span><span class="key-badge">A / ENTER / →</span> 進入子選單</span>
                        <span><span class="key-badge">LB / RB</span> 切換分頁</span>
                        <span><span class="key-badge">B / ESC</span> 返回</span>
                    `;
                } else {
                    hintsEl.innerHTML = `
                        <span><span class="key-badge">↑↓ / WS</span> 選擇項目</span>
                        <span><span class="key-badge">←→ / AD</span> 調整選項/數值</span>
                        <span><span class="key-badge">A / ENTER</span> 變更/測試</span>
                        <span><span class="key-badge">LB / RB</span> 切換分頁</span>
                        <span><span class="key-badge">B / ESC</span> 返回分類</span>
                    `;
                }
            }
        }

        function navigateToPausePage(page) {
            currentPauseSubPage = page;
            const mainPage = document.getElementById('pausePageMain');
            const settingsPage = document.getElementById('pausePageSettings');
            const titleEl = document.getElementById('pauseHeaderTitle');
            const badgeEl = document.getElementById('pauseHeaderBadge');

            if (page === 'main') {
                if (mainPage) mainPage.classList.add('active');
                if (settingsPage) settingsPage.classList.remove('active');
                if (titleEl) titleEl.innerHTML = '⏸ PAUSED';
                if (badgeEl) badgeEl.textContent = 'CYBER RACER';
                pauseFocusIndex = 0;
                updatePauseMainFocus();
                updatePauseGamepadHints();
            } else if (page === 'settings') {
                if (mainPage) mainPage.classList.remove('active');
                if (settingsPage) settingsPage.classList.add('active');
                if (titleEl) titleEl.innerHTML = '⚙️ 遊戲設定 (SETTINGS)';
                if (badgeEl) badgeEl.textContent = 'GAME OPTIONS';
                horizonSettingsZone = 'category';
                horizonCatIndex = HORIZON_CATEGORIES.findIndex(c => c.id === horizonActiveCat);
                if (horizonCatIndex < 0) horizonCatIndex = 0;
                horizonActiveCat = HORIZON_CATEGORIES[horizonCatIndex].id;
                horizonFocusIndex = 0;
                renderHorizonSettingsList();
            }
        }

        function openGameSettingsPage() {
            if (typeof lastPauseToggleTime !== 'undefined') {
                lastPauseToggleTime = performance.now();
            }
            const isRacing = typeof Game !== 'undefined' && Game.getState && (Game.getState() === 'playing' || Game.getState() === 'paused' || Game.getState() === 'countdown');
            isOpenedFromOutsideRace = !isRacing;
            const pauseMenu = document.getElementById('pauseHint');
            if (pauseMenu) pauseMenu.classList.add('active');
            navigateToPausePage('settings');
        }

        function renderHorizonSettingsList() {
            const listEl = document.getElementById('horizonSettingsList');
            if (!listEl) return;

            const isRacing = (typeof Game !== 'undefined' && Game.getState) ? (Game.getState() !== 'menu') : false;
            const items = HORIZON_SETTINGS_CONFIG.filter(cfg => cfg.category === horizonActiveCat);

            listEl.innerHTML = '';
            items.forEach((cfg, idx) => {
                const isLocked = isRacing && cfg.lockedInRace;
                const row = document.createElement('div');
                const isRowFocused = (horizonSettingsZone === 'items' && idx === horizonFocusIndex);
                row.className = `horizon-setting-row ${isRowFocused ? 'focused' : ''}`;
                row.setAttribute('data-id', cfg.id);

                if (cfg.type === 'slider') {
                    const curVal = cfg.getValue();
                    row.innerHTML = `
                        <span class="horizon-setting-label">${cfg.label}</span>
                        <div class="horizon-setting-control horizon-slider-control">
                            <span class="horizon-arrow horizon-slider-dec" title="減少">◄</span>
                            <div class="horizon-slider-wrap">
                                <input type="range" class="horizon-range-slider" 
                                    min="${cfg.min || 0}" max="${cfg.max || 100}" step="${cfg.step || 1}" 
                                    value="${curVal}" ${isLocked ? 'disabled' : ''}>
                                <div class="horizon-slider-fill" style="width: ${curVal}%;"></div>
                            </div>
                            <span class="horizon-arrow horizon-slider-inc" title="增加">►</span>
                            <span class="horizon-value horizon-slider-value">${curVal}%</span>
                        </div>
                    `;

                    const sliderInput = row.querySelector('.horizon-range-slider');
                    const fillEl = row.querySelector('.horizon-slider-fill');
                    const valEl = row.querySelector('.horizon-slider-value');
                    const decBtn = row.querySelector('.horizon-slider-dec');
                    const incBtn = row.querySelector('.horizon-slider-inc');

                    const updateSliderUI = (v) => {
                        if (fillEl) fillEl.style.width = v + '%';
                        if (valEl) valEl.textContent = v + '%';
                    };

                    if (sliderInput) {
                        sliderInput.addEventListener('input', (e) => {
                            e.stopPropagation();
                            horizonSettingsZone = 'items';
                            horizonFocusIndex = idx;
                            updateHorizonFocusUI();
                            const v = parseFloat(e.target.value);
                            updateSliderUI(v);
                            cfg.setValue(v);
                        });
                        sliderInput.addEventListener('click', (e) => {
                            e.stopPropagation();
                            horizonSettingsZone = 'items';
                            horizonFocusIndex = idx;
                            updateHorizonFocusUI();
                        });
                        sliderInput.addEventListener('change', (e) => {
                            e.stopPropagation();
                            if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.triggerTestVibration) {
                                window.CyberRaceInputHaptics.triggerTestVibration();
                            }
                        });
                    }

                    if (decBtn) {
                        decBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            horizonSettingsZone = 'items';
                            horizonFocusIndex = idx;
                            updateHorizonFocusUI();
                            if (!isLocked) {
                                const step = cfg.step || 5;
                                const newVal = Math.max(cfg.min || 0, cfg.getValue() - step);
                                cfg.setValue(newVal);
                                if (sliderInput) sliderInput.value = newVal;
                                updateSliderUI(newVal);
                                sfxMove();
                            }
                        });
                    }

                    if (incBtn) {
                        incBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            horizonSettingsZone = 'items';
                            horizonFocusIndex = idx;
                            updateHorizonFocusUI();
                            if (!isLocked) {
                                const step = cfg.step || 5;
                                const newVal = Math.min(cfg.max || 100, cfg.getValue() + step);
                                cfg.setValue(newVal);
                                if (sliderInput) sliderInput.value = newVal;
                                updateSliderUI(newVal);
                                sfxMove();
                            }
                        });
                    }
                } else {
                    const curOptIdx = cfg.getValue();
                    const optText = isLocked ? `${cfg.options[curOptIdx]} 🔒` : cfg.options[curOptIdx];

                    row.innerHTML = `
                        <span class="horizon-setting-label">${cfg.label}</span>
                        <div class="horizon-setting-control">
                            <span class="horizon-arrow">◄</span>
                            <span class="horizon-value ${isLocked ? 'locked' : ''}">${optText}</span>
                            <span class="horizon-arrow">►</span>
                        </div>
                    `;

                    row.addEventListener('click', () => {
                        horizonSettingsZone = 'items';
                        horizonFocusIndex = idx;
                        updateHorizonFocusUI();
                        if (!isLocked) {
                            const nextIdx = (cfg.getValue() + 1) % cfg.options.length;
                            cfg.setValue(nextIdx);
                            sfxConfirm();
                            renderHorizonSettingsList();
                        } else {
                            sfxBack();
                        }
                    });
                }

                row.addEventListener('mouseenter', () => {
                    horizonSettingsZone = 'items';
                    horizonFocusIndex = idx;
                    updateHorizonFocusUI();
                });

                listEl.appendChild(row);
            });

            updateHorizonFocusUI();
        }

        function updateHorizonFocusUI() {
            const catCol = document.getElementById('horizonCatList');
            if (catCol) {
                catCol.classList.toggle('focused-zone', horizonSettingsZone === 'category');
            }

            const catBtns = document.querySelectorAll('#horizonCatList .horizon-cat-item');
            catBtns.forEach(btn => {
                const cat = btn.getAttribute('data-cat');
                const isSelected = (cat === horizonActiveCat);
                btn.classList.toggle('active', isSelected);
                btn.classList.toggle('focused', horizonSettingsZone === 'category' && isSelected);
            });

            const rows = document.querySelectorAll('#horizonSettingsList .horizon-setting-row');
            rows.forEach((row, idx) => {
                row.classList.toggle('focused', horizonSettingsZone === 'items' && idx === horizonFocusIndex);
            });

            updateHorizonDescription();
            updatePauseGamepadHints();
        }

        function updateHorizonDescription() {
            const titleEl = document.getElementById('horizonDescTitle');
            const textEl = document.getElementById('horizonDescText');
            if (!titleEl || !textEl) return;

            if (horizonSettingsZone === 'category') {
                const catMeta = HORIZON_CATEGORIES.find(c => c.id === horizonActiveCat) || HORIZON_CATEGORIES[0];
                titleEl.textContent = catMeta.descTitle;
                textEl.textContent = catMeta.descText;
            } else {
                const items = HORIZON_SETTINGS_CONFIG.filter(cfg => cfg.category === horizonActiveCat);
                const curCfg = items[horizonFocusIndex];
                if (curCfg) {
                    titleEl.textContent = curCfg.descTitle || curCfg.label;
                    textEl.textContent = curCfg.descText || '';
                }
            }
        }

        function updatePauseMainFocus() {
            const buttons = document.querySelectorAll('#pausePageMain .pause-main-item');
            if (buttons.length === 0) return;

            if (pauseFocusIndex < 0) pauseFocusIndex = buttons.length - 1;
            if (pauseFocusIndex >= buttons.length) pauseFocusIndex = 0;

            buttons.forEach((btn, idx) => {
                btn.classList.toggle('focused', idx === pauseFocusIndex);
            });
        }

        function handlePauseMenuAction(action) {
            const pauseMenu = document.getElementById('pauseHint');
            if (!pauseMenu || !pauseMenu.classList.contains('active')) return;

            if (currentPauseSubPage === 'main') {
                const buttons = Array.from(document.querySelectorAll('#pausePageMain .pause-main-item'));
                if (buttons.length === 0) return;

                if (action === 'up') {
                    sfxMove();
                    pauseFocusIndex--;
                    updatePauseMainFocus();
                } else if (action === 'down') {
                    sfxMove();
                    pauseFocusIndex++;
                    updatePauseMainFocus();
                } else if (action === 'confirm') {
                    sfxConfirm();
                    buttons[pauseFocusIndex]?.click();
                } else if (action === 'back' || action === 'resume') {
                    sfxBack();
                    Game.togglePause();
                }
            } else if (currentPauseSubPage === 'settings') {
                if (horizonSettingsZone === 'category') {
                    // ===== 區域 1: 左側分類選單 =====
                    if (action === 'up') {
                        sfxMove();
                        horizonCatIndex = (horizonCatIndex - 1 + HORIZON_CATEGORIES.length) % HORIZON_CATEGORIES.length;
                        horizonActiveCat = HORIZON_CATEGORIES[horizonCatIndex].id;
                        horizonFocusIndex = 0;
                        renderHorizonSettingsList();
                    } else if (action === 'down') {
                        sfxMove();
                        horizonCatIndex = (horizonCatIndex + 1) % HORIZON_CATEGORIES.length;
                        horizonActiveCat = HORIZON_CATEGORIES[horizonCatIndex].id;
                        horizonFocusIndex = 0;
                        renderHorizonSettingsList();
                    } else if (action === 'confirm' || action === 'right') {
                        // 進入右側子選單
                        const items = HORIZON_SETTINGS_CONFIG.filter(cfg => cfg.category === horizonActiveCat);
                        if (items.length > 0) {
                            sfxConfirm();
                            horizonSettingsZone = 'items';
                            horizonFocusIndex = 0;
                            updateHorizonFocusUI();
                        }
                    } else if (action === 'back') {
                        sfxBack();
                        if (isOpenedFromOutsideRace) {
                            pauseMenu.classList.remove('active');
                            isOpenedFromOutsideRace = false;
                        } else {
                            navigateToPausePage('main');
                        }
                    }
                } else {
                    // ===== 區域 2: 右側子選單 (項目設定) =====
                    const items = HORIZON_SETTINGS_CONFIG.filter(cfg => cfg.category === horizonActiveCat);
                    if (items.length === 0) return;

                    if (action === 'up') {
                        sfxMove();
                        horizonFocusIndex = (horizonFocusIndex - 1 + items.length) % items.length;
                        updateHorizonFocusUI();
                    } else if (action === 'down') {
                        sfxMove();
                        horizonFocusIndex = (horizonFocusIndex + 1) % items.length;
                        updateHorizonFocusUI();
                    } else if (action === 'left' || action === 'right') {
                        const dir = action === 'left' ? -1 : 1;
                        const cfg = items[horizonFocusIndex];
                        const isRacing = (typeof Game !== 'undefined' && Game.getState) ? (Game.getState() !== 'menu') : false;

                        if (cfg && (!isRacing || !cfg.lockedInRace)) {
                            sfxMove();
                            if (cfg.type === 'slider') {
                                const step = cfg.step || 5;
                                const curVal = cfg.getValue();
                                const nextVal = Math.max(cfg.min || 0, Math.min(cfg.max || 100, curVal + dir * step));
                                cfg.setValue(nextVal);
                                renderHorizonSettingsList();
                            } else {
                                const curIdx = cfg.getValue();
                                const nextIdx = (curIdx + dir + cfg.options.length) % cfg.options.length;
                                cfg.setValue(nextIdx);
                                renderHorizonSettingsList();
                            }
                        } else {
                            sfxBack();
                        }
                    } else if (action === 'confirm') {
                        const cfg = items[horizonFocusIndex];
                        const isRacing = (typeof Game !== 'undefined' && Game.getState) ? (Game.getState() !== 'menu') : false;

                        if (cfg && (!isRacing || !cfg.lockedInRace)) {
                            sfxConfirm();
                            if (cfg.type === 'slider') {
                                if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.triggerTestVibration) {
                                    window.CyberRaceInputHaptics.triggerTestVibration();
                                }
                            } else {
                                const curIdx = cfg.getValue();
                                const nextIdx = (curIdx + 1) % cfg.options.length;
                                cfg.setValue(nextIdx);
                                renderHorizonSettingsList();
                            }
                        } else {
                            sfxBack();
                        }
                    } else if (action === 'back') {
                        // 按 B 或 ESC 返回左側選單
                        sfxBack();
                        horizonSettingsZone = 'category';
                        updateHorizonFocusUI();
                    }
                }
            }
        }

        window.addEventListener('keydown', (e) => {
            setInputDevice('keyboard');
            if (e.repeat) return;
            const modal = document.getElementById('modal-controls');
            if (modal && modal.style.display === 'flex') {
                if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
                    toggleModal(false);
                } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                    switchModalTab(modalActiveTabIndex - 1);
                } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                    switchModalTab(modalActiveTabIndex + 1);
                } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'h' || e.key === 'H') {
                    toggleModal(false);
                }
                return;
            }

            const pauseMenu = document.getElementById('pauseHint');
            const isPauseActive = pauseMenu && pauseMenu.classList.contains('active');

            if (isPauseActive) {
                if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') {
                    const now = performance.now();
                    if (now - lastPauseToggleTime > 300) {
                        lastPauseToggleTime = now;
                        handlePauseMenuAction('back');
                    }
                } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                    handlePauseMenuAction('up');
                } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                    handlePauseMenuAction('down');
                } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    handlePauseMenuAction('left');
                } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    handlePauseMenuAction('right');
                } else if (e.key === 'Enter' || e.key === ' ') {
                    handlePauseMenuAction('confirm');
                } else if (e.key === 'q' || e.key === 'Q') {
                    horizonCatIndex = (horizonCatIndex - 1 + HORIZON_CATEGORIES.length) % HORIZON_CATEGORIES.length;
                    horizonActiveCat = HORIZON_CATEGORIES[horizonCatIndex].id;
                    horizonFocusIndex = 0;
                    sfxMove();
                    renderHorizonSettingsList();
                } else if (e.key === 'e' || e.key === 'E') {
                    horizonCatIndex = (horizonCatIndex + 1) % HORIZON_CATEGORIES.length;
                    horizonActiveCat = HORIZON_CATEGORIES[horizonCatIndex].id;
                    horizonFocusIndex = 0;
                    sfxMove();
                    renderHorizonSettingsList();
                }
                return;
            }

            if (e.key === 'f' || e.key === 'F') {
                if (typeof window.toggleFPSMonitor === 'function') {
                    window.toggleFPSMonitor();
                    const osd = document.getElementById('fpsOSD');
                    const isActive = osd && osd.classList.contains('active');
                    if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.showShiftToast) {
                        window.CyberRaceInputHaptics.showShiftToast(isActive ? '🖥️ FPS 監控: 開啟' : '🖥️ FPS 監控: 關閉');
                    }
                }
                return;
            }

            const isRacing = typeof Game !== 'undefined' && Game.getState && (Game.getState() === 'playing' || Game.getState() === 'paused' || Game.getState() === 'countdown');

            if (!isRacing && (e.key === 't' || e.key === 'T')) {
                const nextVis = !(window.gameSettings && window.gameSettings.telemetryVisible);
                if (typeof window.setTelemetryVisible === 'function') {
                    window.setTelemetryVisible(nextVis);
                } else {
                    if (window.gameSettings) window.gameSettings.telemetryVisible = nextVis;
                    try { localStorage.setItem('telemetryVisible', nextVis ? 'true' : 'false'); } catch (err) {}
                    const panel = document.getElementById('telemetryPanel');
                    if (panel) {
                        panel.classList.toggle('active', nextVis);
                        panel.style.display = nextVis ? 'block' : 'none';
                    }
                }
                if (window.CyberRaceInputHaptics && window.CyberRaceInputHaptics.showShiftToast) {
                    window.CyberRaceInputHaptics.showShiftToast(nextVis ? '📊 輪胎遙測: 開啟' : '📊 輪胎遙測: 關閉');
                }
                return;
            }
            if (e.key === 'p' || e.key === 'P') {
                const now = performance.now();
                if (now - lastPauseToggleTime > 300) {
                    lastPauseToggleTime = now;
                    if (isRacing) {
                        isOpenedFromOutsideRace = false;
                        Game.togglePause();
                    } else {
                        if (isPauseActive) {
                            handlePauseMenuAction('back');
                        } else {
                            openGameSettingsPage();
                        }
                    }
                }
                return;
            }
            if (isRacing && e.key === 'Escape') {
                const now = performance.now();
                if (now - lastPauseToggleTime > 300) {
                    lastPauseToggleTime = now;
                    isOpenedFromOutsideRace = false;
                    Game.togglePause();
                }
                return;
            }

            if (currentScreen === 'screen-track') {
                if (e.key === 'q' || e.key === 'Q') {
                    switchTrackFilter(-1);
                    return;
                } else if (e.key === 'e' || e.key === 'E') {
                    switchTrackFilter(1);
                    return;
                } else if (e.key === 'y' || e.key === 'Y') {
                    cycleFilterMode();
                    return;
                } else if (e.key === 'x' || e.key === 'X') {
                    cycleSortMode();
                    return;
                } else if (e.key === 'Enter' || e.key === ' ') {
                    if (trackScreenZone === 'list') {
                        confirmCourse();
                    } else if (trackScreenZone === 'settings_nav') {
                        trackScreenZone = 'settings_edit';
                        sfxConfirm();
                        updateTrackScreenFocus();
                    } else if (trackScreenZone === 'settings_edit') {
                        toggleSettingInRow(settingsFocusRow);
                    }
                    return;
                } else if (e.key === 'Escape') {
                    if (trackScreenZone === 'settings_edit') {
                        trackScreenZone = 'settings_nav';
                        sfxBack();
                        updateTrackScreenFocus();
                        return;
                    } else if (trackScreenZone === 'settings_nav') {
                        trackScreenZone = 'list';
                        sfxBack();
                        updateTrackScreenFocus();
                        return;
                    }
                }
            } else if (currentScreen === 'screen-car') {
                if (e.key === 'q' || e.key === 'Q') {
                    switchCarFilter(-1);
                    return;
                } else if (e.key === 'e' || e.key === 'E') {
                    switchCarFilter(1);
                    return;
                } else if (e.key === 'y' || e.key === 'Y') {
                    cycleCarFilterMode();
                    return;
                } else if (e.key === 'x' || e.key === 'X') {
                    cycleCarSortMode();
                    return;
                } else if (e.key === 'Enter' || e.key === ' ') {
                    confirmCar();
                    return;
                }
            }

            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                navigateDirection('right');
            } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                navigateDirection('left');
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                navigateDirection('down');
            } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                navigateDirection('up');
            } else if (e.key === 'Enter' || e.key === ' ') {
                if (currentFocusables[focusIndex]) currentFocusables[focusIndex].click();
            } else if (e.key === 'Escape') {
                goBack();
            } else if (e.key === 'h' || e.key === 'H') {
                toggleModal(true);
            }
        });

        function getActiveGamepad() {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) return gamepads[i];
            }
            return null;
        }

        function isPressed(btn) {
            if (!btn) return false;
            return typeof btn === 'object' ? (btn.pressed || btn.value > 0.5) : btn > 0.5;
        }

        let prevPadButtons = {};

        function pollGamepad() {
            const gp = getActiveGamepad();
            if (gp) {
                const now = performance.now();
                const modal = document.getElementById('modal-controls');
                const isModalOpen = modal && modal.style.display === 'flex';

                const dpadUp = isPressed(gp.buttons[12]) || gp.axes[1] < -0.5;
                const dpadDown = isPressed(gp.buttons[13]) || gp.axes[1] > 0.5;
                const dpadLeft = isPressed(gp.buttons[14]) || gp.axes[0] < -0.5;
                const dpadRight = isPressed(gp.buttons[15]) || gp.axes[0] > 0.5;

                const btnA = isPressed(gp.buttons[0]);
                const btnB = isPressed(gp.buttons[1]);
                const btnX = isPressed(gp.buttons[2]);
                const btnY = isPressed(gp.buttons[3]);
                const btnLB = isPressed(gp.buttons[4]);
                const btnRB = isPressed(gp.buttons[5]);
                const btnSelect = isPressed(gp.buttons[8]);
                const btnStart = isPressed(gp.buttons[9]);

                const justA = btnA && !prevPadButtons.btnA;
                const justB = btnB && !prevPadButtons.btnB;
                const justX = btnX && !prevPadButtons.btnX;
                const justY = btnY && !prevPadButtons.btnY;
                const justLB = btnLB && !prevPadButtons.btnLB;
                const justRB = btnRB && !prevPadButtons.btnRB;
                const justSelect = btnSelect && !prevPadButtons.btnSelect;
                const justStart = btnStart && !prevPadButtons.btnStart;

                const dirPressed = dpadUp || dpadDown || dpadLeft || dpadRight;
                const justDir = dirPressed && (now - lastPadTimestamp > 200);

                if (dirPressed || btnA || btnB || btnX || btnY || btnLB || btnRB || btnSelect || btnStart) {
                    setInputDevice('gamepad');
                }

                prevPadButtons = { btnA, btnB, btnX, btnY, btnLB, btnRB, btnSelect, btnStart };

                // 檢查是否正在進行比賽
                const isRacing = (typeof Game !== 'undefined' && Game.getState && (Game.getState() === 'playing' || Game.getState() === 'countdown')) || (currentScreen === 'screen-game');

                if (isModalOpen) {
                    if (justB || justSelect) {
                        toggleModal(false);
                    } else if (dpadUp && justDir) {
                        switchModalTab(modalActiveTabIndex - 1);
                        lastPadTimestamp = now;
                    } else if (dpadDown && justDir) {
                        switchModalTab(modalActiveTabIndex + 1);
                        lastPadTimestamp = now;
                    }
                    requestAnimationFrame(pollGamepad);
                    return;
                }

                const pauseMenu = document.getElementById('pauseHint');
                const isPauseActive = pauseMenu && pauseMenu.classList.contains('active');

                if (isPauseActive) {
                    if (justB || (justStart && now - lastPauseToggleTime > 350)) {
                        lastPauseToggleTime = now;
                        handlePauseMenuAction('back');
                    } else if (justA) {
                        handlePauseMenuAction('confirm');
                    } else if (justLB || justRB) {
                        const dir = justLB ? -1 : 1;
                        horizonCatIndex = (horizonCatIndex + dir + HORIZON_CATEGORIES.length) % HORIZON_CATEGORIES.length;
                        horizonActiveCat = HORIZON_CATEGORIES[horizonCatIndex].id;
                        horizonFocusIndex = 0;
                        sfxMove();
                        renderHorizonSettingsList();
                    } else if (justDir) {
                        if (dpadUp) handlePauseMenuAction('up');
                        else if (dpadDown) handlePauseMenuAction('down');
                        else if (dpadLeft) handlePauseMenuAction('left');
                        else if (dpadRight) handlePauseMenuAction('right');
                        lastPadTimestamp = now;
                    }
                    requestAnimationFrame(pollGamepad);
                    return;
                }

                if (justStart) {
                    if (now - lastPauseToggleTime > 350) {
                        lastPauseToggleTime = now;
                        if (isRacing) {
                            isOpenedFromOutsideRace = false;
                            Game.togglePause();
                        } else {
                            isOpenedFromOutsideRace = true;
                            openGameSettingsPage();
                        }
                    }
                    requestAnimationFrame(pollGamepad);
                    return;
                }

                // 比賽中：UI 控制器完全不攔截方向鍵與按鍵，全部交由車輛物理引擎處理
                if (isRacing) {
                    requestAnimationFrame(pollGamepad);
                    return;
                }

                if (justSelect) {
                    toggleModal(true);
                    requestAnimationFrame(pollGamepad);
                    return;
                }

                // 選單狀態下的導航處理
                if (justLB || justRB) {
                    const dir = justLB ? -1 : 1;
                    if (currentScreen === 'screen-track') {
                        switchTrackFilter(dir);
                    } else if (currentScreen === 'screen-car') {
                        switchCarFilter(dir);
                    }
                }

                if (currentScreen === 'screen-track') {
                    if (justY) {
                        cycleFilterMode();
                    } else if (justX) {
                        cycleSortMode();
                    } else if (justA) {
                        if (trackScreenZone === 'list') {
                            confirmCourse();
                        } else if (trackScreenZone === 'settings_nav') {
                            trackScreenZone = 'settings_edit';
                            sfxConfirm();
                            updateTrackScreenFocus();
                        } else if (trackScreenZone === 'settings_edit') {
                            toggleSettingInRow(settingsFocusRow);
                        }
                    } else if (justB) {
                        if (trackScreenZone === 'settings_edit') {
                            trackScreenZone = 'settings_nav';
                            sfxBack();
                            updateTrackScreenFocus();
                        } else if (trackScreenZone === 'settings_nav') {
                            trackScreenZone = 'list';
                            sfxBack();
                            updateTrackScreenFocus();
                        } else {
                            goBack();
                        }
                    }
                } else if (currentScreen === 'screen-car') {
                    if (justY) {
                        cycleCarFilterMode();
                    } else if (justX) {
                        cycleCarSortMode();
                    } else if (justA) {
                        confirmCar();
                    } else if (justB) {
                        goBack();
                    }
                } else {
                    if (justA) {
                        if (currentFocusables[focusIndex]) currentFocusables[focusIndex].click();
                    } else if (justB) {
                        goBack();
                    }
                }

                if (justDir) {
                    if (dpadRight) navigateDirection('right');
                    else if (dpadLeft) navigateDirection('left');
                    else if (dpadDown) navigateDirection('down');
                    else if (dpadUp) navigateDirection('up');
                    lastPadTimestamp = now;
                }
            }
            requestAnimationFrame(pollGamepad);
        }

        // Expose UI_V3 actions globally for inline onclick handlers & external calls
        window.selectMode = selectMode;
        window.getSelectedGameMode = () => selectedGameMode;
        window.navigateTo = navigateTo;
        window.goBack = goBack;
        window.goBackHome = goBackHome;
        window.confirmCourse = confirmCourse;
        window.confirmCar = confirmCar;
        window.startGame = startGame;
        window.setOpt = setOpt;
        window.switchTrackFilter = switchTrackFilter;
        window.switchCarFilter = switchCarFilter;
        window.selectTrackFilterVal = selectTrackFilterVal;
        window.selectCarFilterVal = selectCarFilterVal;
        window.onTrackCardClick = onTrackCardClick;
        window.onCarCardClick = onCarCardClick;
        window.handleFooterAction = handleFooterAction;
        window.toggleModal = toggleModal;
        window.switchModalTab = switchModalTab;
        window.restartCurrentRace = restartCurrentRace;
        window.hideExitConfirm = hideExitConfirm;
        window.exitToMenu = exitToMenu;
        window.openGameSettingsPage = openGameSettingsPage;
        window.navigateToPausePage = navigateToPausePage;

        Promise.all([loadTracksIndex(), loadCarsIndex()]).then(() => {
            renderTrackFilterBar();
            renderTrackList();
            renderCarFilterBar();
            renderCarList();
            updateControlHints();
            updateFocusableElements();
        });

        updateControlHints();
        updateFocusableElements();
        requestAnimationFrame(pollGamepad);

        // ===== 綁定 Horizon 類別按鈕點擊事件 =====
        document.querySelectorAll('#horizonCatList .horizon-cat-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-cat');
                if (cat) {
                    horizonActiveCat = cat;
                    horizonCatIndex = HORIZON_CATEGORIES.findIndex(c => c.id === cat);
                    if (horizonCatIndex < 0) horizonCatIndex = 0;
                    horizonFocusIndex = 0;
                    horizonSettingsZone = 'items';
                    sfxConfirm();
                    renderHorizonSettingsList();
                }
            });
        });

        const InputHaptics = window.CyberRaceInputHaptics || {};
        const updateTransModeButtonsUI = () => InputHaptics.updateTransModeButtonsUI ? InputHaptics.updateTransModeButtonsUI() : (window.Game && window.Game.updateTransModeButtonsUI && window.Game.updateTransModeButtonsUI());
        const showShiftToast = (msg, isWarn) => InputHaptics.showShiftToast ? InputHaptics.showShiftToast(msg, isWarn) : (window.Game && window.Game.showShiftToast && window.Game.showShiftToast(msg, isWarn));
        const updateGamepadStatusUI = (c, id) => InputHaptics.updateGamepadStatusUI ? InputHaptics.updateGamepadStatusUI(c, id) : (window.Game && window.Game.updateGamepadStatusUI && window.Game.updateGamepadStatusUI(c, id));
        const cleanGamepadName = (id) => InputHaptics.cleanGamepadName ? InputHaptics.cleanGamepadName(id) : (id || '手把');

        // 變速箱模式切換
        document.querySelectorAll('.trans-mode-btn[data-trans]').forEach(btn => {
            btn.addEventListener('click', () => {
                setTransmissionMode(btn.dataset.trans);
            });
        });
        updateTransModeButtonsUI();

        // 輪胎損耗切換
        const tireWearOffBtn = document.getElementById('tireWearOffBtn');
        const tireWearOnBtn = document.getElementById('tireWearOnBtn');
        const activeSettings = window.gameSettings || { tireWearEnabled: false, telemetryVisible: false };

        if (tireWearOffBtn && tireWearOnBtn) {
            tireWearOffBtn.classList.toggle('active', !activeSettings.tireWearEnabled);
            tireWearOnBtn.classList.toggle('active', activeSettings.tireWearEnabled);

            tireWearOffBtn.addEventListener('click', () => {
                activeSettings.tireWearEnabled = false;
                localStorage.setItem('tireWearEnabled', 'false');
                tireWearOffBtn.classList.add('active');
                tireWearOnBtn.classList.remove('active');
                showShiftToast('🛞 輪胎損耗已關閉');
            });

            tireWearOnBtn.addEventListener('click', () => {
                activeSettings.tireWearEnabled = true;
                localStorage.setItem('tireWearEnabled', 'true');
                tireWearOnBtn.classList.add('active');
                tireWearOffBtn.classList.remove('active');
                showShiftToast('🛞 輪胎損耗已開啟！');
            });
        }

        // 輪胎遙測開關
        const telemetryToggleBtn = document.getElementById('telemetryToggleBtn');
        if (telemetryToggleBtn) {
            telemetryToggleBtn.addEventListener('click', () => {
                const nextVis = !activeSettings.telemetryVisible;
                if (typeof window.setTelemetryVisible === 'function') {
                    window.setTelemetryVisible(nextVis);
                } else {
                    activeSettings.telemetryVisible = nextVis;
                    localStorage.setItem('telemetryVisible', nextVis ? 'true' : 'false');
                    const telPanel = document.getElementById('telemetryPanel');
                    if (telPanel) {
                        telPanel.style.display = nextVis ? 'block' : 'none';
                        telPanel.classList.toggle('active', nextVis);
                    }
                }
                showShiftToast(activeSettings.telemetryVisible ? '📊 輪胎遙測 HUD 已開啟' : '📊 輪胎遙測 HUD 已隱藏');
            });
        }
        if (typeof window.setTelemetryVisible === 'function') {
            window.setTelemetryVisible(activeSettings.telemetryVisible);
        }

        // 手把震動開關與強度調節
        const vibOffBtn = document.getElementById('vibOffBtn');
        const vibOnBtn = document.getElementById('vibOnBtn');
        if (vibOffBtn && vibOnBtn) {
            vibOffBtn.classList.toggle('active', !activeSettings.vibrationEnabled);
            vibOnBtn.classList.toggle('active', activeSettings.vibrationEnabled);

            vibOffBtn.addEventListener('click', () => {
                activeSettings.vibrationEnabled = false;
                localStorage.setItem('vibrationEnabled', 'false');
                vibOffBtn.classList.add('active');
                vibOnBtn.classList.remove('active');
                showShiftToast('🎮 手把震動已關閉');
            });

            vibOnBtn.addEventListener('click', () => {
                activeSettings.vibrationEnabled = true;
                localStorage.setItem('vibrationEnabled', 'true');
                vibOnBtn.classList.add('active');
                vibOffBtn.classList.remove('active');
                showShiftToast('🎮 手把震動已開啟！');
                triggerTestVibration();
            });
        }

        const vibIntensityGroup = document.getElementById('vibIntensityGroup');
        const vibIntensitySlider = document.getElementById('vibIntensitySlider');
        const vibValLabel = document.getElementById('vibValLabel');

        const syncVibUI = (intensityVal) => {
            const pct = Math.round(intensityVal * 100);
            if (vibValLabel) vibValLabel.textContent = pct + '%';
            if (vibIntensitySlider) vibIntensitySlider.value = pct;

            if (vibIntensityGroup) {
                const btns = vibIntensityGroup.querySelectorAll('button[data-vib]');
                btns.forEach(b => {
                    const val = parseFloat(b.dataset.vib);
                    b.classList.toggle('active', Math.abs(val - intensityVal) < 0.025);
                });
            }
        };

        syncVibUI(activeSettings.vibrationIntensity || 0.10);

        if (vibIntensitySlider) {
            vibIntensitySlider.addEventListener('input', (e) => {
                const pct = parseFloat(e.target.value);
                const val = pct / 100.0;
                activeSettings.vibrationIntensity = val;
                localStorage.setItem('vibrationIntensity', val.toString());
                syncVibUI(val);
            });
            vibIntensitySlider.addEventListener('change', () => {
                if (activeSettings.vibrationEnabled && typeof triggerTestVibration === 'function') {
                    triggerTestVibration();
                }
            });
        }

        if (vibIntensityGroup) {
            const btns = vibIntensityGroup.querySelectorAll('button[data-vib]');
            btns.forEach(b => {
                b.addEventListener('click', () => {
                    const val = parseFloat(b.dataset.vib);
                    activeSettings.vibrationIntensity = val;
                    localStorage.setItem('vibrationIntensity', val.toString());
                    syncVibUI(val);
                    showShiftToast(`📳 震動強度設為: ${Math.round(val * 100)}%`);
                    if (activeSettings.vibrationEnabled && typeof triggerTestVibration === 'function') {
                        triggerTestVibration();
                    }
                });
            });
        }

        // 說明面板 Tab 切換
        document.querySelectorAll('.inst-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.inst-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.inst-section').forEach(s => s.style.display = 'none');
                tab.classList.add('active');
                const target = document.getElementById(tab.dataset.target);
                if (target) target.style.display = 'block';
            });
        });

        // Gamepad 連線事件
        window.addEventListener('gamepadconnected', (e) => {
            updateGamepadStatusUI(true, e.gamepad.id);
            showShiftToast(`🎮 已連線: ${cleanGamepadName(e.gamepad.id)}`);
        });
        window.addEventListener('gamepaddisconnected', (e) => {
            updateGamepadStatusUI(false);
            showShiftToast('🎮 手把已中斷連線', true);
        });

        // 儀表樣式切換
        document.querySelectorAll('.gauge-style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.gauge-style-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // gaugeStyle is a Game-module-level variable, update via window bridge
                window._setGaugeStyle && window._setGaugeStyle(btn.dataset.style);
                localStorage.setItem('gaugeStyle', btn.dataset.style);
            });
        });

        // 載入已儲存的儀表樣式偏好
        const savedGaugeStyle = localStorage.getItem('gaugeStyle') || 'analog';
        document.querySelectorAll('.gauge-style-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.style === savedGaugeStyle);
        });

        const restartBtnEl = document.getElementById('restartBtn');
        if (restartBtnEl) {
            restartBtnEl.addEventListener('click', () => {
                restartCurrentRace();
            });
        }

        const menuBtnEl = document.getElementById('menuBtn');
        if (menuBtnEl) {
            menuBtnEl.addEventListener('click', () => {
                exitToMenu();
            });
        }

        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    }

    return {
        init
    };
})();
