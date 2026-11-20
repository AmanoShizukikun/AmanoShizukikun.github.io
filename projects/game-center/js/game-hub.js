/* ========== 遊戲中心 UI 控制邏輯 (Game Hub Core Controller) ========== */

let currentView = 'LIBRARY'; // 'LIBRARY' | 'DETAIL'
let focusArea = 'GRID'; // 'HERO' | 'GRID'
let heroFeaturedIndex = 0;
let currentFocusedCardIndex = 0;
let isHeroPaused = false;
let activeModal = null; // 'sort' | 'filter' | 'media-preview'
let modalFocusedIndex = 0;
let selectedGameObj = null;
let currentMediaIndex = 0;
let currentInputMode = 'KEYBOARD'; // 'KEYBOARD' | 'GAMEPAD'

let currentFilterGroupKey = 'GENRE';
let currentCategoryIndex = 0;
let currentCategoryTabs = ['ALL', 'FAVORITE', 'RAC', 'ACT', 'RPG', 'TAC', 'MUS'];
let filteredGames = [];
let currentSort = 'recent';
let currentSortLabel = '最近遊玩';

const filterGroups = {
    GENRE: { label: '遊戲類型', tabs: ['ALL', 'RAC', 'ACT', 'RPG', 'TAC', 'MUS'] },
    HARDWARE: { label: '硬體支援', tabs: ['ALL', 'FULL_GAMEPAD', 'KEYBOARD_MOUSE'] },
    FAVORITE: { label: '我的最愛', tabs: ['FAVORITE', 'ALL'] }
};

const sortOptionsList = [
    { id: 'recent', label: '最近遊玩' },
    { id: 'playtime', label: '遊玩時間' },
    { id: 'name', label: '遊戲名稱' }
];

function getDisplayLabel(val) {
    const labels = {
        ALL: '全部', FAVORITE: '最愛', RAC: '競速', ACT: '動作',
        RPG: '扮演', TAC: '戰略', MUS: '音樂',
        FULL_GAMEPAD: '手把', KEYBOARD_MOUSE: '鍵鼠'
    };
    return labels[val] || val;
}

function updateHeroProgressState() {
    const isPaused = isHeroPaused || focusArea === 'HERO';
    const activeBar = document.getElementById('hero-progress-bar');
    if (activeBar) {
        if (isPaused) {
            activeBar.classList.add('paused');
        } else {
            activeBar.classList.remove('paused');
        }
    }
}

function pauseHeroAuto() {
    isHeroPaused = true;
    updateHeroProgressState();
}
window.pauseHeroAuto = pauseHeroAuto;

function setHeroFocus() {
    isHeroPaused = true;
    focusArea = 'HERO';
    updateHeroFocusBorder();
}
window.setHeroFocus = setHeroFocus;

function resumeHeroAuto() {
    isHeroPaused = false;
    updateHeroProgressState();
}
window.resumeHeroAuto = resumeHeroAuto;

function startHeroAuto() {
    renderHeroBanner();
}
window.startHeroAuto = startHeroAuto;

function handleHeroProgressEnd() {
    if (isHeroPaused || focusArea === 'HERO' || !gamesData || gamesData.length === 0) return;
    heroFeaturedIndex = (heroFeaturedIndex + 1) % gamesData.length;
    renderHeroBanner();
}
window.handleHeroProgressEnd = handleHeroProgressEnd;

function renderHeroBanner() {
    if (!gamesData || gamesData.length === 0) return;
    const hero = gamesData[heroFeaturedIndex];
    if (!hero) return;

    const heroImg = document.getElementById('hero-img');
    const heroTitle = document.getElementById('hero-title');
    const heroDesc = document.getElementById('hero-desc');

    if (heroImg && heroTitle && heroDesc) {
        heroImg.classList.add('opacity-0');
        heroTitle.classList.add('opacity-0');
        heroDesc.classList.add('opacity-0');

        setTimeout(() => {
            heroImg.src = hero.banner;
            heroTitle.innerText = hero.title;
            heroDesc.innerText = hero.desc;
            heroImg.classList.remove('opacity-0');
            heroTitle.classList.remove('opacity-0');
            heroDesc.classList.remove('opacity-0');
        }, 120);
    }

    updateHeroFocusBorder();
    renderHeroIndicators();

    if (window.lucide) lucide.createIcons();
}

function updateHeroFocusBorder() {
    const borderEl = document.getElementById('hero-focus-border');
    const heroBanner = document.getElementById('hero-banner');

    if (focusArea === 'HERO') {
        document.querySelectorAll('.game-card-focus').forEach(c => {
            c.classList.remove('game-card-focus', 'border-cyan-400', 'z-20');
            c.classList.add('border-slate-800/80');
        });
        if (heroBanner) heroBanner.classList.add('hero-banner-focus');
        if (borderEl) {
            borderEl.className = 'absolute inset-0 z-10 pointer-events-none border-2 border-cyan-400 rounded-xl clip-corner-lg shadow-[inset_0_0_20px_rgba(0,240,255,0.25)]';
        }
    } else {
        if (heroBanner) heroBanner.classList.remove('hero-banner-focus');
        if (borderEl) {
            borderEl.className = 'absolute inset-0 z-10 pointer-events-none border-2 border-transparent transition-all duration-300 rounded-xl clip-corner-lg';
        }
    }
    updateHeroProgressState();
}

function renderHeroIndicators() {
    const indContainer = document.getElementById('hero-indicators');
    if (!indContainer || !gamesData) return;

    const isPaused = isHeroPaused || focusArea === 'HERO';

    indContainer.innerHTML = gamesData.map((g, idx) => {
        const isActive = idx === heroFeaturedIndex;
        if (isActive) {
            return `
                <button onclick="selectHeroItem(event, ${idx})" class="w-8 sm:w-12 h-1.5 sm:h-2 rounded-full bg-slate-900/90 border border-cyan-400/60 overflow-hidden relative shadow-md shadow-cyan-500/30 cursor-pointer group">
                    <div id="hero-progress-bar" onanimationend="handleHeroProgressEnd()" class="hero-progress-bar absolute inset-y-0 left-0 bg-cyan-400 rounded-full ${isPaused ? 'paused' : ''}"></div>
                </button>
            `;
        } else {
            return `
                <button onclick="selectHeroItem(event, ${idx})" class="w-8 sm:w-12 h-1.5 sm:h-2 rounded-full bg-slate-900/90 border border-slate-700/60 overflow-hidden relative cursor-pointer group hover:border-slate-500">
                    <div class="absolute inset-y-0 left-0 bg-slate-700/50 rounded-full w-0"></div>
                </button>
            `;
        }
    }).join('');

    requestAnimationFrame(() => {
        const bar = document.getElementById('hero-progress-bar');
        if (bar) {
            bar.classList.add('animate');
        }
    });
}

