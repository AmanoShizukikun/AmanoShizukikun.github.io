<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once '../include/auth.php';

$message_sent = false;
$error_message = '';
$success_message = '';

// 處理表單提交
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = $_POST['name'] ?? '';
    $email = $_POST['email'] ?? '';
    $message = $_POST['message'] ?? '';
    $subject = $_POST['subject'] ?? '';
    
    if (empty($name) || empty($email) || empty($message) || empty($subject)) {
        $error_message = '請填寫所有必填欄位';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error_message = '請輸入有效的電子郵件地址';
    } elseif (strlen($message) < 10) {
        $error_message = '訊息內容至少需要 10 個字符';
    } else {
        $success_message = '訊息發送成功！我們會盡快回覆您。';
        $message_sent = true;
        // 清空表單數據
        $name = $email = $message = $subject = '';
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CONTACT - Communication Terminal</title>
    <?php include '../include/style.php'; ?>
    <style>
        /* 主要聯絡容器 */
        .contact-hud {
            position: relative;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(26, 26, 46, 0.95));
            border: 3px solid transparent;
            border-image: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff) 1;
            border-radius: 20px;
            padding: 40px;
            margin: 30px 0;
            backdrop-filter: blur(20px);
            overflow: hidden;
            animation: hudPulse 8s infinite ease-in-out;
            box-shadow: 
                0 0 100px rgba(0, 255, 255, 0.15),
                inset 0 0 50px rgba(0, 255, 255, 0.05);
        }
        
        @keyframes hudPulse {
            0%, 100% {
                box-shadow: 0 0 100px rgba(0, 255, 255, 0.15), inset 0 0 50px rgba(0, 255, 255, 0.05);
            }
            50% {
                box-shadow: 0 0 150px rgba(255, 0, 255, 0.2), inset 0 0 80px rgba(255, 0, 255, 0.08);
            }
        }
        
        .contact-hud::before {
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
        
        .contact-hud::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 255, 255, 0.1) 2px,
                    rgba(0, 255, 255, 0.1) 4px
                );
            animation: gridPulse 4s ease-in-out infinite alternate;
            pointer-events: none;
            z-index: 0;
        }
        
        @keyframes gridPulse {
            0% { opacity: 0.1; }
            100% { opacity: 0.3; }
        }
        
        /* 標題區域 */
        .contact-header {
            position: relative;
            z-index: 10;
            text-align: center;
            margin-bottom: 40px;
            padding: 30px 20px;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 46, 0.9));
            border: 3px solid #00ffff;
            border-radius: 15px;
            backdrop-filter: blur(15px);
            overflow: hidden;
            box-shadow: 
                0 0 30px rgba(0, 255, 255, 0.3),
                inset 0 0 30px rgba(0, 255, 255, 0.05);
        }
        
        .contact-title {
            font-size: clamp(1.8em, 5vw, 2.5em);
            font-family: 'Orbitron', sans-serif;
            color: #00ffff;
            text-shadow: 
                0 0 20px rgba(0, 255, 255, 0.8),
                0 0 40px rgba(0, 255, 255, 0.5),
                0 0 60px rgba(0, 255, 255, 0.3);
            margin-bottom: 15px;
            animation: titleGlitch 4s infinite;
            position: relative;
            text-transform: uppercase;
            letter-spacing: clamp(1px, 0.5vw, 3px);
            font-weight: 900;
            z-index: 2;
        }
        
        @keyframes titleGlitch {
            0%, 90%, 100% {
                filter: hue-rotate(0deg);
                transform: translateX(0);
            }
            10% {
                filter: hue-rotate(90deg);
                transform: translateX(-2px);
            }
        }
        
        @keyframes glitchShift {
            0%, 100% { transform: translate(0); }
            20% { transform: translate(-1px, 1px); }
            40% { transform: translate(1px, -1px); }
            60% { transform: translate(-1px, 2px); }
            80% { transform: translate(1px, -2px); }
        }
        
        .contact-subtitle {
            font-size: clamp(0.9em, 2.5vw, 1.2em);
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 15px;
            text-shadow: 0 0 10px currentColor;
        }
        
        .system-status {
            display: flex;
            justify-content: center;
            gap: 15px;
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
            font-size: 0.85em;
            font-weight: 600;
            color: #00ffff;
            text-shadow: 0 0 8px currentColor;
            transition: all 0.3s ease;
        }
        
        .status-indicator:hover {
            background: rgba(0, 255, 255, 0.2);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.4);
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
        
        /* 表單區域 */
        .contact-form-container {
            position: relative;
            z-index: 10;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #ff00ff;
            border-radius: 15px;
            padding: 35px;
            margin: 30px 0;
            backdrop-filter: blur(15px);
            box-shadow: 
                0 0 30px rgba(255, 0, 255, 0.2),
                inset 0 0 30px rgba(255, 0, 255, 0.05);
        }
        
        .contact-form-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 20% 20%, rgba(0, 255, 255, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(255, 0, 255, 0.05) 0%, transparent 50%);
            border-radius: 15px;
            pointer-events: none;
        }
        
        .form-section-title {
            font-size: clamp(1.2em, 3vw, 1.5em);
            color: #ff00ff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            margin-bottom: 25px;
            text-shadow: 0 0 15px currentColor;
            position: relative;
            text-transform: uppercase;
            letter-spacing: 2px;
            z-index: 1;
            text-align: center;
        }
        
        .form-section-title::before {
            content: '◆';
            position: absolute;
            left: -30px;
            top: 50%;
            transform: translateY(-50%);
            color: #00ffff;
            animation: pulse 2s infinite;
            font-size: 0.8em;
        }
        
        .form-section-title::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 2px;
            background: linear-gradient(90deg, transparent, #ff00ff, transparent);
            animation: underlineExpand 3s ease-in-out infinite;
        }
        
        @keyframes underlineExpand {
            0%, 100% { width: 80%; opacity: 0.5; }
            50% { width: 100%; opacity: 1; }
        }
        
        /* 表單佈局 */
        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 25px;
            position: relative;
            z-index: 1;
        }
        
        .form-group {
            position: relative;
        }
        
        .form-group.full-width {
            grid-column: 1 / -1;
        }
        
        .form-label {
            display: block;
            color: #00ffff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 1em;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
            position: relative;
        }
        
        .form-label::before {
            content: '▶';
            margin-right: 8px;
            color: #ff00ff;
            font-size: 0.8em;
            animation: blink 2s infinite;
        }
        
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }
        
        .form-input, .form-select {
            width: 100%;
            padding: 18px 20px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid rgba(0, 255, 255, 0.3);
            border-radius: 0;
            clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
            color: #ffffff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1em;
            transition: all 0.3s ease;
            box-sizing: border-box;
            position: relative;
        }
        
        .form-input:focus, .form-select:focus {
            outline: none;
            border-color: #00ffff;
            background: rgba(0, 0, 0, 0.9);
            box-shadow: 
                0 0 20px rgba(0, 255, 255, 0.3),
                inset 0 0 20px rgba(0, 255, 255, 0.1);
            color: #ffffff;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
        }
        
        .form-input::placeholder {
            color: rgba(255, 255, 255, 0.4);
            font-style: italic;
        }
        
        .form-textarea {
            width: 100%;
            min-height: 120px;
            resize: vertical;
            font-family: 'Rajdhani', sans-serif;
            line-height: 1.6;
        }
        
        .form-select option {
            background: rgba(0, 0, 0, 0.9);
            color: #ffffff;
            padding: 10px;
        }
        
        /* 修改後的提交按鈕 - 參考 about.php 的 cyber-return-button 風格 */
        .submit-container {
            text-align: center;
            margin-top: 40px;
            position: relative;
            z-index: 1;
        }
        
        .cyber-submit-button {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 20px 50px;
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(0, 150, 255, 0.2));
            border: 3px solid #00ffff;
            color: #00ffff;
            text-decoration: none;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 3px;
            font-family: 'Orbitron', sans-serif;
            font-size: 1.1em;
            border-radius: 0;
            clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);
            transition: all 0.4s ease;
            overflow: hidden;
            text-shadow: 0 0 10px currentColor;
            box-shadow: 
                0 5px 15px rgba(0, 255, 255, 0.3),
                inset 0 0 20px rgba(0, 255, 255, 0.05);
            cursor: pointer;
            backdrop-filter: blur(10px);
            transform-style: preserve-3d;
            perspective: 1000px;
        }
        
        .cyber-submit-button::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(
                from 0deg,
                transparent,
                rgba(0, 255, 255, 0.3),
                transparent,
                rgba(255, 0, 255, 0.3),
                transparent
            );
            animation: submitButtonRotate 4s linear infinite;
            opacity: 0;
            transition: opacity 0.4s ease;
        }
        
        @keyframes submitButtonRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .cyber-submit-button::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.6s ease;
            z-index: 1;
        }
        
        .cyber-submit-button:hover {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.4), rgba(0, 150, 255, 0.4));
            border-color: #ffffff;
            color: #ffffff;
            transform: translateY(-5px) rotateX(5deg) rotateY(5deg) scale(1.05);
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
            box-shadow: 
                0 10px 30px rgba(0, 255, 255, 0.5),
                inset 0 0 40px rgba(0, 255, 255, 0.2);
        }
        
        .cyber-submit-button:hover::before {
            opacity: 1;
        }
        
        .cyber-submit-button:hover::after {
            left: 100%;
        }
        
        .submit-icon {
            font-size: 1.2em;
            margin-right: 12px;
            animation: submitIconPulse 2s ease-in-out infinite;
            position: relative;
            z-index: 2;
        }
        
        .submit-text {
            position: relative;
            z-index: 2;
        }
        
        @keyframes submitIconPulse {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.1) rotate(10deg); }
        }
        
        /* 載入狀態 */
        .cyber-submit-button.loading {
            background: linear-gradient(45deg, #ffff00, #ff9900);
            border-color: #ffff00;
            pointer-events: none;
        }
        
        .cyber-submit-button.loading .submit-icon {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* 訊息狀態 */
        .message-status {
            padding: 18px 25px;
            border-radius: 10px;
            margin: 25px 0;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            font-size: 1.1em;
            text-align: center;
            position: relative;
            z-index: 10;
            animation: messageSlideIn 0.5s ease;
        }
        
        @keyframes messageSlideIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .error-message {
            background: linear-gradient(135deg, rgba(255, 0, 0, 0.2), rgba(200, 0, 0, 0.2));
            border: 2px solid rgba(255, 0, 0, 0.6);
            color: #ff6b6b;
            text-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
        }
        
        .success-message {
            background: linear-gradient(135deg, rgba(0, 255, 0, 0.2), rgba(0, 200, 0, 0.2));
            border: 2px solid rgba(0, 255, 0, 0.6);
            color: #51cf66;
            text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }
        
        /* 聯絡方式資訊面板 */
        .contact-info-panel {
            position: relative;
            z-index: 10;
            background: rgba(0, 0, 0, 0.85);
            border: 2px solid #ffff00;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            backdrop-filter: blur(15px);
            box-shadow: 
                0 0 30px rgba(255, 255, 0, 0.2),
                inset 0 0 30px rgba(255, 255, 0, 0.05);
        }
        
        .contact-info-title {
            font-size: clamp(1.2em, 3vw, 1.5em);
            color: #ffff00;
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            margin-bottom: 25px;
            text-shadow: 0 0 15px currentColor;
            position: relative;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-align: center;
        }
        
        .contact-info-title::before {
            content: '◆';
            position: absolute;
            left: -30px;
            top: 50%;
            transform: translateY(-50%);
            color: #00ffff;
            animation: pulse 2s infinite;
            font-size: 0.8em;
        }
        
        .contact-methods {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            position: relative;
            z-index: 1;
        }
        
        .contact-method {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 25px 20px;
            background: rgba(0, 0, 0, 0.6);
            border: 2px solid rgba(255, 255, 0, 0.3);
            border-radius: 12px;
            transition: all 0.4s ease;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
        }
        
        .contact-method::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s ease;
        }
        
        .contact-method:hover {
            border-color: #ffff00;
            background: rgba(255, 255, 0, 0.1);
            box-shadow: 0 0 25px rgba(255, 255, 0, 0.4);
            transform: translateY(-5px) scale(1.05);
            text-decoration: none;
            color: inherit;
        }
        
        .contact-method:hover::before {
            left: 100%;
        }
        
        .contact-method-icon {
            font-size: 2.5em;
            margin-bottom: 15px;
            animation: iconPulse 3s ease-in-out infinite;
            display: block;
            transition: transform 0.3s ease;
        }
        
        .contact-method:hover .contact-method-icon {
            transform: scale(1.2) rotate(10deg);
        }
        
        @keyframes iconPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .contact-method-label {
            color: #ffff00;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 1.1em;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-shadow: 0 0 10px currentColor;
        }
        
        .contact-method-value {
            color: #ffffff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1em;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
            word-break: break-all;
        }
        
        /* 返回按鈕 - 參考 about.php 風格 */
        .return-hud {
            text-align: center;
            margin-top: 40px;
            position: relative;
            z-index: 10;
        }
        
        .cyber-return-button {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 20px 45px;
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(0, 150, 255, 0.2));
            border: 3px solid #00ffff;
            color: #00ffff;
            text-decoration: none;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 3px;
            font-family: 'Orbitron', sans-serif;
            font-size: 1em;
            border-radius: 10px;
            transition: all 0.4s ease;
            overflow: hidden;
            text-shadow: 0 0 10px currentColor;
            box-shadow: 
                0 5px 15px rgba(0, 255, 255, 0.3),
                inset 0 0 20px rgba(0, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            transform-style: preserve-3d;
            perspective: 1000px;
        }
        
        .cyber-return-button::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(
                from 0deg,
                transparent,
                rgba(0, 255, 255, 0.3),
                transparent,
                rgba(255, 0, 255, 0.3),
                transparent
            );
            animation: returnButtonRotate 6s linear infinite;
            opacity: 0;
            transition: opacity 0.4s ease;
        }
        
        @keyframes returnButtonRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .cyber-return-button:hover {
            border-color: #ffffff;
            color: #ffffff;
            transform: translateY(-3px) rotateX(5deg) rotateY(5deg) scale(1.05);
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
            box-shadow: 
                0 8px 25px rgba(0, 255, 255, 0.4),
                inset 0 0 40px rgba(0, 255, 255, 0.2);
        }
        
        .cyber-return-button:hover::before {
            opacity: 1;
        }
        
        .return-icon {
            font-size: 1.2em;
            animation: returnIconBounce 2s infinite;
            position: relative;
            z-index: 2;
            margin-right: 10px;
        }
        
        .return-text {
            position: relative;
            z-index: 2;
        }
        
        @keyframes returnIconBounce {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-3px); }
        }
        
        /* 響應式設計 */
        @media (max-width: 768px) {
            .contact-hud {
                padding: 25px 20px;
                margin: 20px 0;
            }
            
            .contact-title {
                font-size: 1.8em;
                letter-spacing: 2px;
            }
            
            .form-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .contact-methods {
                grid-template-columns: 1fr;
            }
            
            .system-status {
                flex-direction: column;
                gap: 10px;
            }
            
            .cyber-submit-button {
                padding: 18px 35px;
                font-size: 1em;
            }
            
            .form-section-title::before {
                left: -20px;
            }
            
            .contact-info-title::before {
                left: -20px;
            }
        }
        
        @media (max-width: 480px) {
            .contact-header {
                padding: 20px 15px;
            }
            
            .contact-title {
                font-size: 1.5em;
                letter-spacing: 1px;
            }
            
            .form-input, .form-select {
                padding: 15px 18px;
                font-size: 0.95em;
            }
            
            .contact-method {
                padding: 20px 15px;
            }
            
            .contact-method-icon {
                font-size: 2em;
                margin-bottom: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="particles" id="particles"></div>
    
    <?php include '../include/menu.php'; ?>
    
    <div class="container">
        <div class="contact-hud">
            <div class="contact-header">
                <h1 class="contact-title">◆ COMMUNICATION TERMINAL ◆</h1>
                <p class="contact-subtitle">SECURE MESSAGE TRANSMISSION</p>
                <div class="system-status">
                    <div class="status-indicator">
                        <span class="status-dot"></span>
                        <span>SYSTEM ONLINE</span>
                    </div>
                    <div class="status-indicator">
                        <span class="status-dot"></span>
                        <span>ENCRYPTION ACTIVE</span>
                    </div>
                    <div class="status-indicator">
                        <span class="status-dot"></span>
                        <span>READY TO TRANSMIT</span>
                    </div>
                </div>
            </div>
            
            <?php if ($error_message): ?>
                <div class="message-status error-message">
                    ◆ ERROR: <?php echo htmlspecialchars($error_message); ?> ◆
                </div>
            <?php endif; ?>
            
            <?php if ($success_message): ?>
                <div class="message-status success-message">
                    ◆ SUCCESS: <?php echo htmlspecialchars($success_message); ?> ◆
                </div>
            <?php endif; ?>
            
            <div class="contact-form-container">
                <h2 class="form-section-title">MESSAGE TRANSMISSION PROTOCOL</h2>
                
                <form method="POST" action="contact.php" id="contactForm">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label" for="name">傳送者識別碼</label>
                            <input type="text" 
                                   id="name" 
                                   name="name" 
                                   class="form-input" 
                                   placeholder="請輸入您的姓名" 
                                   value="<?php echo htmlspecialchars($name ?? ''); ?>"
                                   required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="email">通訊頻道</label>
                            <input type="email" 
                                   id="email" 
                                   name="email" 
                                   class="form-input" 
                                   placeholder="請輸入您的電子郵件" 
                                   value="<?php echo htmlspecialchars($email ?? ''); ?>"
                                   required>
                        </div>
                        
                        <div class="form-group full-width">
                            <label class="form-label" for="subject">訊息類別</label>
                            <select id="subject" name="subject" class="form-select" required>
                                <option value="">請選擇訊息類別</option>
                                <option value="general" <?php echo ($subject ?? '') === 'general' ? 'selected' : ''; ?>>一般詢問</option>
                                <option value="technical" <?php echo ($subject ?? '') === 'technical' ? 'selected' : ''; ?>>技術支援</option>
                                <option value="collaboration" <?php echo ($subject ?? '') === 'collaboration' ? 'selected' : ''; ?>>合作提案</option>
                                <option value="feedback" <?php echo ($subject ?? '') === 'feedback' ? 'selected' : ''; ?>>意見反饋</option>
                                <option value="other" <?php echo ($subject ?? '') === 'other' ? 'selected' : ''; ?>>其他事項</option>
                            </select>
                        </div>
                        
                        <div class="form-group full-width">
                            <label class="form-label" for="message">訊息內容</label>
                            <textarea id="message" 
                                      name="message" 
                                      class="form-input form-textarea" 
                                      rows="6" 
                                      placeholder="請輸入您的訊息內容（至少10個字符）"
                                      required><?php echo htmlspecialchars($message ?? ''); ?></textarea>
                        </div>
                    </div>
                    
                    <div class="submit-container">
                        <button type="submit" class="cyber-submit-button" id="submitButton">
                            <span class="submit-icon">◢</span>
                            <span class="submit-text">傳送訊息</span>
                        </button>
                    </div>
                </form>
            </div>
            
            <div class="contact-info-panel">
                <h2 class="contact-info-title">其他聯絡方式</h2>
                <div class="contact-methods">
                    <!-- 電子郵件 - 可點擊開啟郵件應用程式 -->
                    <a href="mailto:3b017128@gm.student.ncut.edu.tw" class="contact-method">
                        <div class="contact-method-icon">📧</div>
                        <div class="contact-method-label">電子郵件</div>
                        <div class="contact-method-value">3b017128@gm.student.ncut.edu.tw</div>
                    </a>
                    
                    <!-- Discord - 可點擊複製使用者名稱 -->
                    <div class="contact-method" onclick="copyDiscordUsername()">
                        <div class="contact-method-icon">💬</div>
                        <div class="contact-method-label">Discord</div>
                        <div class="contact-method-value">amano_shizuki_kun</div>
                    </div>
                    
                    <!-- GitHub - 可點擊開啟GitHub頁面 -->
                    <a href="https://github.com/AmanoShizukikun" class="contact-method" target="_blank" rel="noopener noreferrer">
                        <div class="contact-method-icon">🔗</div>
                        <div class="contact-method-label">GitHub</div>
                        <div class="contact-method-value">AmanoShizukikun</div>
                    </a>
                </div>
            </div>
        </div>
        
        <div class="return-hud">
            <a href="../index.php" class="cyber-return-button">
                <span class="return-icon">◀</span>
                <span class="return-text">返回主界面</span>
            </a>
        </div>
    </div>
    
    <script>
        // 複製Discord使用者名稱到剪貼簿
        function copyDiscordUsername() {
            const username = 'amano_shizuki_kun';
            
            // 嘗試使用現代 API
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(username).then(function() {
                    showCopyNotification('Discord 使用者名稱已複製到剪貼簿！');
                }).catch(function() {
                    fallbackCopyMethod(username);
                });
            } else {
                fallbackCopyMethod(username);
            }
        }
        
        // 後備複製方法
        function fallbackCopyMethod(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showCopyNotification('Discord 使用者名稱已複製到剪貼簿！');
            } catch (err) {
                showCopyNotification('複製失敗，請手動選取：amano_shizuki_kun');
            }
            
            document.body.removeChild(textArea);
        }
        
        // 顯示複製通知
        function showCopyNotification(message) {
            // 創建通知元素
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, rgba(0, 255, 255, 0.9), rgba(0, 150, 255, 0.9));
                color: #000000;
                padding: 15px 25px;
                border-radius: 10px;
                font-family: 'Rajdhani', sans-serif;
                font-weight: bold;
                font-size: 1.1em;
                z-index: 10000;
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
                animation: notificationSlide 3s ease forwards;
                text-shadow: none;
                clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
            `;
            
            // 添加動畫樣式
            const style = document.createElement('style');
            style.textContent = `
                @keyframes notificationSlide {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(notification);
            
            // 3秒後移除通知
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 3000);
        }
        
        // 增強粒子效果
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            const particleCount = window.innerWidth > 768 ? 50 : 25;
            
            // 清除舊粒子
            particlesContainer.innerHTML = '';
            
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 10 + 's';
                particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
                particlesContainer.appendChild(particle);
            }
        }
        
        // 表單驗證增強
        function enhanceFormValidation() {
            const form = document.getElementById('contactForm');
            const inputs = form.querySelectorAll('.form-input, .form-select');
            
            inputs.forEach(input => {
                // 即時驗證反饋
                input.addEventListener('blur', function() {
                    validateField(this);
                });
                
                // 輸入時的視覺反饋
                input.addEventListener('input', function() {
                    this.style.borderColor = 'rgba(0, 255, 255, 0.6)';
                    clearTimeout(this.feedbackTimer);
                    this.feedbackTimer = setTimeout(() => {
                        validateField(this);
                    }, 1000);
                });
                
                // 焦點效果增強
                input.addEventListener('focus', function() {
                    this.style.borderColor = '#00ffff';
                    this.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.4)';
                });
            });
        }
        
        function validateField(field) {
            const value = field.value.trim();
            let isValid = true;
            
            switch (field.type) {
                case 'email':
                    isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                    break;
                case 'text':
                    isValid = value.length >= 2;
                    break;
                default:
                    if (field.tagName.toLowerCase() === 'textarea') {
                        isValid = value.length >= 10;
                    } else {
                        isValid = value.length > 0;
                    }
            }
            
            if (isValid) {
                field.style.borderColor = 'rgba(0, 255, 0, 0.6)';
                field.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.3)';
            } else {
                field.style.borderColor = 'rgba(255, 0, 0, 0.6)';
                field.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.3)';
            }
        }
        
        // 表單提交動畫增強
        function enhanceFormSubmission() {
            const form = document.getElementById('contactForm');
            const submitButton = document.getElementById('submitButton');
            const originalText = submitButton.querySelector('.submit-text').textContent;
            const submitIcon = submitButton.querySelector('.submit-icon');
            
            form.addEventListener('submit', function(e) {
                // 添加載入狀態
                submitButton.classList.add('loading');
                submitButton.querySelector('.submit-text').textContent = '傳送中...';
                submitIcon.style.animation = 'spin 1s linear infinite';
                submitButton.disabled = true;
                
                // 模擬載入完成
                setTimeout(() => {
                    if (!document.querySelector('.success-message')) {
                        submitButton.classList.remove('loading');
                        submitButton.querySelector('.submit-text').textContent = originalText;
                        submitIcon.style.animation = 'submitIconPulse 2s ease-in-out infinite';
                        submitButton.disabled = false;
                    }
                }, 3000);
            });
        }
        
        // 打字機效果
        function typewriterEffect() {
            const title = document.querySelector('.contact-title');
            const originalText = title.textContent;
            title.textContent = '';
            
            let i = 0;
            const typeInterval = setInterval(() => {
                title.textContent += originalText.charAt(i);
                i++;
                if (i >= originalText.length) {
                    clearInterval(typeInterval);
                }
            }, 80);
        }
        
        // 狀態指示器動畫增強
        function enhanceStatusIndicators() {
            const indicators = document.querySelectorAll('.status-indicator');
            
            indicators.forEach((indicator, index) => {
                setTimeout(() => {
                    indicator.style.opacity = '0';
                    indicator.style.transform = 'translateX(-20px)';
                    indicator.style.transition = 'all 0.5s ease';
                    
                    setTimeout(() => {
                        indicator.style.opacity = '1';
                        indicator.style.transform = 'translateX(0)';
                    }, 100);
                }, index * 200);
            });
        }
        
        // 自動消失訊息
        function autoHideMessages() {
            const messages = document.querySelectorAll('.message-status');
            messages.forEach(message => {
                setTimeout(() => {
                    message.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    message.style.opacity = '0';
                    message.style.transform = 'translateY(-20px)';
                    setTimeout(() => {
                        if (message.parentNode) {
                            message.remove();
                        }
                    }, 500);
                }, 8000);
            });
        }
        
        // 聯絡方式懸停效果增強
        function enhanceContactMethods() {
            const methods = document.querySelectorAll('.contact-method');
            
            methods.forEach(method => {
                method.addEventListener('mouseenter', function() {
                    const icon = this.querySelector('.contact-method-icon');
                    if (icon) {
                        icon.style.transform = 'scale(1.2) rotate(10deg)';
                        icon.style.transition = 'transform 0.3s ease';
                    }
                });
                
                method.addEventListener('mouseleave', function() {
                    const icon = this.querySelector('.contact-method-icon');
                    if (icon) {
                        icon.style.transform = 'scale(1) rotate(0deg)';
                    }
                });
            });
        }
        
        // 頁面載入完成後執行
        document.addEventListener('DOMContentLoaded', function() {
            createParticles();
            enhanceFormValidation();
            enhanceFormSubmission();
            enhanceStatusIndicators();
            autoHideMessages();
            enhanceContactMethods();
            
            // 延遲執行打字機效果
            setTimeout(typewriterEffect, 500);
            
            // 定期重新生成粒子效果
            setInterval(createParticles, 30000);
        });
    </script>
</body>
</html>