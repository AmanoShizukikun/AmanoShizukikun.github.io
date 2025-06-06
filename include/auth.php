<?php
require_once 'database.php';

class Auth {
    private $db;
    private $max_attempts = 5;
    private $lockout_time = 15; // 分鐘
    
    public function __construct() {
        $this->db = new Database();
        $this->db->createUserTable();
        $this->db->createPasswordResetTable();
        $this->db->createRememberTokenTable();
        $this->db->createSecurityLogTable();
        $this->db->createUserProfileTable();
        $this->db->createUserActivityTable();
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $this->handleSessionTimeout();
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (!$this->isLoggedIn()) {
            $this->checkRememberToken();
        }
    }

    private function handleSessionTimeout() {
        if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true && isset($_SESSION['login_time'])) {
            $sessionTimeout = 12 * 60 * 60; // 12 小時
            if (time() - $_SESSION['login_time'] > $sessionTimeout) {
                $userIdBeforeLogout = $_SESSION['user_id'] ?? null;
                $this->logout(); // logout() 現在只銷毀會話，不自動重啟
                if ($userIdBeforeLogout) {
                }
            }
        }
    }
    
    private function checkRememberToken() {
        if (isset($_COOKIE['remember_token'])) {
            $token = $_COOKIE['remember_token'];
            $stmt = $this->db->getConnection()->prepare(
                "SELECT rt.user_id, u.username, u.email, u.role 
                 FROM remember_tokens rt 
                 JOIN users u ON rt.user_id = u.id 
                 WHERE rt.token = ? AND rt.expires_at > NOW() AND u.is_active = 1"
            );
            $stmt->execute([$token]);
            $result = $stmt->fetch();
            
            if ($result) {
                // 在填充新的會話數據前，確保會話是乾淨的並重新生成 ID
                if (session_status() === PHP_SESSION_NONE) { // 以防萬一
                    session_start();
                }
                session_regenerate_id(true); 
                $_SESSION['user_id'] = $result['user_id'];
                $_SESSION['username'] = $result['username'];
                $_SESSION['email'] = $result['email'];
                $_SESSION['role'] = $result['role'] ?? 'user';
                $_SESSION['login_time'] = time();
                $_SESSION['logged_in'] = true;
                $_SESSION['ip_address'] = $_SERVER['REMOTE_ADDR'] ?? '';
                
                $stmt_update_token = $this->db->getConnection()->prepare(
                    "UPDATE remember_tokens SET last_used_at = NOW() WHERE token = ?"
                );
                $stmt_update_token->execute([$token]);
                $this->logUserActivity($result['user_id'], 'auto_login', 'User auto-logged in via remember token');
            } else {
                // 無效令牌，清除 cookie
                $cookie_path = '/';
                $cookie_domain = ''; 
                $cookie_secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
                $cookie_httponly = true;
                setcookie('remember_token', '', time() - 3600, $cookie_path, $cookie_domain, $cookie_secure, $cookie_httponly);
            }
        }
    }
    
    public function login($username_or_email, $password, $remember_me = false) {
        try {
            $stmt = $this->db->getConnection()->prepare(
                "SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1"
            );
            $stmt->execute([$username_or_email, $username_or_email]);
            $user = $stmt->fetch();
            
            if (!$user) {
                $this->logSecurityEvent('login_failed', $username_or_email, $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', 'User not found');
                return ['success' => false, 'message' => '用戶名或密碼錯誤'];
            }
            
            if ($user['locked_until'] && strtotime($user['locked_until']) > time()) {
                $lockTime = date('Y-m-d H:i:s', strtotime($user['locked_until']));
                return ['success' => false, 'message' => "帳戶已被鎖定至 {$lockTime}"];
            }
            
            if (!password_verify($password, $user['password'])) {
                $this->incrementLoginAttempts($user['id']);
                $this->logSecurityEvent('login_failed', $user['username'], $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', 'Invalid password');
                return ['success' => false, 'message' => '用戶名或密碼錯誤'];
            }
            
            // 確保會話已啟動並清空舊會話數據，然後重新生成 ID
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }
            $_SESSION = array(); // 清空當前會話數組
            session_regenerate_id(true); // 生成新的會話 ID 並刪除舊的

            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['email'] = $user['email'];
            $_SESSION['role'] = $user['role'] ?? 'user';
            $_SESSION['login_time'] = time();
            $_SESSION['logged_in'] = true; 
            $_SESSION['ip_address'] = $_SERVER['REMOTE_ADDR'] ?? '';
            
            $this->resetLoginAttempts($user['id']);
            $stmt_update_user = $this->db->getConnection()->prepare(
                "UPDATE users SET last_login = NOW(), last_ip = ? WHERE id = ?"
            );
            $stmt_update_user->execute([$_SERVER['REMOTE_ADDR'] ?? '', $user['id']]);
            
            if ($remember_me) {
                $this->createRememberToken($user['id']);
            }
            
            $this->logUserActivity($user['id'], 'login', 'User logged in successfully');
            $this->logSecurityEvent('login_success', $user['username'], $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', 'Login successful');
            
            return ['success' => true, 'message' => '登入成功！'];
            
        } catch (PDOException $e) {
            error_log("登入失敗: " . $e->getMessage());
            return ['success' => false, 'message' => '登入失敗，請稍後再試'];
        }
    }
    
    public function isLoggedIn() {
        // 確保在檢查前會話是活躍的
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return false;
        }
        return isset($_SESSION['user_id']) && 
               !empty($_SESSION['user_id']) && 
               isset($_SESSION['logged_in']) && 
               $_SESSION['logged_in'] === true;
    }
    
    public function getCurrentUser() {
        if (!$this->isLoggedIn()) {
            return null;
        }
        return [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'email' => $_SESSION['email'],
            'role' => $_SESSION['role'] ?? 'user',
            'login_time' => $_SESSION['login_time'] ?? null
        ];
    }
    
    public function logout() {
        $userIdToLog = null;
        // 檢查會話是否活躍以及 user_id 是否存在
        if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['user_id'])) {
            $userIdToLog = $_SESSION['user_id'];
        }

        // 清除 "記住我" 令牌 (資料庫和 cookie)
        if (isset($_COOKIE['remember_token'])) {
            $stmt = $this->db->getConnection()->prepare(
                "DELETE FROM remember_tokens WHERE token = ?"
            );
            $stmt->execute([$_COOKIE['remember_token']]);
            
            $cookie_path = '/';
            $cookie_domain = ''; 
            $cookie_secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
            $cookie_httponly = true;
            setcookie('remember_token', '', time() - 3600, $cookie_path, $cookie_domain, $cookie_secure, $cookie_httponly);
        }
        
        // 清空會話變數
        $_SESSION = array();
        
        // 清除會話 cookie
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        // 銷毀伺服器上的會話數據
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }

        // 記錄登出活動 (如果 user ID 成功獲取)
        if ($userIdToLog) {
            $this->logUserActivity($userIdToLog, 'logout', 'User logged out');
        }
        
        // logout 方法不再負責 session_start()。
        // Auth 建構函式或其他調用者會在需要時處理。
        
        return true;
    }

    public function register($username, $email, $password, $additional_data = []) {
        try {
            if (empty($username) || empty($email) || empty($password)) {
                return ['success' => false, 'message' => '請填寫所有必填欄位'];
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'message' => '請輸入有效的電子郵件地址'];
            }
            if (strlen($password) < 6) {
                return ['success' => false, 'message' => '密碼長度至少需要 6 個字符'];
            }
            if (strlen($username) < 3) {
                return ['success' => false, 'message' => '使用者名稱長度至少需要 3 個字符'];
            }
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
                return ['success' => false, 'message' => '使用者名稱只能包含字母、數字和下劃線'];
            }
            if (!$this->validatePasswordStrengthSimple($password)) {
                return ['success' => false, 'message' => '密碼必須包含至少一個字母和一個數字'];
            }
            $stmt_check_user = $this->db->getConnection()->prepare(
                "SELECT COUNT(*) FROM users WHERE username = ? OR email = ?"
            );
            $stmt_check_user->execute([$username, $email]);
            if ($stmt_check_user->fetchColumn() > 0) {
                return ['success' => false, 'message' => '用戶名或電子郵件已存在'];
            }
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $verification_token = bin2hex(random_bytes(32));
            $stmt_insert_user = $this->db->getConnection()->prepare(
                "INSERT INTO users (username, email, password, verification_token, password_changed_at) VALUES (?, ?, ?, ?, NOW())"
            );
            $stmt_insert_user->execute([$username, $email, $hashed_password, $verification_token]);
            $user_id = $this->db->getConnection()->lastInsertId();
            $this->createUserProfile($user_id, $additional_data);
            $this->logUserActivity($user_id, 'user_register', 'User registered successfully');
            $this->logSecurityEvent('user_register', $username, $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '', 'New user registration');
            return ['success' => true, 'message' => '註冊成功！請登入'];
        } catch (PDOException $e) {
            error_log("註冊失敗: " . $e->getMessage());
            return ['success' => false, 'message' => '註冊失敗，請稍後再試'];
        }
    }

    private function validatePasswordStrengthSimple($password) {
        return strlen($password) >= 6 &&
               preg_match('/[a-zA-Z]/', $password) &&
               preg_match('/[0-9]/', $password);
    }

    public function updateProfile($user_id, $email, $first_name = '', $last_name = '', $phone = '', $bio = '', $birth_date = '', $gender = '', $location = '') {
        try {
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'message' => '請輸入有效的電子郵件地址'];
            }
            $stmt_check_email = $this->db->getConnection()->prepare(
                "SELECT COUNT(*) FROM users WHERE email = ? AND id != ?"
            );
            $stmt_check_email->execute([$email, $user_id]);
            if ($stmt_check_email->fetchColumn() > 0) {
                return ['success' => false, 'message' => '此電子郵件已被其他用戶使用'];
            }
            $stmt_update_users_email = $this->db->getConnection()->prepare(
                "UPDATE users SET email = ? WHERE id = ?"
            );
            $stmt_update_users_email->execute([$email, $user_id]);
            
            $stmt_update_profile = $this->db->getConnection()->prepare(
                "INSERT INTO user_profiles (user_id, first_name, last_name, phone, bio, birth_date, gender, location) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 first_name = VALUES(first_name), 
                 last_name = VALUES(last_name), 
                 phone = VALUES(phone), 
                 bio = VALUES(bio), 
                 birth_date = VALUES(birth_date), 
                 gender = VALUES(gender), 
                 location = VALUES(location),
                 updated_at = NOW()"
            );
            $stmt_update_profile->execute([
                $user_id, $first_name, $last_name, $phone, $bio, 
                $birth_date ?: null, $gender ?: null, $location
            ]);
            
            if (isset($_SESSION['user_id']) && $_SESSION['user_id'] == $user_id) {
                $_SESSION['email'] = $email;
            }
            
            $this->logUserActivity($user_id, 'profile_update', 'Profile information updated');
            return ['success' => true, 'message' => '資料更新成功！'];
        } catch (PDOException $e) {
            error_log("更新資料失敗: " . $e->getMessage());
            return ['success' => false, 'message' => '更新失敗，請稍後再試'];
        }
    }

    public function getFullUserProfile($user_id) {
        try {
            $stmt = $this->db->getConnection()->prepare(
                "SELECT u.*, up.first_name, up.last_name, up.phone, up.bio, up.avatar_url, 
                       up.birth_date, up.gender, up.location, up.website, up.timezone, 
                       up.language, up.receive_notifications, up.receive_emails, up.profile_visibility
                 FROM users u
                 LEFT JOIN user_profiles up ON u.id = up.user_id
                 WHERE u.id = ?"
            );
            $stmt->execute([$user_id]);
            return $stmt->fetch();
        } catch (PDOException $e) {
            error_log("獲取用戶資料失敗 for user_id {$user_id}: " . $e->getMessage());
            return null;
        }
    }
    
    private function createUserProfile($user_id, $additional_data = []) {
        try {
            $stmt = $this->db->getConnection()->prepare(
                "INSERT INTO user_profiles (user_id, language) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE language = VALUES(language)"
            );
            $stmt->execute([
                $user_id,
                $additional_data['language'] ?? 'zh-TW'
            ]);
        } catch (PDOException $e) {
            error_log("創建用戶資料失敗: " . $e->getMessage());
        }
    }

    private function logUserActivity($user_id, $activity_type, $description) {
        try {
            $stmt = $this->db->getConnection()->prepare(
                "INSERT INTO user_activities (user_id, activity_type, description, ip_address, user_agent) 
                 VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $user_id, 
                $activity_type, 
                $description, 
                $_SERVER['REMOTE_ADDR'] ?? '', 
                $_SERVER['HTTP_USER_AGENT'] ?? ''
            ]);
        } catch (PDOException $e) {
            error_log("記錄用戶活動失敗: " . $e->getMessage());
        }
    }

    private function logSecurityEvent($event_type, $username, $ip_address, $user_agent, $details) {
        try {
            $stmt = $this->db->getConnection()->prepare(
                "INSERT INTO security_logs (event_type, username, ip_address, user_agent, details) 
                 VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([$event_type, $username, $ip_address, $user_agent, $details]);
        } catch (PDOException $e) {
            error_log("記錄安全事件失敗: " . $e->getMessage());
        }
    }

    private function createRememberToken($user_id) {
        try {
            $token = bin2hex(random_bytes(32));
            $expires_at = date('Y-m-d H:i:s', strtotime('+30 days'));
            
            $stmt = $this->db->getConnection()->prepare(
                "INSERT INTO remember_tokens (user_id, token, expires_at) VALUES (?, ?, ?)"
            );
            $stmt->execute([$user_id, $token, $expires_at]);
            
            $cookie_path = '/';
            $cookie_domain = ''; 
            $cookie_secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
            $cookie_httponly = true;
            setcookie('remember_token', $token, strtotime('+30 days'), $cookie_path, $cookie_domain, $cookie_secure, $cookie_httponly);
            
        } catch (PDOException $e) {
            error_log("創建記住令牌失敗: " . $e->getMessage());
        }
    }

    private function incrementLoginAttempts($user_id) {
        $stmt_inc = $this->db->getConnection()->prepare(
            "UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?"
        );
        $stmt_inc->execute([$user_id]);
        
        $stmt_check = $this->db->getConnection()->prepare(
            "SELECT login_attempts FROM users WHERE id = ?"
        );
        $stmt_check->execute([$user_id]);
        $attempts = $stmt_check->fetchColumn();
        
        if ($attempts >= $this->max_attempts) {
            $lockUntil = new DateTime();
            $lockUntil->add(new DateInterval('PT' . $this->lockout_time . 'M'));
            
            $stmt_lock = $this->db->getConnection()->prepare(
                "UPDATE users SET locked_until = ? WHERE id = ?"
            );
            $stmt_lock->execute([$lockUntil->format('Y-m-d H:i:s'), $user_id]);
        }
    }

    private function resetLoginAttempts($user_id) {
        $stmt = $this->db->getConnection()->prepare(
            "UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?"
        );
        $stmt->execute([$user_id]);
    }

    public function changePassword($user_id, $current_password, $new_password) {
        try {
            $stmt_get_user = $this->db->getConnection()->prepare("SELECT password FROM users WHERE id = ?");
            $stmt_get_user->execute([$user_id]);
            $user = $stmt_get_user->fetch();
            
            if (!$user) {
                return ['success' => false, 'message' => '找不到用戶'];
            }
            
            if (!password_verify($current_password, $user['password'])) {
                return ['success' => false, 'message' => '目前密碼錯誤'];
            }
            
            if (!$this->validatePasswordStrengthSimple($new_password)) {
                return ['success' => false, 'message' => '新密碼不符合強度要求（至少6個字符，包含字母和數字）'];
            }
            
            $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
            
            $stmt_update_pass = $this->db->getConnection()->prepare(
                "UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?"
            );
            $stmt_update_pass->execute([$hashed_password, $user_id]);
            
            $this->logUserActivity($user_id, 'password_change', 'Password changed successfully');
            
            return ['success' => true, 'message' => '密碼變更成功！'];
            
        } catch (PDOException $e) {
            error_log("變更密碼失敗: " . $e->getMessage());
            return ['success' => false, 'message' => '變更失敗，請稍後再試'];
        }
    }
}
?>