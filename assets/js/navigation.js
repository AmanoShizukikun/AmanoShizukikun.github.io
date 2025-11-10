/**
 * 導航系統
 * 處理頁面導航、側邊欄、活動狀態等
 */

const Navigation = {
    /**
     * 初始化側邊導航
     * 根據頁面 section 自動生成
     */
    initSideNav() {
        const sideNav = document.querySelector('.side-nav');
        if (!sideNav) return;

        let currentActive = null;

        // 更新活動狀態
        const updateActive = () => {
            const sections = document.querySelectorAll('section[id]');
            const scrollY = window.pageYOffset + 150; // 添加偏移量，標記視口中心為基準

            let foundActive = null;
            let closestDistance = Infinity;

            sections.forEach(section => {
                const sectionId = section.getAttribute('id');
                const navLink = sideNav.querySelector(`a[href="#${sectionId}"]`);
                
                if (!navLink) return;

                const sectionTop = section.offsetTop;
                const sectionBottom = sectionTop + section.offsetHeight;
                const sectionCenter = (sectionTop + sectionBottom) / 2;

                // 計算滾動位置到章節中心的距離
                const distance = Math.abs(scrollY - sectionCenter);

                // 如果當前滾動位置在該 section 內，或距離最近
                if (scrollY >= sectionTop && scrollY < sectionBottom) {
                    foundActive = navLink;
                } else if (distance < closestDistance) {
                    closestDistance = distance;
                    // 只有在沒有找到精確匹配時，才使用最近的
                    if (!foundActive) {
                        foundActive = navLink;
                    }
                }
            });

            // 只有在改變時才更新 DOM
            if (foundActive && foundActive !== currentActive) {
                sideNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                foundActive.classList.add('active');
                currentActive = foundActive;
            }
        };

        // 使用 throttle 優化性能，但降低延遲
        const throttledUpdate = Core.throttle(updateActive, 50);

        window.addEventListener('scroll', throttledUpdate);
        updateActive(); // 初始化
    },

    /**
     * 初始化頂部導航
     * 處理活動狀態和滾動效果
     */
    initTopNav() {
        const header = document.querySelector('header');
        if (!header) return;

        // 滾動時添加陰影
        const handleScroll = Core.throttle(() => {
            if (window.scrollY > 50) {
                header.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.3)';
            } else {
                header.style.boxShadow = 'none';
            }
        }, 100);

        window.addEventListener('scroll', handleScroll);

        // 設置當前頁面的活動狀態
        this.setActiveNavLink();
    },

    /**
     * 設置導航連結的活動狀態
     * 根據當前頁面 URL
     */
    setActiveNavLink() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-links a');

        navLinks.forEach(link => {
            const linkPath = new URL(link.href).pathname;
            if (linkPath === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    },

    /**
     * 移動端選單切換
     */
    initMobileMenu() {
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.querySelector('.nav-links');

        if (!menuToggle || !navLinks) return;

        // 創建遮罩層
        let overlay = document.querySelector('.nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            document.body.appendChild(overlay);
        }

        // 切換選單
        const toggleMenu = (show) => {
            if (show) {
                navLinks.classList.add('active');
                menuToggle.classList.add('active');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden'; // 防止背景滾動
            } else {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                // 只有當設定面板也關閉時才關閉遮罩
                const settingsPanel = document.querySelector('.settings-panel');
                if (!settingsPanel || !settingsPanel.classList.contains('active')) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = ''; // 恢復滾動
                }
            }
        };

        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = navLinks.classList.contains('active');
            
            // 如果設定面板開啟，先關閉它
            const settingsPanel = document.querySelector('.settings-panel');
            const settingsToggle = document.querySelector('.settings-toggle');
            if (settingsPanel && settingsPanel.classList.contains('active')) {
                settingsPanel.classList.remove('active');
                if (settingsToggle) settingsToggle.classList.remove('active');
            }
            
            toggleMenu(!isActive);
        });

        // 點擊選單項後關閉選單
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                toggleMenu(false);
            });
        });

        // 點擊遮罩關閉選單
        overlay.addEventListener('click', () => {
            toggleMenu(false);
        });

        // 點擊頁面其他地方關閉選單
        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && 
                !navLinks.contains(e.target) && 
                navLinks.classList.contains('active')) {
                toggleMenu(false);
            }
        });

        // ESC 鍵關閉選單
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                toggleMenu(false);
            }
        });
    },

    /**
     * 設定面板切換
     */
    initSettingsPanel() {
        const settingsToggle = document.querySelector('.settings-toggle');
        const settingsPanel = document.querySelector('.settings-panel');
        
        if (!settingsToggle || !settingsPanel) return;

        // 獲取或創建遮罩層
        let overlay = document.querySelector('.nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            document.body.appendChild(overlay);
        }

        // 切換設定面板
        const toggleSettings = (show) => {
            const header = document.querySelector('header');
            
            if (show) {
                settingsPanel.classList.add('active');
                settingsToggle.classList.add('active');
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                // 打開面板時，暫時固定 header
                if (header) {
                    header.style.position = 'fixed';
                    document.body.style.paddingTop = header.offsetHeight + 'px';
                }
            } else {
                settingsPanel.classList.remove('active');
                settingsToggle.classList.remove('active');
                // 只有當導航選單也關閉時才關閉遮罩
                const navLinks = document.querySelector('.nav-links');
                if (!navLinks || !navLinks.classList.contains('active')) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
                
                // 面板關閉時，恢復 header 到用戶設定的狀態
                const headerFixed = localStorage.getItem('headerFixed') !== 'false';
                if (header) {
                    if (headerFixed) {
                        header.style.position = 'fixed';
                        document.body.style.paddingTop = header.offsetHeight + 'px';
                    } else {
                        header.style.position = 'relative';
                        document.body.style.paddingTop = '0';
                    }
                }
            }
        };

        settingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = settingsPanel.classList.contains('active');
            
            // 如果導航選單開啟,先關閉它
            const navLinks = document.querySelector('.nav-links');
            const menuToggle = document.querySelector('.menu-toggle');
            if (navLinks && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                if (menuToggle) menuToggle.classList.remove('active');
            }
            
            toggleSettings(!isActive);
        });

        // 點擊遮罩關閉設定面板
        overlay.addEventListener('click', () => {
            toggleSettings(false);
        });

        // 點擊頁面其他地方關閉設定面板
        document.addEventListener('click', (e) => {
            if (!settingsToggle.contains(e.target) && 
                !settingsPanel.contains(e.target) && 
                settingsPanel.classList.contains('active')) {
                toggleSettings(false);
            }
        });

        // ESC 鍵關閉設定面板
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && settingsPanel.classList.contains('active')) {
                toggleSettings(false);
            }
        });

        // 初始化設定功能
        this.initSettings();
    },

    /**
     * 初始化設定功能
     */
    initSettings() {
        // 從 localStorage 載入設定
        const loadSettings = () => {
            return {
                headerFixed: localStorage.getItem('headerFixed') !== 'false',
                theme: localStorage.getItem('theme') || 'dark',
                animationStrength: parseInt(localStorage.getItem('animationStrength')) || 100,
                soundEnabled: localStorage.getItem('soundEnabled') !== 'false'
            };
        };

        // 儲存設定到 localStorage
        const saveSettings = (settings) => {
            localStorage.setItem('headerFixed', settings.headerFixed);
            localStorage.setItem('theme', settings.theme);
            localStorage.setItem('animationStrength', settings.animationStrength);
            localStorage.setItem('soundEnabled', settings.soundEnabled);
        };

        // 應用設定
        const applySettings = (settings, skipHeaderFixed = false) => {
            const header = document.querySelector('header');
            const html = document.documentElement;

            // Header 固定 - 可選擇跳過
            if (header && !skipHeaderFixed) {
                if (settings.headerFixed) {
                    header.style.position = 'fixed';
                    document.body.style.paddingTop = header.offsetHeight + 'px';
                } else {
                    header.style.position = 'relative';
                    document.body.style.paddingTop = '0';
                }
            }

            // 主題模式
            html.setAttribute('data-theme', settings.theme);
            if (settings.theme === 'light') {
                // 淺色模式 - 背景與主要顏色
                html.style.setProperty('--dark-bg', '#f5f5f7');
                html.style.setProperty('--darker-bg', '#e8e8ea');
                html.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.7)');
                
                // 主題顏色稍微調整以適配淺色背景
                html.style.setProperty('--primary-cyan', '#0099cc');
                html.style.setProperty('--primary-magenta', '#cc0066');
                html.style.setProperty('--accent-cyan', '#00bbdd');
                html.style.setProperty('--primary-yellow', '#ffbb00');
                
                // 文字顏色
                document.body.style.color = '#1a1a1a';
                
                // 調整背景元素
                const cyberBg = document.querySelector('.cyber-bg');
                if (cyberBg) {
                    cyberBg.style.background = `
                        radial-gradient(circle at 25% 25%, rgba(0, 153, 204, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 75% 75%, rgba(204, 0, 102, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 50% 10%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                        linear-gradient(135deg, #f5f5f7 0%, #e8e8ea 50%, #f5f5f7 100%)
                    `;
                }
                
                // 調整網格覆蓋層
                const gridOverlay = document.querySelector('.grid-overlay');
                if (gridOverlay) {
                    gridOverlay.style.backgroundImage = `
                        linear-gradient(rgba(0, 153, 204, 0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 153, 204, 0.1) 1px, transparent 1px),
                        radial-gradient(circle at 20% 20%, rgba(204, 0, 102, 0.08) 1px, transparent 1px)
                    `;
                    gridOverlay.style.opacity = '0.5';
                }
                
                // 調整粒子顏色
                document.querySelectorAll('.particle').forEach((particle, index) => {
                    if (index % 3 === 0) {
                        particle.style.background = '#8b5cf6';
                        particle.style.boxShadow = '0 0 10px #8b5cf6, 0 0 20px #8b5cf6';
                    } else if (index % 2 === 0) {
                        particle.style.background = '#cc0066';
                        particle.style.boxShadow = '0 0 10px #cc0066, 0 0 20px #cc0066';
                    } else {
                        particle.style.background = '#0099cc';
                        particle.style.boxShadow = '0 0 10px #0099cc, 0 0 20px #0099cc';
                    }
                    particle.style.opacity = '0.6';
                });
            } else {
                // 深色模式 - 恢復原始設定
                html.style.setProperty('--dark-bg', '#0a0a0f');
                html.style.setProperty('--darker-bg', '#050507');
                html.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.05)');
                
                html.style.setProperty('--primary-cyan', '#00d4ff');
                html.style.setProperty('--primary-magenta', '#ff0080');
                html.style.setProperty('--accent-cyan', '#00ffff');
                html.style.setProperty('--primary-yellow', '#ffff00');
                
                document.body.style.color = '#ffffff';
                
                // 恢復背景元素
                const cyberBg = document.querySelector('.cyber-bg');
                if (cyberBg) {
                    cyberBg.style.background = `
                        radial-gradient(circle at 25% 25%, rgba(0, 212, 255, 0.2) 0%, transparent 40%),
                        radial-gradient(circle at 75% 75%, rgba(255, 0, 128, 0.2) 0%, transparent 40%),
                        radial-gradient(circle at 50% 10%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
                        linear-gradient(135deg, #0a0a0f 0%, #050507 50%, #0a0a0f 100%)
                    `;
                }
                
                const gridOverlay = document.querySelector('.grid-overlay');
                if (gridOverlay) {
                    gridOverlay.style.backgroundImage = `
                        linear-gradient(rgba(0, 212, 255, 0.15) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 212, 255, 0.15) 1px, transparent 1px),
                        radial-gradient(circle at 20% 20%, rgba(255, 0, 128, 0.1) 1px, transparent 1px)
                    `;
                    gridOverlay.style.opacity = '0.4';
                }
                
                // 恢復粒子顏色
                document.querySelectorAll('.particle').forEach((particle, index) => {
                    if (index % 3 === 0) {
                        particle.style.background = '#8b5cf6';
                        particle.style.boxShadow = '0 0 10px #8b5cf6, 0 0 20px #8b5cf6, 0 0 40px #8b5cf6';
                    } else if (index % 2 === 0) {
                        particle.style.background = '#ff0080';
                        particle.style.boxShadow = '0 0 10px #ff0080, 0 0 20px #ff0080, 0 0 40px #ff0080';
                    } else {
                        particle.style.background = '#00d4ff';
                        particle.style.boxShadow = '0 0 10px #00d4ff, 0 0 20px #00d4ff, 0 0 40px #00d4ff';
                    }
                    particle.style.opacity = '0.9';
                });
            }

            // 動畫強度
            const animationScale = settings.animationStrength / 100;
            html.style.setProperty('--animation-duration', `${animationScale}s`);
            
            // 調整所有動畫速度
            document.querySelectorAll('*').forEach(el => {
                const computedStyle = window.getComputedStyle(el);
                const animationDuration = computedStyle.animationDuration;
                if (animationDuration && animationDuration !== '0s') {
                    const duration = parseFloat(animationDuration);
                    el.style.animationDuration = `${duration * animationScale}s`;
                }
            });

            // 聲音開關 (預留,可在其他功能中使用)
            window.soundEnabled = settings.soundEnabled;
        };

        // 初始化設定值
        const settings = loadSettings();
        applySettings(settings);

        // Header 固定切換
        const headerFixedToggle = document.getElementById('headerFixed');
        if (headerFixedToggle) {
            headerFixedToggle.classList.toggle('active', settings.headerFixed);
            headerFixedToggle.addEventListener('click', () => {
                settings.headerFixed = !settings.headerFixed;
                headerFixedToggle.classList.toggle('active', settings.headerFixed);
                saveSettings(settings);
                // 不立即應用 header 固定變更，等到面板關閉時才應用
                applySettings(settings, true); // 跳過 headerFixed 的應用
            });
        }

        // 主題切換
        const themeSelect = document.getElementById('themeMode');
        if (themeSelect) {
            themeSelect.value = settings.theme;
            themeSelect.addEventListener('change', (e) => {
                settings.theme = e.target.value;
                saveSettings(settings);
                applySettings(settings);
            });
        }

        // 動畫強度
        const animationSlider = document.getElementById('animationStrength');
        const animationValue = document.getElementById('animationValue');
        if (animationSlider && animationValue) {
            animationSlider.value = settings.animationStrength;
            animationValue.textContent = settings.animationStrength + '%';
            animationSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                animationValue.textContent = value + '%';
                settings.animationStrength = value;
                saveSettings(settings);
                applySettings(settings);
            });
        }

        // 聲音開關
        const soundToggle = document.getElementById('soundEnabled');
        if (soundToggle) {
            soundToggle.classList.toggle('active', settings.soundEnabled);
            soundToggle.addEventListener('click', () => {
                settings.soundEnabled = !settings.soundEnabled;
                soundToggle.classList.toggle('active', settings.soundEnabled);
                saveSettings(settings);
                applySettings(settings);
            });
        }
    },

    /**
     * 麵包屑導航
     * 自動生成頁面路徑
     */
    generateBreadcrumb() {
        const breadcrumb = document.querySelector('.breadcrumb');
        if (!breadcrumb) return;

        const path = window.location.pathname.split('/').filter(p => p);
        const items = [{ name: '首頁', url: '/index.html' }];

        let currentPath = '';
        path.forEach((segment, index) => {
            currentPath += '/' + segment;
            // 將檔名轉換為顯示名稱
            const name = segment.replace('.html', '').replace(/-/g, ' ');
            items.push({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                url: currentPath + (index === path.length - 1 ? '' : '.html')
            });
        });

        breadcrumb.innerHTML = items.map((item, index) => {
            if (index === items.length - 1) {
                return `<span class="breadcrumb-current">${item.name}</span>`;
            }
            return `<a href="${item.url}">${item.name}</a>`;
        }).join(' <span class="breadcrumb-separator">›</span> ');
    },

    /**
     * 返回頂部按鈕
     */
    initBackToTop() {
        let backToTop = document.querySelector('.back-to-top');
        
        if (!backToTop) {
            backToTop = document.createElement('button');
            backToTop.className = 'back-to-top';
            backToTop.innerHTML = '⇧';
            backToTop.setAttribute('aria-label', '返回頂部');
            document.body.appendChild(backToTop);
        }

        const toggleVisibility = Core.throttle(() => {
            if (window.scrollY > 500) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }, 100);

        window.addEventListener('scroll', toggleVisibility);

        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    },

    /**
     * 計算並設置 header 高度 CSS 變數
     * 確保側滑選單不會蓋過 header
     */
    setHeaderHeightVariable() {
        const header = document.querySelector('header');
        if (!header) return;

        // 獲取 header 的實際高度（包括 padding 和邊框）
        const headerHeight = header.offsetHeight;
        
        // 設置 CSS 變數
        document.documentElement.style.setProperty('--header-height', headerHeight + 'px');
        
        // 在窗口大小改變時重新計算
        const updateHeaderHeight = Core.debounce(() => {
            const newHeight = header.offsetHeight;
            document.documentElement.style.setProperty('--header-height', newHeight + 'px');
        }, 200);
        
        window.addEventListener('resize', updateHeaderHeight);
    },

    /**
     * 初始化所有導航功能
     */
    init() {
        this.setHeaderHeightVariable(); // 首先設置 header 高度
        this.initTopNav();
        this.initSideNav();
        this.initMobileMenu();
        this.initSettingsPanel();
        this.initBackToTop();
        this.generateBreadcrumb();
    }
};

// 導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
}
