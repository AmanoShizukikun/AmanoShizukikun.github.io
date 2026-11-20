/* ========== 整版進入動畫 ========== */

(function () {
    // 建立矩陣雨 (使用 DocumentFragment 批量注入)
    function createMatrixRain() {
        const matrixContainer = document.getElementById('entranceMatrix');
        if (!matrixContainer) return;
        matrixContainer.innerHTML = '';

        const fragment = document.createDocumentFragment();
        const chars = '01';
        const columnSpacing = 120;
        const columns = Math.floor(window.innerWidth / columnSpacing);

        for (let i = 0; i < columns; i++) {
            const column = document.createElement('div');
            column.className = 'matrix-column';
            column.style.left = `${i * columnSpacing + (Math.random() * 20 - 10)}px`;
            column.style.animationDuration = `${Math.random() * 3 + 2.5}s`;
            column.style.animationDelay = `${Math.random() * 2}s`;
            column.style.opacity = `${0.3 + Math.random() * 0.4}`;
            
            let text = '';
            const length = Math.floor(Math.random() * 16) + 8;
            for (let j = 0; j < length; j++) {
                text += chars[Math.floor(Math.random() * chars.length)] + '<br>';
            }
            column.innerHTML = text;
            fragment.appendChild(column);
        }
        matrixContainer.appendChild(fragment);
    }

    // 創建六邊形網格 (還原完整蜂巢幾何陣列 + 使用 DocumentFragment 批量注入)
    function createHexagons() {
        const hexContainer = document.getElementById('entranceHexagons');
        if (!hexContainer) return;
        hexContainer.innerHTML = '';

        const fragment = document.createDocumentFragment();
        const hexWidth = 120;
        const hexHeight = 104;
        const horizontalSpacing = hexWidth * 0.75;
        const verticalSpacing = hexHeight;
        const hexRows = Math.ceil(window.innerHeight / verticalSpacing) + 2;
        const hexCols = Math.ceil(window.innerWidth / horizontalSpacing) + 3;

        for (let row = 0; row < hexRows; row++) {
            for (let col = 0; col < hexCols; col++) {
                const hex = document.createElement('div');
                hex.className = 'hexagon';
                const offsetY = (col % 2) * (hexHeight / 2);
                const left = col * horizontalSpacing - 30;
                const top = row * verticalSpacing + offsetY - hexHeight;
                hex.style.left = `${left}px`;
                hex.style.top = `${top}px`;
                hex.style.animationDelay = `${Math.random() * 3}s`;
                fragment.appendChild(hex);
            }
        }
        hexContainer.appendChild(fragment);
    }

    // 創建粒子爆發效果 (使用 DocumentFragment 批量注入)
    function createParticleBurst() {
        const particlesContainer = document.getElementById('entranceParticles');
        if (!particlesContainer) return;
        particlesContainer.innerHTML = '';

        const fragment = document.createDocumentFragment();
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const particleCount = 32;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'entrance-particle';
            const angle = (Math.PI * 2 * i) / particleCount;
            const distance = 180 + Math.random() * 240;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            particle.style.left = `${centerX}px`;
            particle.style.top = `${centerY}px`;
            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);
            particle.style.animationDelay = `${Math.random() * 0.3}s`;
            
            if (Math.random() > 0.5) {
                particle.style.background = 'rgba(255, 0, 255, 0.8)';
            }
            
            fragment.appendChild(particle);
        }
        particlesContainer.appendChild(fragment);
    }

    // 整版進入動畫控制
    function playEntranceAnimation() {
        const overlay = document.getElementById('entranceOverlay');
        const mainContainer = document.querySelector('.game-center-container');

        // 檢查是否跳過進入動畫
        const skipAnimation = sessionStorage.getItem('skipEntranceAnimation');
        const showSetting = localStorage.getItem('showEntranceAnimation');
        const hasSkipClass = document.documentElement.classList.contains('skip-entrance-anim');

        if (skipAnimation === 'true' || showSetting === 'false' || hasSkipClass) {
            sessionStorage.removeItem('skipEntranceAnimation');
            document.documentElement.classList.add('skip-entrance-anim');
            if (overlay) {
                overlay.style.display = 'none';
                overlay.style.opacity = '0';
            }
            if (mainContainer) {
                mainContainer.classList.add('gc-revealed');
            }
            document.documentElement.classList.remove('no-scroll');
            window.entryAnimationsCompleted = true;
            try { window.dispatchEvent(new CustomEvent('animations:entryComplete')); } catch (e) {}
            return;
        }

        if (!overlay) {
            window.entryAnimationsCompleted = true;
            if (mainContainer) mainContainer.classList.add('gc-revealed');
            try { window.dispatchEvent(new CustomEvent('animations:entryComplete')); } catch (e) {}
            return;
        }

        // 隱藏頁面滾動條
        document.documentElement.classList.add('no-scroll');

        // 生成 CG 視覺特效
        createMatrixRain();
        createHexagons();
        createParticleBurst();

        // 漸隱透明度過渡
        setTimeout(() => {
            overlay.classList.add('gc-fade-out');
            if (mainContainer) {
                mainContainer.classList.remove('gc-pre-entrance');
                mainContainer.classList.add('gc-revealed');
            }

            // 恢復頁面滾動條與通知
            document.documentElement.classList.remove('no-scroll');
            window.entryAnimationsCompleted = true;
            try { window.dispatchEvent(new CustomEvent('animations:entryComplete')); } catch (e) {}
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 1500);
        }, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', playEntranceAnimation);
    } else {
        playEntranceAnimation();
    }
})();
