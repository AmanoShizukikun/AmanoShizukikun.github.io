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

        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });

        // 點擊選單項後關閉選單
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
            });
        });
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
     * 初始化所有導航功能
     */
    init() {
        this.initTopNav();
        this.initSideNav();
        this.initMobileMenu();
        this.initBackToTop();
        this.generateBreadcrumb();
    }
};

// 導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Navigation;
}
