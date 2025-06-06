<?php
require_once '../include/auth.php';

$auth = new Auth();
$error_message = '';
$success_message = '';

// 檢查是否已登入
if ($auth->isLoggedIn()) {
    header('Location: ../index.php');
    exit;
}

// 處理登入請求
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        if ($_POST['action'] === 'login') {
            $username_or_email = $_POST['username_or_email'] ?? '';
            $password = $_POST['password'] ?? '';
            $remember_me = isset($_POST['remember_me']);
            
            if (!empty($username_or_email) && !empty($password)) {
                $result = $auth->login($username_or_email, $password, $remember_me);
                
                if ($result['success']) {
                    header('Location: ../index.php');
                    exit;
                } else {
                    $error_message = $result['message'];
                }
            } else {
                $error_message = '請填寫所有必填欄位';
            }
        } elseif ($_POST['action'] === 'register') {
            $username = $_POST['reg_username'] ?? '';
            $email = $_POST['reg_email'] ?? '';
            $password = $_POST['reg_password'] ?? '';
            $confirm_password = $_POST['reg_confirm_password'] ?? '';
            
            if (!empty($username) && !empty($email) && !empty($password) && !empty($confirm_password)) {
                if ($password === $confirm_password) {
                    $result = $auth->register($username, $email, $password);
                    
                    if ($result['success']) {
                        $success_message = $result['message'];
                    } else {
                        $error_message = $result['message'];
                    }
                } else {
                    $error_message = '密碼確認不匹配';
                }
            } else {
                $error_message = '請填寫所有必填欄位';
            }
        }
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LOGIN / REGISTER - Access Terminal</title>
    <?php include '../include/style.php'; ?>
    <style>
        body {
            background: 
                linear-gradient(45deg, #0a0a0a, #1a1a2e, #16213e);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-container {
            max-width: 500px;
            width: 100%;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 46, 0.9));
            border: 3px solid transparent;
            border-image: linear-gradient(45deg, #00ffff, #ff00ff, #ffff00, #00ffff) 1;
            border-radius: 20px;
            padding: 40px;
            backdrop-filter: blur(20px);
            box-shadow: 
                0 0 50px rgba(0, 255, 255, 0.3),
                inset 0 0 50px rgba(0, 255, 255, 0.05);
            position: relative;
            overflow: hidden;
            animation: containerPulse 8s infinite ease-in-out;
        }
        
        @keyframes containerPulse {
            0%, 100% { 
                box-shadow: 0 0 50px rgba(0, 255, 255, 0.3), inset 0 0 50px rgba(0, 255, 255, 0.05);
            }
            50% { 
                box-shadow: 0 0 80px rgba(255, 0, 255, 0.4), inset 0 0 80px rgba(255, 0, 255, 0.08);
            }
        }
        
        .access-header {
            text-align: center;
            margin-bottom: 40px;
            position: relative;
            z-index: 10;
        }
        
        .access-title {
            font-size: 2.2em;
            font-family: 'Orbitron', sans-serif;
            color: #00ffff;
            text-shadow: 
                0 0 20px rgba(0, 255, 255, 0.8),
                0 0 40px rgba(0, 255, 255, 0.5),
                0 0 60px rgba(0, 255, 255, 0.3);
            margin-bottom: 10px;
            font-weight: 900;
            letter-spacing: 3px;
        }
        
        .access-subtitle {
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.1em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.9;
        }
        
        .form-tabs {
            display: flex;
            margin-bottom: 30px;
            border-bottom: 2px solid rgba(0, 255, 255, 0.3);
            position: relative;
            z-index: 10;
        }
        
        .tab-button {
            flex: 1;
            padding: 15px;
            background: transparent;
            border: none;
            color: rgba(255, 255, 255, 0.6);
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.1em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .tab-button.active {
            color: #00ffff;
            text-shadow: 0 0 15px currentColor;
        }
        
        .tab-button.active::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #00ffff, #ff00ff, #00ffff);
        }
        
        .form-content {
            position: relative;
            z-index: 10;
        }
        
        .tab-panel {
            display: none;
            animation: fadeInUp 0.5s ease;
        }
        
        .tab-panel.active {
            display: block;
        }
        
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .form-group {
            margin-bottom: 25px;
            position: relative;
        }
        
        .form-label {
            display: block;
            color: #00ffff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            font-size: 1em;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
        }
        
        .form-input {
            width: 100%;
            padding: 15px 20px;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid rgba(0, 255, 255, 0.3);
            border-radius: 8px;
            color: #ffffff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1em;
            transition: all 0.3s ease;
            box-sizing: border-box;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #00ffff;
            background: rgba(0, 0, 0, 0.9);
            box-shadow: 
                0 0 20px rgba(0, 255, 255, 0.3),
                inset 0 0 20px rgba(0, 255, 255, 0.1);
        }
        
        .form-input::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }
        
        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 20px 0;
        }
        
        .checkbox-input {
            width: 18px;
            height: 18px;
            accent-color: #00ffff;
        }
        
        .checkbox-label {
            color: #e0e0e0;
            font-family: 'Rajdhani', sans-serif;
            font-size: 0.9em;
            cursor: pointer;
        }
        
        .submit-button {
            width: 100%;
            padding: 18px;
            background: linear-gradient(45deg, #00ffff, #0099cc);
            border: none;
            border-radius: 8px;
            color: #000000;
            font-family: 'Orbitron', sans-serif;
            font-size: 1.1em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .submit-button:hover {
            background: linear-gradient(45deg, #00ccff, #0066aa);
            transform: translateY(-2px);
            box-shadow: 
                0 5px 15px rgba(0, 255, 255, 0.4),
                0 0 30px rgba(0, 255, 255, 0.2);
        }
        
        .message {
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            text-align: center;
        }
        
        .error-message {
            background: rgba(255, 0, 0, 0.1);
            border: 2px solid rgba(255, 0, 0, 0.5);
            color: #ff6b6b;
        }
        
        .success-message {
            background: rgba(0, 255, 0, 0.1);
            border: 2px solid rgba(0, 255, 0, 0.5);
            color: #51cf66;
        }
        
        .return-link {
            text-align: center;
            margin-top: 30px;
            position: relative;
            z-index: 10;
        }
        
        .return-btn {
            color: #ff00ff;
            text-decoration: none;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            font-size: 1em;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 10px 20px;
            border: 2px solid rgba(255, 0, 255, 0.3);
            border-radius: 6px;
            transition: all 0.3s ease;
            display: inline-block;
            text-shadow: 0 0 10px rgba(255, 0, 255, 0.5);
        }
        
        .return-btn:hover {
            border-color: #ff00ff;
            background: rgba(255, 0, 255, 0.1);
            box-shadow: 0 0 20px rgba(255, 0, 255, 0.3);
            transform: translateY(-2px);
        }
        
        @media (max-width: 768px) {
            .login-container {
                padding: 30px 20px;
                margin: 10px;
            }
            
            .access-title {
                font-size: 1.8em;
            }
        }
    </style>
</head>
<body>
    <div class="animated-bg"></div>
    
    <div class="login-container">
        <div class="access-header">
            <h1 class="access-title">◆ ACCESS TERMINAL ◆</h1>
            <p class="access-subtitle">SECURE LOGIN REQUIRED</p>
        </div>
        
        <?php if ($error_message): ?>
            <div class="message error-message"><?php echo htmlspecialchars($error_message); ?></div>
        <?php endif; ?>
        
        <?php if ($success_message): ?>
            <div class="message success-message"><?php echo htmlspecialchars($success_message); ?></div>
        <?php endif; ?>
        
        <div class="form-tabs">
            <button class="tab-button active" onclick="switchTab('login')">◆ LOGIN</button>
            <button class="tab-button" onclick="switchTab('register')">◆ REGISTER</button>
        </div>
        
        <div class="form-content">
            <!-- 登入表單 -->
            <div id="login-panel" class="tab-panel active">
                <form method="POST" action="">
                    <input type="hidden" name="action" value="login">
                    
                    <div class="form-group">
                        <label class="form-label" for="username_or_email">用戶名或電子郵件</label>
                        <input type="text" id="username_or_email" name="username_or_email" class="form-input" 
                               placeholder="請輸入用戶名或電子郵件" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="password">密碼</label>
                        <input type="password" id="password" name="password" class="form-input" 
                               placeholder="請輸入密碼" required>
                    </div>
                    
                    <div class="checkbox-group">
                        <input type="checkbox" id="remember_me" name="remember_me" class="checkbox-input">
                        <label for="remember_me" class="checkbox-label">記住我（30天）</label>
                    </div>
                    
                    <button type="submit" class="submit-button">◆ 登入系統 ◆</button>
                </form>
                
                <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.9em;">
                    <p>測試帳號：admin / password123!</p>
                    <p>或者：testuser / password123!</p>
                </div>
            </div>
            
            <!-- 註冊表單 -->
            <div id="register-panel" class="tab-panel">
                <form method="POST" action="">
                    <input type="hidden" name="action" value="register">
                    
                    <div class="form-group">
                        <label class="form-label" for="reg_username">用戶名</label>
                        <input type="text" id="reg_username" name="reg_username" class="form-input" 
                               placeholder="請輸入用戶名" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="reg_email">電子郵件</label>
                        <input type="email" id="reg_email" name="reg_email" class="form-input" 
                               placeholder="請輸入電子郵件" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="reg_password">密碼</label>
                        <input type="password" id="reg_password" name="reg_password" class="form-input" 
                               placeholder="請輸入密碼（至少6個字符）" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="reg_confirm_password">確認密碼</label>
                        <input type="password" id="reg_confirm_password" name="reg_confirm_password" class="form-input" 
                               placeholder="請再次輸入密碼" required>
                    </div>
                    
                    <button type="submit" class="submit-button">◆ 註冊帳號 ◆</button>
                </form>
            </div>
        </div>
        
        <div class="return-link">
            <a href="../index.php" class="return-btn">◆ RETURN TO MAIN ◆</a>
        </div>
    </div>
    
    <script>
        // 切換標籤頁
        function switchTab(tabName) {
            // 隱藏所有面板
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // 移除所有按鈕的活動狀態
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });
            
            // 顯示選中的面板
            document.getElementById(tabName + '-panel').classList.add('active');
            
            // 激活選中的按鈕
            event.target.classList.add('active');
        }
        
        // 自動消失訊息
        setTimeout(function() {
            const messages = document.querySelectorAll('.message');
            messages.forEach(message => {
                message.style.transition = 'opacity 0.3s ease';
                message.style.opacity = '0';
                setTimeout(() => message.remove(), 300);
            });
        }, 5000);
    </script>
</body>
</html>