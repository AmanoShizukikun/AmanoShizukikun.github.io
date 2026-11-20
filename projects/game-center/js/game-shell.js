/* ========== 遊戲中心統一外圍平台組件 (Game Center Unified Shell) ========== */
/**
 * 本腳本由 Game Center 統一維護管理。
 * 任何遊戲子頁面只需引入本腳本，即可自動掛載並驅動：
 * 1. Universal 全站 Header 導航列（支援選單、搜尋、齒輪設定按鈕）
 * 2. 左側賽博導覽欄 (gc-sidebar - 支援展開/摺疊、返回遊戲中心、FPS開關、關閉側欄)
 * 3. 完整系統設定抽屜 (Settings Panel - 包含固定導航、高度、主題、Live2D、12種背景特效、動畫強度、音效等)
 * 4. FPS / 效能即時監控 OSD (FPS OSD - 支援拖曳、模式切換、即時幀率計算)
 */

(function () {
    // 判斷是否為 iframe 內嵌模式（若是被 Game Center 宿主 iframe 內嵌，則滿版自適應）
    const isEmbedded = window.self !== window.top;

    // 計算相對路徑層級 (自適應 games/xxx/ 或 projects/game-center/ 目錄)
    const isSubGame = window.location.pathname.includes('/games/');
    const rootRel = isSubGame ? '../../../../' : '../../';
    const gcRel = isSubGame ? '../../' : './';

    // 安全 LocalStorage 存取
    const SafeStorage = {
        getItem(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        setItem(key, val) {
            try { localStorage.setItem(key, val); } catch (e) {}
        }
    };

    // 1. 動態加載必要依賴 (Lucide Icons)
    function ensureDependencies(callback) {
        if (typeof window.lucide !== 'undefined') {
            callback();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/lucide@latest';
        script.onload = callback;
        document.head.appendChild(script);
    }

    // 2. 注入外圍樣式 (徹底消除白色閃爍與遮擋)
    function injectShellStyles() {
        if (document.getElementById('gc-shell-dynamic-css')) return;
        const style = document.createElement('style');
        style.id = 'gc-shell-dynamic-css';
        style.textContent = `
            :root {
                --header-height: 75px;
            }
            /* 關鍵：html 使用深色底色，徹底避免 .cyber-bg 透明度變化時漏出瀏覽器預設白底 */
            html {
                background: #050507 !important;
                max-width: 100%;
                overflow-x: hidden;
            }
            [data-theme="light"] html {
                background: #ffffff !important;
            }
            /* body 必須為透明，底層負層級的 .cyber-bg、.grid-overlay 與粒子 Canvas 才能完整顯現 */
            body {
                background: transparent !important;
                overflow: hidden !important;
                width: 100%;
                height: 100%;
            }
            /* 頂部 Header 固定定位 */
            header {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                height: var(--header-height, 75px) !important;
                z-index: 950 !important;
            }
            /* 側邊導覽欄 */
            .gc-sidebar {
                top: var(--header-height, 75px) !important;
                height: calc(100vh - var(--header-height, 75px)) !important;
                z-index: 900 !important;
            }
            /* 遊戲主容器自適應避讓 Header 與 Sidebar */
            .game-container {
                position: fixed !important;
                top: var(--header-height, 75px) !important;
                bottom: 0 !important;
                left: 72px !important;
                right: 0 !important;
                width: auto !important;
                height: auto !important;
                z-index: 10 !important;
                margin: 0 !important;
                transition: left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.1s ease !important;
                box-sizing: border-box !important;
            }
            .gc-sidebar:not(.collapsed):not(.hidden-sidebar) ~ .game-container,
            .gc-sidebar:not(.collapsed):not(.hidden-sidebar) ~ #gameContainer {
                left: 220px !important;
            }
            .gc-sidebar.collapsed ~ .game-container,
            .gc-sidebar.collapsed ~ #gameContainer {
                left: 72px !important;
            }
            .gc-sidebar.hidden-sidebar ~ .game-container,
            .gc-sidebar.hidden-sidebar ~ #gameContainer {
                left: 0px !important;
            }
            @media (max-width: 768px) {
                .game-container {
                    left: 65px !important;
                }
            }
            /* 設定面板與選單層級保護 */
            .settings-panel {
                z-index: 9999 !important;
            }
            .nav-overlay {
                z-index: 920 !important;
            }
            .nav-links {
                z-index: 960 !important;
            }
            .settings-toggle.closing::after {
                animation: spinReverse 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            @keyframes spinReverse {
                0% { transform: rotate(180deg); }
                100% { transform: rotate(0deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // 3. 注入 HTML 模板 (Header, 全站標準 Settings Panel, FPS OSD, Sidebar)
    function injectShellHTML() {
        if (document.getElementById('gcSidebar')) return;

        const shellHTML = `
            <!-- Universal 全站 Header 導航列 -->
            <header style="height: var(--header-height, 75px);">
                <a href="${rootRel}index.html">
                    <div style="margin-left: 30px; font-family: 'Orbitron', sans-serif;">『 AMANO SHIZUKI 』</div>
                </a>
                <div class="nav-container">
                    <ul class="nav-links">
                        <div class="nav-header">
                            <h2 class="nav-title">選單導航</h2>
                        </div>
                        
                        <div class="search-box">
                            <input type="text" id="navSearch" class="search-input" placeholder="搜尋頁面...">
                            <button class="search-btn" aria-label="Search">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                            </button>
                        </div>
                        
                        <div class="nav-section">
                            <h3 class="nav-section-title">主要頁面</h3>
                            <li><a href="${rootRel}index.html">&#x25C6; HOME</a></li>
                            <li><a href="${rootRel}pages/about.html">&#x25C6; ABOUT</a></li>
                            <li><a href="${rootRel}pages/experience.html">&#x25C6; EXPERIENCE</a></li>
                            <li><a href="${rootRel}pages/skills.html">&#x25C6; SKILLS</a></li>
                        </div>

                        <div class="nav-section">
                            <h3 class="nav-section-title">特別內容</h3>
                            <li><a href="${gcRel}game-center.html" class="active">&#x25C6; GAME CENTER</a></li>
                            <li><a href="${rootRel}projects/nagato-sakura-webos/nagato-sakura-webos.html">&#x25C6; WEB OS</a></li>
                            <li><a href="${rootRel}projects/music-player/music-player.html">&#x25C6; MUSIC PLAYER</a></li>
                            <li><a href="${rootRel}projects/forza-tuning-calculator/forza-tuning-calculator.html">&#x25C6; FORZA CALC</a></li>
                        </div>

                        <div class="nav-section">
                            <h3 class="nav-section-title">更多連結</h3>
                            <li>
                                <a href="https://www.youtube.com/@Amano_Shizuki_Kun" target="_blank" rel="noopener noreferrer" class="social-link">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px; vertical-align: middle;">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                    </svg>
                                    YouTube
                                </a>
                            </li>
                            <li>
                                <a href="https://github.com/AmanoShizukikun" target="_blank" rel="noopener noreferrer" class="social-link">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px; vertical-align: middle;">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a href="https://discord.gg/jac8eAFzjz" target="_blank" rel="noopener noreferrer" class="social-link">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px; vertical-align: middle;">
                                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                                    </svg>
                                    Discord
                                </a>
                            </li>
                            <li>
                                <a href="mailto:3b017128@gm.student.ncut.edu.tw" class="social-link">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; vertical-align: middle;">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                        <polyline points="22,6 12,13 2,6"></polyline>
                                    </svg>
                                    Email
                                </a>
                            </li>
                        </div>
                    </ul>
                </div>
                <div class="header-actions">
                    <button class="settings-toggle" aria-label="Settings"></button>
                    <button class="menu-toggle" aria-label="Toggle menu">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </header>

            <!-- 完整 Settings Panel Drawer 設定選單面板 -->
            <div class="settings-panel">
                <div class="settings-header">
                    <h2 class="settings-title">系統設定</h2>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">顯示設定</h3>
                    
                    <div class="setting-item">
                        <div class="setting-label">
                            <span>固定導航欄</span>
                            <span class="setting-description">保持導航欄在頂部固定</span>
                        </div>
                        <div class="toggle-switch active" id="headerFixed"></div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label">
                            <span id="headerHeightLabel">導航欄高度</span>
                            <span class="setting-description" id="headerHeightDesc">調整頂部導航欄的高度</span>
                        </div>
                        <div class="slider-control">
                            <div class="slider-value" id="headerHeightValue">75px</div>
                            <input type="range" class="slider-range" id="headerHeight" min="50" max="100" value="75" step="5">
                            <div class="slider-marks">
                                <span data-value="50">小</span>
                                <span data-value="75">中</span>
                                <span data-value="100">大</span>
                            </div>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label">
                            <span>側邊欄文字顯示</span>
                            <span class="setting-description">是否持續顯示側邊欄文字標題</span>
                        </div>
                        <div class="toggle-switch active" id="sideNavTextVisible" role="switch" tabindex="0" aria-label="側邊欄文字顯示"></div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label">
                            <span>顯示左側導覽欄</span>
                            <span class="setting-description">顯示或隱藏遊戲中心左側導覽欄</span>
                        </div>
                        <div class="toggle-switch active" id="showSidebar"></div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label">
                            <span id="themeModeLabel">主題模式</span>
                            <span class="setting-description">切換深色/淺色模式</span>
                        </div>
                        <div class="select-control">
                            <select id="themeMode" aria-labelledby="themeModeLabel" title="主題模式">
                                <option value="dark">深色模式</option>
                                <option value="light">淺色模式</option>
                            </select>
                        </div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label">
                            <span>看板娘 (Live2D)</span>
                            <span class="setting-description">啟用或停用頁面上的 Live2D 看板娘</span>
                        </div>
                        <div class="toggle-switch" id="live2dToggle" role="switch" aria-checked="false" tabindex="0" aria-label="看板娘 (Live2D)"></div>
                    </div>

                    <div class="setting-item">
                        <div class="setting-label">
                            <span>背景樣式</span>
                            <span class="setting-description">選擇背景動畫樣式</span>
                        </div>
                        <div class="select-control">
                            <select id="backgroundStyle" title="背景樣式" aria-label="背景樣式">
                                <option value="dom">粒子風暴</option>
                                <option value="network">網格連線</option>
                                <option value="magnet">磁力連線</option>
                                <option value="star">宇宙星圖</option>
                                <option value="bubble">氣泡派對</option>
                                <option value="circuit">電路脈衝</option>
                                <option value="sakura">櫻花飄落</option>
                                <option value="glitch">故障雜訊</option>
                                <option value="laser">雷射禁地</option>
                                <option value="fleet">宇宙戰艦</option>
                                <option value="off">關閉</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">效能設定</h3>
                    
                    <div class="setting-item">
                        <div class="setting-label">
                            <span id="animationStrengthLabel">動畫強度</span>
                            <span class="setting-description" id="animationStrengthDesc">調整頁面動畫效果強度</span>
                        </div>
                        <div class="slider-control">
                            <div class="slider-value" id="animationValue">強</div>
                            <input type="range" class="slider-range" id="animationStrength" min="0" max="2" value="2" step="1">
                            <div class="slider-marks">
                                <span data-value="0">關</span>
                                <span data-value="1">低</span>
                                <span data-value="2">強</span>
                            </div>
                        </div>
                    </div>

                    <div class="setting-item fps-monitor">
                        <div class="setting-label">
                            <span>幀數監控</span>
                            <span class="setting-description">即時顯示頁面渲染幀率</span>
                        </div>
                        <div class="fps-display">
                            <span class="fps-value" id="fpsValue">000</span>
                            <span class="fps-unit">FPS</span>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3 class="settings-section-title">音效設定</h3>
                    
                    <div class="setting-item">
                        <div class="setting-label">
                            <span>音效開關</span>
                            <span class="setting-description">啟用/關閉互動音效</span>
                        </div>
                        <div class="toggle-switch active" id="soundEnabled"></div>
                    </div>
                </div>
            </div>

            <!-- OSD 多功能顯示面板 -->
            <div class="fps-osd" id="fpsOSD">
                <div class="osd-header">
                    <div class="osd-title" id="osdTitle">FPS</div>
                    <div class="osd-mode-switcher">
                        <button class="osd-mode-btn active" data-mode="fps" title="FPS 模式"></button>
                        <button class="osd-mode-btn" data-mode="advanced" title="進階模式"></button>
                        <button class="osd-mode-btn" data-mode="full" title="完整模式"></button>
                    </div>
                </div>
                <div class="osd-content" id="osdContent"></div>
            </div>

            <!-- 左側導覽欄 Sidebar (預設摺疊) -->
            <aside class="gc-sidebar collapsed" id="gcSidebar">
                <ul class="gc-sidebar-menu">
                    <li class="gc-sidebar-item">
                        <a class="gc-sidebar-link" id="sidebarToggle" title="展開側邊欄">
                            <i data-lucide="chevron-right" class="sidebar-icon"></i>
                            <span class="sidebar-text">展開</span>
                        </a>
                    </li>
                    <li class="gc-sidebar-item">
                        <a class="gc-sidebar-link" id="gcBackBtn" title="返回遊戲中心">
                            <i data-lucide="layout-grid" class="sidebar-icon"></i>
                            <span class="sidebar-text">遊戲中心</span>
                        </a>
                    </li>
                    <li class="gc-sidebar-item">
                        <a class="gc-sidebar-link" id="fpsOSDToggle" title="顯示幀數監控">
                            <i data-lucide="activity" class="sidebar-icon"></i>
                            <span class="sidebar-text">幀數顯示</span>
                        </a>
                    </li>
                    <li class="gc-sidebar-item">
                        <a class="gc-sidebar-link" id="hideSidebarBtn" title="隱藏左側欄">
                            <i data-lucide="eye-off" class="sidebar-icon"></i>
                            <span class="sidebar-text">關閉左側欄</span>
                        </a>
                    </li>
                </ul>
            </aside>
        `;

        const wrapper = document.createElement('div');
        wrapper.id = 'gc-shell-host-container';
        wrapper.innerHTML = shellHTML;
        document.body.insertBefore(wrapper, document.body.firstChild);
    }

    // 4. Header 與 設定面板獨立互動控制器
    function initHeaderAndSettingsController() {
        const settingsToggle = document.querySelector('.settings-toggle');
        const settingsPanel = document.querySelector('.settings-panel');
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.querySelector('.nav-links');

        // 確保或創建遮罩層
        let overlay = document.querySelector('.nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            document.body.appendChild(overlay);
        }

        // 開關設定面板
        function toggleSettings(show) {
            if (!settingsPanel || !settingsToggle) return;
            const isActive = typeof show === 'boolean' ? show : !settingsPanel.classList.contains('active');
            if (isActive) {
                if (navLinks) navLinks.classList.remove('active');
                if (menuToggle) menuToggle.classList.remove('active');
                settingsPanel.classList.add('active');
                settingsToggle.classList.add('active');
                overlay.classList.add('active');
            } else {
                settingsPanel.classList.remove('active');
                if (settingsToggle.classList.contains('active')) {
                    settingsToggle.classList.remove('active');
                    settingsToggle.classList.add('closing');
                    setTimeout(() => settingsToggle.classList.remove('closing'), 300);
                }
                if (!navLinks || !navLinks.classList.contains('active')) {
                    overlay.classList.remove('active');
                }
            }
        }

        // 開關手機選單
        function toggleMenu(show) {
            if (!navLinks || !menuToggle) return;
            const isActive = typeof show === 'boolean' ? show : !navLinks.classList.contains('active');
            if (isActive) {
                toggleSettings(false);
                navLinks.classList.add('active');
                menuToggle.classList.add('active');
                overlay.classList.add('active');
            } else {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                if (!settingsPanel || !settingsPanel.classList.contains('active')) {
                    overlay.classList.remove('active');
                }
            }
        }

        if (settingsToggle) {
            settingsToggle.onclick = (e) => {
                e.stopPropagation();
                toggleSettings();
            };
        }

        if (menuToggle) {
            menuToggle.onclick = (e) => {
                e.stopPropagation();
                toggleMenu();
            };
        }

        overlay.onclick = () => {
            toggleSettings(false);
            toggleMenu(false);
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                toggleSettings(false);
                toggleMenu(false);
            }
        });

        // 搜尋功能
        const navSearch = document.getElementById('navSearch');
        if (navSearch) {
            navSearch.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const links = document.querySelectorAll('.nav-links li');
                links.forEach(li => {
                    const text = li.textContent.toLowerCase();
                    li.style.display = text.includes(query) ? '' : 'none';
                });
            });
        }

        // 固定導航欄
        const headerFixedToggle = document.getElementById('headerFixed');
        const header = document.querySelector('header');
        if (headerFixedToggle) {
            const isFixed = SafeStorage.getItem('headerFixed') !== 'false';
            headerFixedToggle.classList.toggle('active', isFixed);
            if (header) header.style.position = isFixed ? 'fixed' : 'relative';
            headerFixedToggle.onclick = () => {
                const active = headerFixedToggle.classList.toggle('active');
                SafeStorage.setItem('headerFixed', active ? 'true' : 'false');
                if (header) header.style.position = active ? 'fixed' : 'relative';
            };
        }

        // 主題切換
        const themeSelect = document.getElementById('themeMode');
        if (themeSelect) {
            const currentTheme = SafeStorage.getItem('theme') || 'dark';
            themeSelect.value = currentTheme;
            document.documentElement.setAttribute('data-theme', currentTheme);
            themeSelect.onchange = (e) => {
                const theme = e.target.value;
                document.documentElement.setAttribute('data-theme', theme);
                SafeStorage.setItem('theme', theme);
            };
        }

        // Header 高度調節
        const headerHeightSlider = document.getElementById('headerHeight');
        const headerHeightValue = document.getElementById('headerHeightValue');
        if (headerHeightSlider && headerHeightValue) {
            const savedHeight = SafeStorage.getItem('headerHeight') || '75';
            headerHeightSlider.value = savedHeight;
            headerHeightValue.innerText = `${savedHeight}px`;
            document.documentElement.style.setProperty('--header-height', `${savedHeight}px`);

            headerHeightSlider.oninput = (e) => {
                const val = e.target.value;
                headerHeightValue.innerText = `${val}px`;
                document.documentElement.style.setProperty('--header-height', `${val}px`);
                SafeStorage.setItem('headerHeight', val);
            };
        }

        // 看板娘 (Live2D) 開關
        const live2dToggle = document.getElementById('live2dToggle');
        if (live2dToggle) {
            const live2dActive = SafeStorage.getItem('live2dEnabled') === 'true';
            live2dToggle.classList.toggle('active', live2dActive);
            live2dToggle.setAttribute('aria-checked', live2dActive ? 'true' : 'false');
            live2dToggle.onclick = () => {
                const active = live2dToggle.classList.toggle('active');
                live2dToggle.setAttribute('aria-checked', active ? 'true' : 'false');
                SafeStorage.setItem('live2dEnabled', active ? 'true' : 'false');
                if (window.Live2DManager && typeof window.Live2DManager.toggle === 'function') {
                    window.Live2DManager.toggle(active);
                }
            };
        }

        // 背景樣式切換
        const bgSelect = document.getElementById('backgroundStyle');
        if (bgSelect) {
            const savedBg = SafeStorage.getItem('backgroundStyle') || 'city';
            bgSelect.value = savedBg;
            bgSelect.onchange = (e) => {
                const val = e.target.value;
                SafeStorage.setItem('backgroundStyle', val);
                if (window.Core && window.Core.BackgroundManager && typeof window.Core.BackgroundManager.apply === 'function') {
                    window.Core.BackgroundManager.apply(val, { container: document.querySelector('.particles'), force: true });
                }
            };
        }

        // 動畫強度調節 (關, 低, 強)
        const animationSlider = document.getElementById('animationStrength');
        const animationValue = document.getElementById('animationValue');
        if (animationSlider && animationValue) {
            const labels = ['關', '低', '強'];
            const savedAnim = SafeStorage.getItem('animationStrength') || '2';
            animationSlider.value = savedAnim;
            animationValue.innerText = labels[parseInt(savedAnim)] || '強';

            animationSlider.oninput = (e) => {
                const val = e.target.value;
                animationValue.innerText = labels[parseInt(val)] || '強';
                SafeStorage.setItem('animationStrength', val);
                document.documentElement.style.setProperty('--animation-speed', val === '0' ? '0s' : (val === '1' ? '2s' : '1s'));
            };
        }

        // 音效開關
        const soundToggle = document.getElementById('soundEnabled');
        if (soundToggle) {
            const soundActive = SafeStorage.getItem('soundEnabled') !== 'false';
            soundToggle.classList.toggle('active', soundActive);
            soundToggle.onclick = () => {
                const active = soundToggle.classList.toggle('active');
                SafeStorage.setItem('soundEnabled', active ? 'true' : 'false');
            };
        }
    }

    // 5. 側邊欄邏輯控制器
    function initSidebarLogic() {
        const sidebar = document.getElementById('gcSidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const hideSidebarBtn = document.getElementById('hideSidebarBtn');
        const fpsOSDToggle = document.getElementById('fpsOSDToggle');
        const gcBackBtn = document.getElementById('gcBackBtn');

        let isCollapsed = true;
        let isHidden = false;

        const savedShowSidebar = SafeStorage.getItem('showSidebar');
        const savedCollapsed = SafeStorage.getItem('sidebarCollapsed');

        if (savedShowSidebar === 'false') {
            setSidebarVisibility(false, false);
        } else {
            setSidebarVisibility(true, false);
        }

        if (savedCollapsed === 'false') {
            setSidebarCollapse(false, false);
        } else {
            setSidebarCollapse(true, false);
        }

        function setSidebarVisibility(visible, save = true) {
            if (!sidebar) return;
            isHidden = !visible;
            sidebar.classList.toggle('hidden-sidebar', isHidden);
            if (save) SafeStorage.setItem('showSidebar', visible ? 'true' : 'false');
            const showSidebarToggle = document.getElementById('showSidebar');
            if (showSidebarToggle) showSidebarToggle.classList.toggle('active', visible);
        }

        function setSidebarCollapse(collapsed, save = true) {
            if (!sidebar) return;
            isCollapsed = collapsed;
            sidebar.classList.toggle('collapsed', isCollapsed);
            
            if (sidebarToggle) {
                sidebarToggle.setAttribute('title', isCollapsed ? '展開側邊欄' : '摺疊側邊欄');
                const textEl = sidebarToggle.querySelector('.sidebar-text');
                if (textEl) textEl.innerText = isCollapsed ? '展開' : '摺疊';

                const iconEl = sidebarToggle.querySelector('.sidebar-icon');
                if (iconEl) {
                    const targetIcon = isCollapsed ? 'chevron-right' : 'chevron-left';
                    if (iconEl.tagName.toLowerCase() === 'svg') {
                        const newI = document.createElement('i');
                        newI.className = iconEl.getAttribute('class') || 'sidebar-icon';
                        newI.setAttribute('data-lucide', targetIcon);
                        iconEl.parentNode.replaceChild(newI, iconEl);
                    } else {
                        iconEl.setAttribute('data-lucide', targetIcon);
                    }
                    if (window.lucide) window.lucide.createIcons();
                }
            }

            if (save) SafeStorage.setItem('sidebarCollapsed', isCollapsed ? 'true' : 'false');
        }

        if (sidebarToggle) {
            sidebarToggle.onclick = (e) => {
                e.preventDefault();
                setSidebarCollapse(!isCollapsed, true);
            };
        }

        if (hideSidebarBtn) {
            hideSidebarBtn.onclick = (e) => {
                e.preventDefault();
                setSidebarVisibility(false, true);
            };
        }

        const showSidebarToggle = document.getElementById('showSidebar');
        if (showSidebarToggle) {
            showSidebarToggle.onclick = () => {
                const active = showSidebarToggle.classList.toggle('active');
                setSidebarVisibility(active, true);
            };
        }

        if (fpsOSDToggle) {
            fpsOSDToggle.onclick = (e) => {
                e.preventDefault();
                if (window.toggleFPSMonitor) window.toggleFPSMonitor();
            };
        }

        if (gcBackBtn) {
            gcBackBtn.onclick = (e) => {
                e.preventDefault();
                sessionStorage.setItem('skipEntranceAnimation', 'true');
                window.location.href = `${gcRel}game-center.html`;
            };
        }
    }

    // 6. FPS OSD 引擎 (升級版：支援 FPS / 進階 (波型圖) / 完整模式)
    function initFPSOSDLogic() {
        let fpsCount = 60;
        let minFps = 60;
        let lastTime = performance.now();
        let lastFrameTime = performance.now();
        let frameDelta = 16.6;
        let frameCount = 0;
        let isMonitorActive = false;
        let currentMode = 'fps';
        let fpsHistory = new Array(35).fill(60);

        function updateFPS(now) {
            if (!isMonitorActive) return;
            frameCount++;
            const delta = now - lastFrameTime;
            lastFrameTime = now;
            frameDelta = delta.toFixed(1);

            if (now - lastTime >= 400) {
                fpsCount = Math.round((frameCount * 1000) / (now - lastTime));
                frameCount = 0;
                lastTime = now;

                if (fpsCount > 0 && (fpsCount < minFps || minFps === 60)) {
                    minFps = fpsCount;
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

            ctx.clearRect(0, 0, w, h);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);

            const y60 = h - (60 / 75) * h;
            ctx.beginPath();
            ctx.moveTo(0, y60);
            ctx.lineTo(w, y60);
            ctx.stroke();

            const y30 = h - (30 / 75) * h;
            ctx.beginPath();
            ctx.moveTo(0, y30);
            ctx.lineTo(w, y30);
            ctx.stroke();

            ctx.setLineDash([]);

            const fpsColor = fpsCount >= 50 ? '#00f0ff' : (fpsCount >= 30 ? '#f59e0b' : '#ef4444');
            ctx.strokeStyle = fpsColor;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 6;
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

            ctx.shadowBlur = 0;
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, fpsColor + '33');
            grad.addColorStop(1, fpsColor + '00');
            ctx.fillStyle = grad;
            ctx.fill();
        }

        function renderOSDContent() {
            const contentContainer = document.getElementById('osdContent');
            const fpsValueEl = document.getElementById('fpsValue');
            if (fpsValueEl) fpsValueEl.innerText = String(fpsCount).padStart(3, '0');
            if (!contentContainer) return;

            const fpsColor = fpsCount >= 50 ? '#00f0ff' : (fpsCount >= 30 ? '#f59e0b' : '#ef4444');
            const statusBadge = fpsCount >= 50 ? 'STABLE' : (fpsCount >= 30 ? 'DROP' : 'LAG');
            const badgeColor = fpsCount >= 50 ? '#10b981' : (fpsCount >= 30 ? '#f59e0b' : '#ef4444');
            const memoryMB = (performance && performance.memory) ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) : 42;

            if (currentMode === 'fps') {
                contentContainer.innerHTML = `
                    <div class="osd-item" style="padding: 2px 0; justify-content: space-between;">
                        <span class="osd-label">即時幀率</span>
                        <div style="display: flex; align-items: baseline; gap: 4px;">
                            <span class="osd-value" style="color: ${fpsColor}; font-size: 1.45rem; font-weight: 800;">${fpsCount}</span>
                            <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">FPS</span>
                        </div>
                    </div>
                    <div class="osd-progress" style="margin-top: 2px;">
                        <div class="osd-progress-bar" style="width: ${Math.min(100, (fpsCount / 60) * 100)}%; background: ${fpsColor}"></div>
                    </div>
                `;
            } else if (currentMode === 'advanced') {
                contentContainer.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div class="osd-item" style="background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(0,240,255,0.15);">
                            <div style="display: flex; flex-direction: column;">
                                <span class="osd-label">即時 FPS</span>
                                <span class="osd-value" style="color: ${fpsColor}; font-size: 1.3rem;">${fpsCount} <span style="font-size: 0.7rem; color: #64748b;">FPS</span></span>
                            </div>
                        </div>
                        <div class="osd-item" style="background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(0,240,255,0.15);">
                            <div style="display: flex; flex-direction: column;">
                                <span class="osd-label">幀延遲</span>
                                <span class="osd-value" style="color: #38bdf8; font-size: 1.3rem;">${frameDelta} <span style="font-size: 0.7rem; color: #64748b;">ms</span></span>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="osd-label">FPS 波動走勢波形圖</span>
                            <span style="font-size: 0.65rem; color: #64748b;">60 / 30 基準線</span>
                        </div>
                        <div style="width: 100%; height: 48px; background: rgba(0,0,0,0.4); border-radius: 6px; border: 1px solid rgba(0,240,255,0.15); overflow: hidden;">
                            <canvas id="osdSparklineAdvanced" style="width: 100%; height: 100%; display: block;"></canvas>
                        </div>
                    </div>
                `;
                drawSparkline('osdSparklineAdvanced');
            } else {
                const nowTime = new Date();
                const timeStr = String(nowTime.getHours()).padStart(2, '0') + ':' + String(nowTime.getMinutes()).padStart(2, '0') + ':' + String(nowTime.getSeconds()).padStart(2, '0');

                contentContainer.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
                        <div class="osd-item" style="background: rgba(0,0,0,0.3); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(0,240,255,0.15);">
                            <span class="osd-label">即時 FPS</span>
                            <span class="osd-value" style="color: ${fpsColor}; font-size: 1.15rem;">${fpsCount}</span>
                        </div>
                        <div class="osd-item" style="background: rgba(0,0,0,0.3); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(0,240,255,0.15);">
                            <span class="osd-label">幀延遲</span>
                            <span class="osd-value" style="color: #38bdf8; font-size: 1.15rem;">${frameDelta}<span style="font-size: 0.65rem">ms</span></span>
                        </div>
                        <div class="osd-item" style="background: rgba(0,0,0,0.3); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(0,240,255,0.15);">
                            <span class="osd-label">記憶體</span>
                            <span class="osd-value" style="color: #a855f7; font-size: 1.15rem;">${memoryMB}<span style="font-size: 0.65rem">MB</span></span>
                        </div>
                        <div class="osd-item" style="background: rgba(0,0,0,0.3); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(0,240,255,0.15);">
                            <span class="osd-label">最低 FPS</span>
                            <span class="osd-value" style="color: #f59e0b; font-size: 1.15rem;">${minFps}</span>
                        </div>
                    </div>

                    <div class="osd-progress" style="margin-top: 2px;">
                        <div class="osd-progress-bar" style="width: ${Math.min(100, (fpsCount / 60) * 100)}%; background: ${fpsColor}"></div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 2px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="osd-label">FPS 即時波型圖</span>
                            <span style="font-size: 0.65rem; color: #64748b;">時間: ${timeStr}</span>
                        </div>
                        <div style="width: 100%; height: 42px; background: rgba(0,0,0,0.4); border-radius: 6px; border: 1px solid rgba(0,240,255,0.15); overflow: hidden;">
                            <canvas id="osdSparklineFull" style="width: 100%; height: 100%; display: block;"></canvas>
                        </div>
                    </div>
                `;
                drawSparkline('osdSparklineFull');
            }
        }

        window.toggleFPSMonitor = function (show) {
            const osd = document.getElementById('fpsOSD');
            if (!osd) return;
            isMonitorActive = typeof show === 'boolean' ? show : !isMonitorActive;
            osd.classList.toggle('active', isMonitorActive);
            SafeStorage.setItem('fpsOSDActive', isMonitorActive ? 'true' : 'false');
            if (isMonitorActive) {
                lastTime = performance.now();
                lastFrameTime = performance.now();
                frameCount = 0;
                requestAnimationFrame(updateFPS);
            }
        };

        const fpsOSD = document.getElementById('fpsOSD');
        if (!fpsOSD) return;

        // 恢復儲存尺寸與位置
        const savedLeft = SafeStorage.getItem('fpsOSD_left');
        const savedTop = SafeStorage.getItem('fpsOSD_top');
        const savedWidth = SafeStorage.getItem('fpsOSD_width');
        const savedHeight = SafeStorage.getItem('fpsOSD_height');
        const savedMode = SafeStorage.getItem('fpsOSD_mode') || 'fps';

        if (savedLeft && savedTop) {
            fpsOSD.style.right = 'auto';
            fpsOSD.style.bottom = 'auto';
            fpsOSD.style.left = `${Math.min(window.innerWidth - 100, Math.max(10, parseInt(savedLeft)))}px`;
            fpsOSD.style.top = `${Math.min(window.innerHeight - 80, Math.max(10, parseInt(savedTop)))}px`;
        }
        if (savedWidth) fpsOSD.style.width = `${Math.max(180, parseInt(savedWidth))}px`;
        if (savedHeight) fpsOSD.style.height = `${Math.max(110, parseInt(savedHeight))}px`;

        if (SafeStorage.getItem('fpsOSDActive') === 'true') {
            window.toggleFPSMonitor(true);
        }

        const modeBtns = fpsOSD.querySelectorAll('.osd-mode-btn');
        modeBtns.forEach(btn => {
            const m = btn.getAttribute('data-mode');
            if (m === currentMode) btn.classList.add('active');
            else btn.classList.remove('active');

            btn.onclick = () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentMode = btn.getAttribute('data-mode') || 'fps';
                SafeStorage.setItem('fpsOSD_mode', currentMode);
                renderOSDContent();
            };
        });

        // 拖曳支援 (帶邊界限制)
        const header = fpsOSD.querySelector('.osd-header');
        if (header) {
            let isDragging = false, startX, startY, initLeft, initTop;
            header.onmousedown = (e) => {
                if (e.target.closest('.osd-mode-switcher')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = fpsOSD.getBoundingClientRect();
                initLeft = rect.left;
                initTop = rect.top;
                fpsOSD.style.right = 'auto';
                fpsOSD.style.bottom = 'auto';
                fpsOSD.style.left = `${initLeft}px`;
                fpsOSD.style.top = `${initTop}px`;
                document.onmousemove = (me) => {
                    if (!isDragging) return;
                    let newLeft = initLeft + (me.clientX - startX);
                    let newTop = initTop + (me.clientY - startY);
                    newLeft = Math.max(8, Math.min(window.innerWidth - fpsOSD.offsetWidth - 8, newLeft));
                    newTop = Math.max(8, Math.min(window.innerHeight - fpsOSD.offsetHeight - 8, newTop));
                    fpsOSD.style.left = `${newLeft}px`;
                    fpsOSD.style.top = `${newTop}px`;
                };
                document.onmouseup = () => {
                    if (isDragging) {
                        isDragging = false;
                        SafeStorage.setItem('fpsOSD_left', parseInt(fpsOSD.style.left));
                        SafeStorage.setItem('fpsOSD_top', parseInt(fpsOSD.style.top));
                    }
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };
        }

        // 縮放監聽
        if (window.ResizeObserver) {
            const ro = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    if (isMonitorActive) {
                        SafeStorage.setItem('fpsOSD_width', Math.round(entry.contentRect.width));
                        SafeStorage.setItem('fpsOSD_height', Math.round(entry.contentRect.height));
                    }
                }
            });
            ro.observe(fpsOSD);
        }
    }

    // 7. 啟動入口：直接注入並啟動所有控制器
    function bootShell() {
        if (isEmbedded) {
            const style = document.createElement('style');
            style.textContent = `
                .game-container, #gameContainer {
                    position: fixed !important;
                    inset: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    margin: 0 !important;
                    padding: 20px !important;
                }
            `;
            document.head.appendChild(style);
            return;
        }

        injectShellStyles();
        injectShellHTML();
        ensureDependencies(() => {
            initHeaderAndSettingsController();
            initSidebarLogic();
            initFPSOSDLogic();

            // 確保全站背景系統就緒 (Core.initBackground)
            if (window.Core && typeof window.Core.initBackground === 'function') {
                window.Core.initBackground();
            }

            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootShell);
    } else {
        bootShell();
    }
})();
