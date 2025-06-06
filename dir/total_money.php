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
    <title>ORDER PROCESSING - Transaction Terminal</title>
    <?php include '../include/style.php'; ?>
    <style>
        /* 主要訂單處理容器 */
        .order-processing-hud {
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
                0 0 80px rgba(0, 255, 255, 0.3),
                inset 0 0 50px rgba(0, 255, 255, 0.05);
        }

        @keyframes hudPulse {
            0%, 100% {
                box-shadow: 0 0 80px rgba(0, 255, 255, 0.3), inset 0 0 50px rgba(0, 255, 255, 0.05);
            }
            50% {
                box-shadow: 0 0 120px rgba(255, 0, 255, 0.4), inset 0 0 80px rgba(255, 0, 255, 0.08);
            }
        }

        .order-processing-hud::before {
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

        .order-processing-hud::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255, 0, 255, 0.1) 2px, rgba(255, 0, 255, 0.1) 4px);
            animation: gridPulse 4s ease-in-out infinite alternate;
            pointer-events: none;
            z-index: 0;
        }

        @keyframes gridPulse {
            0% { opacity: 0.1; }
            100% { opacity: 0.3; }
        }

        /* 標題區域 */
        .order-header {
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
                0 0 40px rgba(0, 255, 255, 0.3),
                inset 0 0 30px rgba(0, 255, 255, 0.1);
        }

        .order-title {
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

        .order-title::before {
            content: '◆ ORDER PROCESSING ◆';
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
                filter: hue-rotate(0deg);
                transform: translate(0);
            }
            10% {
                filter: hue-rotate(90deg);
                transform: translate(-2px, 2px);
            }
        }

        @keyframes glitchShift {
            0%, 100% { transform: translate(0); }
            20% { transform: translate(-1px, 1px); }
            40% { transform: translate(1px, -1px); }
            60% { transform: translate(-1px, 2px); }
            80% { transform: translate(1px, -2px); }
        }

        .order-subtitle {
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
        .transaction-status {
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

        .status-processing {
            background: #ffff00;
        }

        .status-error {
            background: #ff0000;
        }

        @keyframes statusBlink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }

        /* 訂購者資訊區域 */
        .customer-info-hud {
            position: relative;
            z-index: 10;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #00ffff;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            backdrop-filter: blur(15px);
            box-shadow: 
                0 0 30px rgba(0, 255, 255, 0.2),
                inset 0 0 20px rgba(0, 255, 255, 0.05);
        }

        .info-section-title {
            font-size: 1.5em;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            margin-bottom: 20px;
            text-shadow: 0 0 15px currentColor;
            position: relative;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-align: center;
        }

        .info-section-title::before {
            content: '◆';
            position: absolute;
            left: -30px;
            top: 50%;
            transform: translateY(-50%);
            color: #ff00ff;
            animation: pulse 2s infinite;
            font-size: 0.8em;
        }

        .info-section-title::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 60%;
            height: 2px;
            background: linear-gradient(90deg, transparent, #00ffff, transparent);
            animation: underlineExpand 3s ease-in-out infinite;
        }

        @keyframes underlineExpand {
            0%, 100% { width: 60%; opacity: 0.5; }
            50% { width: 80%; opacity: 1; }
        }

        .customer-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 25px;
        }

        .info-item {
            display: flex;
            align-items: center;
            padding: 15px;
            background: rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 8px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .info-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.2), transparent);
            transition: left 0.5s ease;
        }

        .info-item:hover {
            border-color: #00ffff;
            background: rgba(0, 0, 0, 0.8);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
        }

        .info-item:hover::before {
            left: 100%;
        }

        .info-label {
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-right: 15px;
            min-width: 80px;
            text-shadow: 0 0 8px currentColor;
        }

        .info-value {
            color: #ffffff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1em;
            font-weight: 500;
            flex: 1;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
        }

        /* 訂單明細表格 */
        .order-details-hud {
            position: relative;
            z-index: 10;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #ff00ff;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            backdrop-filter: blur(15px);
            box-shadow: 
                0 0 30px rgba(255, 0, 255, 0.2),
                inset 0 0 20px rgba(255, 0, 255, 0.05);
        }

        .order-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 20px 0;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 
                0 0 20px rgba(255, 0, 255, 0.2),
                inset 0 0 30px rgba(255, 0, 255, 0.05);
            position: relative;
        }

        .order-table::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff);
            animation: tableGlow 3s ease-in-out infinite;
        }

        @keyframes tableGlow {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
        }

        .order-table th,
        .order-table td {
            padding: 18px 20px;
            border: 1px solid rgba(255, 0, 255, 0.3);
            text-align: left;
            color: #ffffff;
            font-family: 'Rajdhani', sans-serif;
            position: relative;
        }

        .order-table th {
            background: linear-gradient(135deg, rgba(255, 0, 255, 0.3), rgba(0, 255, 255, 0.3));
            color: #ffffff;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-family: 'Orbitron', sans-serif;
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
            font-size: 0.9em;
        }

        .order-table tbody tr {
            transition: all 0.3s ease;
            background: rgba(0, 0, 0, 0.5);
        }

        .order-table tbody tr:hover {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.15), rgba(255, 0, 255, 0.15));
            transform: scale(1.01);
            box-shadow: 0 3px 15px rgba(0, 255, 255, 0.3);
        }

        .order-table tbody tr:nth-child(even) {
            background: rgba(0, 0, 0, 0.3);
        }

        .order-table tbody tr:nth-child(even):hover {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.15), rgba(255, 0, 255, 0.15));
        }

        .total-row {
            background: linear-gradient(135deg, rgba(255, 255, 0, 0.3), rgba(255, 0, 255, 0.3)) !important;
            font-weight: bold;
            color: #ffffff !important;
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
            border: 2px solid #ffff00 !important;
            font-size: 1.1em;
        }

        .total-row td {
            border-color: #ffff00 !important;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-family: 'Orbitron', sans-serif;
        }

        /* 訊息狀態區域 */
        .message-hud {
            position: relative;
            z-index: 10;
            margin: 30px 0;
            padding: 25px;
            border-radius: 15px;
            backdrop-filter: blur(15px);
            text-align: center;
            animation: messageSlideIn 0.5s ease;
        }

        @keyframes messageSlideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .success-message-hud {
            background: linear-gradient(135deg, rgba(0, 255, 0, 0.2), rgba(0, 150, 0, 0.2));
            border: 3px solid #00ff00;
            box-shadow: 
                0 0 30px rgba(0, 255, 0, 0.3),
                inset 0 0 20px rgba(0, 255, 0, 0.1);
        }

        .error-message-hud {
            background: linear-gradient(135deg, rgba(255, 0, 0, 0.2), rgba(150, 0, 0, 0.2));
            border: 3px solid #ff0000;
            box-shadow: 
                0 0 30px rgba(255, 0, 0, 0.3),
                inset 0 0 20px rgba(255, 0, 0, 0.1);
        }

        .message-icon {
            font-size: 2em;
            margin-bottom: 15px;
            display: block;
            animation: iconPulse 2s ease-in-out infinite;
        }

        .success-message-hud .message-icon {
            color: #00ff00;
            text-shadow: 0 0 20px currentColor;
        }

        .error-message-hud .message-icon {
            color: #ff0000;
            text-shadow: 0 0 20px currentColor;
        }

        @keyframes iconPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }

        .message-text {
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.2em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            line-height: 1.6;
        }

        .success-message-hud .message-text {
            color: #00ff00;
            text-shadow: 0 0 15px rgba(0, 255, 0, 0.8);
        }

        .error-message-hud .message-text {
            color: #ff0000;
            text-shadow: 0 0 15px rgba(255, 0, 0, 0.8);
        }

        .message-subtitle {
            font-family: 'Rajdhani', sans-serif;
            font-size: 1em;
            margin-top: 10px;
            opacity: 0.9;
        }

        /* 特殊訊息樣式 */
        .poor-message {
            background: linear-gradient(135deg, rgba(255, 0, 255, 0.2), rgba(255, 0, 0, 0.2));
            border: 3px solid #ff00ff;
            box-shadow: 
                0 0 30px rgba(255, 0, 255, 0.3),
                inset 0 0 20px rgba(255, 0, 255, 0.1);
            animation: poorMessageGlitch 1s ease-in-out infinite alternate;
        }

        .poor-message .message-text {
            color: #ff00ff;
            text-shadow: 0 0 15px rgba(255, 0, 255, 0.8);
            animation: textGlitch 0.5s ease-in-out infinite alternate;
        }

        @keyframes poorMessageGlitch {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(30deg); }
        }

        @keyframes textGlitch {
            0% { text-shadow: 0 0 15px rgba(255, 0, 255, 0.8); }
            100% { text-shadow: 0 0 25px rgba(255, 0, 0, 0.8); }
        }

        /* 導航按鈕區域 */
        .navigation-hud {
            position: relative;
            z-index: 10;
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 40px 0;
            flex-wrap: wrap;
        }

        .cyber-nav-btn {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 18px 35px;
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.15), rgba(0, 150, 255, 0.15));
            border: 2px solid #00ffff;
            color: #00ffff;
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
                0 0 20px rgba(0, 255, 255, 0.2),
                inset 0 0 15px rgba(0, 255, 255, 0.05);
            backdrop-filter: blur(10px);
        }

        .cyber-nav-btn::before {
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

        .cyber-nav-btn:hover {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.3), rgba(0, 150, 255, 0.3));
            border-color: #ffffff;
            color: #ffffff;
            transform: translateY(-3px) scale(1.05);
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
            box-shadow: 
                0 5px 25px rgba(0, 255, 255, 0.4),
                inset 0 0 30px rgba(0, 255, 255, 0.1);
        }

        .cyber-nav-btn:hover::before {
            left: 100%;
        }

        .home-btn {
            background: linear-gradient(135deg, rgba(255, 0, 255, 0.15), rgba(150, 0, 255, 0.15));
            border-color: #ff00ff;
            color: #ff00ff;
        }

        .home-btn:hover {
            background: linear-gradient(135deg, rgba(255, 0, 255, 0.3), rgba(150, 0, 255, 0.3));
            border-color: #ffffff;
            color: #ffffff;
            box-shadow: 
                0 5px 25px rgba(255, 0, 255, 0.4),
                inset 0 0 30px rgba(255, 0, 255, 0.1);
        }

        .nav-icon {
            font-size: 1.1em;
            margin-right: 10px;
            animation: iconFloat 3s ease-in-out infinite;
            position: relative;
            z-index: 2;
        }

        .nav-text {
            position: relative;
            z-index: 2;
        }

        @keyframes iconFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-3px); }
        }

        /* 響應式設計 */
        @media (max-width: 768px) {
            .order-processing-hud {
                padding: 25px 15px;
                margin: 20px 0;
            }

            .order-header {
                padding: 20px 15px;
            }

            .customer-info-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }

            .info-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }

            .info-label {
                min-width: unset;
                margin-right: 0;
            }

            .order-table {
                font-size: 0.9em;
            }

            .order-table th,
            .order-table td {
                padding: 12px 8px;
            }

            .navigation-hud {
                gap: 15px;
            }

            .cyber-nav-btn {
                padding: 15px 25px;
                font-size: 0.8em;
            }
        }

        @media (max-width: 480px) {
            .order-table-container {
                overflow-x: auto;
            }

            .order-table {
                min-width: 500px;
            }

            .navigation-hud {
                flex-direction: column;
                align-items: center;
            }

            .cyber-nav-btn {
                width: 80%;
                max-width: 300px;
            }
        }
    </style>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="particles" id="particles"></div>
    
    <?php include '../include/menu.php'; ?>
    
    <div class="container">
        <div class="order-processing-hud">
            <div class="order-header">
                <h1 class="order-title">◆ ORDER PROCESSING ◆</h1>
                <div class="order-subtitle">TRANSACTION VERIFICATION SYSTEM</div>
                <div class="transaction-status">
                    <div class="status-indicator">
                        <div class="status-dot status-processing"></div>
                        <span>PROCESSING</span>
                    </div>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>SECURE CONNECTION</span>
                    </div>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>ENCRYPTION ACTIVE</span>
                    </div>
                </div>
            </div>

            <?php
            if ($_SERVER["REQUEST_METHOD"] == "POST") {
                // 訂購者資料
                $name = isset($_POST['name']) ? htmlspecialchars($_POST['name']) : '';
                $phone = isset($_POST['phone']) ? htmlspecialchars($_POST['phone']) : '';
                $email = isset($_POST['email']) ? htmlspecialchars($_POST['email']) : '';
                $address = isset($_POST['address']) ? htmlspecialchars($_POST['address']) : '';

                // 產品資料
                $product_names = isset($_POST['product_name']) ? $_POST['product_name'] : array();
                $product_prices = isset($_POST['product_price']) ? $_POST['product_price'] : array();
                $quantities = isset($_POST['quantity']) ? $_POST['quantity'] : array();

                if (!empty($name) && !empty($phone) && !empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL) && !empty($address)) {
                    $has_products = false;
                    $total_amount = 0;

                    // 顯示訂購者資訊
                    echo '<div class="customer-info-hud">';
                    echo '<h2 class="info-section-title">◆ Customer Information ◆</h2>';
                    echo '<div class="customer-info-grid">';
                    echo '<div class="info-item">';
                    echo '<span class="info-label">Name:</span>';
                    echo '<span class="info-value">' . $name . '</span>';
                    echo '</div>';
                    echo '<div class="info-item">';
                    echo '<span class="info-label">Phone:</span>';
                    echo '<span class="info-value">' . $phone . '</span>';
                    echo '</div>';
                    echo '<div class="info-item">';
                    echo '<span class="info-label">Email:</span>';
                    echo '<span class="info-value">' . $email . '</span>';
                    echo '</div>';
                    echo '<div class="info-item">';
                    echo '<span class="info-label">Address:</span>';
                    echo '<span class="info-value">' . $address . '</span>';
                    echo '</div>';
                    echo '</div>';
                    echo '</div>';

                    // 顯示產品訂單明細
                    echo '<div class="order-details-hud">';
                    echo '<h2 class="info-section-title">◆ Order Details ◆</h2>';
                    echo '<div class="order-table-container">';
                    echo '<table class="order-table">';
                    echo '<thead>';
                    echo '<tr>';
                    echo '<th>Product Name</th>';
                    echo '<th>Unit Price (NT$)</th>';
                    echo '<th>Quantity</th>';
                    echo '<th>Subtotal (NT$)</th>';
                    echo '</tr>';
                    echo '</thead>';
                    echo '<tbody>';

                    foreach ($quantities as $key => $quantity) {
                        $quantity = intval($quantity);
                        if ($quantity > 0) {
                            $has_products = true;
                            $product_name = isset($product_names[$key]) ? htmlspecialchars($product_names[$key]) : '未知產品';
                            $product_price = isset($product_prices[$key]) ? floatval($product_prices[$key]) : 0;
                            $subtotal = $product_price * $quantity;
                            $total_amount += $subtotal;

                            echo '<tr>';
                            echo '<td>' . $product_name . '</td>';
                            echo '<td>' . number_format($product_price, 0) . '</td>';
                            echo '<td>' . $quantity . '</td>';
                            echo '<td>' . number_format($subtotal, 0) . '</td>';
                            echo '</tr>';
                        }
                    }

                    echo '<tr class="total-row">';
                    echo '<td colspan="3" style="text-align:right; font-weight: bold;">TOTAL AMOUNT:</td>';
                    echo '<td style="font-weight: bold;">' . number_format($total_amount, 0) . '</td>';
                    echo '</tr>';
                    echo '</tbody>';
                    echo '</table>';
                    echo '</div>';
                    echo '</div>';

                    // 顯示處理結果訊息
                    if ($has_products) {
                        echo '<div class="message-hud success-message-hud">';
                        echo '<span class="message-icon">✓</span>';
                        echo '<div class="message-text">Transaction Successful!</div>';
                        echo '<div class="message-subtitle">Order has been successfully processed. Thank you for your purchase!</div>';
                        echo '<div class="message-subtitle">We will process your order as soon as possible.</div>';
                        echo '</div>';
                    } else {
                        echo '<div class="message-hud poor-message">';
                        echo '<span class="message-icon">⚠</span>';
                        echo '<div class="message-text">No Products Selected</div>';
                        echo '<div class="message-subtitle">我知道你很窮沒錢，但還是請你返回上頁選購商品。</div>';
                        echo '</div>';
                    }
                } else {
                    echo '<div class="message-hud error-message-hud">';
                    echo '<span class="message-icon">✗</span>';
                    echo '<div class="message-text">Data Validation Failed</div>';
                    echo '<div class="message-subtitle">提交的資料不完整或格式錯誤，請返回上一頁檢查後重新提交。</div>';
                    echo '</div>';
                }
            } else {
                echo '<div class="message-hud error-message-hud">';
                echo '<span class="message-icon">⚠</span>';
                echo '<div class="message-text">Invalid Request</div>';
                echo '<div class="message-subtitle">Access denied. Please use the proper order form.</div>';
                echo '</div>';
            }
            ?>

            <div class="navigation-hud">
                <a href="product.php" class="cyber-nav-btn">
                    <span class="nav-icon">◀</span>
                    <span class="nav-text">Return to Products</span>
                </a>
                <a href="../index.php" class="cyber-nav-btn home-btn">
                    <span class="nav-icon">◆</span>
                    <span class="nav-text">Return to Main</span>
                </a>
            </div>
        </div>
    </div>

    <script>
        // 創建粒子效果
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            if (!particlesContainer) return;
            
            // 清除現有粒子
            particlesContainer.innerHTML = '';
            
            const particleCount = 40;
            
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                
                // 隨機位置
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                
                // 隨機動畫延遲
                particle.style.animationDelay = Math.random() * 10 + 's';
                particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
                
                // 隨機大小
                const size = Math.random() * 3 + 1;
                particle.style.width = size + 'px';
                particle.style.height = size + 'px';
                
                particlesContainer.appendChild(particle);
            }
        }

        // 狀態指示器動畫增強
        function enhanceStatusIndicators() {
            const indicators = document.querySelectorAll('.status-indicator');
            indicators.forEach((indicator, index) => {
                indicator.addEventListener('mouseenter', function() {
                    const dot = this.querySelector('.status-dot');
                    if (dot) {
                        dot.style.animation = 'statusBlink 0.5s infinite';
                        dot.style.transform = 'scale(1.2)';
                    }
                });
                
                indicator.addEventListener('mouseleave', function() {
                    const dot = this.querySelector('.status-dot');
                    if (dot) {
                        dot.style.animation = 'statusBlink 2s infinite';
                        dot.style.transform = 'scale(1)';
                    }
                });
                
                // 隨機狀態切換效果
                setTimeout(() => {
                    indicator.style.animation = 'fadeInUp 0.5s ease forwards';
                }, index * 200);
            });
        }

        // 表格行懸停效果增強
        function enhanceTableRows() {
            const tableRows = document.querySelectorAll('.order-table tbody tr:not(.total-row)');
            tableRows.forEach((row, index) => {
                row.addEventListener('mouseenter', function() {
                    this.style.transform = 'scale(1.02) translateX(5px)';
                    this.style.zIndex = '10';
                });
                
                row.addEventListener('mouseleave', function() {
                    this.style.transform = 'scale(1) translateX(0)';
                    this.style.zIndex = '1';
                });
                
                // 漸入動畫
                setTimeout(() => {
                    row.style.opacity = '0';
                    row.style.transform = 'translateY(20px)';
                    row.style.transition = 'all 0.5s ease';
                    
                    setTimeout(() => {
                        row.style.opacity = '1';
                        row.style.transform = 'translateY(0)';
                    }, 50);
                }, index * 100);
            });
        }

        // 訊息動畫增強
        function enhanceMessages() {
            const messages = document.querySelectorAll('.message-hud');
            messages.forEach(message => {
                const icon = message.querySelector('.message-icon');
                if (icon) {
                    // 增強圖標動畫
                    icon.addEventListener('animationiteration', function() {
                        if (Math.random() > 0.7) {
                            this.style.animation = 'iconPulse 0.3s ease-in-out';
                            setTimeout(() => {
                                this.style.animation = 'iconPulse 2s ease-in-out infinite';
                            }, 300);
                        }
                    });
                }
                
                // 特殊效果：如果是錯誤訊息，添加故障效果
                if (message.classList.contains('poor-message')) {
                    setInterval(() => {
                        if (Math.random() > 0.8) {
                            message.style.filter = 'hue-rotate(' + (Math.random() * 60) + 'deg)';
                            setTimeout(() => {
                                message.style.filter = '';
                            }, 200);
                        }
                    }, 1000);
                }
            });
        }

        // 導航按鈕增強效果
        function enhanceNavigationButtons() {
            const navButtons = document.querySelectorAll('.cyber-nav-btn');
            navButtons.forEach((button, index) => {
                // 入場動畫
                button.style.opacity = '0';
                button.style.transform = 'translateY(30px)';
                
                setTimeout(() => {
                    button.style.transition = 'all 0.5s ease';
                    button.style.opacity = '1';
                    button.style.transform = 'translateY(0)';
                }, index * 200 + 500);
                
                // 懸停時的額外效果
                button.addEventListener('mouseenter', function() {
                    const icon = this.querySelector('.nav-icon');
                    if (icon) {
                        icon.style.transform = 'translateX(-3px) scale(1.1)';
                        icon.style.transition = 'transform 0.3s ease';
                    }
                });
                
                button.addEventListener('mouseleave', function() {
                    const icon = this.querySelector('.nav-icon');
                    if (icon) {
                        icon.style.transform = 'translateX(0) scale(1)';
                    }
                });
            });
        }

        // 打字機效果
        function typewriterEffect() {
            const titles = document.querySelectorAll('.info-section-title');
            titles.forEach((title, index) => {
                const text = title.textContent;
                title.textContent = '';
                title.style.borderRight = '2px solid #00ffff';
                title.style.animation = 'blink 1s infinite';
                
                setTimeout(() => {
                    let charIndex = 0;
                    const typeInterval = setInterval(() => {
                        title.textContent += text[charIndex];
                        charIndex++;
                        
                        if (charIndex >= text.length) {
                            clearInterval(typeInterval);
                            setTimeout(() => {
                                title.style.borderRight = 'none';
                                title.style.animation = '';
                            }, 1000);
                        }
                    }, 100);
                }, index * 1000);
            });
        }

        // 隨機故障效果
        function randomGlitchEffect() {
            const glitchElements = document.querySelectorAll('.order-title, .info-section-title');
            
            setInterval(() => {
                const randomElement = glitchElements[Math.floor(Math.random() * glitchElements.length)];
                if (randomElement && Math.random() > 0.9) {
                    randomElement.style.animation = 'titleGlitch 0.3s ease-in-out';
                    setTimeout(() => {
                        randomElement.style.animation = '';
                    }, 300);
                }
            }, 3000);
        }

        // 數字動畫效果
        function animateNumbers() {
            const numberElements = document.querySelectorAll('.order-table tbody td:last-child, .total-row td:last-child');
            numberElements.forEach((element, index) => {
                const targetText = element.textContent;
                const targetNumber = parseInt(targetText.replace(/,/g, ''));
                
                if (!isNaN(targetNumber) && targetNumber > 0) {
                    element.textContent = '0';
                    
                    setTimeout(() => {
                        const duration = 1500;
                        const startTime = performance.now();
                        
                        function updateNumber(currentTime) {
                            const elapsed = currentTime - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            
                            // 使用 easeOutCubic 緩動函數
                            const easeProgress = 1 - Math.pow(1 - progress, 3);
                            const currentNumber = Math.floor(targetNumber * easeProgress);
                            
                            element.textContent = currentNumber.toLocaleString();
                            
                            if (progress < 1) {
                                requestAnimationFrame(updateNumber);
                            } else {
                                element.textContent = targetText;
                            }
                        }
                        
                        requestAnimationFrame(updateNumber);
                    }, index * 300);
                }
            });
        }

        // 頁面載入完成後執行
        document.addEventListener('DOMContentLoaded', function() {
            createParticles();
            enhanceStatusIndicators();
            enhanceTableRows();
            enhanceMessages();
            enhanceNavigationButtons();
            
            // 延遲執行的效果
            setTimeout(() => {
                typewriterEffect();
                animateNumbers();
            }, 1000);
            
            setTimeout(() => {
                randomGlitchEffect();
            }, 3000);
            
            // 定期重新創建粒子效果
            setInterval(createParticles, 30000);
        });

        // 響應式處理
        window.addEventListener('resize', function() {
            clearTimeout(window.resizeTimeout);
            window.resizeTimeout = setTimeout(createParticles, 300);
        });
    </script>
</body>
</html>