function selectHeroItem(event, idx) {
    if (event) event.stopPropagation();
    heroFeaturedIndex = idx;
    renderHeroBanner();
    scrollToFocusedElement();
    playSound('nav');
}

function launchGameFromHero(event) {
    if (event) event.stopPropagation();
    const hero = gamesData[heroFeaturedIndex];
    if (hero) openGameDetailByObj(hero);
}

function launchHeroDirect(event) {
    if (event) event.stopPropagation();
    const hero = gamesData[heroFeaturedIndex];
    if (hero) launchGame(hero);
}
window.launchHeroDirect = launchHeroDirect;

function renderCategoryTabs() {
    const container = document.getElementById('category-container');
    if (!container) return;
    container.innerHTML = currentCategoryTabs.map((tab, idx) => {
        const isActive = idx === currentCategoryIndex;
        return `
            <button onclick="selectCategory(${idx})" class="px-3 py-1 text-xs rounded transition flex-none flex items-center space-x-1 ${isActive ? 'bg-cyan-400 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}">
                <span>${getDisplayLabel(tab)}</span>
            </button>
        `;
    }).join('');
    scrollActiveTabIntoView();
}

function scrollActiveTabIntoView() {
    const container = document.getElementById('category-container');
    if (!container) return;
    const activeTab = container.children[currentCategoryIndex];
    if (activeTab) {
        const tabOffsetLeft = activeTab.offsetLeft;
        const tabWidth = activeTab.offsetWidth;
        const containerWidth = container.clientWidth;
        const targetScrollLeft = tabOffsetLeft - (containerWidth / 2) + (tabWidth / 2);
        container.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
        });
    }
}

function selectCategory(target) {
    if (typeof target === 'string') {
        let idx = currentCategoryTabs.indexOf(target);
        if (idx === -1) {
            currentCategoryTabs.push(target);
            idx = currentCategoryTabs.length - 1;
        }
        currentCategoryIndex = idx;
    } else {
        const total = currentCategoryTabs.length;
        currentCategoryIndex = (target + total) % total;
    }
    renderCategoryTabs();
    applyCurrentFilters();
    playSound('nav');
}

function filterByTag(tagName) {
    if (!tagName) return;
    if (currentView === 'DETAIL') closeDetailView();
    currentFilterGroupKey = 'GENRE';
    currentCategoryTabs = filterGroups.GENRE.tabs;
    selectCategory(tagName);
    showToast('標籤篩選', `# ${getDisplayLabel(tagName)}`);
}

function applyCurrentFilters() {
    const selectedTab = currentCategoryTabs[currentCategoryIndex];

    filteredGames = gamesData.filter(game => {
        if (currentFilterGroupKey === 'GENRE') {
            if (selectedTab === 'ALL') return true;
            if (selectedTab === 'FAVORITE') return game.isFavorite;
            return game.category === selectedTab || (game.tags && game.tags.includes(selectedTab));
        }
        if (currentFilterGroupKey === 'HARDWARE') return selectedTab === 'ALL' || game.inputSupport === selectedTab;
        if (currentFilterGroupKey === 'FAVORITE') return selectedTab === 'ALL' || game.isFavorite;
        return true;
    });

    if (currentSort === 'name') {
        filteredGames.sort((a, b) => a.title.localeCompare(b.title, 'zh-TW'));
    } else if (currentSort === 'playtime') {
        filteredGames.sort((a, b) => (parseInt(b.playtime) || 0) - (parseInt(a.playtime) || 0));
    } else {
        filteredGames.sort((a, b) => {
            const timeA = typeof a.lastPlayed === 'number' ? a.lastPlayed : (a.lastPlayed ? new Date(a.lastPlayed).getTime() || 0 : 0);
            const timeB = typeof b.lastPlayed === 'number' ? b.lastPlayed : (b.lastPlayed ? new Date(b.lastPlayed).getTime() || 0 : 0);
            return timeB - timeA;
        });
    }

    const countEl = document.getElementById('game-count');
    if (countEl) countEl.innerText = `${filteredGames.length} ITEMS`;

    if (currentFocusedCardIndex >= filteredGames.length) {
        currentFocusedCardIndex = Math.max(0, filteredGames.length - 1);
    }
    renderGameGrid();
    scrollToFocusedElement();
}

