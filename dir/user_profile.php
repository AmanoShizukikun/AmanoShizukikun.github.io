<?php
require_once '../include/auth.php';

$auth = new Auth();

// 檢查是否已登入
if (!$auth->isLoggedIn()) {
    header('Location: login.php');
    exit;
}

$user = $auth->getCurrentUser();
$error_message = '';
$success_message = '';

// 處理個人資料更新
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action']) && $_POST['action'] === 'update_profile') {
        $email = $_POST['email'] ?? '';
        $first_name = $_POST['first_name'] ?? '';
        $last_name = $_POST['last_name'] ?? '';
        $phone = $_POST['phone'] ?? '';
        $bio = $_POST['bio'] ?? '';
        $birth_date = $_POST['birth_date'] ?? '';
        $gender = $_POST['gender'] ?? '';
        $location = $_POST['location'] ?? '';
        
        $result = $auth->updateProfile(
            $user['id'], 
            $email, 
            $first_name, 
            $last_name, 
            $phone, 
            $bio, 
            $birth_date, 
            $gender, 
            $location
        );
        
        if ($result['success']) {
            $success_message = $result['message'];
            // 重新獲取更新後的用戶資料
            $user = $auth->getCurrentUser();
        } else {
            $error_message = $result['message'];
        }
    } elseif (isset($_POST['action']) && $_POST['action'] === 'change_password') {
        $current_password = $_POST['current_password'] ?? '';
        $new_password = $_POST['new_password'] ?? '';
        $confirm_password = $_POST['confirm_password'] ?? '';
        
        if ($new_password === $confirm_password) {
            $result = $auth->changePassword($user['id'], $current_password, $new_password);
            
            if ($result['success']) {
                $success_message = $result['message'];
            } else {
                $error_message = $result['message'];
            }
        } else {
            $error_message = '新密碼確認不匹配';
        }
    }
}

