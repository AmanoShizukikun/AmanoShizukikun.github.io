<?php
$base_url = '/example/';
$isLoggedIn = false;
$username = '';
$isAdmin = false;

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$auth_path = null;
$possible_paths = [
    __DIR__ . '/auth.php',
    dirname(__DIR__) . '/include/auth.php',
    './include/auth.php',
    '../include/auth.php',
];

foreach ($possible_paths as $path) {
    if (file_exists($path)) {
        $auth_path = $path;
        break;
    }
}

if ($auth_path) {
    require_once $auth_path;
    
    try {
        $auth = new Auth();
        $isLoggedIn = $auth->isLoggedIn();
        
        if ($isLoggedIn) {
            $user = $auth->getCurrentUser();
            if ($user && isset($user['id'])) {
                $username = htmlspecialchars($user['username']); // Sanitize username for display
                $fullUser = $auth->getFullUserProfile($user['id']);
                if ($fullUser) {
                    $isAdmin = ($fullUser['role'] ?? 'user') === 'admin';
                } else {
                    error_log("Menu.php: Could not fetch full user profile for user ID: " . $user['id']);
                    $isAdmin = false;
                }
            } else {
                 error_log("Menu.php: Could not fetch current user details even though logged in state was true.");
                 // Consider this an inconsistent state, treat as not logged in for safety.
                 $isLoggedIn = false; 
            }
        }
    } catch (Exception $e) {
        error_log("Menu Auth Error: " . $e->getMessage());
        $isLoggedIn = false;
    }
} else {
    error_log("Auth file not found in menu.php. Relying on direct session check (limited functionality).");
    // Fallback: Direct session check (less robust, especially for timeouts)
    if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true && isset($_SESSION['user_id'])) {
        // Basic session timeout check if Auth class is unavailable
        $sessionTimeout = 12 * 60 * 60; // 12 小時
        if (isset($_SESSION['login_time']) && (time() - $_SESSION['login_time'] > $sessionTimeout)) {
            // Simplified logout if session timed out
            $_SESSION = array();
            if (ini_get("session.use_cookies")) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
            }
            if (session_status() === PHP_SESSION_ACTIVE) { session_destroy(); }
            if (session_status() === PHP_SESSION_NONE) { session_start(); } // Restart for next request
            $isLoggedIn = false;
        } else {
            $isLoggedIn = true;
            $username = htmlspecialchars($_SESSION['username'] ?? 'User');
            $isAdmin = ($_SESSION['role'] ?? 'user') === 'admin';
        }
    } else {
        $isLoggedIn = false;
    }
}
?>
<header>
    <a href="<?php echo $base_url; ?>index.php">
        <div style="margin-left: 30px; font-family: 'Orbitron', sans-serif;">『 AMANO SHIZUKI 』</div>
    </a>
    <div class="nav-container">
        <ul class="nav-links">
            <li><a href="<?php echo $base_url; ?>dir/about.php">◆ ABOUT</a></li>
            <li><a href="<?php echo $base_url; ?>dir/exprience.php">◆ EXPERIENCE</a></li>
            <li><a href="<?php echo $base_url; ?>dir/product.php">◆ PRODUCTS</a></li>
            <li><a href="<?php echo $base_url; ?>dir/contact.php">◆ CONTACT</a></li>
            <?php if ($isLoggedIn): ?>
                <li><a href="<?php echo $base_url; ?>dir/user_profile.php">◆ PROFILE</a></li>
                <?php if ($isAdmin): ?>
                    <li><a href="<?php echo $base_url; ?>dir/admin_users.php" style="color: #ff6600 !important;">◆ ADMIN</a></li>
                <?php endif; ?>
                <li><a href="<?php echo $base_url; ?>dir/logout.php" style="color: #ff4444 !important;">◆ LOGOUT [<?php echo $username; // Already sanitized ?>]</a></li>
            <?php else: ?>
                <li><a href="<?php echo $base_url; ?>dir/login.php">◆ LOGIN</a></li>
            <?php endif; ?>
        </ul>
    </div>
</header>