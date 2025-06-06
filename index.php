<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once 'include/auth.php';
?>
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8" />
        <meta name="description" content="天野靜樹的賽博龐克領域" />
        <meta name="author" content="天野靜樹" />
        <meta name="keywords" content="天野靜樹" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="assets/logo.png" type="image/png">
        <link rel="shortcut icon" href="assets/logo.png" type="image/png">
        <title>天野靜樹 - Cyber Nexus</title>
        <?php include 'include/style.php'; ?>
        <style>
            .data-stream {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: -2;
                opacity: 0.15;
                font-family: 'Courier New', monospace;
                color: #00ffff;
                overflow: hidden;
            }
            
            .binary-rain {
                position: absolute;
                top: -100px;
                font-size: 14px;
                line-height: 20px;
                white-space: nowrap;
                animation: rain 12s linear infinite;
            }
            
            @keyframes rain {
                0% { transform: translateY(-100px); opacity: 0; }
                10% { opacity: 0.8; }
                90% { opacity: 0.8; }
                100% { transform: translateY(100vh); opacity: 0; }
            }
            
            .animated-bg {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -3;
                background: 
                    radial-gradient(circle at 20% 80%, rgba(0, 255, 255, 0.15) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(255, 0, 255, 0.15) 0%, transparent 50%),
                    radial-gradient(circle at 40% 40%, rgba(255, 255, 0, 0.08) 0%, transparent 50%),
                    linear-gradient(45deg, #0a0a0a, #1a1a2e, #16213e, #0a0a0a);
                background-size: 400% 400%;
                animation: gradientShift 20s ease infinite;
            }
            
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                25% { background-position: 100% 50%; }
                50% { background-position: 100% 100%; }
                75% { background-position: 0% 100%; }
                100% { background-position: 0% 50%; }
            }
            
            .particles {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: -1;
                pointer-events: none;
            }
            
            .particle {
                position: absolute;
                width: 2px;
                height: 2px;
                background: #00ffff;
                border-radius: 50%;
                animation: float 10s infinite linear;
                opacity: 0.6;
                box-shadow: 0 0 10px currentColor;
            }
            
            .particle:nth-child(even) {
                background: #ff00ff;
                animation-duration: 15s;
            }
            
            .particle:nth-child(3n) {
                background: #ffff00;
                animation-duration: 8s;
            }
            
            @keyframes float {
                0% {
                    transform: translateY(100vh) translateX(0px) rotate(0deg);
                    opacity: 0;
                }
                10% { opacity: 0.6; }
                90% { opacity: 0.6; }
                100% {
                    transform: translateY(-20px) translateX(150px) rotate(360deg);
                    opacity: 0;
                }
            }
            
            .neon-title {
                font-size: 4em;
                font-weight: 900;
                color: #00ffff;
                text-shadow: 
                    0 0 10px #00ffff,
                    0 0 20px #00ffff,
                    0 0 30px #00ffff,
                    0 0 40px #00ffff;
                animation: neonFlicker 4s infinite alternate;
                margin-bottom: 30px;
                text-align: center;
                font-family: 'Orbitron', sans-serif;
                letter-spacing: 5px;
                position: relative;
            }
            
            .neon-title::before {
                content: 'AMANO SHIZUKI';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                color: #ff00ff;
                z-index: -1;
                animation: glitchMove 6s infinite;
            }
            
            @keyframes neonFlicker {
                0%, 100% {
                    text-shadow: 
                        0 0 10px #00ffff,
                        0 0 20px #00ffff,
                        0 0 30px #00ffff,
                        0 0 40px #00ffff;
                }
                50% {
                    text-shadow: 
                        0 0 5px #00ffff,
                        0 0 10px #00ffff,
                        0 0 15px #00ffff,
                        0 0 20px #00ffff;
                }
            }
            
            @keyframes glitchMove {
                0%, 100% { transform: translate(0); }
                10% { transform: translate(-1px, 1px); }
                20% { transform: translate(1px, -1px); }
                30% { transform: translate(-1px, -1px); }
                40% { transform: translate(1px, 1px); }
                50% { transform: translate(-1px, 1px); }
                60% { transform: translate(1px, -1px); }
                70% { transform: translate(-1px, -1px); }
                80% { transform: translate(1px, 1px); }
                90% { transform: translate(-1px, 1px); }
            }
            
            /* 副標題效果 */
            .cyber-subtitle {
                font-size: 1.5em;
                color: #ff00ff;
                text-transform: uppercase;
                letter-spacing: 4px;
                text-align: center;
                margin-bottom: 40px;
                position: relative;
                font-family: 'Rajdhani', sans-serif;
                font-weight: 600;
                text-shadow: 0 0 15px currentColor;
            }
            
            .cyber-subtitle::before,
            .cyber-subtitle::after {
                content: '◆';
                color: #00ffff;
                animation: pulse 2s infinite;
                margin: 0 15px;
                text-shadow: 0 0 15px currentColor;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.1); }
            }
            
            /* 個人資料區域 - 使用新的照片效果 */
            .profile-enhanced {
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.85), rgba(26, 26, 46, 0.85));
                border: 3px solid;
                border-image: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff) 1;
                border-radius: 20px;
                padding: 50px;
                margin: 40px 0;
                backdrop-filter: blur(15px);
                box-shadow: 
                    0 0 50px rgba(0, 255, 255, 0.3),
                    inset 0 0 50px rgba(0, 255, 255, 0.1);
                animation: borderPulse 8s infinite;
                position: relative;
                overflow: hidden;
            }
            
            .profile-enhanced::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: 
                    repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent 15px,
                        rgba(0, 255, 255, 0.03) 15px,
                        rgba(0, 255, 255, 0.03) 30px
                    );
                animation: scanlines 3s linear infinite;
                pointer-events: none;
            }
            
            @keyframes borderPulse {
                0%, 100% {
                    border-image: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff) 1;
                    box-shadow: 
                        0 0 50px rgba(0, 255, 255, 0.3),
                        inset 0 0 50px rgba(0, 255, 255, 0.1);
                }
                50% {
                    border-image: linear-gradient(45deg, #ff00ff, #ffff00, #00ffff, #ff00ff) 1;
                    box-shadow: 
                        0 0 50px rgba(255, 0, 255, 0.3),
                        inset 0 0 50px rgba(255, 0, 255, 0.1);
                }
            }
            
            /* 新的頭像效果 */
            .avatar-container {
                position: relative;
                display: inline-block;
                margin-bottom: 30px;
            }
            
            .avatar-container img {
                width: 250px;
                height: 250px;
                border-radius: 50%;
                border: 4px solid #00ffff;
                box-shadow: 
                    0 0 30px rgba(0, 255, 255, 0.6),
                    inset 0 0 30px rgba(0, 255, 255, 0.2);
                transition: all 0.5s ease;
                animation: avatarFloat 8s ease-in-out infinite;
                filter: brightness(1.1) contrast(1.2) saturate(1.3);
            }
            
            @keyframes avatarFloat {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                25% { transform: translateY(-8px) rotate(3deg); }
                50% { transform: translateY(0px) rotate(0deg); }
                75% { transform: translateY(-4px) rotate(-3deg); }
            }
            
            .avatar-container::before {
                content: '';
                position: absolute;
                top: -10px;
                left: -10px;
                right: -10px;
                bottom: -10px;
                border: 2px solid transparent;
                border-radius: 50%;
                background: conic-gradient(#00ffff, #ff00ff, #ffff00, #00ffff);
                z-index: -1;
                animation: borderRotate 6s linear infinite;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.4);
            }
            
            @keyframes borderRotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* 保留原始按鈕網格樣式 */
            .cyber-buttons {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 20px;
                margin-top: 40px;
            }
            
            .cyber-btn {
                position: relative;
                padding: 20px 30px;
                background: linear-gradient(45deg, rgba(0, 255, 255, 0.2), rgba(255, 0, 255, 0.2));
                border: 3px solid #00ffff;
                color: #00ffff;
                text-decoration: none;
                text-transform: uppercase;
                font-weight: bold;
                letter-spacing: 2px;
                transition: all 0.4s ease;
                overflow: hidden;
                clip-path: polygon(15px 0, 100% 0, calc(100% - 15px) 100%, 0 100%);
                font-family: 'Orbitron', sans-serif;
                text-align: center;
                font-size: 0.9em;
                text-shadow: 0 0 10px currentColor;
            }
            
            .cyber-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                transition: left 0.6s ease;
            }
            
            .cyber-btn:hover {
                background: linear-gradient(45deg, rgba(0, 255, 255, 0.4), rgba(255, 0, 255, 0.4));
                border-color: #ff00ff;
                color: #ffffff;
                transform: translateY(-5px) scale(1.05);
                box-shadow: 
                    0 10px 40px rgba(0, 255, 255, 0.6),
                    inset 0 0 40px rgba(0, 255, 255, 0.2);
                text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
            }
            
            .cyber-btn:hover::before {
                left: 100%;
            }
            
            .cyber-btn:hover::after {
                opacity: 1;
            }
            
            /* 側邊欄 */
            .cyber-sidebar {
                position: fixed;
                right: 30px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 1000;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 46, 0.9));
                border: 2px solid;
                border-image: linear-gradient(45deg, #00ffff, #ff00ff) 1;
                border-radius: 15px;
                padding: 25px 15px;
                backdrop-filter: blur(20px);
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
            }
            
            .cyber-sidebar a {
                display: block;
                color: #00ffff;
                text-decoration: none;
                padding: 12px 18px;
                margin: 6px 0;
                border: 2px solid transparent;
                border-radius: 8px;
                transition: all 0.3s ease;
                font-size: 0.85em;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-family: 'Rajdhani', sans-serif;
                font-weight: 600;
                text-align: center;
                text-shadow: 0 0 8px currentColor;
            }
            
            .cyber-sidebar a:hover {
                border-color: #00ffff;
                background: rgba(0, 255, 255, 0.2);
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
                transform: translateX(-3px);
                color: #ffffff;
            }
            
            /* 文字特效 */
            .glitch-text {
                color: #ffffff;
                font-size: 1.2em;
                line-height: 2;
                text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
                font-family: 'Rajdhani', sans-serif;
            }
            
            .glitch-text h2 {
                font-family: 'Orbitron', sans-serif;
                margin-bottom: 25px;
                text-transform: uppercase;
                letter-spacing: 2px;
                text-shadow: 0 0 15px currentColor;
            }
            
            /* 響應式設計 */
            @media (max-width: 768px) {
                .neon-title {
                    font-size: 2.5em;
                    letter-spacing: 3px;
                }
                .cyber-sidebar {
                    display: none;
                }
                .cyber-buttons {
                    grid-template-columns: 1fr;
                    gap: 15px;
                }
                .avatar-container img {
                    width: 200px;
                    height: 200px;
                }
                .profile-enhanced {
                    padding: 30px;
                    margin: 20px 0;
                }
            }
        </style>
    </head>
    <body>
        <!-- 數據流背景 -->
        <div class="data-stream" id="dataStream"></div>
        
        <!-- 動態背景 -->
        <div class="animated-bg"></div>
        
        <!-- 粒子效果 -->
        <div class="particles" id="particles"></div>
        
        <?php include 'include/menu.php'; ?>
        
        <div class="container">
            <h1>AMANO SHIZUKI</h1>
            <div class="cyber-subtitle">◆ Digital Creator & Code Warrior ◆</div>
            
            <div class="profile-enhanced">
                <div style="text-align: center;">
                    <div class="avatar-container">
                        <img src="assets/P_20210111_232101_BF_p.jpg" alt="Profile Picture">
                    </div>
                    
                    <div class="glitch-text">
                        <h2 style="color: #ff00ff; margin-bottom: 25px;">『 創造者宣言 』</h2>
                        <p>吾乃天野靜樹，國立勤益科技大學之學徒。<br>
                           程式編織與新知探求，乃吾之使命與熱忱。<br>
                           在數位領域中追求效率與創意的極致融合！</p>
                        
                        <div style="margin: 30px 0; padding: 20px; background: rgba(0, 255, 255, 0.1); border-radius: 15px; border: 2px solid #00ffff;" class="quantum-box">
                            <strong style="color: #00ffff; font-family: 'Orbitron', sans-serif;">✉ CONTACT CODE:</strong><br>
                            <span style="color: #ff00ff; font-family: 'Courier New', monospace; font-size: 1.1em;">3b017128@gm.student.ncut.edu.tw</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="cyber-buttons">
                <a href="https://ericchen920114.wixsite.com/live2" class="cyber-btn">Live2D Portal</a>
                <a href="https://drive.google.com/drive/folders/1XgkJizJwTsG---tprOAJcetIRD4pjB8c?usp=sharing" class="cyber-btn">AI Art Gallery</a>
                <a href="https://github.com/AmanoShizukikun" class="cyber-btn">Code Repository</a>
                <a href="https://www.youtube.com/watch?v=v5ASo_gLxWg&list=PL5K3TBBjxgOIfFaQ0DEFVeX6nIVA0FQL6&index=1" class="cyber-btn">AI Learning Path</a>
                <a href="https://www.youtube.com/watch?v=Oyy9GXTwd6A" class="cyber-btn">Presentation Arts</a>
                <a href="https://www.youtube.com/watch?v=uv-QlB0skn8" class="cyber-btn">IoT Projects</a>
                <a href="https://youtu.be/g0D3Ys1m2_I" class="cyber-btn">PC Assembly</a>
                <a href="https://youtu.be/xcnzCRhfVf8?si=o3Z1ZX1scZOpqIND" class="cyber-btn">Audio Mastery</a>
            </div>
        </div>
        
        <div class="cyber-sidebar">
            <a href="#about">◆ About</a>
            <a href="#learning">◆ Learning</a>
            <a href="#projects">◆ Projects</a>
            <a href="#connect">◆ Connect</a>
            <a href="dir/3d_demo.php">◆ 3D Demo</a>
        </div>
        
        <script>
            // 創建數據流雨效果
            function createDataRain() {
                const dataStream = document.getElementById('dataStream');
                const binaryChars = ['0', '1'];
                const streams = 15;
                
                for (let i = 0; i < streams; i++) {
                    const stream = document.createElement('div');
                    stream.className = 'binary-rain';
                    stream.style.left = Math.random() * 100 + '%';
                    stream.style.animationDelay = Math.random() * 12 + 's';
                    stream.style.animationDuration = (Math.random() * 8 + 10) + 's';
                    
                    let binaryString = '';
                    for (let j = 0; j < 40; j++) {
                        binaryString += binaryChars[Math.floor(Math.random() * binaryChars.length)] + ' ';
                        if (j % 8 === 0) binaryString += '\n';
                    }
                    stream.textContent = binaryString;
                    dataStream.appendChild(stream);
                }
            }
            
            // 創建粒子效果
            function createParticles() {
                const particlesContainer = document.getElementById('particles');
                const particleCount = 60;
                
                for (let i = 0; i < particleCount; i++) {
                    const particle = document.createElement('div');
                    particle.className = 'particle';
                    particle.style.left = Math.random() * 100 + '%';
                    particle.style.animationDelay = Math.random() * 10 + 's';
                    particle.style.animationDuration = (Math.random() * 8 + 8) + 's';
                    particlesContainer.appendChild(particle);
                }
            }
            
            // 頁面加載完成後創建效果
            document.addEventListener('DOMContentLoaded', function() {
                createDataRain();
                createParticles();
                
                // 按鈕懸停效果
                document.querySelectorAll('.cyber-btn').forEach(btn => {
                    btn.addEventListener('mouseenter', function() {
                        this.style.background = 'linear-gradient(45deg, rgba(0, 255, 255, 0.4), rgba(255, 0, 255, 0.4))';
                    });
                    
                    btn.addEventListener('mouseleave', function() {
                        this.style.background = 'linear-gradient(45deg, rgba(0, 255, 255, 0.2), rgba(255, 0, 255, 0.2))';
                    });
                });
                
                // 隨機Glitch效果
                setInterval(() => {
                    const glitchElements = document.querySelectorAll('.glitch-text');
                    if (Math.random() > 0.8) {
                        glitchElements.forEach(el => {
                            el.style.animation = 'glitch 0.3s ease-in-out';
                            setTimeout(() => {
                                el.style.animation = '';
                            }, 300);
                        });
                    }
                }, 4000);
            });
        </script>
    </body>
</html>