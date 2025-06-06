<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once '../include/auth.php';
?>
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ABOUT - Digital Chronicles</title>
        <?php include '../include/style.php'; ?>
        <style>
            .hud-container {
                position: relative;
                background: 
                    radial-gradient(circle at 50% 50%, rgba(0, 255, 255, 0.05), transparent 70%),
                    linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(26, 26, 46, 0.95));
                border: 3px solid transparent;
                border-image: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff) 1;
                border-radius: 20px;
                padding: 40px;
                margin: 30px 0;
                backdrop-filter: blur(20px);
                position: relative;
                overflow: hidden;
                animation: hudPulse 8s infinite ease-in-out;
            }
            
            @keyframes hudPulse {
                0%, 100% {
                    box-shadow: 
                        0 0 30px rgba(0, 255, 255, 0.3),
                        inset 0 0 30px rgba(0, 255, 255, 0.1);
                }
                50% {
                    box-shadow: 
                        0 0 50px rgba(255, 0, 255, 0.4),
                        inset 0 0 50px rgba(255, 0, 255, 0.1);
                }
            }
            
            .hud-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.3), transparent);
                animation: hudScan 6s infinite;
                z-index: 1;
                pointer-events: none;
            }
            
            @keyframes hudScan {
                0% { left: -100%; opacity: 0; }
                25% { opacity: 1; }
                75% { opacity: 1; }
                100% { left: 100%; opacity: 0; }
            }
            
            .hud-container::after {
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
                        transparent 20px,
                        rgba(0, 255, 255, 0.1) 20px,
                        rgba(0, 255, 255, 0.1) 21px
                    ),
                    repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 20px,
                        rgba(0, 255, 255, 0.1) 20px,
                        rgba(0, 255, 255, 0.1) 21px
                    );
                animation: gridPulse 4s ease-in-out infinite alternate;
                pointer-events: none;
                z-index: 0;
            }
            
            @keyframes gridPulse {
                0% { opacity: 0.1; }
                100% { opacity: 0.3; }
            }
            
            .hud-header {
                position: relative;
                z-index: 10;
                text-align: center;
                margin-bottom: 40px;
                padding: 20px;
                background: rgba(0, 0, 0, 0.7);
                border: 2px solid #00ffff;
                border-radius: 15px;
                clip-path: polygon(20px 0%, 100% 0%, calc(100% - 20px) 100%, 0% 100%);
            }
            
            .hud-title {
                font-size: 2.5em;
                font-family: 'Orbitron', sans-serif;
                color: #00ffff;
                text-shadow: 
                    0 0 10px #00ffff,
                    0 0 20px #00ffff,
                    0 0 30px #00ffff;
                margin-bottom: 15px;
                animation: titleGlitch 4s infinite;
                position: relative;
            }
            
            .hud-title::before {
                content: '◆ DIGITAL CHRONICLES ◆';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                color: #ff00ff;
                z-index: -1;
                animation: glitchShift 6s infinite;
            }
            
            @keyframes titleGlitch {
                0%, 90%, 100% {
                    text-shadow: 
                        0 0 10px #00ffff,
                        0 0 20px #00ffff,
                        0 0 30px #00ffff;
                }
                10% {
                    text-shadow: 
                        2px 0 #ff00ff,
                        -2px 0 #ffff00,
                        0 0 30px #00ffff;
                }
            }
            
            @keyframes glitchShift {
                0%, 100% { transform: translate(0); }
                20% { transform: translate(-2px, 1px); }
                40% { transform: translate(2px, -1px); }
                60% { transform: translate(-1px, 2px); }
                80% { transform: translate(1px, -2px); }
            }
            
            .hud-subtitle {
                font-size: 1.2em;
                color: #ff00ff;
                font-family: 'Rajdhani', sans-serif;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 3px;
                margin-bottom: 10px;
            }
            
            .system-status {
                display: flex;
                justify-content: center;
                gap: 30px;
                margin-top: 15px;
                flex-wrap: wrap;
            }
            
            .status-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 15px;
                background: rgba(0, 255, 255, 0.1);
                border: 1px solid #00ffff;
                border-radius: 20px;
                font-family: 'Rajdhani', sans-serif;
                font-size: 0.9em;
                font-weight: 600;
            }
            
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #00ff00;
                animation: statusBlink 2s infinite;
                box-shadow: 0 0 10px currentColor;
            }
            
            @keyframes statusBlink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0.3; }
            }
            
            .profile-hud {
                position: relative;
                z-index: 10;
                display: grid;
                grid-template-columns: 300px 1fr;
                gap: 40px;
                margin: 40px 0;
                align-items: start;
            }
            
            .avatar-panel {
                position: relative;
                background: rgba(0, 0, 0, 0.8);
                border: 2px solid #00ffff;
                border-radius: 15px;
                padding: 25px;
                text-align: center;
                overflow: hidden;
            }
            
            .avatar-panel::before {
                content: '';
                position: absolute;
                top: -2px;
                left: -2px;
                right: -2px;
                bottom: -2px;
                background: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff);
                border-radius: 15px;
                z-index: -1;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            @keyframes borderRotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .avatar-container {
                position: relative;
                display: inline-block;
                margin-bottom: 20px;
            }
            
            .avatar-image {
                width: 200px;
                height: 200px;
                border-radius: 50%;
                border: 3px solid #00ffff;
                box-shadow: 
                    0 0 30px rgba(0, 255, 255, 0.6),
                    inset 0 0 30px rgba(0, 255, 255, 0.2);
                animation: avatarFloat 6s ease-in-out infinite;
                filter: brightness(1.1) contrast(1.2) saturate(1.3);
            }
            
            @keyframes avatarFloat {
                0%, 100% { transform: translateY(0px) scale(1); }
                25% { transform: translateY(-8px) scale(1.02); }
                50% { transform: translateY(0px) scale(1); }
                75% { transform: translateY(-4px) scale(0.98); }
            }
            
            .avatar-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                border-radius: 50%;
                background: radial-gradient(
                    circle at 30% 30%,
                    rgba(255, 255, 255, 0.2) 0%,
                    transparent 50%
                );
                pointer-events: none;
            }
            
            .id-card {
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid #00ffff;
                border-radius: 8px;
                padding: 15px;
                margin-top: 15px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                line-height: 1.6;
            }
            
            .id-field {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
                color: #e0e0e0;
            }
            
            .id-label {
                color: #00ffff;
                font-weight: bold;
            }
            
            .id-value {
                color: #ff00ff;
                text-shadow: 0 0 5px currentColor;
            }
            
            .bio-panel {
                position: relative;
                background: rgba(0, 0, 0, 0.8);
                border: 2px solid #ff00ff;
                border-radius: 15px;
                padding: 30px;
                height: fit-content;
            }
            
            .bio-panel::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: 
                    repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 15px,
                        rgba(255, 0, 255, 0.05) 15px,
                        rgba(255, 0, 255, 0.05) 30px
                    );
                border-radius: 15px;
                pointer-events: none;
            }
            
            .chapter-title {
                font-size: 1.4em;
                color: #ff00ff;
                font-family: 'Orbitron', sans-serif;
                font-weight: 700;
                margin-bottom: 20px;
                text-shadow: 0 0 15px currentColor;
                position: relative;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            
            .chapter-title::before {
                content: '◢';
                position: absolute;
                left: -25px;
                color: #00ffff;
                animation: pulse 2s infinite;
            }
            
            .chapter-title::after {
                content: '';
                position: absolute;
                bottom: -8px;
                left: 0;
                width: 80%;
                height: 2px;
                background: linear-gradient(90deg, #ff00ff, transparent);
                animation: underlineExpand 3s ease-in-out infinite;
            }
            
            @keyframes underlineExpand {
                0%, 100% { width: 80%; opacity: 0.5; }
                50% { width: 100%; opacity: 1; }
            }
            
            .bio-text {
                color: #e0e0e0;
                font-family: 'Rajdhani', sans-serif;
                font-size: 1.1em;
                line-height: 1.8;
                margin-bottom: 15px;
                text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
            }
            
            /* 技能系統 HUD */
            .skills-hud {
                position: relative;
                z-index: 10;
                margin: 40px 0;
            }
            
            .skills-header {
                text-align: center;
                margin-bottom: 30px;
                background: rgba(0, 0, 0, 0.8);
                border: 2px solid #ffff00;
                border-radius: 15px;
                padding: 20px;
                clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);
            }
            
            .skills-title {
                font-size: 2em;
                color: #ffff00;
                font-family: 'Orbitron', sans-serif;
                text-shadow: 
                    0 0 10px #ffff00,
                    0 0 20px #ffff00;
                margin-bottom: 10px;
                animation: skillsTitleGlow 3s ease-in-out infinite alternate;
            }
            
            @keyframes skillsTitleGlow {
                0% {
                    text-shadow: 
                        0 0 10px #ffff00,
                        0 0 20px #ffff00;
                }
                100% {
                    text-shadow: 
                        0 0 15px #ffff00,
                        0 0 30px #ffff00,
                        0 0 45px #ffff00;
                }
            }
            
            .skills-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 25px;
                margin-top: 30px;
            }
            
            .skill-module {
                background: rgba(0, 0, 0, 0.85);
                border: 2px solid #00ffff;
                border-radius: 15px;
                padding: 25px;
                position: relative;
                overflow: hidden;
                transition: all 0.4s ease;
                transform-style: preserve-3d;
                perspective: 1000px;
            }
            
            .skill-module::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: conic-gradient(
                    from 0deg,
                    transparent,
                    rgba(0, 255, 255, 0.2),
                    transparent,
                    rgba(255, 0, 255, 0.2),
                    transparent
                );
                animation: skillRotate 10s linear infinite;
                opacity: 0;
                transition: opacity 0.4s ease;
            }
            
            .skill-module:hover::before {
                opacity: 1;
            }
            
            @keyframes skillRotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .skill-module:hover {
                border-color: #ff00ff;
                transform: translateY(-8px) rotateX(5deg) rotateY(5deg);
                box-shadow: 
                    0 15px 40px rgba(255, 0, 255, 0.4),
                    inset 0 0 40px rgba(255, 0, 255, 0.1);
            }
            
            .skill-icon {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: linear-gradient(45deg, #00ffff, #ff00ff);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2em;
                color: #000;
                font-weight: bold;
                animation: iconSpin 8s linear infinite;
                z-index: 5;
            }
            
            @keyframes iconSpin {
                0% { transform: rotate(0deg) scale(1); }
                50% { transform: rotate(180deg) scale(1.1); }
                100% { transform: rotate(360deg) scale(1); }
            }
            
            .skill-name {
                font-size: 1.3em;
                color: #00ffff;
                font-family: 'Orbitron', sans-serif;
                font-weight: 700;
                margin-bottom: 15px;
                text-shadow: 0 0 10px currentColor;
                position: relative;
                z-index: 5;
            }
            
            .skill-description {
                color: #e0e0e0;
                font-family: 'Rajdhani', sans-serif;
                font-size: 1em;
                line-height: 1.6;
                margin-bottom: 20px;
                position: relative;
                z-index: 5;
            }
            
            .skill-stats {
                position: relative;
                z-index: 5;
            }
            
            .skill-level-label {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-family: 'Rajdhani', sans-serif;
                font-weight: 600;
                font-size: 0.9em;
            }
            
            .skill-level-text {
                color: #ffff00;
                text-shadow: 0 0 5px currentColor;
            }
            
            .skill-percentage {
                color: #ff00ff;
                font-family: 'Orbitron', sans-serif;
                text-shadow: 0 0 5px currentColor;
            }
            
            .skill-progress-container {
                width: 100%;
                height: 12px;
                background: rgba(0, 0, 0, 0.7);
                border: 1px solid #00ffff;
                border-radius: 6px;
                overflow: hidden;
                position: relative;
            }
            
            .skill-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #00ffff 0%, #ff00ff 50%, #ffff00 100%);
                border-radius: 6px;
                position: relative;
                transition: width 3s ease-out;
                animation: progressPulse 2s ease-in-out infinite alternate;
            }
            
            @keyframes progressPulse {
                0% {
                    box-shadow: 
                        0 0 5px rgba(0, 255, 255, 0.5),
                        inset 0 0 10px rgba(255, 255, 255, 0.2);
                }
                100% {
                    box-shadow: 
                        0 0 15px rgba(0, 255, 255, 0.8),
                        inset 0 0 20px rgba(255, 255, 255, 0.4);
                }
            }
            
            .skill-progress-bar::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
                animation: progressScan 3s ease-in-out infinite;
            }
            
            @keyframes progressScan {
                0% { left: -100%; }
                50% { left: 100%; }
                100% { left: -100%; }
            }
            
            /* 使命宣言 HUD */
            .mission-hud {
                position: relative;
                z-index: 10;
                margin: 40px 0;
                background: rgba(0, 0, 0, 0.9);
                border: 3px solid #ff00ff;
                border-radius: 20px;
                padding: 40px;
                text-align: center;
                overflow: hidden;
            }
            
            .mission-hud::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: 
                    radial-gradient(circle at 25% 25%, rgba(255, 0, 255, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(0, 255, 255, 0.1) 0%, transparent 50%);
                border-radius: 20px;
                animation: missionGlow 6s ease-in-out infinite alternate;
            }
            
            @keyframes missionGlow {
                0% { opacity: 0.3; }
                100% { opacity: 0.7; }
            }
            
            .mission-title {
                font-size: 1.8em;
                color: #ff00ff;
                font-family: 'Orbitron', sans-serif;
                font-weight: 700;
                margin-bottom: 25px;
                text-shadow: 0 0 15px currentColor;
                position: relative;
                z-index: 5;
            }
            
            .mission-statement {
                font-size: 1.3em;
                color: #00ffff;
                font-family: 'Rajdhani', sans-serif;
                font-weight: 600;
                line-height: 1.8;
                margin-bottom: 30px;
                position: relative;
                z-index: 5;
                text-shadow: 0 0 10px currentColor;
            }
            
            .contact-terminal {
                display: inline-block;
                padding: 20px 30px;
                background: rgba(0, 255, 255, 0.1);
                border: 2px solid #00ffff;
                border-radius: 10px;
                position: relative;
                z-index: 5;
                transition: all 0.3s ease;
            }
            
            .contact-terminal:hover {
                background: rgba(0, 255, 255, 0.2);
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
                transform: scale(1.05);
            }
            
            .contact-label {
                color: #ff00ff;
                font-family: 'Orbitron', sans-serif;
                font-weight: bold;
                margin-bottom: 8px;
                font-size: 1em;
            }
            
            .contact-value {
                color: #00ffff;
                font-family: 'Courier New', monospace;
                font-size: 1.1em;
                text-shadow: 0 0 8px currentColor;
            }
            
            /* 返回按鈕 */
            .return-hud {
                text-align: center;
                margin-top: 40px;
                position: relative;
                z-index: 10;
            }
            
            .cyber-return-button {
                display: inline-flex;
                align-items: center;
                gap: 15px;
                padding: 18px 40px;
                background: linear-gradient(45deg, rgba(0, 255, 255, 0.2), rgba(255, 0, 255, 0.2));
                border: 3px solid #00ffff;
                color: #00ffff;
                text-decoration: none;
                text-transform: uppercase;
                font-weight: bold;
                letter-spacing: 2px;
                font-family: 'Orbitron', sans-serif;
                border-radius: 0;
                clip-path: polygon(20px 0%, 100% 0%, calc(100% - 20px) 100%, 0% 100%);
                transition: all 0.4s ease;
                position: relative;
                overflow: hidden;
                text-shadow: 0 0 10px currentColor;
            }
            
            .cyber-return-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                transition: left 0.6s ease;
            }
            
            .cyber-return-button:hover {
                background: linear-gradient(45deg, rgba(0, 255, 255, 0.4), rgba(255, 0, 255, 0.4));
                border-color: #ff00ff;
                color: #ffffff;
                transform: translateY(-5px) scale(1.05);
                box-shadow: 
                    0 10px 40px rgba(0, 255, 255, 0.6),
                    inset 0 0 40px rgba(0, 255, 255, 0.2);
                text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
            }
            
            .cyber-return-button:hover::before {
                left: 100%;
            }
            
            .return-icon {
                font-size: 1.2em;
                animation: iconBounce 2s ease-in-out infinite;
            }
            
            @keyframes iconBounce {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(-5px); }
            }
            
            /* 響應式設計 */
            @media (max-width: 768px) {
                .profile-hud {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
                
                .avatar-image {
                    width: 150px;
                    height: 150px;
                }
                
                .skills-grid {
                    grid-template-columns: 1fr;
                }
                
                .hud-title {
                    font-size: 2em;
                }
                
                .system-status {
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="animated-bg"></div>
        <div class="particles" id="particles"></div>
        
        <?php include '../include/menu.php'; ?>
        
        <div class="container">
            <div class="hud-container">
                <div class="hud-header">
                    <div class="hud-title">◆ DIGITAL CHRONICLES ◆</div>
                    <div class="hud-subtitle">System Information Interface</div>
                    <div class="system-status">
                        <div class="status-indicator">
                            <div class="status-dot"></div>
                            <span>SYSTEM ONLINE</span>
                        </div>
                        <div class="status-indicator">
                            <div class="status-dot"></div>
                            <span>NEURAL LINK ACTIVE</span>
                        </div>
                        <div class="status-indicator">
                            <div class="status-dot"></div>
                            <span>SECURITY LEVEL: ALPHA</span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-hud">
                    <div class="avatar-panel">
                        <div class="avatar-container">
                            <img src="../assets/P_20210111_232101_BF_p.jpg" alt="Profile Avatar" class="avatar-image">
                            <div class="avatar-overlay"></div>
                        </div>
                        
                        <div class="id-card">
                            <div class="id-field">
                                <span class="id-label">ID:</span>
                                <span class="id-value">AMANO_SHIZUKI</span>
                            </div>
                            <div class="id-field">
                                <span class="id-label">NAME:</span>
                                <span class="id-value">天野靜樹</span>
                            </div>
                            <div class="id-field">
                                <span class="id-label">CLASS:</span>
                                <span class="id-value">DIGITAL_WARRIOR</span>
                            </div>
                            <div class="id-field">
                                <span class="id-label">RANK:</span>
                                <span class="id-value">CODE_BEGINNER</span>
                            </div>
                            <div class="id-field">
                                <span class="id-label">LOCATION:</span>
                                <span class="id-value">NCUT_CSIE</span>
                            </div>
                            <div class="id-field">
                                <span class="id-label">STATUS:</span>
                                <span class="id-value">ACTIVE</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bio-panel">
                        <div class="chapter-title">『 起源之章 - Origin Protocol 』</div>
                        <p class="bio-text">
                            在數位世界的邊緣，我誕生於一個充滿無限可能的時代。從小便對科技與創新充滿熱情，逐漸成為一名數位戰士，專注於程式編寫與人工智慧的奧秘。
                        </p>
                        <p class="bio-text">
                            這個世界充滿了挑戰與機遇，我的目標是成為一名頂尖的數位創作者，將我的創意與技術結合，開拓新的數位疆界。
                        </p>
                        <p class="bio-text">
                            在這個由零與一構成的賽博空間裡，我以效率為利刃，以創意為護盾，在無盡的數據海洋中航行，追尋著技術與藝術的完美融合。
                        </p>
                    </div>
                </div>
            </div>
            
            <div class="hud-container skills-hud">
                <div class="skills-header">
                    <div class="skills-title">『 能力覺醒 - Skill Matrix 』</div>
                </div>
                
                <div class="skills-grid">
                    <div class="skill-module">
                        <div class="skill-icon">◆</div>
                        <div class="skill-name">程式編織術</div>
                        <div class="skill-description">掌握多種程式語言，編織數位世界的奇蹟。從低階系統到高階應用，無所不精。</div>
                        <div class="skill-stats">
                            <div class="skill-level-label">
                                <span class="skill-level-text">MASTERY LEVEL</span>
                                <span class="skill-percentage">85%</span>
                            </div>
                            <div class="skill-progress-container">
                                <div class="skill-progress-bar" data-width="85"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="skill-module">
                        <div class="skill-icon">◇</div>
                        <div class="skill-name">AI召喚術</div>
                        <div class="skill-description">運用人工智慧之力，創造前所未見的數位生命體。機器學習與深度學習的完美融合。</div>
                        <div class="skill-stats">
                            <div class="skill-level-label">
                                <span class="skill-level-text">MASTERY LEVEL</span>
                                <span class="skill-percentage">78%</span>
                            </div>
                            <div class="skill-progress-container">
                                <div class="skill-progress-bar" data-width="78"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="skill-module">
                        <div class="skill-icon">◈</div>
                        <div class="skill-name">Live2D幻術</div>
                        <div class="skill-description">賦予二次元角色生命與靈魂的神秘技藝。讓靜態圖像擁有動態的魅力。</div>
                        <div class="skill-stats">
                            <div class="skill-level-label">
                                <span class="skill-level-text">MASTERY LEVEL</span>
                                <span class="skill-percentage">90%</span>
                            </div>
                            <div class="skill-progress-container">
                                <div class="skill-progress-bar" data-width="90"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="skill-module">
                        <div class="skill-icon">◉</div>
                        <div class="skill-name">IoT控制術</div>
                        <div class="skill-description">連接萬物，構建智慧互聯的數位王國。物聯網技術的終極應用。</div>
                        <div class="skill-stats">
                            <div class="skill-level-label">
                                <span class="skill-level-text">MASTERY LEVEL</span>
                                <span class="skill-percentage">72%</span>
                            </div>
                            <div class="skill-progress-container">
                                <div class="skill-progress-bar" data-width="72"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="hud-container mission-hud">
                <div class="mission-title">『 使命宣言 - Mission Statement 』</div>
                <div class="mission-statement">
                    "以效率為劍，以創意為盾，在數位戰場上開拓無限可能！<br>
                    每一個挑戰都是成長的機會，每一次突破都是對極限的超越！<br>
                    在代碼的世界中追求完美，在創新的道路上永不止步！"
                </div>
                
                <div class="contact-terminal">
                    <div class="contact-label">◆ 聯繫座標 - Contact Protocol ◆</div>
                    <div class="contact-value">3b017128@gm.student.ncut.edu.tw</div>
                </div>
            </div>
            
            <div class="return-hud">
                <a href="../index.php" class="cyber-return-button">
                    <span class="return-icon">◀</span>
                    <span>返回主界面</span>
                </a>
            </div>
        </div>
        
        <script>
            // 增強粒子效果
            function createParticles() {
                const particlesContainer = document.getElementById('particles');
                const particleCount = 40;
                
                for (let i = 0; i < particleCount; i++) {
                    const particle = document.createElement('div');
                    particle.className = 'particle';
                    particle.style.left = Math.random() * 100 + '%';
                    particle.style.animationDelay = Math.random() * 8 + 's';
                    particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
                    
                    // 隨機粒子顏色
                    const colors = ['#00ffff', '#ff00ff', '#ffff00'];
                    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
                    particle.style.boxShadow = `0 0 10px ${particle.style.background}`;
                    
                    particlesContainer.appendChild(particle);
                }
            }
            
            // 技能進度條動畫
            function animateSkillBars() {
                const progressBars = document.querySelectorAll('.skill-progress-bar');
                
                progressBars.forEach((bar, index) => {
                    const targetWidth = bar.getAttribute('data-width');
                    
                    setTimeout(() => {
                        bar.style.width = targetWidth + '%';
                    }, index * 300 + 500);
                });
            }
            
            // HUD 系統啟動效果
            function initializeHUD() {
                const hudContainers = document.querySelectorAll('.hud-container');
                
                hudContainers.forEach((container, index) => {
                    container.style.opacity = '0';
                    container.style.transform = 'translateY(50px)';
                    container.style.transition = 'all 0.8s ease';
                    
                    setTimeout(() => {
                        container.style.opacity = '1';
                        container.style.transform = 'translateY(0)';
                    }, index * 200 + 300);
                });
            }
            
            // 打字機效果增強
            function typewriterEffect() {
                const bioTexts = document.querySelectorAll('.bio-text');
                
                bioTexts.forEach((text, index) => {
                    const originalText = text.textContent;
                    text.textContent = '';
                    
                    setTimeout(() => {
                        let i = 0;
                        const typeInterval = setInterval(() => {
                            if (i < originalText.length) {
                                text.textContent += originalText.charAt(i);
                                i++;
                            } else {
                                clearInterval(typeInterval);
                            }
                        }, 30);
                    }, index * 2000 + 1000);
                });
            }
            
            // 隨機系統故障效果
            function randomGlitchEffect() {
                const glitchElements = [
                    '.hud-title',
                    '.chapter-title',
                    '.skill-name',
                    '.mission-title'
                ];
                
                setInterval(() => {
                    if (Math.random() > 0.85) {
                        const randomElement = document.querySelector(
                            glitchElements[Math.floor(Math.random() * glitchElements.length)]
                        );
                        
                        if (randomElement) {
                            randomElement.style.animation = 'none';
                            setTimeout(() => {
                                randomElement.style.animation = '';
                            }, 10);
                            
                            randomElement.style.textShadow = `
                                ${Math.random() * 4 - 2}px 0 #ff00ff,
                                ${Math.random() * 4 - 2}px 0 #00ffff,
                                0 0 15px currentColor
                            `;
                            
                            setTimeout(() => {
                                randomElement.style.textShadow = '';
                            }, 200);
                        }
                    }
                }, 3000);
            }
            
            // 技能模組懸停效果增強
            function enhanceSkillModules() {
                const skillModules = document.querySelectorAll('.skill-module');
                
                skillModules.forEach(module => {
                    module.addEventListener('mouseenter', function() {
                        const icon = this.querySelector('.skill-icon');
                        const progressBar = this.querySelector('.skill-progress-bar');
                        
                        if (icon) {
                            icon.style.animation = 'iconSpin 1s linear infinite';
                        }
                        
                        if (progressBar) {
                            progressBar.style.animation = 'progressPulse 0.5s ease-in-out infinite alternate';
                        }
                    });
                    
                    module.addEventListener('mouseleave', function() {
                        const icon = this.querySelector('.skill-icon');
                        const progressBar = this.querySelector('.skill-progress-bar');
                        
                        if (icon) {
                            icon.style.animation = 'iconSpin 8s linear infinite';
                        }
                        
                        if (progressBar) {
                            progressBar.style.animation = 'progressPulse 2s ease-in-out infinite alternate';
                        }
                    });
                });
            }
            
            // 音效模擬（視覺反饋）
            function simulateAudioFeedback() {
                const interactiveElements = document.querySelectorAll('a, .skill-module, .contact-terminal');
                
                interactiveElements.forEach(element => {
                    element.addEventListener('mouseenter', function() {
                        // 創建視覺"音效"反饋
                        const feedback = document.createElement('div');
                        feedback.style.position = 'fixed';
                        feedback.style.pointerEvents = 'none';
                        feedback.style.width = '4px';
                        feedback.style.height = '4px';
                        feedback.style.background = '#00ffff';
                        feedback.style.borderRadius = '50%';
                        feedback.style.boxShadow = '0 0 15px currentColor';
                        feedback.style.zIndex = '9999';
                        feedback.style.animation = 'audioFeedback 0.3s ease-out forwards';
                        
                        const rect = this.getBoundingClientRect();
                        feedback.style.left = (rect.left + rect.width / 2) + 'px';
                        feedback.style.top = (rect.top + rect.height / 2) + 'px';
                        
                        document.body.appendChild(feedback);
                        
                        setTimeout(() => {
                            feedback.remove();
                        }, 300);
                    });
                });
            }
            
            // 添加音效反饋動畫
            const audioFeedbackCSS = `
                @keyframes audioFeedback {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(4);
                        opacity: 0;
                    }
                }
            `;
            
            const style = document.createElement('style');
            style.textContent = audioFeedbackCSS;
            document.head.appendChild(style);
            
            // 頁面載入完成後執行所有初始化
            document.addEventListener('DOMContentLoaded', function() {
                createParticles();
                initializeHUD();
                
                // 延遲執行動畫效果
                setTimeout(() => {
                    animateSkillBars();
                    typewriterEffect();
                    enhanceSkillModules();
                    simulateAudioFeedback();
                    randomGlitchEffect();
                }, 1000);
            });
        </script>
    </body>
</html>