// 獲取用戶完整資料
$userProfile = $auth->getFullUserProfile($user['id']);
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>USER PROFILE - Neural Interface Terminal</title>
    <?php include '../include/style.php'; ?>
    <style>
        /* 主要資料容器 - 增強版 */
        .profile-main-hud {
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
                0 0 60px rgba(0, 255, 255, 0.2),
                inset 0 0 60px rgba(0, 255, 255, 0.03);
        }

        @keyframes hudPulse {
            0%, 100% { 
                box-shadow: 0 0 60px rgba(0, 255, 255, 0.2), inset 0 0 60px rgba(0, 255, 255, 0.03);
            }
            50% { 
                box-shadow: 0 0 100px rgba(255, 0, 255, 0.3), inset 0 0 100px rgba(255, 0, 255, 0.05);
            }
        }

        .profile-main-hud::before {
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

        .profile-main-hud::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                linear-gradient(-45deg, transparent 48%, rgba(255, 0, 255, 0.08) 49%, rgba(255, 0, 255, 0.08) 51%, transparent 52%);
            background-size: 30px 30px;
            animation: gridPulse 4s ease-in-out infinite alternate;
            pointer-events: none;
            z-index: 0;
        }

        @keyframes gridPulse {
            0% { opacity: 0.1; }
            100% { opacity: 0.3; }
        }

        /* 標題區域 */
        .profile-header {
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
                0 0 40px rgba(0, 255, 255, 0.2),
                inset 0 0 40px rgba(0, 255, 255, 0.05);
        }

        .profile-title {
            font-size: clamp(1.8em, 5vw, 2.5em);
            font-family: 'Orbitron', sans-serif;
            color: #00ffff;
            text-shadow: 
                0 0 20px #00ffff,
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
                transform: scale(1); 
            }
            10% { 
                filter: hue-rotate(90deg); 
                transform: scale(1.01) skew(1deg); 
            }
        }

        @keyframes glitchShift {
            0%, 100% { transform: translate(0); }
            20% { transform: translate(-1px, 1px); }
            40% { transform: translate(1px, -1px); }
            60% { transform: translate(-1px, 2px); }
            80% { transform: translate(1px, -2px); }
        }

        .profile-subtitle {
            font-size: clamp(0.9em, 2.5vw, 1.2em);
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 15px;
            text-shadow: 0 0 10px currentColor;
        }

        /* 系統狀態指示器 */
        .system-status {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 20px;
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

        /* 訊息狀態區域 */
        .message-hud {
            position: relative;
            z-index: 15;
            margin: 20px 0;
            padding: 20px;
            border-radius: 15px;
            backdrop-filter: blur(15px);
            text-align: center;
            animation: messageSlideIn 0.5s ease;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        @keyframes messageSlideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .success-message-hud {
            background: linear-gradient(135deg, rgba(0, 255, 0, 0.15), rgba(0, 150, 0, 0.15));
            border: 2px solid #00ff00;
            color: #00ff00;
            box-shadow: 
                0 0 30px rgba(0, 255, 0, 0.3),
                inset 0 0 30px rgba(0, 255, 0, 0.05);
        }

        .error-message-hud {
            background: linear-gradient(135deg, rgba(255, 0, 0, 0.15), rgba(150, 0, 0, 0.15));
            border: 2px solid #ff0000;
            color: #ff0000;
            box-shadow: 
                0 0 30px rgba(255, 0, 0, 0.3),
                inset 0 0 30px rgba(255, 0, 0, 0.05);
        }

        .message-icon {
            font-size: 1.5em;
            margin-right: 10px;
            animation: messageIconPulse 2s ease-in-out infinite;
        }

        @keyframes messageIconPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        /* 用戶資料容器 */
        .profile-container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            position: relative;
            z-index: 10;
        }
        
        /* 資料區塊 */
        .profile-section {
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 46, 0.9));
            border: 2px solid #00ffff;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            backdrop-filter: blur(15px);
            position: relative;
            overflow: hidden;
            transition: all 0.4s ease;
            box-shadow: 
                0 0 30px rgba(0, 255, 255, 0.1),
                inset 0 0 30px rgba(0, 255, 255, 0.03);
        }

        .profile-section::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(
                from 0deg,
                transparent,
                rgba(0, 255, 255, 0.1),
                transparent,
                rgba(255, 0, 255, 0.1),
                transparent
            );
            animation: sectionRotate 15s linear infinite;
            opacity: 0;
            transition: opacity 0.4s ease;
        }

        .profile-section:hover::before {
            opacity: 1;
        }

        @keyframes sectionRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .profile-section:hover {
            border-color: #ff00ff;
            transform: translateY(-5px) scale(1.01);
            box-shadow: 
                0 10px 40px rgba(255, 0, 255, 0.2),
                inset 0 0 40px rgba(255, 0, 255, 0.05);
        }
        
        .section-title {
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            font-size: 1.5em;
            margin-bottom: 25px;
            text-shadow: 
                0 0 15px currentColor,
                0 0 30px rgba(0, 255, 255, 0.5);
            position: relative;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 700;
            z-index: 1;
        }

        .section-title::before {
            content: '◆';
            position: absolute;
            left: -30px;
            top: 50%;
            transform: translateY(-50%);
            color: #ff00ff;
            animation: pulse 2s infinite;
            font-size: 0.8em;
            text-shadow: 0 0 15px currentColor;
        }

        .section-title::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 0;
            width: 60%;
            height: 2px;
            background: linear-gradient(90deg, #00ffff, transparent);
            animation: titleUnderline 3s ease-in-out infinite;
        }

        @keyframes titleUnderline {
            0%, 100% { width: 60%; opacity: 0.5; }
            50% { width: 100%; opacity: 1; }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: translateY(-50%) scale(1); }
            50% { opacity: 0.7; transform: translateY(-50%) scale(1.2); }
        }
        
        /* 基本資訊網格 */
        .user-info {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 20px;
            align-items: center;
            margin-bottom: 20px;
            position: relative;
            z-index: 1;
        }
        
        .info-label {
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 1em;
            text-transform: uppercase;
            letter-spacing: 1px;
            min-width: 120px;
            text-shadow: 0 0 8px currentColor;
            position: relative;
        }

        .info-label::before {
            content: '▶';
            margin-right: 8px;
            color: #00ffff;
            font-size: 0.8em;
            animation: blink 2s infinite;
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }
        
        .info-value {
            color: #e0e0e0;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.1em;
            font-weight: 500;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
            padding: 10px 15px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(0, 255, 255, 0.2);
            border-radius: 8px;
            transition: all 0.3s ease;
        }

        .info-value:hover {
            background: rgba(0, 0, 0, 0.7);
            border-color: #00ffff;
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
        }
        
        /* 表單佈局增強 */
        .form-row {
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

        .form-input, .form-textarea, .form-select {
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

        .form-input:focus, .form-textarea:focus, .form-select:focus {
            outline: none;
            border-color: #00ffff;
            background: rgba(0, 0, 0, 0.9);
            box-shadow: 
                0 0 20px rgba(0, 255, 255, 0.3),
                inset 0 0 20px rgba(0, 255, 255, 0.1);
            color: #ffffff;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
        }

        .form-input::placeholder, .form-textarea::placeholder {
            color: rgba(255, 255, 255, 0.4);
            font-style: italic;
        }

        .form-textarea {
            min-height: 120px;
            resize: vertical;
            line-height: 1.6;
        }

        .form-select option {
            background: rgba(0, 0, 0, 0.9);
            color: #ffffff;
            padding: 10px;
        }

        /* 提交按鈕增強 */
        .submit-container {
            text-align: center;
            margin-top: 30px;
            position: relative;
            z-index: 1;
        }

        .submit-button {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 18px 40px;
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(0, 150, 255, 0.2));
            border: 3px solid #00ffff;
            color: #00ffff;
            text-decoration: none;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 3px;
            font-family: 'Orbitron', sans-serif;
            font-size: 1em;
            border-radius: 0;
            clip-path: polygon(15px 0%, 100% 0%, calc(100% - 15px) 100%, 0% 100%);
            transition: all 0.4s ease;
            overflow: hidden;
            text-shadow: 0 0 10px currentColor;
            box-shadow: 
                0 0 20px rgba(0, 255, 255, 0.2),
                inset 0 0 20px rgba(0, 255, 255, 0.05);
            cursor: pointer;
            backdrop-filter: blur(10px);
            transform-style: preserve-3d;
            perspective: 1000px;
        }

        .submit-button::before {
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

        .submit-button::after {
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

        .submit-button:hover {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.4), rgba(0, 150, 255, 0.4));
            border-color: #ffffff;
            color: #ffffff;
            transform: translateY(-3px) rotateX(5deg) rotateY(5deg) scale(1.05);
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
            box-shadow: 
                0 10px 30px rgba(0, 255, 255, 0.4),
                inset 0 0 30px rgba(0, 255, 255, 0.1);
        }

        .submit-button:hover::before {
            opacity: 1;
        }

        .submit-button:hover::after {
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
            50% { transform: scale(1.1) rotate(5deg); }
        }

        /* 返回按鈕 */
        .return-hud {
            text-align: center;
            margin-top: 40px;
            position: relative;
            z-index: 10;
        }

        .cyber-return-btn {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 18px 40px;
            background: linear-gradient(135deg, rgba(255, 0, 255, 0.15), rgba(150, 0, 255, 0.15));
            border: 2px solid #ff00ff;
            color: #ff00ff;
            text-decoration: none;
            text-transform: uppercase;
            font-weight: bold;
            letter-spacing: 2px;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.9em;
            border-radius: 8px;
            transition: all 0.4s ease;
            overflow: hidden;
            text-shadow: 0 0 10px currentColor;
            box-shadow: 
                0 0 20px rgba(255, 0, 255, 0.2),
                inset 0 0 20px rgba(255, 0, 255, 0.05);
            backdrop-filter: blur(10px);
        }

        .cyber-return-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.6s ease;
            z-index: 1;
        }

        .cyber-return-btn:hover {
            background: linear-gradient(135deg, rgba(255, 0, 255, 0.3), rgba(150, 0, 255, 0.3));
            border-color: #ffffff;
            color: #ffffff;
            transform: translateY(-3px) scale(1.05);
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
            box-shadow: 
                0 8px 25px rgba(255, 0, 255, 0.4),
                inset 0 0 25px rgba(255, 0, 255, 0.1);
        }

        .cyber-return-btn:hover::before {
            left: 100%;
        }

        .btn-icon {
            font-size: 1.1em;
            margin-right: 10px;
            animation: iconFloat 2s ease-in-out infinite;
            position: relative;
            z-index: 2;
        }

        .btn-text {
            position: relative;
            z-index: 2;
        }

        @keyframes iconFloat {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            25% { transform: translateY(-2px) rotate(5deg); }
            50% { transform: translateY(0px) rotate(0deg); }
            75% { transform: translateY(-1px) rotate(-5deg); }
        }
        
        /* 響應式設計 */
        @media (max-width: 768px) {
            .form-row {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .profile-container {
                padding: 10px;
            }

            .profile-section {
                padding: 20px;
                margin-bottom: 20px;
            }

            .user-info {
                grid-template-columns: 1fr;
                gap: 15px;
            }

            .info-label {
                min-width: auto;
                margin-bottom: 5px;
            }

            .profile-title {
                font-size: 1.8em;
            }

            .submit-button {
                padding: 15px 30px;
                font-size: 0.9em;
            }
        }

        @media (max-width: 480px) {
            .profile-main-hud {
                padding: 20px;
                margin: 15px 0;
            }

            .profile-header {
                padding: 20px 15px;
            }

            .system-status {
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }

            .section-title::before {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="particles" id="particles"></div>
    
    <?php include '../include/menu.php'; ?>
    
    <div class="container">
        <div class="profile-main-hud">
            <!-- 標題區域 -->
            <div class="profile-header">
                <h1 class="profile-title">◆ USER PROFILE ◆</h1>
                <p class="profile-subtitle">Neural Interface Terminal</p>
                
                <div class="system-status">
                    <div class="status-indicator">
                        <span class="status-dot"></span>
                        <span>SYSTEM ONLINE</span>
                    </div>
                    <div class="status-indicator">
                        <span class="status-dot" style="background: #ffff00;"></span>
                        <span>DATA SYNC</span>
                    </div>
                    <div class="status-indicator">
                        <span class="status-dot" style="background: #ff00ff;"></span>
                        <span>SECURE MODE</span>
                    </div>
                </div>
            </div>
            
            <!-- 訊息狀態 -->
            <?php if ($error_message): ?>
                <div class="message-hud error-message-hud">
                    <span class="message-icon">⚠</span><?php echo htmlspecialchars($error_message); ?>
                </div>
            <?php endif; ?>
            
            <?php if ($success_message): ?>
                <div class="message-hud success-message-hud">
                    <span class="message-icon">✓</span><?php echo htmlspecialchars($success_message); ?>
                </div>
            <?php endif; ?>
            
            <div class="profile-container">
                <!-- 基本資訊 -->
                <div class="profile-section">
                    <h2 class="section-title">◆ 系統資訊</h2>
                    <div class="user-info">
                        <span class="info-label">用戶名</span>
                        <span class="info-value"><?php echo htmlspecialchars($user['username']); ?></span>
                        
                        <span class="info-label">電子郵件</span>
                        <span class="info-value"><?php echo htmlspecialchars($user['email']); ?></span>
                        
                        <span class="info-label">權限等級</span>
                        <span class="info-value"><?php echo htmlspecialchars($user['role']); ?></span>
                        
                        <span class="info-label">註冊時間</span>
                        <span class="info-value"><?php echo isset($userProfile['created_at']) ? date('Y-m-d H:i:s', strtotime($userProfile['created_at'])) : 'N/A'; ?></span>
                        
                        <span class="info-label">最後登入</span>
                        <span class="info-value"><?php echo isset($userProfile['last_login']) ? date('Y-m-d H:i:s', strtotime($userProfile['last_login'])) : 'N/A'; ?></span>
                    </div>
                </div>
                
                <!-- 更新個人資料 -->
                <div class="profile-section">
                    <h2 class="section-title">◆ 資料更新</h2>
                    <form method="POST" action="">
                        <input type="hidden" name="action" value="update_profile">
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label" for="email">電子郵件</label>
                                <input type="email" id="email" name="email" class="form-input" 
                                       value="<?php echo htmlspecialchars($user['email']); ?>" 
                                       placeholder="your.email@domain.com" required>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="phone">聯絡電話</label>
                                <input type="tel" id="phone" name="phone" class="form-input" 
                                       value="<?php echo htmlspecialchars($userProfile['phone'] ?? ''); ?>"
                                       placeholder="+886-912-345-678">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label" for="first_name">名字</label>
                                <input type="text" id="first_name" name="first_name" class="form-input" 
                                       value="<?php echo htmlspecialchars($userProfile['first_name'] ?? ''); ?>"
                                       placeholder="請輸入名字">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="last_name">姓氏</label>
                                <input type="text" id="last_name" name="last_name" class="form-input" 
                                       value="<?php echo htmlspecialchars($userProfile['last_name'] ?? ''); ?>"
                                       placeholder="請輸入姓氏">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label" for="birth_date">出生日期</label>
                                <input type="date" id="birth_date" name="birth_date" class="form-input" 
                                       value="<?php echo htmlspecialchars($userProfile['birth_date'] ?? ''); ?>">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="gender">性別</label>
                                <select id="gender" name="gender" class="form-select">
                                    <option value="">請選擇性別</option>
                                    <option value="male" <?php echo ($userProfile['gender'] ?? '') === 'male' ? 'selected' : ''; ?>>男性</option>
                                    <option value="female" <?php echo ($userProfile['gender'] ?? '') === 'female' ? 'selected' : ''; ?>>女性</option>
                                    <option value="other" <?php echo ($userProfile['gender'] ?? '') === 'other' ? 'selected' : ''; ?>>其他</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group full-width">
                            <label class="form-label" for="location">所在位置</label>
                            <input type="text" id="location" name="location" class="form-input" 
                                   value="<?php echo htmlspecialchars($userProfile['location'] ?? ''); ?>"
                                   placeholder="台灣，台北市">
                        </div>
                        
                        <div class="form-group full-width">
                            <label class="form-label" for="bio">個人簡介</label>
                            <textarea id="bio" name="bio" class="form-textarea" rows="4" 
                                      placeholder="在此輸入您的個人簡介..."><?php echo htmlspecialchars($userProfile['bio'] ?? ''); ?></textarea>
                        </div>
                        
                        <div class="submit-container">
                            <button type="submit" class="submit-button">
                                <span class="submit-icon">◆</span>
                                <span class="submit-text">更新資料</span>
                            </button>
                        </div>
                    </form>
                </div>
                
                <!-- 變更密碼 -->
                <div class="profile-section">
                    <h2 class="section-title">◆ 安全設定</h2>
                    <form method="POST" action="">
                        <input type="hidden" name="action" value="change_password">
                        
                        <div class="form-group">
                            <label class="form-label" for="current_password">目前密碼</label>
                            <input type="password" id="current_password" name="current_password" class="form-input" 
                                   placeholder="請輸入目前密碼" required>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label" for="new_password">新密碼</label>
                                <input type="password" id="new_password" name="new_password" class="form-input" 
                                       placeholder="至少6個字符" required>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="confirm_password">確認新密碼</label>
                                <input type="password" id="confirm_password" name="confirm_password" class="form-input" 
                                       placeholder="再次輸入新密碼" required>
                            </div>
                        </div>
                        
                        <div class="submit-container">
                            <button type="submit" class="submit-button">
                                <span class="submit-icon">🔒</span>
                                <span class="submit-text">變更密碼</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        
        <div class="return-hud">
            <a href="../index.php" class="cyber-return-btn">
                <span class="btn-icon">◀</span>
                <span class="btn-text">返回主界面</span>
            </a>
        </div>
    </div>

    <script>
        // 創建粒子效果
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            if (!particlesContainer) return;
            
            const particleCount = window.innerWidth < 768 ? 30 : 50;
            
            // 清除現有粒子
            particlesContainer.innerHTML = '';
            
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 10 + 's';
                particle.style.animationDuration = (Math.random() * 10 + 5) + 's';
                particlesContainer.appendChild(particle);
            }
        }

        // 表單驗證增強
        function enhanceFormValidation() {
            const forms = document.querySelectorAll('form');
            
            forms.forEach(form => {
                const inputs = form.querySelectorAll('input, textarea, select');
                
                inputs.forEach(input => {
                    // 實時驗證
                    input.addEventListener('input', function() {
                        validateField(this);
                    });
                    
                    // 失焦驗證
                    input.addEventListener('blur', function() {
                        validateField(this);
                    });
                });
                
                // 表單提交驗證
                form.addEventListener('submit', function(e) {
                    let isValid = true;
                    
                    inputs.forEach(input => {
                        if (!validateField(input)) {
                            isValid = false;
                        }
                    });
                    
                    // 密碼確認驗證
                    const newPassword = form.querySelector('#new_password');
                    const confirmPassword = form.querySelector('#confirm_password');
                    
                    if (newPassword && confirmPassword) {
                        if (newPassword.value !== confirmPassword.value) {
                            showFieldError(confirmPassword, '密碼確認不匹配');
                            isValid = false;
                        }
                    }
                    
                    if (!isValid) {
                        e.preventDefault();
                        showNotification('請檢查表單中的錯誤', 'error');
                    } else {
                        // 顯示載入動畫
                        const submitBtn = form.querySelector('.submit-button');
                        if (submitBtn) {
                            submitBtn.style.pointerEvents = 'none';
                            submitBtn.querySelector('.submit-text').textContent = '處理中...';
                            submitBtn.querySelector('.submit-icon').style.animation = 'spin 1s linear infinite';
                        }
                    }
                });
            });
        }

        function validateField(field) {
            const value = field.value.trim();
            const fieldType = field.type;
            const fieldName = field.name;
            
            // 清除之前的錯誤狀態
            clearFieldError(field);
            
            // 必填欄位檢查
            if (field.hasAttribute('required') && !value) {
                showFieldError(field, '此欄位為必填');
                return false;
            }
            
            // Email 驗證
            if (fieldType === 'email' && value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    showFieldError(field, '請輸入有效的電子郵件地址');
                    return false;
                }
            }
            
            // 密碼長度驗證
            if (fieldType === 'password' && value && value.length < 6) {
                showFieldError(field, '密碼長度至少需要 6 個字符');
                return false;
            }
            
            // 電話號碼驗證
            if (fieldType === 'tel' && value) {
                const phoneRegex = /^[\d\-\+\(\)\s]+$/;
                if (!phoneRegex.test(value)) {
                    showFieldError(field, '請輸入有效的電話號碼');
                    return false;
                }
            }
            
            // 驗證成功
            showFieldSuccess(field);
            return true;
        }

        function showFieldError(field, message) {
            field.style.borderColor = '#ff0000';
            field.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.3)';
            
            // 移除現有錯誤訊息
            const existingError = field.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
            
            // 添加錯誤訊息
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.style.cssText = `
                color: #ff0000;
                font-size: 0.8em;
                margin-top: 5px;
                font-family: 'Rajdhani', sans-serif;
                text-shadow: 0 0 5px currentColor;
                animation: shake 0.5s ease-in-out;
            `;
            errorDiv.textContent = message;
            field.parentNode.appendChild(errorDiv);
        }

        function showFieldSuccess(field) {
            field.style.borderColor = '#00ff00';
            field.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.3)';
        }

        function clearFieldError(field) {
            field.style.borderColor = 'rgba(0, 255, 255, 0.3)';
            field.style.boxShadow = 'none';
            
            const errorDiv = field.parentNode.querySelector('.field-error');
            if (errorDiv) {
                errorDiv.remove();
            }
        }

        // 通知系統
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 46, 0.9));
                border: 2px solid ${type === 'error' ? '#ff0000' : '#00ffff'};
                border-radius: 10px;
                color: ${type === 'error' ? '#ff0000' : '#00ffff'};
                font-family: 'Rajdhani', sans-serif;
                font-weight: 600;
                z-index: 10000;
                backdrop-filter: blur(10px);
                animation: slideInRight 0.5s ease;
                max-width: 300px;
                word-wrap: break-word;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // 自動移除
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.5s ease';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        }

        // 密碼強度指示器
        function addPasswordStrengthIndicator() {
            const passwordField = document.getElementById('new_password');
            if (!passwordField) return;
            
            const strengthIndicator = document.createElement('div');
            strengthIndicator.className = 'password-strength';
            strengthIndicator.style.cssText = `
                margin-top: 8px;
                height: 4px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            `;
            
            const strengthBar = document.createElement('div');
            strengthBar.style.cssText = `
                height: 100%;
                width: 0%;
                transition: all 0.3s ease;
                border-radius: 2px;
            `;
            
            strengthIndicator.appendChild(strengthBar);
            passwordField.parentNode.appendChild(strengthIndicator);
            
            passwordField.addEventListener('input', function() {
                const password = this.value;
                let strength = 0;
                
                if (password.length >= 6) strength += 25;
                if (/[a-z]/.test(password)) strength += 25;
                if (/[A-Z]/.test(password)) strength += 25;
                if (/[\d\W]/.test(password)) strength += 25;
                
                strengthBar.style.width = strength + '%';
                
                if (strength < 50) {
                    strengthBar.style.background = 'linear-gradient(90deg, #ff0000, #ff6600)';
                } else if (strength < 75) {
                    strengthBar.style.background = 'linear-gradient(90deg, #ffff00, #ff6600)';
                } else {
                    strengthBar.style.background = 'linear-gradient(90deg, #00ff00, #00ffff)';
                }
            });
        }

        // 自動儲存草稿功能
        function setupAutoSave() {
            const profileForm = document.querySelector('form[action=""][method="POST"]');
            if (!profileForm) return;
            
            const inputs = profileForm.querySelectorAll('input, textarea, select');
            
            inputs.forEach(input => {
                input.addEventListener('input', function() {
                    const formData = new FormData(profileForm);
                    const data = {};
                    for (let [key, value] of formData.entries()) {
                        data[key] = value;
                    }
                    localStorage.setItem('profile_draft', JSON.stringify(data));
                });
            });
            
            // 載入儲存的草稿
            const draft = localStorage.getItem('profile_draft');
            if (draft) {
                try {
                    const data = JSON.parse(draft);
                    inputs.forEach(input => {
                        if (data[input.name] && input.name !== 'action') {
                            input.value = data[input.name];
                        }
                    });
                } catch (e) {
                    console.error('載入草稿失敗:', e);
                }
            }
        }

        // 頁面載入完成後執行
        document.addEventListener('DOMContentLoaded', function() {
            createParticles();
            enhanceFormValidation();
            addPasswordStrengthIndicator();
            setupAutoSave();
            
            // 自動隱藏訊息
            setTimeout(() => {
                const messages = document.querySelectorAll('.message-hud');
                messages.forEach(message => {
                    message.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    message.style.opacity = '0';
                    message.style.transform = 'translateY(-20px)';
                    setTimeout(() => message.remove(), 500);
                });
            }, 5000);
            
            // 響應式處理
            window.addEventListener('resize', function() {
                clearTimeout(window.resizeTimeout);
                window.resizeTimeout = setTimeout(createParticles, 300);
            });
        });

        // 添加 CSS 動畫
        const additionalCSS = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = additionalCSS;
        document.head.appendChild(style);
    </script>
</body>
</html>