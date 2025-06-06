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
    <title>3D NEURAL MATRIX - Cyber Nexus</title>
    <?php include '../include/style.php'; ?>
    <style>
        /* 全域增強效果 */
        body {
            overflow-x: hidden;
            background: radial-gradient(circle at center, #0a0a0a, #1a1a2e, #0a0a0a);
        }

        /* 主要視覺化容器 - 減少動畫複雜度 */
        .visualization-hud {
            position: relative;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(26, 26, 46, 0.95));
            border: 3px solid #00ffff;
            border-radius: 20px;
            padding: 40px;
            margin: 30px 0;
            backdrop-filter: blur(15px);
            overflow: hidden;
            box-shadow: 0 0 40px rgba(0, 255, 255, 0.3);
        }

        /* 簡化標題動畫 */
        .hud-title {
            font-size: 2.5em;
            font-family: 'Orbitron', sans-serif;
            color: #00ffff;
            text-shadow: 0 0 20px #00ffff;
            margin-bottom: 25px;
            text-align: center;
            position: relative;
            z-index: 10;
            text-transform: uppercase;
            letter-spacing: 4px;
        }

        /* 統計面板 - 優化GPU消耗 */
        .stats-hud {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 25px;
            margin-bottom: 35px;
            position: relative;
            z-index: 10;
        }

        .stat-module {
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.85), rgba(26, 26, 46, 0.85));
            border: 2px solid #ff00ff;
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .stat-module:hover {
            border-color: #00ffff;
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(0, 255, 255, 0.3);
        }

        .stat-label {
            color: #ff00ff;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.1em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 12px;
            position: relative;
            z-index: 1;
        }

        .stat-value {
            font-size: 2.2em;
            font-weight: 900;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            position: relative;
            z-index: 1;
        }

        /* 系統狀態面板 */
        .system-status-hud {
            text-align: center;
            margin-bottom: 30px;
            position: relative;
            z-index: 10;
        }

        .status-text {
            color: #ffff00;
            font-family: 'Rajdhani', sans-serif;
            font-size: 1.1em;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 3px;
            padding: 12px 25px;
            background: rgba(255, 255, 0, 0.15);
            border: 2px solid rgba(255, 255, 0, 0.4);
            border-radius: 25px;
            display: inline-block;
            text-shadow: 0 0 10px currentColor;
            position: relative;
            overflow: hidden;
        }

        /* 控制面板 - 減少特效 */
        .control-hud {
            background: rgba(0, 0, 0, 0.9);
            border: 3px solid #00ffff;
            border-radius: 20px;
            padding: 35px;
            margin-bottom: 30px;
            position: relative;
            z-index: 10;
            overflow: hidden;
            box-shadow: 0 0 30px rgba(0, 255, 255, 0.2);
        }

        .control-title {
            font-size: 1.6em;
            color: #00ffff;
            font-family: 'Orbitron', sans-serif;
            font-weight: 800;
            margin-bottom: 25px;
            text-shadow: 0 0 15px currentColor;
            position: relative;
            text-transform: uppercase;
            letter-spacing: 3px;
            text-align: center;
        }

        .controls-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 25px;
            position: relative;
            z-index: 10;
        }

        .control-module {
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid rgba(0, 255, 255, 0.4);
            border-radius: 12px;
            padding: 20px;
            transition: all 0.3s ease;
            position: relative;
        }

        .control-module:hover {
            border-color: #ff00ff;
            background: rgba(0, 0, 0, 0.9);
            transform: translateY(-2px);
        }

        .control-label {
            color: #00ffff;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 1em;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .control-value {
            color: #ff00ff;
            font-weight: bold;
            font-family: 'Orbitron', sans-serif;
        }

        .control-note {
            color: #ffff00;
            font-size: 0.8em;
            margin-top: 5px;
            font-family: 'Rajdhani', sans-serif;
        }

        .cyber-slider {
            width: 100%;
            height: 8px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #00ffff;
            border-radius: 4px;
            outline: none;
            cursor: pointer;
            position: relative;
            appearance: none;
            -webkit-appearance: none;
        }

        .cyber-slider::-webkit-slider-thumb {
            appearance: none;
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            background: linear-gradient(45deg, #00ffff, #ff00ff);
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid rgba(255, 255, 255, 0.3);
            transition: all 0.3s ease;
        }

        .cyber-slider::-webkit-slider-thumb:hover {
            transform: scale(1.2);
        }

        /* 3D 視覺化容器 - 增大尺寸 */
        #visualization {
            width: 100%;
            height: 800px; /* 提高高度 */
            background: 
                radial-gradient(circle at center, rgba(0, 0, 0, 0.95), rgba(10, 10, 40, 0.98));
            margin: 30px 0;
            position: relative;
            overflow: hidden;
            border-radius: 20px;
            border: 3px solid #00ffff;
            box-shadow: 0 0 40px rgba(0, 255, 255, 0.2);
        }

        /* 神經網絡層級系統 */
        .neural-layer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .synapses-layer { z-index: 100; }
        .neurons-layer { z-index: 200; }
        .core-layer { z-index: 300; }

        .neural-core {
            position: absolute;
            border: 3px solid rgba(0, 255, 255, 0.6);
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 50;
            box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
        }

        .neuron {
            position: absolute;
            background: radial-gradient(circle, #00ffff, rgba(0, 255, 255, 0.4));
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            box-shadow: 0 0 10px currentColor;
            transition: all 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .neuron.type-alpha {
            background: radial-gradient(circle, #ff00ff, rgba(255, 0, 255, 0.4));
        }

        .neuron.type-beta {
            background: radial-gradient(circle, #ffff00, rgba(255, 255, 0, 0.4));
        }

        .neuron.type-gamma {
            background: radial-gradient(circle, #ff6600, rgba(255, 102, 0, 0.4));
        }

        .synapse {
            position: absolute;
            background: linear-gradient(90deg, 
                rgba(0, 255, 255, 0.8), 
                rgba(255, 0, 255, 0.6)
            );
            transform-origin: 0 0;
            pointer-events: none;
            transition: opacity 0.5s ease;
            border-radius: 2px;
        }

        /* 數據流效果 - 簡化 */
        .data-pulse {
            position: absolute;
            width: 3px;
            height: 3px;
            background: #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 6px #ffffff;
            pointer-events: none;
        }

        /* 量子信息面板 */
        .quantum-info {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #ffff00;
            border-radius: 10px;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 0.8em;
            color: #ffff00;
            z-index: 1000;
            backdrop-filter: blur(10px);
        }

        .quantum-info .info-line {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
        }

        .quantum-info .info-value {
            color: #00ffff;
            font-weight: bold;
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
            transition: all 0.3s ease;
            overflow: hidden;
            text-shadow: 0 0 10px currentColor;
            backdrop-filter: blur(10px);
        }

        .cyber-return-btn:hover {
            background: linear-gradient(135deg, rgba(0, 255, 255, 0.4), rgba(0, 150, 255, 0.4));
            border-color: #ffffff;
            color: #ffffff;
            transform: translateY(-3px);
            text-shadow: 0 0 15px rgba(255, 255, 255, 0.8);
        }

        .btn-icon {
            margin-right: 12px;
            font-size: 1.2em;
            position: relative;
            z-index: 2;
        }

        /* 響應式設計 */
        @media (max-width: 768px) {
            .visualization-hud {
                padding: 25px;
                margin: 20px 0;
            }

            .hud-title {
                font-size: 2em;
                margin-bottom: 20px;
                letter-spacing: 2px;
            }

            .stats-hud {
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 20px;
            }

            .controls-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            #visualization {
                height: 500px; /* 移動端適中高度 */
                margin: 25px 0;
            }

            .cyber-return-btn {
                padding: 16px 35px;
                font-size: 0.9em;
                letter-spacing: 2px;
            }

            .quantum-info {
                top: 10px;
                right: 10px;
                padding: 10px;
                font-size: 0.7em;
            }
        }

        @media (max-width: 480px) {
            .hud-title {
                font-size: 1.6em;
            }

            .stats-hud {
                grid-template-columns: 1fr;
            }

            #visualization {
                height: 400px;
            }
        }
    </style>
</head>
<body>
    <div class="animated-bg"></div>
    <div class="particles" id="particles"></div>
    
    <?php include '../include/menu.php'; ?>
    
    <div class="container">
        <div class="visualization-hud">
            <h1 class="hud-title">◆ 3D NEURAL MATRIX ◆</h1>
            
            <div class="stats-hud">
                <div class="stat-module">
                    <div class="stat-label">Neural Nodes</div>
                    <div id="nodeCount" class="stat-value">0</div>
                </div>
                <div class="stat-module">
                    <div class="stat-label">Synapses</div>
                    <div id="synapseCount" class="stat-value">0</div>
                </div>
                <div class="stat-module">
                    <div class="stat-label">Quantum FPS</div>
                    <div id="fpsCount" class="stat-value">60</div>
                </div>
                <div class="stat-module">
                    <div class="stat-label">Data Flow</div>
                    <div id="dataFlow" class="stat-value">100%</div>
                </div>
            </div>
            
            <div class="system-status-hud">
                <div class="status-text" id="systemStatus">NEURAL MATRIX INITIALIZING...</div>
            </div>
            
            <div class="control-hud">
                <h2 class="control-title">◢ NEURAL CONTROL MATRIX ◣</h2>
                <div class="controls-grid">
                    <div class="control-module">
                        <div class="control-label">
                            Neuron Opacity
                            <span class="control-value" id="neuronOpacityValue">0.9</span>
                        </div>
                        <input type="range" id="neuronOpacityControl" class="cyber-slider" 
                               min="0" max="1" step="0.05" value="0.9">
                    </div>
                    
                    <div class="control-module">
                        <div class="control-label">
                            Synapse Opacity
                            <span class="control-value" id="synapseOpacityValue">0.8</span>
                        </div>
                        <input type="range" id="synapseOpacityControl" class="cyber-slider" 
                               min="0" max="1" step="0.05" value="0.8">
                    </div>
                    
                    <div class="control-module">
                        <div class="control-label">
                            Rotation Speed
                            <span class="control-value" id="rotationSpeedValue">1.5</span>
                        </div>
                        <input type="range" id="rotationSpeedControl" class="cyber-slider" 
                               min="0" max="5" step="0.1" value="1.5">
                    </div>
                    
                    <div class="control-module">
                        <div class="control-label">
                            Network Density
                            <span class="control-value" id="densityValue">0.7</span>
                        </div>
                        <input type="range" id="densityControl" class="cyber-slider" 
                               min="0.3" max="1.0" step="0.05" value="0.7">
                    </div>
                    
                    <div class="control-module">
                        <div class="control-label">
                            Zoom Level
                            <span class="control-value" id="zoomValue">1.0</span>
                        </div>
                        <div class="control-note">Use mouse wheel to adjust (0.2x - 8.0x)</div>
                    </div>
                    
                    <div class="control-module">
                        <div class="control-label">
                            Quantum Coherence
                            <span class="control-value" id="coherenceValue">95%</span>
                        </div>
                        <div class="control-note">Auto-stabilizing</div>
                    </div>
                </div>
            </div>
            
            <div id="visualization">
                <div class="quantum-info">
                    <div class="info-line">
                        <span>Matrix Stability:</span>
                        <span class="info-value" id="stability">99.2%</span>
                    </div>
                    <div class="info-line">
                        <span>Quantum State:</span>
                        <span class="info-value" id="quantumState">COHERENT</span>
                    </div>
                    <div class="info-line">
                        <span>Processing:</span>
                        <span class="info-value" id="processing">ENHANCED</span>
                    </div>
                    <div class="info-line">
                        <span>Dimensions:</span>
                        <span class="info-value" id="dimensions">3D+T+Q</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="return-hud">
            <a href="../index.php" class="cyber-return-btn">
                <span class="btn-icon">◆</span>
                <span>RETURN TO MAIN TERMINAL</span>
            </a>
        </div>
    </div>

    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // 提升性能配置 - 提高初始品質
        const PERFORMANCE_CONFIG = {
            MAX_NEURONS: 300,        // 提高神經元數量
            MAX_SYNAPSES_RATIO: 0.4, // 提高連接比例
            UPDATE_INTERVAL: 30,     // 降低更新間隔提高流暢度
            PULSE_CHANCE: 0.01,      // 提高脈衝機率
            ANIMATION_FRAME_SKIP: 0, // 關閉跳幀
            QUALITY_MODE: 'high'     // 設為高品質模式
        };

        // 檢測設備性能 - 更保守的降級策略
        function detectDeviceCapability() {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobile = /mobile|android|iphone|ipad/.test(userAgent);
            const isOldBrowser = !window.requestAnimationFrame;
            
            // 只在極低性能設備上降級
            if (isOldBrowser) {
                PERFORMANCE_CONFIG.MAX_NEURONS = 150;
                PERFORMANCE_CONFIG.MAX_SYNAPSES_RATIO = 0.25;
                PERFORMANCE_CONFIG.UPDATE_INTERVAL = 50;
                PERFORMANCE_CONFIG.QUALITY_MODE = 'medium';
            } else if (isMobile) {
                PERFORMANCE_CONFIG.MAX_NEURONS = 200;
                PERFORMANCE_CONFIG.MAX_SYNAPSES_RATIO = 0.3;
                PERFORMANCE_CONFIG.UPDATE_INTERVAL = 40;
                PERFORMANCE_CONFIG.QUALITY_MODE = 'medium';
            }
        }

        detectDeviceCapability();

        // 創建增強的粒子效果
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            if (!particlesContainer) return;
            
            const particleCount = PERFORMANCE_CONFIG.QUALITY_MODE === 'high' ? 80 : 
                                  PERFORMANCE_CONFIG.QUALITY_MODE === 'medium' ? 50 : 30;
            
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 10 + 's';
                particle.style.animationDuration = (Math.random() * 8 + 6) + 's';
                particlesContainer.appendChild(particle);
            }
        }

        // 獲取視覺化容器
        const container = document.getElementById('visualization');
        const width = container.clientWidth;
        const height = container.clientHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 創建神經網絡層級
        const synapsesLayer = document.createElement('div');
        synapsesLayer.className = 'neural-layer synapses-layer';
        container.appendChild(synapsesLayer);
        
        const neuronsLayer = document.createElement('div');
        neuronsLayer.className = 'neural-layer neurons-layer';
        container.appendChild(neuronsLayer);
        
        const coreLayer = document.createElement('div');
        coreLayer.className = 'neural-layer core-layer';
        container.appendChild(coreLayer);
        
        // 創建更大的神經核心
        const neuralCoreRadius = Math.min(width, height) * 0.15; // 增大核心
        const neuralCore = document.createElement('div');
        neuralCore.className = 'neural-core';
        neuralCore.style.width = (neuralCoreRadius * 2) + 'px';
        neuralCore.style.height = (neuralCoreRadius * 2) + 'px';
        coreLayer.appendChild(neuralCore);
        
        // 控制元素
        const neuronOpacityControl = document.getElementById('neuronOpacityControl');
        const synapseOpacityControl = document.getElementById('synapseOpacityControl');
        const rotationSpeedControl = document.getElementById('rotationSpeedControl');
        const densityControl = document.getElementById('densityControl');
        
        // 顯示元素
        const neuronOpacityValue = document.getElementById('neuronOpacityValue');
        const synapseOpacityValue = document.getElementById('synapseOpacityValue');
        const rotationSpeedValue = document.getElementById('rotationSpeedValue');
        const densityValue = document.getElementById('densityValue');
        const zoomValue = document.getElementById('zoomValue');
        const systemStatus = document.getElementById('systemStatus');
        const fpsDisplay = document.getElementById('fpsCount');
        const stabilityDisplay = document.getElementById('stability');
        const quantumStateDisplay = document.getElementById('quantumState');
        const coherenceDisplay = document.getElementById('coherenceValue');
        
        // 神經網絡參數
        let numNeurons = PERFORMANCE_CONFIG.MAX_NEURONS;
        const neurons = [];
        const neuronElements = [];
        let synapses = [];
        const synapseElements = [];
        
        // 提升縮放和旋轉參數
        let zoomScale = 1;
        const minZoom = 0.2; // 降低最小縮放
        const maxZoom = 8.0; // 大幅提高最大縮放
        let rotationAngle = 0;
        let rotationSpeed = parseFloat(rotationSpeedControl.value) * 0.008; // 提高旋轉速度係數
        
        // 性能監控
        let lastTime = 0;
        let frameCount = 0;
        let fps = 60;
        let frameSkipCounter = 0;
        
        // 網絡重構計時 - 縮短間隔
        let lastNetworkUpdate = 0;
        let networkUpdateInterval = 8000; // 縮短到8秒
        let isUpdatingNetwork = false;
        
        // 工具函數
        function getDistance3D(x1, y1, z1, x2, y2, z2) {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
        }
        
        function getAngle(x1, y1, x2, y2) {
            return Math.atan2(y2 - y1, x2 - x1);
        }
        
        function generateSpherePoint(radius) {
            const u = Math.random();
            const v = Math.random();
            const theta = 2 * Math.PI * u;
            const phi = Math.acos(2 * v - 1);
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            return { x, y, z };
        }
        
        function smoothTransition(current, target, factor = 0.15) { // 提高過渡速度
            return current + (target - current) * factor;
        }
        
        function generateNeuronTypes() {
            const types = ['default', 'alpha', 'beta', 'gamma'];
            const weights = [0.5, 0.25, 0.2, 0.05]; // 更多樣化的神經元類型
            const rand = Math.random();
            let cumulative = 0;
            
            for (let i = 0; i < weights.length; i++) {
                cumulative += weights[i];
                if (rand <= cumulative) {
                    return types[i];
                }
            }
            return types[0];
        }
        
        // 增強的神經元生成
        function generateNeurons() {
            neurons.length = 0;
            neuronElements.forEach(el => el.remove());
            neuronElements.length = 0;
            
            for (let i = 0; i < numNeurons; i++) {
                const distanceMultiplier = Math.random() * 1.0 + 0.8; // 擴大分布範圍
                const coords = generateSpherePoint(neuralCoreRadius * distanceMultiplier);
                
                const neuron = {
                    id: i,
                    x: 0, y: 0, z: 0,
                    originalX: coords.x,
                    originalY: coords.y,
                    originalZ: coords.z,
                    size: Math.random() * 2.0 + 2.0, // 增大神經元尺寸
                    type: generateNeuronTypes(),
                    activity: Math.random(),
                    screenX: 0, screenY: 0,
                    opacity: 0.9,
                    lastPulse: 0
                };
                
                neurons.push(neuron);
                
                // 創建神經元DOM元素
                const neuronElement = document.createElement('div');
                neuronElement.className = `neuron ${neuron.type !== 'default' ? 'type-' + neuron.type : ''}`;
                neuronElement.style.width = (neuron.size * 2) + 'px';
                neuronElement.style.height = (neuron.size * 2) + 'px';
                neuronsLayer.appendChild(neuronElement);
                neuronElements.push(neuronElement);
            }
            
            document.getElementById('nodeCount').textContent = numNeurons;
        }
        
        // 創建增強的突觸池
        function createSynapsePool() {
            const maxSynapses = Math.floor(numNeurons * PERFORMANCE_CONFIG.MAX_SYNAPSES_RATIO);
            synapseElements.forEach(el => el.remove());
            synapseElements.length = 0;
            
            for (let i = 0; i < maxSynapses; i++) {
                const synapseElement = document.createElement('div');
                synapseElement.className = 'synapse';
                synapseElement.style.opacity = '0';
                synapseElement.style.transition = 'opacity 0.6s ease';
                synapsesLayer.appendChild(synapseElement);
                synapseElements.push(synapseElement);
            }
        }
        
        // 增強的網絡生成
        function generateNetwork() {
            synapses = [];
            const density = parseFloat(densityControl.value);
            const numSynapses = Math.floor(numNeurons * PERFORMANCE_CONFIG.MAX_SYNAPSES_RATIO * density);
            
            for (let i = 0; i < numSynapses && i < synapseElements.length; i++) {
                const sourceIndex = Math.floor(Math.random() * numNeurons);
                let targetIndex;
                let attempts = 0;
                
                do {
                    targetIndex = Math.floor(Math.random() * numNeurons);
                    attempts++;
                } while (targetIndex === sourceIndex && attempts < 8); // 增加嘗試次數
                
                if (attempts < 8) {
                    synapses.push({
                        source: sourceIndex,
                        target: targetIndex,
                        strength: Math.random() * 0.5 + 0.5, // 提高連接強度
                        activity: 0,
                        fadeIn: true,
                        age: 0
                    });
                }
            }
            
            document.getElementById('synapseCount').textContent = synapses.length;
        }
        
        // 增強的網絡更新
        function updateNetwork() {
            const now = Date.now();
            if (!isUpdatingNetwork && now - lastNetworkUpdate > networkUpdateInterval) {
                isUpdatingNetwork = true;
                lastNetworkUpdate = now;
                
                // 更頻繁的網絡更新
                const updateCount = Math.floor(synapses.length * 0.15);
                for (let i = 0; i < updateCount; i++) {
                    const index = Math.floor(Math.random() * synapses.length);
                    if (synapses[index]) {
                        synapses[index].fadeIn = false;
                    }
                }
                
                // 縮短重新生成時間
                setTimeout(() => {
                    synapses = synapses.filter(synapse => synapse.fadeIn);
                    
                    const density = parseFloat(densityControl.value);
                    const newSynapses = Math.floor(updateCount * density);
                    
                    for (let i = 0; i < newSynapses; i++) {
                        const sourceIndex = Math.floor(Math.random() * numNeurons);
                        let targetIndex;
                        let attempts = 0;
                        
                        do {
                            targetIndex = Math.floor(Math.random() * numNeurons);
                            attempts++;
                        } while (targetIndex === sourceIndex && attempts < 8);
                        
                        if (attempts < 8) {
                            synapses.push({
                                source: sourceIndex,
                                target: targetIndex,
                                strength: Math.random() * 0.5 + 0.5,
                                activity: 0,
                                fadeIn: true,
                                age: 0
                            });
                        }
                    }
                    
                    document.getElementById('synapseCount').textContent = synapses.length;
                    isUpdatingNetwork = false;
                }, 1500); // 縮短到1.5秒
            }
        }
        
        // 增強的數據脈衝
        function createDataPulse(synapse) {
            if (Math.random() < PERFORMANCE_CONFIG.PULSE_CHANCE) {
                const sourceNeuron = neurons[synapse.source];
                const targetNeuron = neurons[synapse.target];
                
                const pulse = document.createElement('div');
                pulse.className = 'data-pulse';
                
                const startX = sourceNeuron.screenX;
                const startY = sourceNeuron.screenY;
                const endX = targetNeuron.screenX;
                const endY = targetNeuron.screenY;
                
                pulse.style.left = startX + 'px';
                pulse.style.top = startY + 'px';
                
                const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                const duration = Math.max(0.2, distance / 400); // 加快脈衝速度
                
                pulse.style.transition = `transform ${duration}s ease-out, opacity ${duration}s ease-out`;
                pulse.style.transform = `translate(${endX - startX}px, ${endY - startY}px)`;
                pulse.style.opacity = '0';
                
                container.appendChild(pulse);
                
                setTimeout(() => {
                    if (pulse.parentNode) {
                        pulse.remove();
                    }
                }, duration * 1000);
            }
        }
        
        // 增強滾輪縮放事件
        container.addEventListener('wheel', function(event) {
            event.preventDefault();
            const delta = event.deltaY < 0 ? 0.2 : -0.2; // 增大縮放步進
            zoomScale = Math.max(minZoom, Math.min(maxZoom, zoomScale + delta));
            zoomValue.textContent = zoomScale.toFixed(1) + 'x';
        });
        
        // 控制器事件
        neuronOpacityControl.addEventListener('input', function() {
            const value = this.value;
            neuronOpacityValue.textContent = value;
        });
        
        synapseOpacityControl.addEventListener('input', function() {
            const value = this.value;
            synapseOpacityValue.textContent = value;
        });
        
        rotationSpeedControl.addEventListener('input', function() {
            const value = this.value;
            rotationSpeedValue.textContent = value;
            rotationSpeed = parseFloat(value) * 0.008; // 提高旋轉速度係數
        });
        
        densityControl.addEventListener('input', function() {
            const value = this.value;
            densityValue.textContent = value;
        });
        
        // 增強的矩陣更新
        function updateNeuralMatrix() {
            // 跳幀優化（高品質模式下關閉）
            frameSkipCounter++;
            if (frameSkipCounter < PERFORMANCE_CONFIG.ANIMATION_FRAME_SKIP) {
                return;
            }
            frameSkipCounter = 0;
            
            // 更新神經核心
            neuralCore.style.width = (neuralCoreRadius * 2 * zoomScale) + 'px';
            neuralCore.style.height = (neuralCoreRadius * 2 * zoomScale) + 'px';
            
            // 批量更新神經元位置
            const neuronOpacity = parseFloat(neuronOpacityControl.value);
            const cosA = Math.cos(rotationAngle);
            const sinA = Math.sin(rotationAngle);
            
            neurons.forEach((neuron, index) => {
                // 旋轉計算
                neuron.x = neuron.originalX * cosA + neuron.originalZ * sinA;
                neuron.z = -neuron.originalX * sinA + neuron.originalZ * cosA;
                neuron.y = neuron.originalY;
                
                // 3D投影 - 增加透視深度
                const perspective = 1200; // 增加透視距離
                const scale = perspective / (perspective + neuron.z);
                neuron.screenX = centerX + neuron.x * scale * zoomScale;
                neuron.screenY = centerY + neuron.y * scale * zoomScale;
                
                // 深度效果
                const depthFactor = (neuron.z + 400) / 800; // 擴大深度範圍
                const targetOpacity = Math.max(0.2, Math.min(1, depthFactor));
                neuron.opacity = smoothTransition(neuron.opacity, targetOpacity, 0.2);
                
                const sizeScale = 0.6 + depthFactor * 0.8;
                const visualSize = neuron.size * sizeScale * zoomScale;
                
                // 更新DOM元素
                const neuronElement = neuronElements[index];
                neuronElement.style.width = (visualSize * 2) + 'px';
                neuronElement.style.height = (visualSize * 2) + 'px';
                neuronElement.style.left = neuron.screenX + 'px';
                neuronElement.style.top = neuron.screenY + 'px';
                neuronElement.style.opacity = neuron.opacity * neuronOpacity;
            });
            
            // 批量更新突觸
            const synapseOpacity = parseFloat(synapseOpacityControl.value);
            synapses.forEach((synapse, index) => {
                if (index >= synapseElements.length) return;
                
                const sourceNeuron = neurons[synapse.source];
                const targetNeuron = neurons[synapse.target];
                const synapseElement = synapseElements[index];
                
                if (synapse.fadeIn) {
                    const distance = getDistance3D(
                        sourceNeuron.screenX, sourceNeuron.screenY, 0,
                        targetNeuron.screenX, targetNeuron.screenY, 0
                    );
                    const angle = getAngle(
                        sourceNeuron.screenX, sourceNeuron.screenY,
                        targetNeuron.screenX, targetNeuron.screenY
                    );
                    
                    synapseElement.style.left = sourceNeuron.screenX + 'px';
                    synapseElement.style.top = sourceNeuron.screenY + 'px';
                    synapseElement.style.width = distance + 'px';
                    synapseElement.style.height = '3px'; // 增加突觸厚度
                    synapseElement.style.transform = `rotate(${angle}rad)`;
                    
                    const avgDepth = (sourceNeuron.z + targetNeuron.z) / 2;
                    const depthOpacity = Math.max(0.2, Math.min(1, (avgDepth + 400) / 800));
                    
                    const finalOpacity = depthOpacity * synapse.strength * synapseOpacity;
                    synapseElement.style.opacity = finalOpacity;
                    
                    // 提高數據脈衝頻率
                    if (Math.random() < 0.5) {
                        createDataPulse(synapse);
                    }
                } else {
                    synapseElement.style.opacity = '0';
                }
            });
            
            // 隱藏未使用的突觸元素
            for (let i = synapses.length; i < synapseElements.length; i++) {
                synapseElements[i].style.opacity = '0';
            }
        }
        
        // 性能監控
        function updatePerformance(currentTime) {
            frameCount++;
            if (currentTime - lastTime >= 1000) {
                fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                fpsDisplay.textContent = fps;
                frameCount = 0;
                lastTime = currentTime;
                
                // 動態調整性能（更寬鬆的條件）
                if (fps < 25 && PERFORMANCE_CONFIG.QUALITY_MODE !== 'low') {
                    console.log('性能不足，降低品質');
                    PERFORMANCE_CONFIG.ANIMATION_FRAME_SKIP = 1;
                    PERFORMANCE_CONFIG.UPDATE_INTERVAL = 50;
                }
                
                // 更新量子信息 - 提高更新頻率
                if (Math.random() < 0.5) {
                    const stability = (97 + Math.random() * 3).toFixed(1) + '%';
                    stabilityDisplay.textContent = stability;
                    
                    const coherence = (90 + Math.random() * 10).toFixed(0) + '%';
                    coherenceDisplay.textContent = coherence;
                    
                    const states = ['COHERENT', 'ENTANGLED', 'SUPERPOSITION', 'ENHANCED', 'SYNCHRONIZED'];
                    quantumStateDisplay.textContent = states[Math.floor(Math.random() * states.length)];
                }
            }
        }
        
        // 更新系統狀態
        function updateSystemStatus() {
            const statusMessages = [
                'NEURAL MATRIX SYNCHRONIZED',
                'QUANTUM COHERENCE ENHANCED', 
                'DATA STREAM OPTIMIZED',
                'SYNAPTIC TRANSMISSION BOOSTED',
                'CONSCIOUSNESS SIMULATION ADVANCED',
                'NETWORK DENSITY MAXIMIZED',
                'NEURAL PATHWAYS OPTIMIZED'
            ];
            
            const randomStatus = statusMessages[Math.floor(Math.random() * statusMessages.length)];
            systemStatus.textContent = randomStatus;
        }
        
        // 優化的主動畫循環
        let lastUpdateTime = 0;
        function animate(currentTime) {
            // 限制更新頻率
            if (currentTime - lastUpdateTime >= PERFORMANCE_CONFIG.UPDATE_INTERVAL) {
                updatePerformance(currentTime);
                
                rotationAngle += rotationSpeed;
                
                updateNetwork();
                updateNeuralMatrix();
                
                lastUpdateTime = currentTime;
            }
            
            requestAnimationFrame(animate);
        }
        
        // 系統初始化
        function initializeNeuralMatrix() {
            systemStatus.textContent = 'NEURAL MATRIX INITIALIZING...';
            
            setTimeout(() => {
                generateNeurons();
                createSynapsePool();
                generateNetwork();
                
                systemStatus.textContent = 'CONSCIOUSNESS SIMULATION ENHANCED';
                
                // 啟動動畫循環
                requestAnimationFrame(animate);
                
                // 定期更新系統狀態 - 縮短間隔
                setInterval(updateSystemStatus, 5000);
                
                // 自動調整網絡密度 - 縮短間隔
                setInterval(() => {
                    const currentDensity = parseFloat(densityControl.value);
                    const variation = (Math.random() - 0.5) * 0.08; // 增加變化幅度
                    const newDensity = Math.max(0.3, Math.min(1.0, currentDensity + variation));
                    densityControl.value = newDensity;
                    densityValue.textContent = newDensity.toFixed(2);
                }, 15000); // 縮短到15秒
            }, 1000);
        }
        
        // 開始初始化
        createParticles();
        initializeNeuralMatrix();
        
        // 添加視窗大小調整監聽器
        window.addEventListener('resize', function() {
            // 延遲重新初始化以避免頻繁調整
            clearTimeout(window.resizeTimeout);
            window.resizeTimeout = setTimeout(() => {
                location.reload(); // 簡單的重新載入
            }, 1000);
        });
    });
    </script>
</body>
</html>