function renderGameGrid() {
    const gridContainer = document.getElementById('game-grid');
    if (!gridContainer) return;

    if (filteredGames.length === 0) {
        gridContainer.innerHTML = `
            <div class="col-span-full py-16 text-center font-tech text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
                <p>未找到符合條件的遊戲</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    gridContainer.innerHTML = filteredGames.map((game, idx) => {
        const isFocused = focusArea === 'GRID' && idx === currentFocusedCardIndex;
        return `
            <div id="game-card-${idx}" onclick="selectGridCard(${idx})" onmouseenter="focusCardHover(${idx})" tabindex="0" class="group relative rounded-xl overflow-hidden border bg-slate-900/60 transition-all duration-300 cursor-pointer h-36 sm:h-48 flex flex-col justify-end clip-corner ${isFocused ? 'game-card-focus border-cyan-400 z-20' : 'border-slate-800/80 hover:border-slate-700'}">
                <img src="${game.capsule || game.banner}" alt="${game.title}" class="absolute inset-0 w-full h-full object-cover object-center opacity-60 transition duration-500 group-hover:scale-105 group-hover:opacity-80">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                <div class="card-border-glow absolute inset-0 border border-cyan-400/15 rounded-xl opacity-0 pointer-events-none transition-opacity duration-200"></div>
                <div class="tech-bracket opacity-0 transition-opacity duration-200 pointer-events-none absolute inset-0 border-2 border-cyan-400 rounded-xl">
                    <div class="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-white"></div>
                    <div class="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-white"></div>
                </div>
                <button data-heart-id="${game.id}" onclick="toggleGameFavorite(event, '${game.id}')" ontouchstart="event.stopPropagation()" title="${game.isFavorite ? '從最愛移除' : '加入最愛'}" class="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-30 transition-all duration-200 cursor-pointer p-1 ${game.isFavorite ? 'text-rose-500 drop-shadow-md scale-100' : 'text-slate-400 hover:text-rose-400 opacity-60 group-hover:opacity-100 hover:scale-110'}">
                    <i data-lucide="heart" class="w-4 h-4 sm:w-5 sm:h-5 ${game.isFavorite ? 'fill-current' : ''}"></i>
                </button>
                <div class="relative z-10 p-2.5 sm:p-4 space-y-0.5 sm:space-y-1">
                    <h4 class="font-tech text-xs sm:text-base font-bold text-white tracking-wide truncate group-hover:text-cyan-400 transition">${game.title}</h4>
                    <div class="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400">
                        <span>${game.publisher}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function focusCardHover(index) {
    if (currentView !== 'LIBRARY' || activeModal) return;
    setFocusedCardIndex(index, true);
}

function selectGridCard(idx) {
    focusArea = 'GRID';
    setFocusedCardIndex(idx, true);
    openGameDetailByObj(idx);
}

function setFocusedCardIndex(nextIndex, shouldScroll) {
    const previousIndex = currentFocusedCardIndex;
    currentFocusedCardIndex = nextIndex;
    focusArea = 'GRID';

    const previousCard = document.getElementById(`game-card-${previousIndex}`);
    if (previousCard) {
        previousCard.classList.remove('game-card-focus', 'border-cyan-400', 'z-20');
        previousCard.classList.add('border-slate-800/80');
    }

    const nextCard = document.getElementById(`game-card-${currentFocusedCardIndex}`);
    if (nextCard) {
        nextCard.classList.add('game-card-focus', 'border-cyan-400', 'z-20');
        nextCard.classList.remove('border-slate-800/80');
    }

    updateHeroFocusBorder();
    if (shouldScroll) scrollToFocusedElement();
}

function navigateGrid(direction) {
    const total = filteredGames.length;
    const cols = 4;

    if (focusArea === 'HERO') {
        if (direction === 'DOWN') {
            focusArea = 'GRID';
            setFocusedCardIndex(0, true);
            playSound('nav');
        } else if (direction === 'LEFT') {
            heroFeaturedIndex = (heroFeaturedIndex - 1 + gamesData.length) % gamesData.length;
            renderHeroBanner();
            playSound('nav');
        } else if (direction === 'RIGHT') {
            heroFeaturedIndex = (heroFeaturedIndex + 1) % gamesData.length;
            renderHeroBanner();
            playSound('nav');
        }
        return;
    }

    if (direction === 'UP') {
        if (currentFocusedCardIndex < cols) {
            focusArea = 'HERO';
            updateHeroFocusBorder();
            scrollToFocusedElement();
            playSound('nav');
        } else {
            setFocusedCardIndex(currentFocusedCardIndex - cols, true);
            playSound('nav');
        }
    } else if (direction === 'DOWN') {
        if (currentFocusedCardIndex + cols < total) {
            setFocusedCardIndex(currentFocusedCardIndex + cols, true);
            playSound('nav');
        }
    } else if (direction === 'LEFT') {
        if (currentFocusedCardIndex > 0) {
            setFocusedCardIndex(currentFocusedCardIndex - 1, true);
            playSound('nav');
        }
    } else if (direction === 'RIGHT') {
        if (currentFocusedCardIndex < total - 1) {
            setFocusedCardIndex(currentFocusedCardIndex + 1, true);
            playSound('nav');
        }
    }
}

function openGameDetailByObj(gameOrIndex) {
    const game = typeof gameOrIndex === 'number' ? filteredGames[gameOrIndex] : gameOrIndex;
    if (!game) return;

    selectedGameObj = game;
    currentView = 'DETAIL';
    currentMediaIndex = 0;

    const coverImg = document.getElementById('detail-cover-img');
    if (coverImg) coverImg.src = game.banner;
    const titleEl = document.getElementById('detail-title');
    if (titleEl) titleEl.innerText = game.title;
    const descEl = document.getElementById('detail-desc');
    if (descEl) descEl.innerText = game.desc;
    const pubEl = document.getElementById('detail-publisher');
    if (pubEl) pubEl.innerText = game.publisher;
    const inputEl = document.getElementById('detail-input');
    if (inputEl) inputEl.innerText = getDisplayLabel(game.inputSupport);
    const dateEl = document.getElementById('detail-release-date');
    if (dateEl) dateEl.innerText = game.releaseDate || 'TBA';
    const devEl = document.getElementById('detail-developer');
    if (devEl) devEl.innerText = game.developer || game.publisher || 'UNKNOWN';

    const tagsContainer = document.getElementById('detail-tags-container');
    if (tagsContainer) {
        tagsContainer.innerHTML = (game.tags || ['二次元', '動作', '冒險']).map(tag => `
            <button onclick="filterByTag('${tag}')" class="px-3 py-1 bg-slate-900/90 hover:bg-cyan-400/15 text-slate-300 hover:text-cyan-400 border border-slate-800 hover:border-cyan-400/50 rounded clip-corner transition cursor-pointer flex items-center space-x-1.5 group shadow-sm" title="點擊標籤依 #${tag} 篩選">
                <span class="text-cyan-400/60 group-hover:text-cyan-400 font-bold">#</span>
                <span>${tag}</span>
            </button>
        `).join('');
    }

    renderDetailMediaGallery();
    updateDetailFavoriteUI();

    const libView = document.getElementById('library-view');
    const detView = document.getElementById('detail-view');
    if (libView && detView) {
        libView.classList.add('opacity-0');
        setTimeout(() => {
            libView.classList.add('hidden');
            detView.classList.remove('hidden');
            requestAnimationFrame(() => detView.classList.remove('opacity-0'));
        }, 150);
    }

    updateFooterHintsUI();
    playSound('confirm');
}

function closeDetailView() {
    if (currentView !== 'DETAIL') return;
    currentView = 'LIBRARY';
    const libView = document.getElementById('library-view');
    const detView = document.getElementById('detail-view');

    if (detView && libView) {
        detView.classList.add('opacity-0');
        setTimeout(() => {
            detView.classList.add('hidden');
            libView.classList.remove('hidden');
            requestAnimationFrame(() => {
                libView.classList.remove('opacity-0');
                scrollToFocusedElement();
            });
        }, 150);
    }

    updateFooterHintsUI();
    playSound('back');
}

function setInputMode(mode) {
    if (currentInputMode === mode) return;
    currentInputMode = mode;
    renderFooterHints();
}

function renderFooterHints() {
    const isGamepad = currentInputMode === 'GAMEPAD';
    const libHints = document.getElementById('footer-hints-library');
    const detHints = document.getElementById('footer-hints-detail');

    if (libHints) {
        if (isGamepad) {
            libHints.innerHTML = `
                <button onclick="handleGamepadA()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="確認/選擇">
                    <span class="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-400 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-slate-950 flex items-center justify-center font-bold text-[11px] transition">A</span>
                    <span>確認 / 選擇</span>
                </button>
                <button onclick="handleGamepadB()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="取消/返回">
                    <span class="w-5 h-5 rounded-full bg-rose-600/30 border border-rose-400 text-rose-300 group-hover:bg-rose-500 group-hover:text-white flex items-center justify-center font-bold text-[11px] transition">B</span>
                    <span>取消 / 返回</span>
                </button>
                <button onclick="toggleSortModal()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="開啟排序選項">
                    <span class="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-400 text-blue-300 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center font-bold text-[11px] transition">X</span>
                    <span>排序選項</span>
                </button>
                <button onclick="toggleFilterModal()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="開啟篩選選單">
                    <span class="w-5 h-5 rounded-full bg-amber-600/30 border border-amber-400 text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center font-bold text-[11px] transition">Y</span>
                    <span>篩選選單</span>
                </button>
                <div class="flex items-center space-x-1 text-slate-500">
                    <button onclick="selectCategory(currentCategoryIndex - 1)" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition cursor-pointer">LB</button>
                    <button onclick="selectCategory(currentCategoryIndex + 1)" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition cursor-pointer">RB</button>
                    <span class="ml-1">切換標籤</span>
                </div>
            `;
        } else {
            libHints.innerHTML = `
                <button onclick="handleGamepadA()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="確認/選擇">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-[10px] rounded group-hover:bg-cyan-950 group-hover:border-cyan-400 transition">↵ Enter</span>
                    <span>確認 / 選擇</span>
                </button>
                <button onclick="handleGamepadB()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="取消/返回">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-rose-300 font-mono text-[10px] rounded group-hover:bg-rose-950 group-hover:border-rose-400 transition">Esc</span>
                    <span>取消 / 返回</span>
                </button>
                <button onclick="toggleSortModal()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="開啟排序選項">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-blue-300 font-mono text-[10px] rounded group-hover:bg-blue-950 group-hover:border-blue-400 transition">X</span>
                    <span>排序選項</span>
                </button>
                <button onclick="toggleFilterModal()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="開啟篩選選單">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[10px] rounded group-hover:bg-amber-950 group-hover:border-amber-400 transition">Y</span>
                    <span>篩選選單</span>
                </button>
                <div class="flex items-center space-x-1 text-slate-500">
                    <button onclick="selectCategory(currentCategoryIndex - 1)" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition cursor-pointer">Q</button>
                    <button onclick="selectCategory(currentCategoryIndex + 1)" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition cursor-pointer">E</button>
                    <span class="ml-1">切換標籤</span>
                </div>
            `;
        }
    }

    if (detHints) {
        if (isGamepad) {
            detHints.innerHTML = `
                <button onclick="launchGame()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="啟動遊戲">
                    <span class="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-400 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-slate-950 flex items-center justify-center font-bold text-[11px] transition">A</span>
                    <span>啟動遊戲</span>
                </button>
                <button onclick="closeDetailView()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="返回遊戲庫">
                    <span class="w-5 h-5 rounded-full bg-rose-600/30 border border-rose-400 text-rose-300 group-hover:bg-rose-500 group-hover:text-white flex items-center justify-center font-bold text-[11px] transition">B</span>
                    <span>返回遊戲庫</span>
                </button>
                <button onclick="openMediaPreview()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="放大媒體預覽">
                    <span class="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-400 text-blue-300 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center font-bold text-[11px] transition">X</span>
                    <span>放大媒體</span>
                </button>
                <button onclick="toggleCurrentFavorite()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="切換最愛狀態">
                    <span class="w-5 h-5 rounded-full bg-amber-600/30 border border-amber-400 text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center font-bold text-[11px] transition">Y</span>
                    <span>切換最愛</span>
                </button>
            `;
        } else {
            detHints.innerHTML = `
                <button onclick="launchGame()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="啟動遊戲">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-[10px] rounded group-hover:bg-cyan-950 group-hover:border-cyan-400 transition">↵ Enter</span>
                    <span>啟動遊戲</span>
                </button>
                <button onclick="closeDetailView()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="返回遊戲庫">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-rose-300 font-mono text-[10px] rounded group-hover:bg-rose-950 group-hover:border-rose-400 transition">Esc</span>
                    <span>返回遊戲庫</span>
                </button>
                <button onclick="openMediaPreview()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="放大媒體預覽">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-blue-300 font-mono text-[10px] rounded group-hover:bg-blue-950 group-hover:border-blue-400 transition">X</span>
                    <span>放大媒體</span>
                </button>
                <button onclick="toggleCurrentFavorite()" class="flex items-center space-x-2 hover:text-white transition cursor-pointer group" title="切換最愛狀態">
                    <span class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[10px] rounded group-hover:bg-amber-950 group-hover:border-amber-400 transition">Y</span>
                    <span>切換最愛</span>
                </button>
            `;
        }
    }
}

window.addEventListener('mousemove', () => setInputMode('KEYBOARD'), { passive: true });
window.addEventListener('mousedown', () => setInputMode('KEYBOARD'), { passive: true });

function updateFooterHintsUI() {
    const libHints = document.getElementById('footer-hints-library');
    const detHints = document.getElementById('footer-hints-detail');
    if (!libHints || !detHints) return;

    if (currentView === 'DETAIL') {
        libHints.className = 'hidden items-center space-x-6';
        detHints.className = 'hidden md:flex items-center space-x-6';
    } else {
        detHints.className = 'hidden items-center space-x-6';
        libHints.className = 'hidden md:flex items-center space-x-6';
    }
}

window.getCurrentGameCenterView = function() {
    return currentView;
};

window.closeGameView = function() {
    if (currentView !== 'IN_GAME') return;
    currentView = 'LIBRARY';
    const gameView = document.getElementById('game-view');
    const libView = document.getElementById('library-view');
    const gameIframe = document.getElementById('game-iframe');
    const footer = document.querySelector('footer');

    if (gameIframe) {
        gameIframe.src = 'about:blank';
    }

    if (gameView && libView) {
        gameView.classList.add('opacity-0');
        setTimeout(() => {
            gameView.classList.add('hidden');
            libView.classList.remove('hidden');
            requestAnimationFrame(() => {
                libView.classList.remove('opacity-0');
                scrollToFocusedElement();
            });
        }, 150);
    }
    if (footer) footer.classList.remove('hidden');
    updateFooterHintsUI();
    resumeHeroAuto();
    playSound('back');
};

window.closeDetailView = closeDetailView;
window.launchGame = launchGame;

function launchGame(gameObj) {
    const targetGame = gameObj || selectedGameObj;
    if (!targetGame) return;
    if (targetGame.gameUrl) {
        showToast('啟動遊戲中', targetGame.title);
        playSound('confirm');
        pauseHeroAuto();

        // 直接進入獨立的遊戲頁面 .html
        setTimeout(() => {
            window.location.href = targetGame.gameUrl;
        }, 120);
    } else {
        showToast('遊戲建置中', '目前尚無可執行的遊戲連結');
    }
}

function renderDetailMediaGallery() {
    if (!selectedGameObj || !selectedGameObj.gallery || !selectedGameObj.gallery.length) return;
    const gallery = selectedGameObj.gallery.map((item) => typeof item === 'string' ? { type: 'image', src: item, thumb: item } : item);
    if (currentMediaIndex >= gallery.length) currentMediaIndex = 0;

    renderDetailMediaItem(gallery[currentMediaIndex]);

    const thumbsContainer = document.getElementById('detail-media-thumbnails');
    if (!thumbsContainer) return;
    thumbsContainer.innerHTML = gallery.map((item, idx) => {
        const isActive = idx === currentMediaIndex;
        const thumbSrc = item.thumb || item.src;
        return `
            <button onclick="selectDetailMedia(${idx})" class="flex-none w-24 h-16 sm:w-28 sm:h-20 rounded-lg overflow-hidden border-2 transition relative group cursor-pointer ${isActive ? 'border-cyan-400 shadow-md shadow-cyan-500/30 scale-105' : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'}">
                <img src="${thumbSrc}" alt="thumb-${idx}" class="w-full h-full object-cover">
                ${item.type === 'video' ? '<div class="absolute inset-0 flex items-center justify-center bg-slate-950/40"><i data-lucide="play-circle" class="w-6 h-6 text-cyan-400 drop-shadow"></i></div>' : ''}
            </button>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

function renderDetailMediaItem(item) {
    const mainContent = document.getElementById('detail-media-main-content');
    if (!mainContent || !item) return;

    if (item.type === 'video') {
        mainContent.innerHTML = `<video class="w-full h-full object-cover" src="${item.src}" autoplay muted loop playsinline controls></video>`;
    } else {
        mainContent.innerHTML = `<img src="${item.src}" alt="${item.title || 'Preview'}" class="w-full h-full object-cover transition duration-500">`;
    }
}

function selectDetailMedia(idx) {
    if (!selectedGameObj || !selectedGameObj.gallery) return;
    currentMediaIndex = idx;
    renderDetailMediaGallery();
    playSound('nav');
}

function navigateDetailMedia(direction) {
    if (!selectedGameObj || !selectedGameObj.gallery || !selectedGameObj.gallery.length) return;
    const total = selectedGameObj.gallery.length;
    currentMediaIndex = (currentMediaIndex + direction + total) % total;
    renderDetailMediaGallery();
    playSound('nav');
}

function toggleCurrentFavorite() {
    if (!selectedGameObj) return;
    selectedGameObj.isFavorite = !selectedGameObj.isFavorite;
    updateDetailFavoriteUI();
    const heartBtn = document.querySelector(`[data-heart-id="${selectedGameObj.id}"]`);
    if (heartBtn) {
        const icon = heartBtn.querySelector('i');
        if (selectedGameObj.isFavorite) {
            heartBtn.className = heartBtn.className.replace('text-slate-400 opacity-60', 'text-rose-500 drop-shadow-md scale-100');
            if (icon) icon.classList.add('fill-current');
        } else {
            heartBtn.className = heartBtn.className.replace('text-rose-500 drop-shadow-md scale-100', 'text-slate-400 opacity-60');
            if (icon) icon.classList.remove('fill-current');
        }
    }
    showToast(selectedGameObj.isFavorite ? '已加入最愛' : '已從最愛移除', selectedGameObj.title);
    playSound('confirm');
}

function toggleGameFavorite(event, gameId) {
    event.stopPropagation();
    const game = gamesData.find(g => g.id === gameId);
    if (!game) return;
    game.isFavorite = !game.isFavorite;
    renderGameGrid();
    showToast(game.isFavorite ? '已加入最愛' : '已從最愛移除', game.title);
    playSound('confirm');
}

function updateDetailFavoriteUI() {
    const btn = document.getElementById('detail-favorite-btn');
    const icon = document.getElementById('detail-favorite-icon');
    if (!btn || !icon || !selectedGameObj) return;

    if (selectedGameObj.isFavorite) {
        btn.setAttribute('title', '從最愛移除');
        btn.className = 'w-11 h-11 sm:w-12 sm:h-12 bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 rounded-xl border border-rose-500/50 flex items-center justify-center transition flex-shrink-0 cursor-pointer shadow-lg shadow-rose-500/20';
        icon.setAttribute('data-lucide', 'heart');
        icon.className = 'w-5 h-5 sm:w-6 sm:h-6 text-rose-500 fill-current';
    } else {
        btn.setAttribute('title', '加入最愛');
        btn.className = 'w-11 h-11 sm:w-12 sm:h-12 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl border border-slate-800 flex items-center justify-center transition flex-shrink-0 cursor-pointer';
        icon.setAttribute('data-lucide', 'heart');
        icon.className = 'w-5 h-5 sm:w-6 sm:h-6 text-slate-400';
    }
    if (window.lucide) lucide.createIcons();
}

function toggleSortModal() {
    if (document.activeElement) document.activeElement.blur();
    if (activeModal === 'sort') return closeModal();
    if (activeModal === 'filter') {
        const fm = document.getElementById('filter-modal');
        if (fm) fm.classList.add('opacity-0', 'pointer-events-none');
    }
    activeModal = 'sort';
    modalFocusedIndex = 0;
    renderSortModalOptions();
    const sm = document.getElementById('sort-modal');
    if (sm) sm.classList.remove('opacity-0', 'pointer-events-none');
    playSound('nav');
}

function toggleFilterModal() {
    if (document.activeElement) document.activeElement.blur();
    if (activeModal === 'filter') return closeModal();
    if (activeModal === 'sort') {
        const sm = document.getElementById('sort-modal');
        if (sm) sm.classList.add('opacity-0', 'pointer-events-none');
    }
    activeModal = 'filter';
    modalFocusedIndex = 0;
    renderFilterModalOptions();
    const fm = document.getElementById('filter-modal');
    if (fm) fm.classList.remove('opacity-0', 'pointer-events-none');
    playSound('nav');
}

function closeModal() {
    if (document.activeElement) document.activeElement.blur();
    activeModal = null;
    const sm = document.getElementById('sort-modal');
    if (sm) sm.classList.add('opacity-0', 'pointer-events-none');
    const fm = document.getElementById('filter-modal');
    if (fm) fm.classList.add('opacity-0', 'pointer-events-none');
    playSound('back');
}

function confirmModalSelection() {
    if (document.activeElement) document.activeElement.blur();
    if (activeModal === 'sort') selectSortOption(modalFocusedIndex);
    else if (activeModal === 'filter') selectFilterGroupOption(modalFocusedIndex);
}

function renderSortModalOptions() {
    const container = document.getElementById('sort-options');
    if (!container) return;
    container.innerHTML = sortOptionsList.map((opt, idx) => {
        const isFocused = idx === modalFocusedIndex;
        const isSelected = opt.id === currentSort;
        return `
            <div onclick="selectSortOption(${idx})" class="px-4 py-3 rounded-lg cursor-pointer border transition flex items-center justify-between ${isFocused ? 'bg-blue-950/80 border-blue-400 text-white shadow-lg' : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'}">
                <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full ${isSelected ? 'bg-blue-400' : 'bg-transparent'}"></span>
                    <span>${opt.label}</span>
                </div>
                ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-blue-400"></i>' : ''}
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

function renderFilterModalOptions() {
    const container = document.getElementById('filter-options');
    if (!container) return;
    const keys = Object.keys(filterGroups);
    container.innerHTML = keys.map((key, idx) => {
        const group = filterGroups[key];
        const isFocused = idx === modalFocusedIndex;
        const isSelected = key === currentFilterGroupKey;
        return `
            <div onclick="selectFilterGroupOption(${idx})" class="px-4 py-3 rounded-lg cursor-pointer border transition flex items-center justify-between ${isFocused ? 'bg-amber-950/80 border-amber-400 text-white shadow-lg' : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'}">
                <div class="flex items-center space-x-2">
                    <span class="w-2 h-2 rounded-full ${isSelected ? 'bg-amber-400' : 'bg-transparent'}"></span>
                    <span>${group.label}</span>
                </div>
                ${isSelected ? '<i data-lucide="check" class="w-4 h-4 text-amber-400"></i>' : ''}
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

function selectSortOption(idx) {
    if (idx < 0 || idx >= sortOptionsList.length) return;
    const opt = sortOptionsList[idx];
    currentSort = opt.id;
    currentSortLabel = opt.label.split(' ')[0];
    applyCurrentFilters();
    closeModal();
    playSound('confirm');
}

function selectFilterGroupOption(idxOrKey) {
    const keys = Object.keys(filterGroups);
    const key = typeof idxOrKey === 'number' ? keys[idxOrKey] : idxOrKey;
    if (!key || !filterGroups[key]) return;

    currentFilterGroupKey = key;
    currentCategoryTabs = filterGroups[key].tabs;
    currentCategoryIndex = 0;
    renderCategoryTabs();
    applyCurrentFilters();
    closeModal();
    playSound('confirm');
}

let previewControlsTimer = null;

function resetPreviewControlsTimer() {
    const stage = document.getElementById('media-preview-stage');
    if (!stage) return;

    stage.classList.remove('hide-controls');
    if (previewControlsTimer) clearTimeout(previewControlsTimer);
    previewControlsTimer = setTimeout(() => {
        if (activeModal === 'media-preview') {
            stage.classList.add('hide-controls');
        }
    }, 2500);
}

function getDetailMediaItem() {
    if (!selectedGameObj || !selectedGameObj.gallery || !selectedGameObj.gallery.length) return null;
    return selectedGameObj.gallery.map((item) => typeof item === 'string' ? { type: 'image', src: item, thumb: item } : item)[currentMediaIndex];
}

function renderMediaPreviewContent() {
    const item = getDetailMediaItem();
    if (!item) return;

    const content = document.getElementById('media-preview-content');
    if (!content) return;
    content.innerHTML = item.type === 'video'
        ? `<video class="w-full h-full object-contain bg-slate-950" src="${item.src}" controls autoplay playsinline></video>`
        : `<img src="${item.src}" alt="Preview" class="w-full h-full object-contain bg-slate-950">`;

    const fullscreenBtn = document.getElementById('media-preview-fullscreen-btn');
    if (fullscreenBtn) {
        if (item.type === 'video') {
            fullscreenBtn.classList.add('hidden');
        } else {
            fullscreenBtn.classList.remove('hidden');
            const isFullscreen = !!document.fullscreenElement;
            fullscreenBtn.innerHTML = isFullscreen
                ? '<i data-lucide="minimize-2" class="w-5 h-5"></i>'
                : '<i data-lucide="maximize-2" class="w-5 h-5"></i>';
            fullscreenBtn.title = isFullscreen ? '退出全螢幕' : '全螢幕顯示';
        }
    }

    if (window.lucide) lucide.createIcons();
}

function openMediaPreview() {
    const modal = document.getElementById('media-preview-modal');
    if (!modal) return;
    renderMediaPreviewContent();
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100');
    activeModal = 'media-preview';
    resetPreviewControlsTimer();
    playSound('confirm');
}

function navigatePreviewMedia(event, direction) {
    if (event && event.stopPropagation) event.stopPropagation();
    navigateDetailMedia(direction);
    if (activeModal === 'media-preview') renderMediaPreviewContent();
    resetPreviewControlsTimer();
}

function toggleMediaFullscreen(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const stage = document.getElementById('media-preview-stage');
    if (!stage) return;

    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
    } else if (stage.requestFullscreen) {
        stage.requestFullscreen().catch(() => {});
    }
    resetPreviewControlsTimer();
}

function closeMediaPreview() {
    if (previewControlsTimer) clearTimeout(previewControlsTimer);
    const stage = document.getElementById('media-preview-stage');
    if (stage) stage.classList.remove('hide-controls');
    if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
    }
    const modal = document.getElementById('media-preview-modal');
    if (!modal) return;
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0', 'pointer-events-none');
    activeModal = null;
    playSound('back');
}

function showToast(title, subtitle) {
    const toast = document.getElementById('cyber-toast');
    const tTitle = document.getElementById('toast-title');
    const tSub = document.getElementById('toast-subtitle');
    if (!toast || !tTitle || !tSub) return;

    tTitle.innerText = title;
    tSub.innerText = subtitle;
    toast.classList.remove('translate-x-full', 'opacity-0');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('translate-x-full', 'opacity-0'), 3000);
}

function updateClock() {
    const clockEl = document.getElementById('clock');
    if (!clockEl) return;
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockEl.innerText = `${hrs}:${mins}`;
}

let audioCtx = null;
function playSound(type) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const ctx = audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;

        if (type === 'nav') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'confirm') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'back') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        }
    } catch (error) {}
}

function handleGamepadA() {
    if (activeModal && activeModal !== 'media-preview') confirmModalSelection();
    else if (currentView === 'DETAIL') launchGame();
    else if (focusArea === 'HERO') launchGameFromHero();
    else openGameDetailByObj(currentFocusedCardIndex);
}

function handleGamepadB() {
    if (activeModal) closeModal();
    else if (currentView === 'DETAIL') closeDetailView();
}

function scrollToFocusedElement() {
    if (focusArea === 'HERO') {
        const heroBanner = document.getElementById('hero-banner');
        if (heroBanner && heroBanner.scrollIntoView) {
            heroBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else if (focusArea === 'GRID') {
        const focusedCard = document.getElementById(`game-card-${currentFocusedCardIndex}`);
        if (focusedCard && focusedCard.scrollIntoView) {
            focusedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

let lastButtonState = {};
function pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) { gp = gamepads[i]; break; }
    }

    if (gp) {
        const isPressed = (btnIdx) => gp.buttons[btnIdx] && gp.buttons[btnIdx].pressed;
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;
        const stickThreshold = 0.5;
        const hasGamepadActivity = gp.buttons.some(b => b && b.pressed) || Math.abs(axisX) > 0.4 || Math.abs(axisY) > 0.4;

        if (hasGamepadActivity) {
            setInputMode('GAMEPAD');
        }

        if (activeModal === 'media-preview') {
            if ((isPressed(1) && !lastButtonState[1])) {
                closeMediaPreview();
            }
            if ((isPressed(14) || axisX < -stickThreshold) && !lastButtonState.LEFT) {
                navigatePreviewMedia(null, -1);
            }
            if ((isPressed(15) || axisX > stickThreshold) && !lastButtonState.RIGHT) {
                navigatePreviewMedia(null, 1);
            }

            lastButtonState[1] = isPressed(1);
            lastButtonState.LEFT = isPressed(14) || axisX < -stickThreshold;
            lastButtonState.RIGHT = isPressed(15) || axisX > stickThreshold;
            requestAnimationFrame(pollGamepad);
            return;
        }

        if (isPressed(0) && !lastButtonState[0]) handleGamepadA();
        if (isPressed(1) && !lastButtonState[1]) handleGamepadB();
        if (isPressed(2) && !lastButtonState[2]) {
            if (currentView === 'DETAIL') openMediaPreview();
            else if (currentView === 'LIBRARY') toggleSortModal();
        }
        if (isPressed(3) && !lastButtonState[3]) {
            if (currentView === 'DETAIL') toggleCurrentFavorite();
            else if (currentView === 'LIBRARY') toggleFilterModal();
        }
        if (isPressed(4) && !lastButtonState[4]) {
            if (!activeModal && currentView === 'LIBRARY') selectCategory(currentCategoryIndex - 1);
            else if (currentView === 'DETAIL') navigateDetailMedia(-1);
        }
        if (isPressed(5) && !lastButtonState[5]) {
            if (!activeModal && currentView === 'LIBRARY') selectCategory(currentCategoryIndex + 1);
            else if (currentView === 'DETAIL') navigateDetailMedia(1);
        }

        if (activeModal) {
            const maxOpts = activeModal === 'sort' ? sortOptionsList.length : Object.keys(filterGroups).length;
            if ((isPressed(12) || axisY < -stickThreshold) && !lastButtonState.UP) {
                modalFocusedIndex = Math.max(0, modalFocusedIndex - 1);
                activeModal === 'sort' ? renderSortModalOptions() : renderFilterModalOptions();
                playSound('nav');
            }
            if ((isPressed(13) || axisY > stickThreshold) && !lastButtonState.DOWN) {
                modalFocusedIndex = Math.min(maxOpts - 1, modalFocusedIndex + 1);
                activeModal === 'sort' ? renderSortModalOptions() : renderFilterModalOptions();
                playSound('nav');
            }
        } else if (currentView === 'LIBRARY') {
            if ((isPressed(14) || axisX < -stickThreshold) && !lastButtonState.LEFT) navigateGrid('LEFT');
            if ((isPressed(15) || axisX > stickThreshold) && !lastButtonState.RIGHT) navigateGrid('RIGHT');
            if ((isPressed(12) || axisY < -stickThreshold) && !lastButtonState.UP) navigateGrid('UP');
            if ((isPressed(13) || axisY > stickThreshold) && !lastButtonState.DOWN) navigateGrid('DOWN');
        } else if (currentView === 'DETAIL') {
            if ((isPressed(14) || axisX < -stickThreshold) && !lastButtonState.LEFT) navigateDetailMedia(-1);
            if ((isPressed(15) || axisX > stickThreshold) && !lastButtonState.RIGHT) navigateDetailMedia(1);
        }

        lastButtonState[0] = isPressed(0);
        lastButtonState[1] = isPressed(1);
        lastButtonState[2] = isPressed(2);
        lastButtonState[3] = isPressed(3);
        lastButtonState[4] = isPressed(4);
        lastButtonState[5] = isPressed(5);
        lastButtonState.LEFT = isPressed(14) || axisX < -stickThreshold;
        lastButtonState.RIGHT = isPressed(15) || axisX > stickThreshold;
        lastButtonState.UP = isPressed(12) || axisY < -stickThreshold;
        lastButtonState.DOWN = isPressed(13) || axisY > stickThreshold;
    }

    requestAnimationFrame(pollGamepad);
}

window.addEventListener('keydown', (e) => {
    setInputMode('KEYBOARD');
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) {
        e.preventDefault();
    }

    if (activeModal === 'media-preview') {
        if (e.key === 'ArrowLeft') navigatePreviewMedia(e, -1);
        else if (e.key === 'ArrowRight') navigatePreviewMedia(e, 1);
        else if (e.key === 'b' || e.key === 'B' || e.key === 'Escape') closeMediaPreview();
        return;
    }

    if (activeModal) {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            modalFocusedIndex = Math.max(0, modalFocusedIndex - 1);
            activeModal === 'sort' ? renderSortModalOptions() : renderFilterModalOptions();
            playSound('nav');
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const max = activeModal === 'sort' ? sortOptionsList.length : Object.keys(filterGroups).length;
            modalFocusedIndex = Math.min(max - 1, modalFocusedIndex + 1);
            activeModal === 'sort' ? renderSortModalOptions() : renderFilterModalOptions();
            playSound('nav');
        } else if (e.key === 'Enter' || e.key === 'NumpadEnter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            confirmModalSelection();
        } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        }
        return;
    }

    switch (e.key) {
        case 'ArrowLeft':
            if (currentView === 'LIBRARY') navigateGrid('LEFT');
            else if (currentView === 'DETAIL') navigateDetailMedia(-1);
            break;
        case 'ArrowRight':
            if (currentView === 'LIBRARY') navigateGrid('RIGHT');
            else if (currentView === 'DETAIL') navigateDetailMedia(1);
            break;
        case 'ArrowUp':
            if (currentView === 'LIBRARY') navigateGrid('UP');
            break;
        case 'ArrowDown':
            if (currentView === 'LIBRARY') navigateGrid('DOWN');
            break;
        case 'Enter':
        case ' ':
            if (currentView === 'DETAIL') launchGame();
            else if (currentView === 'LIBRARY') {
                if (focusArea === 'HERO') launchGameFromHero();
                else openGameDetailByObj(currentFocusedCardIndex);
            }
            break;
        case 'Escape':
        case 'Backspace':
            if (currentView === 'DETAIL') closeDetailView();
            break;
        case 'x':
        case 'X':
            if (currentView === 'DETAIL') openMediaPreview();
            else if (currentView === 'LIBRARY') toggleSortModal();
            break;
        case 'y':
        case 'Y':
            if (currentView === 'DETAIL') toggleCurrentFavorite();
            else if (currentView === 'LIBRARY') toggleFilterModal();
            break;
        case 'q':
        case 'Q':
        case 'PageUp':
            if (currentView === 'LIBRARY') selectCategory(currentCategoryIndex - 1);
            else if (currentView === 'DETAIL') navigateDetailMedia(-1);
            break;
        case 'e':
        case 'E':
        case 'PageDown':
            if (currentView === 'LIBRARY') selectCategory(currentCategoryIndex + 1);
            else if (currentView === 'DETAIL') navigateDetailMedia(1);
            break;
    }
});

/* ========== 背景動態切換器 (Background Style Controller) ========== */
function initCityBackgroundToggle() {
    const bgSelect = document.getElementById('backgroundStyle');
    const cityBgContainer = document.getElementById('city-bg-container');
    if (cityBgContainer) cityBgContainer.remove();

    if (!bgSelect) return;

    if (typeof Core !== 'undefined' && !Core.BackgroundManager && typeof Core._createBackgroundManager === 'function') {
        Core._createBackgroundManager();
    }

    function applyBackground(val, isInitial = false) {
        if (val === 'city' || val === 'cyber-city') val = 'dom';
        if (typeof Core !== 'undefined' && Core.storage) {
            Core.storage.set('backgroundStyle', val);
        }
        if (typeof Core !== 'undefined' && Core.BackgroundManager && typeof Core.BackgroundManager.apply === 'function') {
            Core.BackgroundManager.apply(val, { container: document.querySelector('.particles'), force: isInitial });
        }
    }

    const savedVal = (typeof Core !== 'undefined' && Core.storage) ? Core.storage.get('backgroundStyle') : null;
    let currentVal = savedVal || bgSelect.value || 'dom';
    if (currentVal === 'city' || currentVal === 'cyber-city') currentVal = 'dom';
    bgSelect.value = currentVal;
    applyBackground(currentVal, true);

    bgSelect.addEventListener('change', (e) => {
        applyBackground(e.target.value);
    });
}

function initGameHubUI() {
    renderFooterHints();
    renderCategoryTabs();
    applyCurrentFilters();
    startHeroAuto();
    updateClock();
    setInterval(updateClock, 10000);
    pollGamepad();
    initCityBackgroundToggle();
    if (window.lucide) lucide.createIcons();
}

// Expose all public API methods on window for HTML inline event handlers
window.setHeroFocus = setHeroFocus;
window.pauseHeroAuto = pauseHeroAuto;
window.resumeHeroAuto = resumeHeroAuto;
window.startHeroAuto = startHeroAuto;
window.handleHeroProgressEnd = handleHeroProgressEnd;
window.renderHeroBanner = renderHeroBanner;
window.selectHeroItem = selectHeroItem;
window.launchGameFromHero = launchGameFromHero;
window.launchHeroDirect = launchHeroDirect;
window.selectCategory = selectCategory;
window.filterByTag = filterByTag;
window.openGameDetailByObj = openGameDetailByObj;
window.launchGame = launchGame;
window.closeModal = closeModal;
window.toggleSortModal = toggleSortModal;
window.toggleFilterModal = toggleFilterModal;
window.selectSortOption = selectSortOption;
window.selectFilterGroupOption = selectFilterGroupOption;
window.closeDetailView = closeDetailView;
window.openMediaPreview = openMediaPreview;
window.closeMediaPreview = closeMediaPreview;
window.toggleMediaFullscreen = toggleMediaFullscreen;
window.navigatePreviewMedia = navigatePreviewMedia;
window.toggleCurrentFavorite = toggleCurrentFavorite;
window.toggleGameFavorite = toggleGameFavorite;
window.selectDetailMedia = selectDetailMedia;
window.navigateDetailMedia = navigateDetailMedia;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGameHubUI);
} else {
    initGameHubUI();
}
