/* nx-reskinned: colours moved into the site palette by tools/reskin-games.mjs */
/* ========== 賽博左側欄與系統設定對接控制 (Sidebar & Settings Controller) ========== */

(function () {
    function getStoredCollapsed() {
        const sc = localStorage.getItem('sidebarCollapsed');
        if (sc !== null) return sc === 'true';
        const gsc = localStorage.getItem('gcSidebarCollapsed');
        if (gsc !== null) return gsc === 'true';
        return true; // 預設摺疊 (Default collapsed)
    }

    let isCollapsed = getStoredCollapsed();
    let isHidden = false;

    // 快速在 DOM 可用時套用狀態，避免展開時出現跳閃
    const earlySidebar = document.getElementById('gcSidebar');
    if (earlySidebar) {
        earlySidebar.classList.toggle('collapsed', isCollapsed);
    }

    function initSidebarControls() {
        const sidebar = document.getElementById('gcSidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const hideSidebarBtn = document.getElementById('hideSidebarBtn');
        const fpsOSDToggle = document.getElementById('fpsOSDToggle');
        const gcBackBtn = document.getElementById('gcBackBtn');

        // 讀取並恢復 localStorage 使用者記憶設定
        const savedShowSidebar = localStorage.getItem('showSidebar');
        isCollapsed = getStoredCollapsed();

        if (savedShowSidebar === 'false') {
            setSidebarVisibility(false, false);
        } else {
            setSidebarVisibility(true, false);
        }

        // 立即套用摺疊/展開狀態
        setSidebarCollapse(isCollapsed, false);

        // 設定隱藏/顯示狀態
        function setSidebarVisibility(visible, save = true) {
            if (!sidebar) return;
            isHidden = !visible;
            sidebar.classList.toggle('hidden-sidebar', isHidden);
            if (save) {
                localStorage.setItem('showSidebar', visible ? 'true' : 'false');
            }
            const showSidebarToggle = document.getElementById('showSidebar');
            if (showSidebarToggle) {
                showSidebarToggle.classList.toggle('active', visible);
            }
            window.dispatchEvent(new CustomEvent('sidebarVisibilityChange', { detail: { visible: visible } }));
            window.dispatchEvent(new Event('resize'));
        }

        // 設定摺疊/展開狀態
        function setSidebarCollapse(collapsed, save = true) {
            if (!sidebar) return;
            isCollapsed = collapsed;
            sidebar.classList.toggle('collapsed', isCollapsed);
            
            if (sidebarToggle) {
                sidebarToggle.setAttribute('title', isCollapsed ? '展開側邊欄' : '摺疊側邊欄');
                const textEl = sidebarToggle.querySelector('.sidebar-text') || sidebarToggle.querySelector('span');
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
                    if (window.lucide && typeof window.lucide.createIcons === 'function') {
                        window.lucide.createIcons();
                    }
                }
            }

            if (save) {
                const val = isCollapsed ? 'true' : 'false';
                localStorage.setItem('sidebarCollapsed', val);
                localStorage.setItem('gcSidebarCollapsed', val);
            }

            // 派發通知讓遊戲主容器與 3D 渲染畫布即時重繪
            window.dispatchEvent(new CustomEvent('sidebarCollapseChange', { detail: { collapsed: isCollapsed } }));
            window.dispatchEvent(new Event('resize'));
        }

        function toggleCollapse() {
            setSidebarCollapse(!isCollapsed, true);
        }

        if (sidebarToggle) {
            sidebarToggle.onclick = (e) => {
                e.preventDefault();
                toggleCollapse();
            };
        }

        if (hideSidebarBtn) {
            hideSidebarBtn.onclick = (e) => {
                e.preventDefault();
                setSidebarVisibility(false, true);
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
                if (window.closeDetailView && typeof window.getCurrentGameCenterView === 'function' && window.getCurrentGameCenterView() === 'DETAIL') {
                    window.closeDetailView();
                } else if (window.location.pathname.includes('/games/')) {
                    sessionStorage.setItem('skipEntranceAnimation', 'true');
                    window.location.href = '../../game-center.html';
                } else {
                    sessionStorage.setItem('skipEntranceAnimation', 'true');
                    window.location.reload();
                }
            };
        }

        // 監聽來自 System Settings Panel 的 sidebarToggle 事件
        window.addEventListener('sidebarToggle', (e) => {
            if (e && e.detail && typeof e.detail.visible === 'boolean') {
                setSidebarVisibility(e.detail.visible, true);
            }
        });

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebarControls);
    } else {
        initSidebarControls();
    }
})();
