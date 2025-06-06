<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once '../include/auth.php';

// 商品資料陣列
$products = [
    'A' => [
        'name' => '鏡花・碎象還映',
        'description' => '碎裂之象，在鏡中重構原初之姿。透過量子反射技術，將現實與虛擬的邊界徹底打破，創造出前所未有的視覺體驗。',
        'price' => 2500,
        'image' => '../assets/products/mirror_fractal.jpg',
        'specs' => [
            '量子處理器：Alpha-7 Neural Core',
            '記憶體：128GB Quantum RAM',
            '儲存：2TB Crystalline SSD',
            '解析度：8K Holographic Display'
        ],
        'category' => 'neural_enhancement',
        'stock' => 15,
        'rating' => 4.8
    ],
    'B' => [
        'name' => '綻靈・綾光紋界',
        'description' => '靈光紋界綻放一瞬，映現潔淨之真形。採用最新的生物光學技術，將意識與數位世界完美融合。',
        'price' => 3200,
        'image' => '../assets/products/spirit_light.jpg',
        'specs' => [
            '神經介面：Bio-Sync Matrix V3',
            '處理核心：Omega-12 Quantum Core',
            '感知範圍：360° Omnidirectional',
            '同步延遲：< 0.1ms'
        ],
        'category' => 'bio_interface',
        'stock' => 8,
        'rating' => 4.9
    ],
    'C' => [
        'name' => '燼霞・斷界微聲',
        'description' => '萬象奔流，唯有斷界之音能再現過往之瞬。時空斷層技術讓您聆聽來自平行宇宙的聲音。',
        'price' => 1800,
        'image' => '../assets/products/ember_echo.jpg',
        'specs' => [
            '音頻引擎：Temporal Echo Processor',
            '頻率範圍：0.1Hz - 100kHz',
            '空間定位：7.1 Dimensional Audio',
            '量子噪音抑制：-120dB'
        ],
        'category' => 'audio_tech',
        'stock' => 22,
        'rating' => 4.7
    ],
    'D' => [
        'name' => '靈栞・夢封織界',
        'description' => '夢栞封界，雜訊終將被靈絲編織為純淨之景。夢境編織技術讓您在睡眠中探索無限可能。',
        'price' => 4500,
        'image' => '../assets/products/dream_weaver.jpg',
        'specs' => [
            '夢境處理器：Oneiric Quantum Core',
            '意識映射：Deep Neural Sync',
            '夢境儲存：Unlimited Dream Bank',
            '清醒度控制：Lucid State Manager'
        ],
        'category' => 'consciousness_tech',
        'stock' => 5,
        'rating' => 5.0
    ],
    'E' => [
        'name' => '極光・數位脈動',
        'description' => '捕捉數位極光的每一次脈動，將網路世界的美麗具現化為實體光譜。',
        'price' => 2100,
        'image' => '../assets/products/digital_aurora.jpg',
        'specs' => [
            '光譜引擎：Photonic Pulse Generator',
            '色彩空間：Extended RGB++ Gamut',
            '更新頻率：240Hz Synchronized',
            '能量效率：95% Quantum Efficiency'
        ],
        'category' => 'visual_tech',
        'stock' => 12,
        'rating' => 4.6
    ],
    'F' => [
        'name' => '虛無・量子糾纏',
        'description' => '探索量子糾纏的奧秘，感受超越時空限制的即時連接體驗。',
        'price' => 5200,
        'image' => '../assets/products/quantum_void.jpg',
        'specs' => [
            '糾纏處理器：Dual Quantum Entanglement Core',
            '傳輸距離：Unlimited (Theoretical)',
            '同步精度：Planck Time Level',
            '安全協議：Quantum Cryptography'
        ],
        'category' => 'quantum_tech',
        'stock' => 3,
        'rating' => 4.9
    ]
];
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CYBER PRODUCTS - Digital Marketplace</title>
    <?php include '../include/style.php'; ?>
    <style>
        /* 主要購物容器 */
        .marketplace-hud {
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
                inset 0 0 60px rgba(0, 255, 255, 0.05);
        }

        @keyframes hudPulse {
            0%, 100% {
                box-shadow: 0 0 60px rgba(0, 255, 255, 0.2), inset 0 0 60px rgba(0, 255, 255, 0.05);
            }
            50% {
                box-shadow: 0 0 80px rgba(255, 0, 255, 0.3), inset 0 0 80px rgba(255, 0, 255, 0.08);
            }
        }

        .marketplace-hud::before {
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

        .marketplace-hud::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                linear-gradient(45deg, transparent 48%, rgba(0, 255, 255, 0.1) 49%, rgba(0, 255, 255, 0.1) 51%, transparent 52%),
                linear-gradient(-45deg, transparent 48%, rgba(255, 0, 255, 0.1) 49%, rgba(255, 0, 255, 0.1) 51%, transparent 52%);
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
        .marketplace-header {
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

        .marketplace-title {
            font-size: clamp(2em, 5vw, 2.8em);
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
            letter-spacing: clamp(1px, 0.5vw, 4px);
            font-weight: 900;
            z-index: 2;
        }



        @keyframes titleGlitch {
            0%, 90%, 100% {
                text-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 40px rgba(0, 255, 255, 0.5);
            }
            10% {
                text-shadow: 2px 0 0 #ff00ff, -2px 0 0 #00ffff, 0 0 20px rgba(255, 0, 255, 0.8);
            }
        }

        @keyframes glitchShift {
            0%, 100% { transform: translate(0); }
            20% { transform: translate(-2px, 1px); }
            40% { transform: translate(2px, -1px); }
            60% { transform: translate(-1px, 2px); }
            80% { transform: translate(1px, -2px); }
        }

        .marketplace-subtitle {
            font-size: clamp(1em, 2.5vw, 1.3em);
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 15px;
            text-shadow: 0 0 10px currentColor;
        }

        /* 商品網格 */
        .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 30px;
            margin: 40px 0;
            position: relative;
            z-index: 10;
        }

        .product-card {
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 46, 0.9));
            border: 2px solid #00ffff;
            border-radius: 20px;
            padding: 25px;
            position: relative;
            overflow: hidden;
            transition: all 0.4s ease;
            backdrop-filter: blur(15px);
            box-shadow: 
                0 5px 25px rgba(0, 0, 0, 0.3),
                inset 0 0 30px rgba(0, 255, 255, 0.05);
        }

        .product-card::before {
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
            animation: productRotate 10s linear infinite;
            opacity: 0;
            transition: opacity 0.4s ease;
        }

        .product-card:hover::before {
            opacity: 1;
        }

        @keyframes productRotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .product-card:hover {
            border-color: #ff00ff;
            transform: translateY(-10px) scale(1.02);
            box-shadow: 
                0 15px 40px rgba(255, 0, 255, 0.3),
                inset 0 0 40px rgba(255, 0, 255, 0.1);
        }

        .product-image-container {
            position: relative;
            width: 100%;
            height: 200px;
            margin-bottom: 20px;
            border-radius: 15px;
            overflow: hidden;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid rgba(0, 255, 255, 0.3);
        }

        .product-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: all 0.3s ease;
            filter: brightness(0.9) contrast(1.1) saturate(1.2);
        }

        .product-card:hover .product-image {
            transform: scale(1.05);
            filter: brightness(1.1) contrast(1.2) saturate(1.4);
        }

        .product-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
                45deg,
                rgba(0, 255, 255, 0.1),
                transparent,
                rgba(255, 0, 255, 0.1)
            );
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .product-card:hover .product-overlay {
            opacity: 1;
        }

        .product-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: linear-gradient(45deg, #ff00ff, #ff6600);
            color: #ffffff;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-family: 'Rajdhani', sans-serif;
            box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
            z-index: 5;
        }

        .product-info {
            position: relative;
            z-index: 5;
        }

        .product-name {
            font-size: 1.4em;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 0 15px rgba(0, 255, 255, 0.6);
            line-height: 1.2;
        }

        .product-description {
            color: #e0e0e0;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1em;
            line-height: 1.6;
            margin-bottom: 15px;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
        }

        .product-specs {
            background: rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 10px;
            padding: 15px;
            margin: 15px 0;
        }

        .specs-title {
            color: #ffff00;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.9em;
            font-weight: 600;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .specs-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .specs-list li {
            color: #b8e6b8;
            font-family: 'Rajdhani', sans-serif;
            font-size: 0.9em;
            padding: 3px 0;
            position: relative;
            padding-left: 20px;
        }

        .specs-list li::before {
            content: '▶';
            position: absolute;
            left: 0;
            color: #00ffff;
            font-size: 0.8em;
            animation: specsBlink 2s infinite;
        }

        @keyframes specsBlink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }

        .product-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 15px 0;
            padding: 10px 0;
            border-top: 1px solid rgba(0, 255, 255, 0.2);
        }

        .product-rating {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .rating-stars {
            color: #ffff00;
            font-size: 1.1em;
            text-shadow: 0 0 8px currentColor;
        }

        .rating-value {
            color: #ffff00;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
        }

        .product-stock {
            color: #00ff00;
            font-family: 'Rajdhani', sans-serif;
            font-size: 0.9em;
            font-weight: 600;
        }

        .product-stock.low {
            color: #ff6600;
            animation: stockWarning 2s infinite;
        }

        @keyframes stockWarning {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.6; }
        }

        .product-pricing {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 20px 0;
            padding: 15px;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid rgba(255, 0, 255, 0.3);
            border-radius: 12px;
        }

        .product-price {
            font-size: 1.8em;
            color: #ff00ff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 900;
            text-shadow: 0 0 15px rgba(255, 0, 255, 0.6);
        }

        .price-currency {
            font-size: 0.7em;
            color: #00ffff;
            margin-left: 5px;
        }

        .quantity-controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .quantity-label {
            color: #00ffff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .quantity-input {
            width: 80px;
            padding: 10px 12px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid rgba(0, 255, 255, 0.3);
            border-radius: 6px;
            color: #ffffff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1em;
            text-align: center;
            transition: all 0.3s ease;
        }

        .quantity-input:focus {
            outline: none;
            border-color: #00ffff;
            background: rgba(0, 0, 0, 0.9);
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
            color: #ffffff;
        }

        /* 購物車摘要 */
        .cart-summary {
            position: relative;
            z-index: 10;
            background: rgba(0, 0, 0, 0.9);
            border: 3px solid #ff00ff;
            border-radius: 20px;
            padding: 30px;
            margin: 40px 0;
            backdrop-filter: blur(15px);
            box-shadow: 
                0 0 40px rgba(255, 0, 255, 0.3),
                inset 0 0 40px rgba(255, 0, 255, 0.05);
        }

        .cart-title {
            font-size: 1.8em;
            color: #ff00ff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 800;
            margin-bottom: 25px;
            text-shadow: 0 0 20px currentColor;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 3px;
            position: relative;
        }

        .cart-title::before {
            content: '◆';
            position: absolute;
            left: -30px;
            top: 50%;
            transform: translateY(-50%);
            color: #00ffff;
            animation: pulse 2s infinite;
        }

        .cart-title::after {
            content: '◆';
            position: absolute;
            right: -30px;
            top: 50%;
            transform: translateY(-50%);
            color: #00ffff;
            animation: pulse 2s infinite;
        }

        .cart-total {
            text-align: center;
            padding: 25px;
            background: rgba(255, 0, 255, 0.1);
            border: 2px solid #ff00ff;
            border-radius: 15px;
            margin-bottom: 30px;
        }

        .total-label {
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.2em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 10px;
        }

        .total-amount {
            font-size: 2.5em;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 900;
            text-shadow: 0 0 20px currentColor;
        }

        /* 訂購者資料表單 */
        .customer-form {
            position: relative;
            z-index: 10;
            background: rgba(0, 0, 0, 0.9);
            border: 3px solid #00ffff;
            border-radius: 20px;
            padding: 35px;
            margin: 30px 0;
            backdrop-filter: blur(15px);
            box-shadow: 
                0 0 40px rgba(0, 255, 255, 0.3),
                inset 0 0 40px rgba(0, 255, 255, 0.05);
        }

        .form-section-title {
            font-size: 1.6em;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            margin-bottom: 25px;
            text-shadow: 0 0 15px currentColor;
            position: relative;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-align: center;
        }

        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 25px;
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

        .form-input, .form-textarea {
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
        }

        .form-input:focus, .form-textarea:focus {
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
            font-family: 'Rajdhani', sans-serif;
            line-height: 1.6;
        }

        /* 提交按鈕 */
        .submit-container {
            text-align: center;
            margin-top: 40px;
            position: relative;
            z-index: 10;
        }

        .cyber-submit-button {
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
            display: inline-block;
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
            transform: translateY(-5px) scale(1.05);
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
            box-shadow: 
                0 10px 40px rgba(0, 255, 255, 0.4),
                inset 0 0 40px rgba(0, 255, 255, 0.1);
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
            50% { transform: scale(1.1) rotate(5deg); }
        }

        /* 返回按鈕 */
        .return-container {
            text-align: center;
            margin-top: 30px;
            position: relative;
            z-index: 10;
        }

        .cyber-return-btn {
            color: #ff00ff;
            text-decoration: none;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            font-size: 1em;
            text-transform: uppercase;
            letter-spacing: 2px;
            padding: 12px 25px;
            border: 2px solid rgba(255, 0, 255, 0.3);
            border-radius: 8px;
            transition: all 0.3s ease;
            display: inline-block;
            text-shadow: 0 0 10px rgba(255, 0, 255, 0.5);
        }

        .cyber-return-btn:hover {
            border-color: #ff00ff;
            background: rgba(255, 0, 255, 0.1);
            box-shadow: 0 0 20px rgba(255, 0, 255, 0.3);
            transform: translateY(-2px);
        }

        /* 響應式設計 */
        @media (max-width: 768px) {
            .products-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .form-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .marketplace-hud {
                padding: 20px;
                margin: 15px 0;
            }

            .product-card {
                padding: 20px;
            }
        }

        @media (max-width: 480px) {
            .marketplace-title {
                font-size: 1.5em;
            }

            .product-name {
                font-size: 1.2em;
            }

            .product-price {
                font-size: 1.5em;
            }

            .cyber-submit-button {
                padding: 15px 30px;
                font-size: 1em;
            }
        }
    </style>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="particles" id="particles"></div>
    
    <?php include '../include/menu.php'; ?>
    
    <div class="container">
        <div class="marketplace-hud">
            <!-- 標題區域 -->
            <div class="marketplace-header">
                <h1 class="marketplace-title">◆ CYBER PRODUCTS ◆</h1>
                <div class="marketplace-subtitle">Digital Enhancement Marketplace</div>
                <div class="system-status">
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>SYSTEM ONLINE</span>
                    </div>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>SECURE CHANNEL</span>
                    </div>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>QUANTUM ENCRYPTED</span>
                    </div>
                </div>
            </div>

            <!-- 商品網格 -->
            <div class="products-grid">
                <?php foreach ($products as $key => $product): ?>
                <div class="product-card" data-product="<?php echo $key; ?>">
                    <div class="product-image-container">
                        <img src="<?php echo $product['image']; ?>" alt="<?php echo htmlspecialchars($product['name']); ?>" class="product-image" 
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTJlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzAwZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Q1lCRVIgUFJPRFVDVDwvdGV4dD48L3N2Zz4='">
                        <div class="product-overlay"></div>
                        <div class="product-badge"><?php echo strtoupper($product['category']); ?></div>
                    </div>

                    <div class="product-info">
                        <h3 class="product-name"><?php echo htmlspecialchars($product['name']); ?></h3>
                        <p class="product-description"><?php echo htmlspecialchars($product['description']); ?></p>

                        <!-- 規格面板 -->
                        <div class="product-specs">
                            <div class="specs-title">◆ TECH SPECS ◆</div>
                            <ul class="specs-list">
                                <?php foreach ($product['specs'] as $spec): ?>
                                <li><?php echo htmlspecialchars($spec); ?></li>
                                <?php endforeach; ?>
                            </ul>
                        </div>

                        <!-- 產品元數據 -->
                        <div class="product-meta">
                            <div class="product-rating">
                                <span class="rating-stars">
                                    <?php 
                                    $fullStars = floor($product['rating']);
                                    for ($i = 0; $i < $fullStars; $i++) echo '★';
                                    if ($product['rating'] - $fullStars >= 0.5) echo '☆';
                                    ?>
                                </span>
                                <span class="rating-value"><?php echo $product['rating']; ?></span>
                            </div>
                            <div class="product-stock <?php echo $product['stock'] <= 5 ? 'low' : ''; ?>">
                                庫存: <?php echo $product['stock']; ?>
                            </div>
                        </div>

                        <!-- 價格和數量控制 -->
                        <div class="product-pricing">
                            <div class="product-price">
                                NT$ <?php echo number_format($product['price']); ?>
                                <span class="price-currency">CREDITS</span>
                            </div>
                            <div class="quantity-controls">
                                <span class="quantity-label">數量:</span>
                                <input type="number" class="quantity-input" min="0" max="<?php echo $product['stock']; ?>" value="0" 
                                       data-product="<?php echo $key; ?>" data-price="<?php echo $product['price']; ?>" 
                                       data-name="<?php echo htmlspecialchars($product['name']); ?>" onchange="updateCart()">
                            </div>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <!-- 購物車摘要 -->
            <div class="cart-summary">
                <h2 class="cart-title">◆ PURCHASE SUMMARY ◆</h2>
                <div class="cart-total">
                    <div class="total-label">總金額</div>
                    <div class="total-amount" id="totalAmount">NT$ 0</div>
                </div>
            </div>

            <!-- 訂購者資料表單 -->
            <div class="customer-form">
                <h2 class="form-section-title">◆ CUSTOMER DATA INPUT ◆</h2>
                <form action="total_money.php" method="POST" onsubmit="return validateForm()">
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label" for="name">訂購者姓名</label>
                            <input type="text" id="name" name="name" class="form-input" placeholder="請輸入您的姓名" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="phone">連絡電話</label>
                            <input type="tel" id="phone" name="phone" class="form-input" placeholder="請輸入連絡電話" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="email">電子郵件</label>
                            <input type="email" id="email" name="email" class="form-input" placeholder="請輸入電子郵件" required>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="city">所在城市</label>
                            <input type="text" id="city" name="city" class="form-input" placeholder="請輸入所在城市">
                        </div>

                        <div class="form-group full-width">
                            <label class="form-label" for="address">收件地址</label>
                            <textarea id="address" name="address" class="form-textarea" placeholder="請輸入完整收件地址" required></textarea>
                        </div>

                        <div class="form-group full-width">
                            <label class="form-label" for="notes">備註</label>
                            <textarea id="notes" name="notes" class="form-textarea" placeholder="特殊需求或備註（選填）"></textarea>
                        </div>
                    </div>

                    <!-- 隱藏的產品資料欄位 -->
                    <div id="productData"></div>

                    <!-- 提交按鈕 -->
                    <div class="submit-container">
                        <button type="submit" class="cyber-submit-button">
                            <span class="submit-icon">◆</span>
                            <span class="submit-text">EXECUTE ORDER</span>
                        </button>
                    </div>
                </form>
            </div>

            <!-- 返回按鈕 -->
            <div class="return-container">
                <a href="../index.php" class="cyber-return-btn">◆ RETURN TO MAIN TERMINAL ◆</a>
            </div>
        </div>
    </div>
    
    <script>
        // 創建粒子效果
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            const particleCount = 50;
            
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 10 + 's';
                particle.style.animationDuration = (Math.random() * 10 + 5) + 's';
                
                const colors = ['#00ffff', '#ff00ff', '#ffff00'];
                particle.style.background = colors[Math.floor(Math.random() * colors.length)];
                
                particlesContainer.appendChild(particle);
            }
        }
        
        // 購物車計算
        function updateCart() {
            const quantityInputs = document.querySelectorAll('.quantity-input');
            const productDataContainer = document.getElementById('productData');
            let total = 0;
            
            // 清空隱藏欄位
            productDataContainer.innerHTML = '';
            
            quantityInputs.forEach((input, index) => {
                const quantity = parseInt(input.value) || 0;
                const price = parseFloat(input.dataset.price);
                const productName = input.dataset.name;
                const productKey = input.dataset.product;
                
                if (quantity > 0) {
                    total += quantity * price;
                    
                    // 添加隱藏欄位
                    const nameInput = document.createElement('input');
                    nameInput.type = 'hidden';
                    nameInput.name = `product_name[${productKey}]`;
                    nameInput.value = productName;
                    productDataContainer.appendChild(nameInput);
                    
                    const priceInput = document.createElement('input');
                    priceInput.type = 'hidden';
                    priceInput.name = `product_price[${productKey}]`;
                    priceInput.value = price;
                    productDataContainer.appendChild(priceInput);
                    
                    const quantityHidden = document.createElement('input');
                    quantityHidden.type = 'hidden';
                    quantityHidden.name = `quantity[${productKey}]`;
                    quantityHidden.value = quantity;
                    productDataContainer.appendChild(quantityHidden);
                }
            });
            
            // 更新總金額顯示
            document.getElementById('totalAmount').textContent = 'NT$ ' + total.toLocaleString();
            
            // 添加視覺效果
            const totalElement = document.getElementById('totalAmount');
            totalElement.style.transform = 'scale(1.1)';
            setTimeout(() => {
                totalElement.style.transform = 'scale(1)';
            }, 200);
        }
        
        // 表單驗證
        function validateForm() {
            const quantityInputs = document.querySelectorAll('.quantity-input');
            let hasProducts = false;
            
            quantityInputs.forEach(input => {
                if (parseInt(input.value) > 0) {
                    hasProducts = true;
                }
            });
            
            if (!hasProducts) {
                alert('請選擇至少一項商品！');
                return false;
            }
            
            return true;
        }
        
        // 添加提交動畫
        function animateSubmit() {
            const submitButton = document.querySelector('.cyber-submit-button');
            submitButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                submitButton.style.transform = 'scale(1)';
            }, 150);
        }
        
        // 商品卡片懸停效果增強
        function enhanceProductCards() {
            const cards = document.querySelectorAll('.product-card');
            cards.forEach(card => {
                card.addEventListener('mouseenter', function() {
                    this.style.filter = 'brightness(1.1) saturate(1.2)';
                });
                
                card.addEventListener('mouseleave', function() {
                    this.style.filter = 'brightness(1) saturate(1)';
                });
            });
        }
        
        // 數量輸入框增強
        function enhanceQuantityInputs() {
            const inputs = document.querySelectorAll('.quantity-input');
            inputs.forEach(input => {
                input.addEventListener('input', function() {
                    const max = parseInt(this.max);
                    const value = parseInt(this.value);
                    
                    if (value > max) {
                        this.value = max;
                        this.style.borderColor = '#ff6600';
                        setTimeout(() => {
                            this.style.borderColor = '';
                        }, 1000);
                    }
                    
                    updateCart();
                });
                
                input.addEventListener('focus', function() {
                    this.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.5)';
                });
                
                input.addEventListener('blur', function() {
                    this.style.boxShadow = '';
                });
            });
        }
        
        // 初始化
        document.addEventListener('DOMContentLoaded', function() {
            createParticles();
            enhanceProductCards();
            enhanceQuantityInputs();
            updateCart();
            
            // 提交按鈕動畫
            const submitButton = document.querySelector('.cyber-submit-button');
            submitButton.addEventListener('click', animateSubmit);
            
            // 窗口大小調整時重新創建粒子
            window.addEventListener('resize', createParticles);
        });
    </script>
</body>
</html>