/**
 * 動畫控制器 - 科幻中二風格增強版
 * 處理進入動畫、加載動畫、過場動畫等
 */

const Animations = {
    showEntryAnimation() {
        const loader = document.querySelector('.loader-container');
        if (!loader) return;
        const loadingBar = loader.querySelector('.loading-bar');
        if (loadingBar) {
            loadingBar.style.width = '0%';
            setTimeout(() => {
                loadingBar.style.width = '100%';
            }, 100);
        }
        setTimeout(() => {
            loader.classList.add('hidden');
            this.triggerPageEntrance();
            setTimeout(() => {
                loader.remove();
                // Notify that entry animations have completed so other modules (e.g., Live2D) can start safely
                try {
                    window.entryAnimationsCompleted = true;
                    window.dispatchEvent(new CustomEvent('animations:entryComplete'));
                } catch (e) {}
            }, 800);
        }, 2200);
    },

    /**
     * 頁面內容進場動畫
     * 防止重複觸發 - 只有當元素尚未動畫過時才觸發
     */
    triggerPageEntrance() {
        const fadeInElements = document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .scale-in');
        fadeInElements.forEach((el, index) => {
            // 檢查是否已經標記為已動畫過
            if (el.dataset.animated === 'true') {
                return;
            }
            
            // 標記為已動畫過
            el.dataset.animated = 'true';
        });
    },

    /**
     * 創建加載動畫 - 未來UI風格
     */
    createLoader() {
        const loader = document.createElement('div');
        loader.className = 'loader-container';
        
        // 創建數據塊
        const dataBlocks = Array(20).fill(0).map((_, i) => {
            const block = document.createElement('div');
            block.className = 'data-block';
            block.textContent = Math.random().toString(36).substring(2, 8).toUpperCase();
            block.style.left = Math.random() * 100 + '%';
            block.style.top = Math.random() * 100 + '%';
            block.style.animationDelay = Math.random() * 2 + 's';
            block.style.animationDuration = (2 + Math.random() * 2) + 's';
            return block;
        });
        
        loader.innerHTML = `
            <div class="loader-logo" data-text="CYBER NEXUS">CYBER NEXUS</div>
            <div class="loader-subtitle">[ INITIALIZING SYSTEM ]</div>
            <div class="scan-frame"></div>
            <div class="loading-bar-container">
                <div class="loading-bar"></div>
            </div>
            <div class="loading-text">系統初始化中...</div>
            <div class="data-stream">
                ${Array(8).fill(0).map((_, i) => 
                    `<div class="data-line" style="top: ${i * 12.5}%; animation-delay: ${i * 0.2}s;"></div>`
                ).join('')}
            </div>
        `;
        
        // 添加數據塊
        dataBlocks.forEach(block => loader.appendChild(block));
        
        document.body.insertBefore(loader, document.body.firstChild);
        return loader;
    },

    /**
     * 櫻花特效（為長門櫻計畫）
     */
    createSakuraEffect(duration = 5000) {
        const sakuraCount = 25;
        
        for (let i = 0; i < sakuraCount; i++) {
            const sakura = document.createElement('div');
            sakura.innerHTML = '🌸';
            sakura.style.cssText = `
                position: fixed;
                font-size: ${Math.random() * 20 + 10}px;
                left: ${Math.random() * window.innerWidth}px;
                top: -50px;
                pointer-events: none;
                z-index: 9999;
                animation: sakuraFall ${Math.random() * 3 + 2}s linear forwards;
            `;
            
            document.body.appendChild(sakura);
            
            setTimeout(() => {
                sakura.remove();
            }, 5000);
        }
    },

    /**
     * 故障效果 - 增強版
     */
    glitchEffect(element, duration = 1000) {
        if (!element) return;

        const text = element.textContent;
        element.setAttribute('data-text', text);
        element.classList.add('glitch-effect');

        setTimeout(() => {
            element.classList.remove('glitch-effect');
            element.removeAttribute('data-text');
        }, duration);
    },

    /**
     * 卡片懸浮動畫
     */
    initCardAnimations() {
        const cards = document.querySelectorAll('.card, .project-card');
        
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-12px) scale(1.03)';
                this.style.boxShadow = `0 20px 40px rgba(0, 212, 255, 0.3)`;
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = '';
            });
        });
    },

    /**
     * 文字顯示動畫
     */
    animateText(element, delay = 0) {
        if (!element) return;

        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';

        setTimeout(() => {
            element.style.transition = 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, delay);
    },

    /**
     * 批量動畫元素
     */
    staggerAnimation(selector, delayIncrement = 100) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, index) => {
            this.animateText(el, index * delayIncrement);
        });
    },

    /**
     * 掃描線效果
     */
    addScanLine(container) {
        if (!container) return;
        const scanLine = document.createElement('div');
        scanLine.className = 'scan-line';
        container.style.position = 'relative';
        container.appendChild(scanLine);
    },

    /**
     * 數據流效果
     */
    createDataStream(container, lineCount = 5) {
        if (!container) return;

        const stream = document.createElement('div');
        stream.className = 'data-stream';
        
        for (let i = 0; i < lineCount; i++) {
            const line = document.createElement('div');
            line.className = 'data-line';
            line.style.top = `${i * 20}%`;
            line.style.animationDelay = `${i * 0.3}s`;
            stream.appendChild(line);
        }
        
        container.appendChild(stream);
    },

    /**
     * 脈衝動畫
     */
    pulseElement(element, duration = 1000) {
        if (!element) return;

        element.style.animation = `pulse ${duration}ms ease-in-out`;
        
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    },



    /**
     * 初始化所有動畫
     */
    init() {
        const showLoader = sessionStorage.getItem('loaderShown') !== 'true';
        if (showLoader) {
            this.createLoader();
            this.showEntryAnimation();
            sessionStorage.setItem('loaderShown', 'true');
        }
        this.initCardAnimations();
        // 初始化 hero 的打字機效果（如果存在）
        try {
            const subtitleEl = document.querySelector('.hero-subtitle .typewriter-text');
            if (subtitleEl) {
                const parent = subtitleEl.closest('.hero-subtitle');
                const text = subtitleEl.dataset.text || subtitleEl.textContent || '';
                // 確保父元素有 typing 樣式以觸發淡入
                if (parent) parent.classList.add('typing');
                // 使用 Core.typewriter（存在於 core.js）逐字打字
                if (typeof Core !== 'undefined' && typeof Core.typewriter === 'function') {
                    Core.typewriter(subtitleEl, text, 100);
                } else {
                    // fallback 簡單實作
                    let i = 0;
                    subtitleEl.textContent = '';
                    const t = setInterval(() => {
                        if (i < text.length) {
                            subtitleEl.textContent += text.charAt(i);
                            i++;
                        } else {
                            clearInterval(t);
                        }
                    }, 50);
                }

                // 偵測何時文字已全部顯示，然後在一段延遲後隱藏游標
                (function waitForCompletion(el, expectedText) {
                    const pollInterval = 60; // ms
                    const hideDelay = 2000; // 在全部字顯示後再等待多少 ms 再隱藏游標
                    let poll = setInterval(() => {
                        try {
                            if (el.textContent.length >= expectedText.length) {

                                clearInterval(poll);
                                // 等待一段時間再切換狀態，讓使用者看到完成狀態
                                setTimeout(() => {
                                    if (parent) {
                                        parent.classList.add('typed');
                                    }
                                }, hideDelay);
                            }
                        } catch (e) {
                            clearInterval(poll);
                        }
                    }, pollInterval);
                })(subtitleEl, text);
            }
        } catch (e) {
            console.error('Typewriter init error:', e);
        }

        // 如果啟動時已經跳過 loader（例如 sessionStorage 已標記），則發出 entry 完成事件
        if (!showLoader) {
            setTimeout(() => {
                try {
                    window.entryAnimationsCompleted = true;
                    window.dispatchEvent(new CustomEvent('animations:entryComplete'));
                } catch (e) {}
            }, 0);
        }
    }
};

// 導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Animations;
}
