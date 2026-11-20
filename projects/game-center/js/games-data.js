/* ========== 遊戲資料集 (Centralized Games Dataset) ========== */

const gamesData = [
    {
        id: 'cyberrace',
        title: 'Cyber Race',
        englishTitle: 'Cyber Race',
        category: 'RAC',
        tags: ['競速', '賽博龐克', '3D', '熱血'],
        inputSupport: 'FULL_GAMEPAD',
        banner: 'games/cyberrace/assets/metadata/main_capsule.jpg',
        capsule: 'games/cyberrace/assets/metadata/main_capsule.jpg',
        desc: '在充斥著霓虹光影與高科技的未來都市軌道上穿梭，體驗極速甩尾與超音速衝刺的熱血沉浸感！支援單人競速與線上賽事。',
        publisher: 'AMANO SHIZUKI',
        developer: 'AMANO SHIZUKI',
        playtime: 0,
        lastPlayed: 0,
        releaseDate: '2026-06-15',
        gameUrl: 'games/cyberrace/cyberrace.html',
        isFavorite: false,
        gallery: [
            { type: 'image', src: 'games/cyberrace/assets/metadata/screenshot_1.jpg', thumb: 'games/cyberrace/assets/metadata/screenshot_1.jpg', title: '賽道選擇' },
            { type: 'image', src: 'games/cyberrace/assets/metadata/screenshot_2.jpg', thumb: 'games/cyberrace/assets/metadata/screenshot_2.jpg', title: '秋名山甩尾競速' }
        ]
    },
    {
        id: 'snake',
        title: 'Neon Snake: Reloaded',
        englishTitle: 'Neon Snake: Cyber Grid',
        category: 'ACT',
        tags: ['經典', '動作', '街機', '霓虹'],
        inputSupport: 'KEYBOARD_MOUSE',
        banner: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop',
        capsule: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop',
        desc: '重溫經典貪食蛇的炫目重生！吞噬能量矩陣、激發閃光連擊，在賽博矩陣中挑戰最高得分記錄！',
        publisher: 'NEON MATRIX',
        developer: 'SHIZUKI GAMES',
        playtime: 0,
        lastPlayed: 0,
        releaseDate: '2026-01-10',
        gameUrl: 'games/snake/snake.html',
        isFavorite: false,
        gallery: [
            { type: 'image', src: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=300&auto=format&fit=crop', title: '霓虹貪食蛇遊戲畫面' }
        ]
    },
    {
        id: 'piano',
        title: 'Cyber Piano Synthesizer',
        englishTitle: 'Cyber Piano Synthesizer Pro',
        category: 'MUS',
        tags: ['音樂', '節奏', '彈奏', '科幻'],
        inputSupport: 'KEYBOARD_MOUSE',
        banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
        capsule: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
        desc: '結合賽博龐克視覺與高音質合成器的音樂彈奏體驗，創作出專屬於你的未來樂章！',
        publisher: 'CYBER AUDIO LAB',
        developer: 'AMANO SHIZUKI STUDIO',
        playtime: 0,
        lastPlayed: 0,
        releaseDate: '2025-11-20',
        gameUrl: 'games/piano/piano.html',
        isFavorite: false,
        gallery: [
            { type: 'image', src: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&auto=format&fit=crop', title: '賽博鋼琴介面' }
        ]
    },
    {
        id: 'wallclimber',
        title: 'Cyber Wall Climber',
        englishTitle: 'Cyber Wall Climber 2088',
        category: 'ACT',
        tags: ['攀爬', '街機', '反應', '賽博龐克'],
        inputSupport: 'KEYBOARD_MOUSE',
        banner: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1200&auto=format&fit=crop',
        capsule: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1200&auto=format&fit=crop',
        desc: '操控賽博攀爬者在霓虹摩天大樓外牆不斷攀升，躲避致命電磁障礙，考驗你的極限反應！',
        publisher: 'CYBER VERTICAL',
        developer: 'SHIZUKI GAMES',
        playtime: 0,
        lastPlayed: 0,
        releaseDate: '2026-03-12',
        gameUrl: 'games/wallclimber/wallclimber.html',
        isFavorite: false,
        gallery: [
            { type: 'image', src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1200&auto=format&fit=crop', thumb: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=300&auto=format&fit=crop', title: '攀爬關卡畫面' }
        ]
    }
];
