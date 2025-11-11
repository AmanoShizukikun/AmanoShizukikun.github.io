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
            
            // 如果設定面板開啟，先關閉它並觸發齒輪動畫
            const settingsPanel = document.querySelector('.settings-panel');
            const settingsToggle = document.querySelector('.settings-toggle');
            if (settingsPanel && settingsPanel.classList.contains('active')) {
                settingsPanel.classList.remove('active');
                
                // 觸發齒輪逆時針旋轉動畫
                if (settingsToggle && settingsToggle.classList.contains('active')) {
                    settingsToggle.classList.remove('active');
                    settingsToggle.classList.add('closing');
                    
                    const handleAnimEnd = (ev) => {
                        if (ev && ev.animationName && ev.animationName.indexOf('spinReverse') === -1) {
                            return;
                        }
                        settingsToggle.classList.remove('closing');
                    };
                    settingsToggle.addEventListener('animationend', handleAnimEnd, { once: true });
                }
            }
            
            toggleMenu(!isActive);
        });

        // 點擊選單項後關閉選單
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                // 如果設定面板開啟，先關閉它並觸發齒輪動畫
                const settingsPanel = document.querySelector('.settings-panel');
                const settingsToggle = document.querySelector('.settings-toggle');
                
                if (settingsPanel && settingsPanel.classList.contains('active')) {
                    settingsPanel.classList.remove('active');
                    
                    // 觸發齒輪逆時針旋轉動畫
                    if (settingsToggle && settingsToggle.classList.contains('active')) {
                        settingsToggle.classList.remove('active');
                        settingsToggle.classList.add('closing');
                        
                        const handleAnimEnd = (ev) => {
                            if (ev && ev.animationName && ev.animationName.indexOf('spinReverse') === -1) {
                                return;
                            }
                            settingsToggle.classList.remove('closing');
                        };
                        settingsToggle.addEventListener('animationend', handleAnimEnd, { once: true });
                    }
                }
                
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
                
                // 如果設定面板開啟，先關閉它並觸發齒輪動畫
                const settingsPanel = document.querySelector('.settings-panel');
                const settingsToggle = document.querySelector('.settings-toggle');
                
                if (settingsPanel && settingsPanel.classList.contains('active')) {
                    settingsPanel.classList.remove('active');
                    
                    // 觸發齒輪逆時針旋轉動畫
                    if (settingsToggle && settingsToggle.classList.contains('active')) {
                        settingsToggle.classList.remove('active');
                        settingsToggle.classList.add('closing');
                        
                        const handleAnimEnd = (ev) => {
                            if (ev && ev.animationName && ev.animationName.indexOf('spinReverse') === -1) {
                                return;
                            }
                            settingsToggle.classList.remove('closing');
                        };
                        settingsToggle.addEventListener('animationend', handleAnimEnd, { once: true });
                    }
                }
                
                toggleMenu(false);
            }
        });

        // ESC 鍵關閉選單
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                // 如果設定面板開啟，先關閉它並觸發齒輪動畫
                const settingsPanel = document.querySelector('.settings-panel');
                const settingsToggle = document.querySelector('.settings-toggle');
                
                if (settingsPanel && settingsPanel.classList.contains('active')) {
                    settingsPanel.classList.remove('active');
                    
                    // 觸發齒輪逆時針旋轉動畫
                    if (settingsToggle && settingsToggle.classList.contains('active')) {
                        settingsToggle.classList.remove('active');
                        settingsToggle.classList.add('closing');
                        
                        const handleAnimEnd = (ev) => {
                            if (ev && ev.animationName && ev.animationName.indexOf('spinReverse') === -1) {
                                return;
                            }
                            settingsToggle.classList.remove('closing');
                        };
                        settingsToggle.addEventListener('animationend', handleAnimEnd, { once: true });
                    }
                }
                
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
                    const headerHeight = parseInt(localStorage.getItem('headerHeight')) || 60;
                    header.style.position = 'fixed';
                    document.body.style.paddingTop = headerHeight + 'px';
                }
            } else {
                // 關閉面板：先移除 active（停止常轉動畫），再觸發一次快速逆時針關閉動畫
                settingsPanel.classList.remove('active');

                // 如果按鈕目前為 active，先移除再加上 closing 以觸發單次逆時針動畫
                if (settingsToggle.classList.contains('active')) {
                    settingsToggle.classList.remove('active');

                    // 加上 closing 類別觸發 CSS 動畫，並在結束後移除該類別
                    settingsToggle.classList.add('closing');
                    const handleAnimEnd = (ev) => {
                        // 僅處理我們觸發的 animationName
                        if (ev && ev.animationName && ev.animationName.indexOf('spinReverse') === -1) {
                            return;
                        }
                        settingsToggle.classList.remove('closing');
                    };
                    settingsToggle.addEventListener('animationend', handleAnimEnd, { once: true });
                } else {
                    // 若非 active，確保沒有 lingering 的 closing 類別
                    settingsToggle.classList.remove('closing');
                }
                
                // 只有當導航選單也關閉時才關閉遮罩
                const navLinks = document.querySelector('.nav-links');
                if (!navLinks || !navLinks.classList.contains('active')) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
                
                // 面板關閉時，恢復 header 到用戶設定的狀態
                const headerFixed = localStorage.getItem('headerFixed') !== 'false';
                const headerHeight = parseInt(localStorage.getItem('headerHeight')) || 60;
                if (header) {
                    // 添加過渡效果
                    header.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease, position 0.3s ease, height 0.3s ease, padding 0.3s ease';
                    
                    if (headerFixed) {
                        header.style.position = 'fixed';
                        header.style.transform = 'translateY(0)';
                        header.style.opacity = '1';
                        document.body.style.paddingTop = headerHeight + 'px';
                    } else {
                        header.style.position = 'relative';
                        header.style.transform = 'translateY(0)';
                        header.style.opacity = '1';
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
            // 安全地解析 animationStrength，確保它是 0, 1 或 2
            let animationStrength = parseInt(localStorage.getItem('animationStrength'));
            if (isNaN(animationStrength) || animationStrength < 0 || animationStrength > 2) {
                animationStrength = 2; // 預設為強
            }
            
            return {
                headerFixed: localStorage.getItem('headerFixed') !== 'false',
                headerHeight: parseInt(localStorage.getItem('headerHeight')) || 75, // 預設 75px
                sideNavTextVisible: localStorage.getItem('sideNavTextVisible') !== 'false',
                theme: localStorage.getItem('theme') || 'dark',
                animationStrength: animationStrength, // 0=關, 1=低, 2=強
                soundEnabled: localStorage.getItem('soundEnabled') === 'true' // 預設關閉音效
            };
        };

        // 儲存設定到 localStorage
        const saveSettings = (settings) => {
            localStorage.setItem('headerFixed', settings.headerFixed);
            localStorage.setItem('headerHeight', settings.headerHeight);
            localStorage.setItem('sideNavTextVisible', settings.sideNavTextVisible);
            localStorage.setItem('theme', settings.theme);
            localStorage.setItem('animationStrength', settings.animationStrength);
            localStorage.setItem('soundEnabled', settings.soundEnabled);
        };

        // 應用設定
        const applySettings = (settings, skipHeaderFixed = false) => {
            const header = document.querySelector('header');
            const html = document.documentElement;

            // Header 高度設定
            if (header) {
                const headerHeight = settings.headerHeight + 'px';
                header.style.height = headerHeight;
                html.style.setProperty('--header-height', headerHeight);
            }

            // Header 固定 - 可選擇跳過
            if (header && !skipHeaderFixed) {
                // 添加過渡效果
                header.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease, position 0.3s ease, height 0.3s ease, padding 0.3s ease';
                
                if (settings.headerFixed) {
                    header.style.position = 'fixed';
                    header.style.transform = 'translateY(0)';
                    header.style.opacity = '1';
                    document.body.style.paddingTop = settings.headerHeight + 'px';
                } else {
                    header.style.position = 'relative';
                    header.style.transform = 'translateY(0)';
                    header.style.opacity = '1';
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

            // 側邊欄文字顯示控制
            if (settings.sideNavTextVisible) {
                document.body.classList.remove('side-nav-text-hidden');
            } else {
                document.body.classList.add('side-nav-text-hidden');
            }

            // 動畫強度 (0=關閉, 1=低, 2=強)
            const particlesContainer = document.querySelector('.particles');
            
            if (settings.animationStrength === 0) {
                // 關閉所有動畫
                document.body.classList.add('no-animations');
                document.body.classList.remove('low-animations');
                
                // 隱藏所有粒子
                if (particlesContainer) {
                    particlesContainer.style.display = 'none';
                }
            } else if (settings.animationStrength === 1) {
                // 低強度
                document.body.classList.remove('no-animations');
                document.body.classList.add('low-animations');
                
                // 顯示粒子但減半
                if (particlesContainer) {
                    particlesContainer.style.display = 'block';
                    const particles = particlesContainer.querySelectorAll('.particle');
                    particles.forEach((particle, index) => {
                        particle.style.display = index % 2 === 0 ? 'block' : 'none';
                    });
                }
            } else {
                // 強 (2) - 預設狀態
                document.body.classList.remove('no-animations');
                document.body.classList.remove('low-animations');
                
                // 顯示所有粒子
                if (particlesContainer) {
                    particlesContainer.style.display = 'block';
                    const particles = particlesContainer.querySelectorAll('.particle');
                    particles.forEach(particle => {
                        particle.style.display = 'block';
                    });
                }
            }

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

        // 動畫強度 - 3段式滑桿
        const animationSlider = document.getElementById('animationStrength');
        const animationValue = document.getElementById('animationValue');
        if (animationSlider && animationValue) {
            const labels = ['關', '低', '強'];
            
            // 使用已載入的 settings 中的值，而不是重新讀取 localStorage
            animationSlider.value = settings.animationStrength;
            animationValue.textContent = labels[settings.animationStrength];
            
            // 添加事件監聽器
            animationSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                animationValue.textContent = labels[value];
                settings.animationStrength = value;
                saveSettings(settings);
                applySettings(settings);
            });
            
            // 點擊標記跳轉到對應檔位
            const animationContainer = animationSlider.closest('.slider-control');
            if (animationContainer) {
                const animationMarks = animationContainer.querySelectorAll('.slider-marks span');
                animationMarks.forEach(mark => {
                    mark.addEventListener('click', () => {
                        const value = parseInt(mark.getAttribute('data-value'));
                        animationSlider.value = value;
                        animationValue.textContent = labels[value];
                        settings.animationStrength = value;
                        saveSettings(settings);
                        applySettings(settings);
                    });
                });
            }
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

        // Header 高度調整
        const headerHeightSlider = document.getElementById('headerHeight');
        const headerHeightValue = document.getElementById('headerHeightValue');
        if (headerHeightSlider && headerHeightValue) {
            headerHeightSlider.value = settings.headerHeight;
            headerHeightValue.textContent = settings.headerHeight + 'px';
            
            headerHeightSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                headerHeightValue.textContent = value + 'px';
                settings.headerHeight = value;
                saveSettings(settings);
                
                // 只更新 header 高度，不調用完整的 applySettings
                const header = document.querySelector('header');
                if (header) {
                    header.style.height = value + 'px';
                    document.documentElement.style.setProperty('--header-height', value + 'px');
                    
                    if (settings.headerFixed) {
                        document.body.style.paddingTop = value + 'px';
                    }
                }
            });
            
            // 點擊標記跳轉到對應檔位
            const headerHeightContainer = headerHeightSlider.closest('.slider-control');
            if (headerHeightContainer) {
                const headerHeightMarks = headerHeightContainer.querySelectorAll('.slider-marks span');
                headerHeightMarks.forEach(mark => {
                    mark.addEventListener('click', () => {
                        const value = parseInt(mark.getAttribute('data-value'));
                        headerHeightSlider.value = value;
                        headerHeightValue.textContent = value + 'px';
                        settings.headerHeight = value;
                        saveSettings(settings);
                        
                        // 只更新 header 高度，不調用完整的 applySettings
                        const header = document.querySelector('header');
                        if (header) {
                            header.style.height = value + 'px';
                            document.documentElement.style.setProperty('--header-height', value + 'px');
                            
                            if (settings.headerFixed) {
                                document.body.style.paddingTop = value + 'px';
                            }
                        }
                    });
                });
            }
        }

        // 側邊欄文字顯示切換
        const sideNavTextToggle = document.getElementById('sideNavTextVisible');
        if (sideNavTextToggle) {
            sideNavTextToggle.classList.toggle('active', settings.sideNavTextVisible);
            sideNavTextToggle.addEventListener('click', () => {
                settings.sideNavTextVisible = !settings.sideNavTextVisible;
                sideNavTextToggle.classList.toggle('active', settings.sideNavTextVisible);
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
     * 初始化導航搜尋功能
     */
    initNavSearch() {
        const searchInput = document.getElementById('navSearch');
        const searchBtn = document.querySelector('.search-btn');
        const navLinks = document.querySelector('.nav-links');

        if (!searchInput || !navLinks) return;

        // 搜尋頁面連結
        const performSearch = () => {
            const query = searchInput.value.toLowerCase().trim();
            
            if (!query) {
                // 如果搜尋框為空，顯示所有連結
                navLinks.querySelectorAll('li a, .social-link').forEach(link => {
                    link.parentElement.style.display = '';
                });
                return;
            }

            navLinks.querySelectorAll('li a, .social-link').forEach(link => {
                const text = link.textContent.toLowerCase();
                const href = link.href.toLowerCase();
                
                if (text.includes(query) || href.includes(query)) {
                    link.parentElement.style.display = '';
                } else {
                    link.parentElement.style.display = 'none';
                }
            });
        };

        // 輸入時搜尋
        searchInput.addEventListener('input', Core.debounce(performSearch, 200));

        // 按下 Enter 鍵搜尋
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });

        // 搜尋按鈕點擊
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }

        // 清空搜尋框時恢復全部連結
        searchInput.addEventListener('focus', () => {
            if (searchInput.value === '') {
                performSearch();
            }
        });
    },

    /**
     * 初始化 FPS 監控
     * 即時監控並顯示頁面幀率
     */
    initFPSMonitor() {
        const fpsValueElement = document.getElementById('fpsValue');
        if (!fpsValueElement) return;

        let lastTime = performance.now();
        let frameCount = 0;
        let fps = 60;

        const updateFPS = (currentTime) => {
            frameCount++;
            
            // 每秒更新一次 FPS 顯示
            if (currentTime >= lastTime + 1000) {
                fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                frameCount = 0;
                lastTime = currentTime;

                // 更新顯示 - 固定為 3 位數格式
                fpsValueElement.textContent = fps.toString().padStart(3, '0');

                // 根據 FPS 設置顏色類別
                fpsValueElement.classList.remove('fps-excellent', 'fps-good', 'fps-moderate', 'fps-poor');
                
                if (fps >= 55) {
                    fpsValueElement.classList.add('fps-excellent');
                } else if (fps >= 45) {
                    fpsValueElement.classList.add('fps-good');
                } else if (fps >= 30) {
                    fpsValueElement.classList.add('fps-moderate');
                } else {
                    fpsValueElement.classList.add('fps-poor');
                }
            }

            requestAnimationFrame(updateFPS);
        };

        // 啟動 FPS 監控
        requestAnimationFrame(updateFPS);
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
        this.initNavSearch(); // 初始化搜尋功能
        this.initFPSMonitor(); // 初始化 FPS 監控
    }
};

// 導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
}
