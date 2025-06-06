<?php
// Ensure session is started before Auth class instantiation if not already.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once '../include/auth.php';

$auth = new Auth(); // Auth constructor might try to handle session state
$auth->logout();    // This will perform the actual logout operations

// Redirect to home page
// Ensure no output before this header call.
header('Location: ../index.php');
exit;
?>