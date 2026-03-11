// Prettified copy of waifu-tips.js
// This file is equivalent to the minified `waifu-tips.js` but reformatted for readability.
// It keeps identifiers and behavior unchanged to maintain compatibility.

function randomSelection(input) {
  return Array.isArray(input) ? input[Math.floor(Math.random() * input.length)] : input;
}

function nextIndex(length, current) {
  const r = Math.floor(Math.random() * (length - 1));
  return r >= current ? r + 1 : r;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    let script = document.createElement('script');
    script.src = src;
    if (script) {
      script.onload = () => resolve(src);
      script.onerror = () => reject(src);
      document.head.appendChild(script);
    }
  });
}

let messageTimer = null;

// Queue for pending motions when effect ids are not ready yet
let pendingMotions = [];
let pendingMotionsTimer = null;
function enqueuePendingMotion(fn, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  pendingMotions.push({ fn, deadline });
  if (!pendingMotionsTimer) {
    pendingMotionsTimer = setInterval(() => {
      const now = Date.now();
      for (let i = pendingMotions.length - 1; i >= 0; i--) {
        const item = pendingMotions[i];
        if (now > item.deadline) {
          console.warn('Pending motion timed out, giving up.');
          pendingMotions.splice(i, 1);
          continue;
        }
        try {
          const started = item.fn();
          if (started) {
            // remove started motion
            pendingMotions.splice(i, 1);
          }
        } catch (e) {
          console.warn('Failed to start pending motion', e);
          pendingMotions.splice(i, 1);
        }
      }
      if (pendingMotions.length === 0) {
        clearInterval(pendingMotionsTimer);
        pendingMotionsTimer = null;
      }
    }, 250);
  }
}

function showMessage(msg, duration, priority, honorPriority = true) {
  let currentPriority = parseInt(sessionStorage.getItem('waifu-message-priority'), 10);
  if (isNaN(currentPriority)) currentPriority = 0;

  // If no message or priority rules prevent showing it, abort
  if (!msg || (honorPriority && currentPriority > priority) || (!honorPriority && currentPriority >= priority)) return;

  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }

  msg = randomSelection(msg);
  sessionStorage.setItem('waifu-message-priority', String(priority));

  const el = document.getElementById('waifu-tips');
  // 若訊息不含 HTML 標籤，則以 <span> 包裹並做基本轉義以使用 CSS 強調
  if (typeof msg === 'string' && !/<[a-z][\s\S]*>/i.test(msg)) {
    const escaped = msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = `<span>${escaped}</span>`;
  } else {
    el.innerHTML = msg;
  }
  el.classList.add('waifu-tips-active');

  messageTimer = setTimeout(() => {
    sessionStorage.removeItem('waifu-message-priority');
    el.classList.remove('waifu-tips-active');
  }, duration);
}

function templateReplace(template, ...args) {
  return template.replace(/\$(\d+)/g, (m, idx) => {
    const i = parseInt(idx, 10) - 1;
    return args[i] ?? '';
  });
}

class Logger {
  constructor(level = 'info') {
    this.level = level;
  }

  setLevel(level) {
    if (level) this.level = level;
  }

  shouldLog(level) {
    return Logger.levelOrder[level] <= Logger.levelOrder[this.level];
  }

  error(...args) {
    if (this.shouldLog('error')) console.error('[Live2D Widget][ERROR]', ...args);
  }

  warn(...args) {
    if (this.shouldLog('warn')) console.warn('[Live2D Widget][WARN]', ...args);
  }

  info(...args) {
    if (this.shouldLog('info')) console.log('[Live2D Widget][INFO]', ...args);
  }

  trace(...args) {
    if (this.shouldLog('trace')) console.log('[Live2D Widget][TRACE]', ...args);
  }
}
Logger.levelOrder = { error: 0, warn: 1, info: 2, trace: 3 };
const logger = new Logger();

// --- Per-model message helper ---
// Returns the message for key from modelMessages if a model-specific override exists,
// otherwise falls back to the global tips.message[key].
function getModelMessage(tips, modelName, key) {
  if (tips && tips.modelMessages && modelName && tips.modelMessages[modelName]) {
    const mm = tips.modelMessages[modelName];
    if (mm[key] !== undefined) return mm[key];
  }
  return tips && tips.message ? tips.message[key] : undefined;
}

// --- Page detection helper ---
function detectPageKey() {
  const path = location.pathname.toLowerCase();
  if (path.includes('about')) return 'about';
  if (path.includes('nagato-sakura') && !path.includes('webos') && !path.includes('nijigen')) return 'nagato-sakura';
  if (path.includes('experience')) return 'experience';
  if (path.includes('skills')) return 'skills';
  if (path.includes('game-center')) return 'game-center';
  if (path.includes('music-player')) return 'music-player';
  return '';
}

// --- Throttle helper for mouseover ---
function throttle(fn, delay) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      return fn.apply(this, args);
    }
  };
}

// Model loader / manager class (supports CDN or local models)
class ModelManager {
  constructor(options, models = []) {
    this.modelList = null;
    let { apiPath, cdnPath } = options;
    const { cubism2Path, cubism5Path } = options;

    let useCDN = false;
    if (typeof cdnPath === 'string') {
      if (!cdnPath.endsWith('/')) cdnPath += '/';
      useCDN = true;
    } else if (typeof apiPath === 'string') {
      if (!apiPath.endsWith('/')) apiPath += '/';
      cdnPath = apiPath;
      useCDN = true;
      logger.warn('apiPath option is deprecated. Please use cdnPath instead.');
    } else if (!models.length) {
      throw 'Invalid initWidget argument!';
    }

    let storedModelId = parseInt(localStorage.getItem('modelId'), 10);
    let storedTextureId = parseInt(localStorage.getItem('modelTexturesId'), 10);
    if (isNaN(storedModelId) || isNaN(storedTextureId)) storedTextureId = 0;
    if (isNaN(storedModelId)) storedModelId = options.modelId ?? 0;

    this.useCDN = useCDN;
    this.cdnPath = cdnPath || '';
    this.cubism2Path = cubism2Path || '';
    this.cubism5Path = cubism5Path || '';
    this._modelId = storedModelId;
    this._modelTexturesId = storedTextureId;
    this.currentModelVersion = 0;
    this.loading = false;
    this.modelJSONCache = {};
    this.models = models;
  }

  static async initCheck(options, models = []) {
    const mgr = new ModelManager(options, models);

    if (mgr.useCDN) {
      const res = await fetch(`${mgr.cdnPath}model_list.json`);
      mgr.modelList = await res.json();
      if (mgr.modelId >= mgr.modelList.models.length) mgr.modelId = 0;
      const candidate = mgr.modelList.models[mgr.modelId];
      if (Array.isArray(candidate)) {
        if (mgr.modelTexturesId >= candidate.length) mgr.modelTexturesId = 0;
      } else {
        const idxJson = `${mgr.cdnPath}model/${candidate}/index.json`;
        const settings = await mgr.fetchWithCache(idxJson);
        if (mgr.checkModelVersion(settings) === 2) {
          const textures = await mgr.loadTextureCache(candidate);
          if (mgr.modelTexturesId >= textures.length) mgr.modelTexturesId = 0;
        }
      }
    } else {
      if (mgr.modelId >= mgr.models.length) mgr.modelId = 0;
      if (mgr.modelTexturesId >= mgr.models[mgr.modelId].paths.length) mgr.modelTexturesId = 0;
    }

    return mgr;
  }

  set modelId(id) {
    this._modelId = id; localStorage.setItem('modelId', id.toString());
  }
  get modelId() { return this._modelId; }

  set modelTexturesId(id) {
    this._modelTexturesId = id; localStorage.setItem('modelTexturesId', id.toString());
  }
  get modelTexturesId() { return this._modelTexturesId; }

  resetCanvas() {
    const container = document.getElementById('waifu-canvas');
    const savedW = container ? container.style.width : '';
    const savedH = container ? container.style.height : '';
    container.innerHTML = '<canvas id="live2d" width="800" height="800"></canvas>';
    // Re-apply saved dimensions to the new canvas element
    const newCanvas = document.getElementById('live2d');
    if (newCanvas && savedW) newCanvas.style.width = savedW;
    if (newCanvas && savedH) newCanvas.style.height = savedH;
  }

  async fetchWithCache(url) {
    if (url in this.modelJSONCache) return this.modelJSONCache[url];
    let data;
    try {
      const res = await fetch(url);
      data = await res.json();
    } catch (e) {
      data = null;
    }
    this.modelJSONCache[url] = data;
    return data;
  }

  checkModelVersion(json) {
    return json.Version === 3 || json.FileReferences ? 3 : 2;
  }

  async loadLive2D(settingPath, settingJson) {
    if (this.loading) {
      logger.warn('Still loading. Abort.');
      return;
    }

    this.loading = true;
    // Reset any previous auto-fit transforms so new model starts from neutral
    try {
      const c = document.getElementById('live2d');
      if (c && c.style) c.style.transform = '';
    } catch (e) { /* ignore */ }
    try {
      const version = this.checkModelVersion(settingJson);
      if (version === 2) {
        if (!this.cubism2model) {
          if (!this.cubism2Path) { logger.error('No cubism2Path set, cannot load Cubism 2 Core.'); return; }
          await loadScript(this.cubism2Path);
          const { default: Cubism2 } = await import('./chunk/index.js');
          this.cubism2model = new Cubism2();
        }

        if (this.currentModelVersion === 3) {
          this.cubism5model.release();
          this.resetCanvas();
        }

        if (this.currentModelVersion !== 3 && this.cubism2model.gl) {
          await this.cubism2model.changeModelWithJSON(settingPath, settingJson);
        } else {
          await this.cubism2model.init('live2d', settingPath, settingJson);
        }
      } else {
        // Cubism 5
        if (!this.cubism5Path) { logger.error('No cubism5Path set, cannot load Cubism 5 Core.'); return; }
        await loadScript(this.cubism5Path);
        const { AppDelegate } = await import('./live2d-framework.js');
        // If a previous Cubism5 instance exists, release it to stop its RAF loop and event listeners.
        if (this.cubism5model) {
          try { this.cubism5model.release(); } catch (e) { /* ignore */ }
          this.cubism5model = null;
          this.resetCanvas();
        }
        this.cubism5model = new AppDelegate();

        if (this.currentModelVersion === 2) {
          this.cubism2model.destroy();
          this.resetCanvas();
        }

        if (this.currentModelVersion !== 2 && this.cubism5model.subdelegates.at(0)) {
          this.cubism5model.changeModel(settingPath);
        } else {
          this.cubism5model.initialize();
          this.cubism5model.changeModel(settingPath);
          this.cubism5model.run();
        }
      }

      logger.info(`Model ${settingPath} (Cubism version ${version}) loaded`);
      this.currentModelVersion = version;
    } catch (err) {
      console.error('loadLive2D failed', err);
    }
    this.loading = false;
  }

  async loadTextureCache(modelName) {
    return await this.fetchWithCache(`${this.cdnPath}model/${modelName}/textures.cache`) || [];
  }

  async loadModel() {
    // Load the configured model (handles CDN/local paths)
    let modelPath, json;
    if (this.useCDN) {
      let candidate = this.modelList.models[this.modelId];
      if (Array.isArray(candidate)) candidate = candidate[this.modelTexturesId];
      modelPath = `${this.cdnPath}model/${candidate}/index.json`;
      json = await this.fetchWithCache(modelPath);
      if (this.checkModelVersion(json) === 2) {
        const textures = await mgr.loadTextureCache(candidate);
        if (textures.length > 0) {
          let tex = textures[this.modelTexturesId];
          if (typeof tex === 'string') tex = [tex];
          json.textures = tex;
        }
      }
    } else {
      modelPath = this.models[this.modelId].paths[this.modelTexturesId];
      json = await this.fetchWithCache(modelPath);
    }

    await this.loadLive2D(modelPath, json);

    // Auto-fit the model to the canvas after a short delay to allow the model to finish initializing
    try {
      setTimeout(() => {
        this.autoFitModel(0.72);
        // Re-apply parameter outfit state after model loads
        this.applyParamOutfits();
      }, 120);
    } catch (e) { console.warn('autoFitModel failed to start', e); }

    showMessage('', 4000, 10);
  }

  /**
   * Auto-measure the model drawables' bounding box and scale/translate the canvas so
   * the model occupies approximately `targetRatio` (0..1) of the canvas.
   * Works for both Cubism2 and Cubism5 models when available.
   */
  autoFitModel(targetRatio = 0.7, options = {}) {
    const cfg = Object.assign({ minScale: 0.4, maxScale: 3 }, options);
    try {
      const canvas = document.getElementById('live2d');
      if (!canvas) return;
      const internalW = canvas.width || 800;
      const internalH = canvas.height || 800;

      // Helper to collect transformed points from a drawData-like object
      const collectFromDrawData = (dd, points) => {
        try {
          if (!dd) return;
          if (typeof dd.getTransformedPoints === 'function') {
            const arr = dd.getTransformedPoints();
            if (arr && arr.length) {
              for (let i = 0; i + 1 < arr.length; i += 2) {
                const x = Number(arr[i]);
                const y = Number(arr[i + 1]);
                if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
              }
            }
          }
        } catch (e) { /* ignore individual draw failures */ }
      };

      const points = [];

      // Try Cubism5 model path
      if (this.cubism5model && this.cubism5model.subdelegates && typeof this.cubism5model.subdelegates.at === 'function') {
        try {
          const sub = this.cubism5model.subdelegates.at(0);
          const liveMgr = sub && typeof sub.getLive2DManager === 'function' ? sub.getLive2DManager() : null;
          const model5 = liveMgr && liveMgr._models && typeof liveMgr._models.at === 'function' ? liveMgr._models.at(0) : null;
          if (model5) {
            // Preferred: if model5 exposes getDrawDataList
            if (typeof model5.getDrawDataList === 'function') {
              const list = model5.getDrawDataList();
              if (Array.isArray(list) && list.length) {
                for (const dd of list) collectFromDrawData(dd, points);
              }
            }

            // Fallback: iterate by index using getDrawData
            if (points.length === 0 && typeof model5.getDrawData === 'function') {
              for (let i = 0; i < 2000; i++) {
                try {
                  const dd = model5.getDrawData(i);
                  if (!dd) break;
                  collectFromDrawData(dd, points);
                } catch (e) { break; }
              }
            }
          }
        } catch (e) { /* ignore */ }
      }

      // Try Cubism2 model path
      if (points.length === 0 && this.cubism2model) {
        try {
          const model2 = this.cubism2model;
          // Some Cubism2 wrappers store drawlist in model2._drawData or expose getDrawData
          if (typeof model2.getDrawDataList === 'function') {
            const list = model2.getDrawDataList();
            if (Array.isArray(list) && list.length) {
              for (const dd of list) collectFromDrawData(dd, points);
            }
          }
          if (points.length === 0 && typeof model2.getDrawData === 'function') {
            for (let i = 0; i < 2000; i++) {
              try {
                const dd = model2.getDrawData(i);
                if (!dd) break;
                collectFromDrawData(dd, points);
              } catch (e) { break; }
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (points.length === 0) return; // nothing to fit

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const maxDim = Math.max(bboxW, bboxH, 1);

      const canvasMax = Math.max(internalW, internalH);
      const currentOccupancy = maxDim / canvasMax;
      const desiredOccupancy = Math.max(0.15, Math.min(0.95, targetRatio));
      let factor = desiredOccupancy / (currentOccupancy || 1);
      factor = Math.max(cfg.minScale, Math.min(cfg.maxScale, factor));

      // Center shift (internal coords -> display coords)
      const bboxCenterX = (minX + maxX) / 2;
      const bboxCenterY = (minY + maxY) / 2;
      const dxInternal = internalW / 2 - bboxCenterX;
      const dyInternal = internalH / 2 - bboxCenterY;
      const displayW = canvas.clientWidth || internalW;
      const displayH = canvas.clientHeight || internalH;
      const dxDisplay = dxInternal * (displayW / internalW);
      const dyDisplay = dyInternal * (displayH / internalH);

      // Because CSS transform is translate(tx,ty) scale(s) and translate is applied before scale,
      // computing tx such that final shift equals dxDisplay -> tx*s = dxDisplay  => tx = dxDisplay / s
      const tx = dxDisplay / factor;
      const ty = dyDisplay / factor;

      canvas.style.transformOrigin = 'center center';
      canvas.style.transition = 'transform .18s ease';
      canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${factor})`;

      // store applied transform for possible reset
      this._autoFit = { factor, tx, ty };
    } catch (e) {
      console.warn('autoFitModel failed', e);
    }
  }

  /**
   * Get the internal CubismModel (framework level) from the currently loaded Cubism5 model.
   * Returns null if not available.
   */
  getCubismModel() {
    try {
      if (this.cubism5model && this.cubism5model.subdelegates && typeof this.cubism5model.subdelegates.at === 'function') {
        const sub = this.cubism5model.subdelegates.at(0);
        const liveMgr = sub && typeof sub.getLive2DManager === 'function' ? sub.getLive2DManager() : null;
        const model5 = liveMgr && liveMgr._models && typeof liveMgr._models.at === 'function' ? liveMgr._models.at(0) : null;
        if (model5 && typeof model5.getModel === 'function') {
          return model5.getModel();
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  /**
   * Set a parameter value on the currently loaded model by parameter ID string.
   * Also persists the value in _savedParameters so it survives the loadParameters/saveParameters cycle.
   */
  setModelParameter(paramId, value) {
    const cubismModel = this.getCubismModel();
    if (!cubismModel) return false;
    try {
      // Find the parameter index by matching the string ID from the core model
      const coreModel = cubismModel._model;
      if (!coreModel || !coreModel.parameters) return false;
      const ids = coreModel.parameters.ids;
      const count = coreModel.parameters.count;
      let idx = -1;
      for (let i = 0; i < count; i++) {
        if (ids[i] === paramId) { idx = i; break; }
      }
      if (idx < 0) return false;
      // Set the value directly on the parameters array
      cubismModel._parameterValues[idx] = value;
      // Also persist in saved parameters so loadParameters() doesn't overwrite it
      if (cubismModel._savedParameters && cubismModel._savedParameters.getSize() > idx) {
        cubismModel._savedParameters.set(idx, value);
      }
      return true;
    } catch (e) {
      console.warn('setModelParameter failed', e);
      return false;
    }
  }

  /**
   * Apply saved paramOutfits state to the current model.
   * Reads the stored outfit index from localStorage and sets the corresponding parameter value.
   */
  applyParamOutfits() {
    if (!this.models || !this.models[this.modelId]) return;
    const model = this.models[this.modelId];
    if (!model.paramOutfits) return;
    const { paramId, values } = model.paramOutfits;
    if (!paramId || !Array.isArray(values) || values.length === 0) return;
    const storedIdx = parseInt(localStorage.getItem('paramOutfitIdx_' + this.modelId), 10);
    const outfitIdx = (!isNaN(storedIdx) && storedIdx >= 0 && storedIdx < values.length) ? storedIdx : (values.length - 1);
    // Retry a few times to account for model initialization delay
    let attempts = 0;
    const tryApply = () => {
      if (this.setModelParameter(paramId, values[outfitIdx])) return;
      if (++attempts < 10) setTimeout(tryApply, 200);
    };
    tryApply();
  }

  async loadRandTexture(...args) {
    const { modelId } = this;
    let noSwap = false;
    if (this.useCDN) {
      const candidate = this.modelList.models[modelId];
      if (Array.isArray(candidate)) {
        this.modelTexturesId = nextIndex(candidate.length, this.modelTexturesId);
      } else {
        const idxJson = `${this.cdnPath}model/${candidate}/index.json`;
        const settings = await this.fetchWithCache(idxJson);
        if (this.checkModelVersion(settings) === 2) {
          const textures = await this.loadTextureCache(candidate);
          if (textures.length <= 1) noSwap = true; else this.modelTexturesId = nextIndex(textures.length, this.modelTexturesId);
        } else {
          noSwap = true;
        }
      }
    } else {
      const model = this.models[modelId];
      // Check for paramOutfits (parameter-based outfit switching)
      if (model.paramOutfits && model.paramOutfits.paramId && Array.isArray(model.paramOutfits.values) && model.paramOutfits.values.length > 1) {
        const { paramId, values } = model.paramOutfits;
        const storedIdx = parseInt(localStorage.getItem('paramOutfitIdx_' + modelId), 10);
        const currentIdx = (!isNaN(storedIdx) && storedIdx >= 0 && storedIdx < values.length) ? storedIdx : (values.length - 1);
        const newIdx = (currentIdx - 1 + values.length) % values.length;
        localStorage.setItem('paramOutfitIdx_' + modelId, newIdx.toString());
        const ok = this.setModelParameter(paramId, values[newIdx]);
        if (ok) {
          showMessage(args[0] || '換裝完成！', 4000, 10);
        } else {
          showMessage(args[1] || '換裝失敗，模型尚未準備好', 4000, 10);
        }
        return;
      }
      // Check for textures array (outfit/costume switching)
      if (model.textures && model.textures.length > 1) {
        this.modelTexturesId = nextIndex(model.textures.length, this.modelTexturesId);
        // Reload the model with the new texture applied
        const modelPath = model.paths[0];
        const json = await this.fetchWithCache(modelPath);
        if (json && json.FileReferences && json.FileReferences.Textures) {
          // Create a copy so we don't pollute the cache
          const jsonCopy = JSON.parse(JSON.stringify(json));
          jsonCopy.FileReferences.Textures = [model.textures[this.modelTexturesId]];
          // Invalidate cache for this path so the modified version is used
          this.modelJSONCache[modelPath] = jsonCopy;
          await this.loadLive2D(modelPath, jsonCopy);
          setTimeout(() => this.autoFitModel(0.72), 120);
          showMessage(args[0] || '換裝完成！', 4000, 10);
          return;
        }
      }
      if (model.paths.length === 1) noSwap = true; else this.modelTexturesId = nextIndex(model.paths.length, this.modelTexturesId);
    }

    if (noSwap) showMessage(args[1], 4000, 10); else await this.loadModel(args[0]);
  }

  async loadNextModel() {
    this.modelTexturesId = 0;
    if (this.useCDN) {
      this.modelId = (this.modelId + 1) % this.modelList.models.length;
      await this.loadModel();
    } else {
      this.modelId = (this.modelId + 1) % this.models.length;
      await this.loadModel();
      // Show model-specific switch message
      const newModel = this.models[this.modelId];
      if (newModel && newModel.message) {
        showMessage(newModel.message, 4000, 10);
      }
    }
  }
}

// Tools manager (registers tool buttons and callbacks)
class ToolsManager {
  constructor(api, config, tips) {
    this.config = config;
    this.tools = {
      hitokoto: {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4c0 0 0 0 0 0s0 0 0 0s0 0 0 0c0 0 0 0 0 0l.3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208z"/></svg>',
        callback: () => {
          // Use model-specific hitokoto if available, then fall back to global
          const currentModelName = api && api.models && api.models[api.modelId] ? api.models[api.modelId].name : '';
          const source = getModelMessage(tips, currentModelName, 'hitokoto');
          let text = '今天心情不錯喔！';
          if (Array.isArray(source)) text = randomSelection(source);
          else if (typeof source === 'string' && source.length) text = source;
          showMessage(text, 6000, 9);
        }
      },

      'switch-model': { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M320 64A64 64 0 1 0 192 64a64 64 0 1 0 128 0zm-96 96c-35.3 0-64 28.7-64 64l0 48c0 17.7 14.3 32 32 32l1.8 0 11.1 99.5c1.8 16.2 15.5 28.5 31.8 28.5l38.7 0c16.3 0 30-12.3 31.8-28.5L318.2 304l1.8 0c17.7 0 32-14.3 32-32l0-48c0-35.3-28.7-64-64-64l-64 0zM132.3 394.2c13-2.4 21.7-14.9 19.3-27.9s-14.9-21.7-27.9-19.3c-32.4 5.9-60.9 14.2-82 24.8c-10.5 5.3-20.3 11.7-27.8 19.6C6.4 399.5 0 410.5 0 424c0 21.4 15.5 36.1 29.1 45c14.7 9.6 34.3 17.3 56.4 23.4C130.2 504.7 190.4 512 256 512s125.8-7.3 170.4-19.6c22.1-6.1 41.8-13.8 56.4-23.4c13.7-8.9 29.1-23.6 29.1-45c0-13.5-6.4-24.5-14-32.6c-7.5-7.9-17.3-14.3-27.8-19.6c-21-10.6-49.5-18.9-82-24.8c-13-2.4-25.5 6.3-27.9 19.3s6.3 25.5 19.3 27.9c30.2 5.5 53.7 12.8 69 20.5c3.2 1.6 5.8 3.1 7.9 4.5c3.6 2.4 3.6 7.2 0 9.6c-8.8 5.7-23.1 11.8-43 17.3C374.3 457 318.5 464 256 464s-118.3-7-157.7-17.9c-19.9-5.5-34.2-11.6-43-17.3c-3.6-2.4-3.6-7.2 0-9.6c2.1-1.4 4.8-2.9 7.9-4.5c15.3-7.7 38.8-14.9 69-20.5z"/></svg>', callback: () => {
        const hasMultiple = (api.useCDN ? (api.modelList && Array.isArray(api.modelList.models) ? api.modelList.models.length > 1 : false) : (Array.isArray(api.models) ? api.models.length > 1 : false));
        if (!hasMultiple) { showMessage((tips && tips.message && (tips.message.changeFail)) || '沒有其他模型可以切換', 4000, 10); return; }
        api.loadNextModel();
      } }, 
      'switch-texture': { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M211.8 0c7.8 0 14.3 5.7 16.7 13.2C240.8 51.9 277.1 80 320 80s79.2-28.1 91.5-66.8C413.9 5.7 420.4 0 428.2 0l12.6 0c22.5 0 44.2 7.9 61.5 22.3L628.5 127.4c6.6 5.5 10.7 13.5 11.4 22.1s-2.1 17.1-7.8 23.6l-56 64c-11.4 13.1-31.2 14.6-44.6 3.5L480 197.7 480 448c0 35.3-28.7 64-64 64l-192 0c-35.3 0-64-28.7-64-64l0-250.3-51.5 42.9c-13.3 11.1-33.1 9.6-44.6-3.5l-56-64c-5.7-6.5-8.5-15-7.8-23.6s4.8-16.6 11.4-22.1L137.7 22.3C155 7.9 176.7 0 199.2 0l12.6 0z"/></svg>', callback: () => { let succ = '', fail = ''; if (tips) { succ = tips.message.changeSuccess; fail = tips.message.changeFail; } api.loadRandTexture(succ, fail); } },
      photo: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M220.6 121.2L271.1 96 448 96l0 96-114.8 0c-21.9-15.1-48.5-24-77.2-24s-55.2 8.9-77.2 24L64 192l0-64 128 0c9.9 0 19.7-2.3 28.6-6.8zM0 128L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L271.1 32c-9.9 0-19.7 2.3-28.6 6.8L192 64l-32 0 0-16c0-8.8-7.2-16-16-16L80 32c-8.8 0-16 7.2-16 16l0 16C28.7 64 0 92.7 0 128zM168 304a88 88 0 1 1 176 0 88 88 0 1 1 -176 0z"/></svg>', callback: () => {
        showMessage(tips.message.photo, 6000, 9);
        const c = document.getElementById('live2d');
        if (!c) return;
        try {
          const data = c.toDataURL();
          // If the data URL is unexpectedly short, consider it a failure
          if (!data || data.length < 2000) {
            showMessage('截圖失敗：畫面尚未完成渲染或不支援截圖，請稍候再試。', 4000, 10);
            return;
          }
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = data;
          a.download = 'live2d-photo.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (err) {
          showMessage('截圖失敗：' + (err && err.message ? err.message : '未知錯誤'), 4000, 10);
        }
      } },
      info: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>', callback: () => { open('https://amanoshizukikun.github.io/'); } },
      quit: { icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.3 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9.3 15.5-18.4 17.4c-12.6 2.6-25.7 4-39.2 4s-26.5-1.3-39.2-4c-9.2-1.9-16.4-8.3-18.4-17.4l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.3-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9.3-15.5 18.4-17.4C226.5 1.3 239.7 0 254.2 0s26.5 1.3 39.2 4c9.2 1.9 16.4 8.3 18.4 17.4l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>', callback: () => {
        // Toggle edit mode
        window.waifuEditMode && typeof window.waifuEditMode.toggle === 'function' && window.waifuEditMode.toggle();
      } }
    };
  }

  registerTools() {
    if (!Array.isArray(this.config.tools)) this.config.tools = Object.keys(this.tools);
    for (const name of this.config.tools) {
      if (this.tools[name]) {
        const { icon, callback } = this.tools[name];
        const el = document.createElement('span');
        el.id = `waifu-tool-${name}`;
        el.innerHTML = icon;
        const parent = document.getElementById('waifu-tool');
        if (parent) parent.insertAdjacentElement('beforeend', el);
        el.addEventListener('click', callback);
      }
    }
  }
}

async function loadWidget(config) {
  localStorage.removeItem('waifu-display');
  sessionStorage.removeItem('waifu-message-priority');

  const existingWaifu = document.getElementById('waifu');
  if (existingWaifu) existingWaifu.remove();

  document.body.insertAdjacentHTML('beforeend', `
    <div id="waifu">
      <div id="waifu-edit-titlebar">
        <span class="titlebar-label">EDIT MODE</span>
        <div class="titlebar-buttons">
          <button class="titlebar-btn btn-done" title="完成編輯">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>
          </button>
          <button class="titlebar-btn btn-reset" title="還原初始化">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M125.7 160l50.3 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L48 224c-17.7 0-32-14.3-32-32L16 64c0-17.7 14.3-32 32-32s32 14.3 32 32l0 51.2C122.6 72.1 194.8 32 256 32c141.4 0 256 114.6 256 256s-114.6 256-256 256S0 429.4 0 288c0-17.7 14.3-32 32-32s32 14.3 32 32c0 106 86 192 192 192s192-86 192-192S362 96 256 96c-46.6 0-87.1 16.6-120.3 48z"/></svg>
          </button>
          <button class="titlebar-btn btn-close" title="關閉">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>
          </button>
        </div>
      </div>
      <div id="waifu-tips"></div>
      <div id="waifu-canvas">
        <canvas id="live2d" width="800" height="800"></canvas>
      </div>
      <div id="waifu-tool"></div>
      <div class="waifu-resize-handle handle-nw" data-dir="nw"></div>
      <div class="waifu-resize-handle handle-ne" data-dir="ne"></div>
      <div class="waifu-resize-handle handle-sw" data-dir="sw"></div>
      <div class="waifu-resize-handle handle-se" data-dir="se"></div>
      <div class="waifu-resize-edge edge-n" data-dir="n"></div>
      <div class="waifu-resize-edge edge-s" data-dir="s"></div>
      <div class="waifu-resize-edge edge-w" data-dir="w"></div>
      <div class="waifu-resize-edge edge-e" data-dir="e"></div>
    </div>
  `);

  let tipsObj = null;
  let models = [];

  if (config.waifuPath) {
    try {
      const res = await fetch(config.waifuPath);
      tipsObj = await res.json();
      models = tipsObj.models;
    } catch (err) {
      logger.warn('Failed to fetch waifuPath JSON', err);
    }

    // Register UI interactions based on tips (if present)
    (function registerEventListener(tips) {
      let userAction = false;
      let userActionTimer = null;
      const messageArray = tips.message.default;

      // seasons: add seasonal messages
      tips.seasons.forEach(({ date, text }) => {
        const now = new Date();
        const after = date.split('-')[0];
        const before = date.split('-')[1] || after;
        if (Number(after.split('/')[0]) <= now.getMonth() + 1 &&
            now.getMonth() + 1 <= Number(before.split('/')[0]) &&
            Number(after.split('/')[1]) <= now.getDate() &&
            now.getDate() <= Number(before.split('/')[1])) {
          let chosen = randomSelection(text);
          chosen = chosen.replace('{year}', String(now.getFullYear()));
          messageArray.push(chosen);
        }
      });

      // Merge page-specific mouseover rules into the global list
      const pageKey = detectPageKey();
      let allMouseover = [...(tips.mouseover || [])];
      if (pageKey && tips.pageMessages && tips.pageMessages[pageKey] && tips.pageMessages[pageKey].mouseover) {
        allMouseover = [...tips.pageMessages[pageKey].mouseover, ...allMouseover];
      }

      window.addEventListener('mousemove', () => (userAction = true));
      window.addEventListener('keydown', () => (userAction = true));

      setInterval(() => {
        if (userAction) {
          userAction = false;
          clearInterval(userActionTimer);
          userActionTimer = null;
        } else if (!userActionTimer) {
          userActionTimer = setInterval(() => {
            // Use model-specific default messages if available (low priority so it never blocks interactive messages)
            const currentModelName = api && api.models && api.models[api.modelId] ? api.models[api.modelId].name : '';
            const modelDefault = getModelMessage(tips, currentModelName, 'default');
            showMessage(modelDefault || messageArray, 4000, 5);
          }, 20000);
        }
      }, 1000);

      // Throttled mouseover handler for performance (100ms to stay responsive)
      const mouseoverHandler = throttle((ev) => {
        for (let { selector, text } of allMouseover) {
          if (!ev.target?.closest(selector)) continue;
          let msg = randomSelection(text);
          if (typeof msg === 'string') msg = msg.replace('{text}', ev.target.innerText);
          showMessage(msg, 4000, 8);
          return;
        }
      }, 1);
      window.addEventListener('mouseover', mouseoverHandler);

      window.addEventListener('click', (ev) => {
        for (let { selector, text } of (tips.click || [])) {
          if (!ev.target?.closest(selector)) continue;
          let msg = randomSelection(text);
          if (typeof msg === 'string') msg = msg.replace('{text}', ev.target.innerText);
          showMessage(msg, 4000, 8);
          return;
        }
      });

      window.addEventListener('live2d:hoverbody', () => {
        const currentModelName = api && api.models && api.models[api.modelId] ? api.models[api.modelId].name : '';
        const hoverBody = getModelMessage(tips, currentModelName, 'hoverBody');
        showMessage(randomSelection(hoverBody), 4000, 8, false);
      });
      window.addEventListener('live2d:tapbody', () => {
        // Use model-specific tap messages if available
        const currentModelName = api && api.models && api.models[api.modelId] ? api.models[api.modelId].name : '';
        const tapBody = getModelMessage(tips, currentModelName, 'tapBody');
        showMessage(randomSelection(tapBody), 4000, 9);

        (async function playRandomAnimation() {
          try {
            // animations list may be in tips.animations or tips.message.animations
            const anims = (tips && (tips.animations || (tips.message && tips.message.animations))) ? (tips.animations || tips.message.animations) : [];
            if (!anims || !anims.length) return;

            const base = (typeof config?.waifuPath === 'string') ? config.waifuPath.replace(/[^\/]+$/, '') : 'assets/live2d/';
            const file = randomSelection(anims);
            // 若踢到已經是絕對路徑（以 "/" 或 "http(s)://" 開頭），就直接使用，不再加上 base，避免重複的 "/assets/live2d/" 路徑
            const url = /^(?:https?:\/\/|\/)\S+/i.test(file) ? file : base + file;

            async function fetchBytes(u) {
              const r = await fetch(u);
              if (!r.ok) throw new Error('failed fetch ' + r.status);
              return await r.arrayBuffer();
            }

            // Try Cubism2 (v2) — use global Live2DMotion when available
            try {
              const model2 = api && api.cubism2model && api.cubism2model.live2DMgr && typeof api.cubism2model.live2DMgr.getModel === 'function'
                ? api.cubism2model.live2DMgr.getModel()
                : (api && api.cubism2model && typeof api.cubism2model.getModel === 'function' ? api.cubism2model.getModel() : null);
              if (model2 && typeof Live2DMotion !== 'undefined') {
                try {
                  const buf = await fetchBytes(url);
                  const motion = Live2DMotion.loadMotion(buf);
                  try { motion.setFadeIn && motion.setFadeIn(200); motion.setFadeOut && motion.setFadeOut(200); } catch (e) {}
                  try {
                    // Set effect IDs from manager if available (prevents null parameter id vectors)
                    try {
                      const mgr = (model2.live2DMgr && model2.live2DMgr) || model2;
                      if (mgr && mgr._eyeBlinkIds && mgr._lipSyncIds && typeof motion.setEffectIds === 'function') {
                        motion.setEffectIds(mgr._eyeBlinkIds, mgr._lipSyncIds);
                        console.debug('Cubism2 motion: set effect ids');
                      }
                    } catch (e) { /* ignore */ }

                    if (model2.mainMotionManager && model2.mainMotionManager.startMotionPrio) model2.mainMotionManager.startMotionPrio(motion, 3);
                    else if (model2.mainMotionManager && model2.mainMotionManager.startMotionPriority) model2.mainMotionManager.startMotionPriority(motion, 3);
                    else if (model2._motionManager && model2._motionManager.startMotionPriority) model2._motionManager.startMotionPriority(motion, 3);
                    else if (model2.getMainMotionManager && model2.getMainMotionManager().startMotionPriority) model2.getMainMotionManager().startMotionPriority(motion, 3);
                  } catch (e) { console.warn('start motion failed', e); }
                  return;
                } catch (e) { console.warn('Cubism2 animation fetch/load failed', e); }
              }
            } catch (e) { /* ignore */ }

            // Try Cubism5 (v5)
            try {
              if (api && api.cubism5model && api.cubism5model.subdelegates && typeof api.cubism5model.subdelegates.at === 'function') {
                const sub = api.cubism5model.subdelegates.at(0);
                const liveMgr = sub && typeof sub.getLive2DManager === 'function' ? sub.getLive2DManager() : null;
                const model5 = liveMgr && liveMgr._models && typeof liveMgr._models.at === 'function' ? liveMgr._models.at(0) : null;
                if (model5 && typeof model5.loadMotion === 'function') {
                  try {
                    const buf = await fetchBytes(url);
                    // 修正點：在加載動作時傳入回調，確保動作結束後手動觸發 Idle 動作重新接管
                    const motion = model5.loadMotion(buf, buf.byteLength, null, (m) => {
                        // 動作結束回調：手動載入並播放 idle_01.motion3.json
                        const base = (typeof config?.waifuPath === 'string') ? config.waifuPath.replace(/[^\/]+$/, '') : 'assets/live2d/';
                        const idleUrl = base + 'animations/idle_01.motion3.json';

                        fetch(idleUrl).then(res => {
                            if (!res.ok) throw new Error('Network response was not ok');
                            return res.arrayBuffer();
                        }).then(idleBuf => {
                            // 載入 Idle 動作，最後參數 false 代表不自動釋放(視情況調整，這裡設為 false 較安全)
                            const idleMotion = model5.loadMotion(idleBuf, idleBuf.byteLength, null, null, null, null, null, null, false);
                            
                            // 2. 核心修復：強制 Idle 動作循環播放
                            if (typeof idleMotion.setIsLoop === 'function') {
                                idleMotion.setIsLoop(true);
                            }

                            // 3. 核心修復：為 idleMotion 設定 Effect IDs，避免 "Cannot read properties of null (reading 'getSize')"
                            if (model5 && model5._eyeBlinkIds && model5._lipSyncIds && typeof idleMotion.setEffectIds === 'function') {
                                idleMotion.setEffectIds(model5._eyeBlinkIds, model5._lipSyncIds);
                            } else if (typeof idleMotion.setEffectIds === 'function') {
                                // 如果模型尚未準備好 IDs，使用空物件作為 Fallback 防止崩潰
                                const emptyIds = { getSize: () => 0, at: () => null };
                                idleMotion.setEffectIds(emptyIds, emptyIds);
                            }

                            // 設定淡入淡出，讓過渡平滑 (加快過渡速度)
                            if (idleMotion.setFadeIn) idleMotion.setFadeIn(100);
                            if (idleMotion.setFadeOut) idleMotion.setFadeOut(100);

                            const motionMgr = model5.getMainMotionManager ? model5.getMainMotionManager() : (model5._motionManager || null);
                            if (motionMgr && typeof motionMgr.startMotionPriority === 'function') {
                                // Priority 1 (Idle) 讓它作為待機動作播放
                                motionMgr.startMotionPriority(idleMotion, false, 1);
                            }
                        }).catch(e => {
                            console.warn('無法載入 Idle 動作:', e);
                        });
                    }, null, null, null, null, false);
                    
                    // 1. 核心修復：強制關閉表情動作的循環，確保它能播完並觸發回調
                    if (typeof motion.setIsLoop === 'function') {
                        motion.setIsLoop(false);
                    }

                    try { motion.setFadeIn && motion.setFadeIn(200); motion.setFadeOut && motion.setFadeOut(200); } catch (e) {}

                    // 修正點：將優先級設為 2 (Normal)，並確保 autoFree 設為 true，讓待機動作能在結束後接替
                    const MOTION_PRIORITY_NORMAL = 2;

                    // Retry helper: wait for effect ids to be initialized (Fix: check model5 instead of liveMgr)
                    async function tryStart(retriesLeft = 3) {
                      try {
                        // Fix: use model5 instead of liveMgr because _eyeBlinkIds is on the model instance (gs) in this version
                        if (model5 && model5._eyeBlinkIds && model5._lipSyncIds && typeof motion.setEffectIds === 'function') {
                          motion.setEffectIds(model5._eyeBlinkIds, model5._lipSyncIds);
                        }
                        else if (model5 && (!model5._eyeBlinkIds || !model5._lipSyncIds)) {
                          if (retriesLeft > 0) {
                            await new Promise(r => setTimeout(r, 150));
                            return tryStart(retriesLeft - 1);
                          }

                          // fallback empty effect ids
                          const makeEmptyIds = () => ({ getSize: () => 0, at: () => null });
                          try {
                            if (typeof motion.setEffectIds === 'function') {
                              motion.setEffectIds(makeEmptyIds(), makeEmptyIds());
                              const mgr = model5.getMainMotionManager ? model5.getMainMotionManager() : (model5._motionManager || null);
                              if (mgr && typeof mgr.startMotionPriority === 'function') {
                                mgr.startMotionPriority(motion, true, MOTION_PRIORITY_NORMAL);
                              }
                            }
                          } catch (e) {
                            console.warn('Failed to start Cubism5 motion with fallback ids', e);
                          }

                          enqueuePendingMotion(() => {
                            try {
                              // Fix: use model5 instead of liveMgr
                              if (model5 && model5._eyeBlinkIds && model5._lipSyncIds && typeof motion.setEffectIds === 'function') {
                                motion.setEffectIds(model5._eyeBlinkIds, model5._lipSyncIds);
                                return true;
                              }
                            } catch (e) {
                              return true;
                            }
                            return false;
                          }, 5000);
                          return;
                        }

                        // 核心修正：使用普通優先級(2)並開啟自動釋放(true)
                        const motionMgr = model5.getMainMotionManager ? model5.getMainMotionManager() : (model5._motionManager || null);
                        if (motionMgr && typeof motionMgr.startMotionPriority === 'function') {
                          motionMgr.startMotionPriority(motion, true, MOTION_PRIORITY_NORMAL);
                        }
                      } catch (e) {
                        console.warn('Failed to start Cubism5 motion', e);
                      }
                    }

                    await tryStart();
                    return;
                  } catch (e) { console.warn('Cubism5 animation fetch/load failed', e); }
                }
              }
            } catch (e) { console.warn('playRandomAnimation Cubism5 error', e); }

          } catch (err) {
            console.warn('playRandomAnimation failed', err);
          }
        })();
      });

      const devtools = () => {};
      devtools.toString = () => { showMessage(tips.message.console, 6000, 9); };
      console.log('%c', devtools);

      window.addEventListener('copy', () => showMessage(tips.message.copy, 6000, 9));
      window.addEventListener('visibilitychange', () => { if (!document.hidden) showMessage(tips.message.visibilitychange, 6000, 9); });
    })(tipsObj);

    // initial message (welcome/referrer/time)
    showMessage((function (timeConfig, welcomeTpl, referrerTpl) {
      if (location.pathname === '/') {
        for (const { hour, text } of timeConfig) {
          const now = new Date();
          const after = hour.split('-')[0];
          const before = hour.split('-')[1] || after;
          if (Number(after.split('/')[0]) <= now.getHours() && now.getHours() <= Number(before.split('/')[0])) return text;
        }
      }
      if (!welcomeTpl) return '';
      const welcome = templateReplace(welcomeTpl, document.title);
      if (!document.referrer || !referrerTpl) return welcome;
      const refUrl = new URL(document.referrer);
      return location.hostname === refUrl.hostname ? welcome : `${templateReplace(referrerTpl, refUrl.hostname)}<br>${welcome}`;
    })(tipsObj.time, tipsObj.message.welcome, tipsObj.message.referrer), 7000, 11);
  }

  const api = await ModelManager.initCheck(config, models);
  await api.loadModel('');

  const tools = new ToolsManager(api, config, tipsObj);
  tools.registerTools();

  // ============================
  // Edit Mode (視窗化編輯模式)
  // ============================
  (function initEditMode() {
    const waifu = document.getElementById('waifu');
    if (!waifu) return;

    const MIN_SIZE = 150;
    const MAX_SIZE = 900;
    let isEditing = false;
    let savedState = null;

    function updateScale() {
      const w = waifu.offsetWidth || 300;
      waifu.style.setProperty('--waifu-scale', (w / 300).toFixed(3));
    }

    function getDefaultState() {
      return {
        left: waifu.style.left || '',
        top: waifu.style.top || '',
        bottom: waifu.style.bottom || '',
        width: '',
        height: '',
        transform: waifu.style.transform || ''
      };
    }

    function saveCurrentState() {
      const canvas = document.getElementById('live2d');
      return {
        left: waifu.style.left,
        top: waifu.style.top,
        bottom: waifu.style.bottom,
        width: waifu.style.width,
        height: waifu.style.height,
        transform: waifu.style.transform,
        customPos: waifu.classList.contains('waifu-custom-pos'),
        canvasWidth: canvas ? canvas.style.width : '',
        canvasHeight: canvas ? canvas.style.height : '',
        canvasContainerWidth: waifu.querySelector('#waifu-canvas') ? waifu.querySelector('#waifu-canvas').style.width : '',
        canvasContainerHeight: waifu.querySelector('#waifu-canvas') ? waifu.querySelector('#waifu-canvas').style.height : ''
      };
    }

    function enterEditMode() {
      if (isEditing) return;
      isEditing = true;
      savedState = saveCurrentState();

      // Compute current visual position BEFORE changing any classes
      const needComputePos = !waifu.style.top || waifu.style.top === '';
      let computedTop, computedLeft;
      if (needComputePos) {
        const rect = waifu.getBoundingClientRect();
        computedTop = rect.top;
        computedLeft = rect.left;
      }

      // Save to localStorage for persistence
      try {
        const pos = {
          left: waifu.offsetLeft,
          top: waifu.offsetTop,
          width: waifu.offsetWidth,
          height: waifu.offsetHeight
        };
        localStorage.setItem('waifu-edit-before', JSON.stringify(pos));
      } catch (e) { /* ignore */ }

      // Now apply classes and position
      waifu.classList.add('waifu-custom-pos');
      if (needComputePos) {
        waifu.style.top = computedTop + 'px';
        waifu.style.left = computedLeft + 'px';
      }
      waifu.classList.add('waifu-edit-mode');

      // Compensate top position for titlebar height so canvas stays visually in place
      const titlebarEl = waifu.querySelector('#waifu-edit-titlebar');
      const tbH = titlebarEl ? titlebarEl.offsetHeight : 0;
      if (tbH > 0) {
        const currentTop = parseFloat(waifu.style.top) || 0;
        waifu.style.top = (currentTop - tbH) + 'px';
      }

      showMessage('進入編輯模式，可以拖動邊角調整大小', 3000, 10);
    }

    function exitEditMode() {
      if (!isEditing) return;
      isEditing = false;

      // Compensate top position back: add titlebar height before removing edit mode
      const titlebarEl = waifu.querySelector('#waifu-edit-titlebar');
      const tbH = titlebarEl ? titlebarEl.offsetHeight : 0;
      if (tbH > 0) {
        const currentTop = parseFloat(waifu.style.top) || 0;
        waifu.style.top = (currentTop + tbH) + 'px';
      }

      waifu.classList.remove('waifu-edit-mode');

      // Save current position/size to localStorage so it persists
      try {
        const canvas = document.getElementById('live2d');
        const canvasContainer = waifu.querySelector('#waifu-canvas');
        localStorage.setItem('waifu-custom-layout', JSON.stringify({
          left: waifu.style.left,
          top: waifu.style.top,
          bottom: waifu.style.bottom,
          width: waifu.style.width,
          height: waifu.style.height,
          canvasWidth: canvas ? canvas.style.width : '',
          canvasHeight: canvas ? canvas.style.height : '',
          canvasContainerWidth: canvasContainer ? canvasContainer.style.width : '',
          canvasContainerHeight: canvasContainer ? canvasContainer.style.height : ''
        }));
      } catch (e) { /* ignore */ }

      showMessage('編輯完成！', 2000, 10);
    }

    function resetLayout() {
      const canvas = document.getElementById('live2d');
      const canvasContainer = waifu.querySelector('#waifu-canvas');

      // Reset to defaults
      waifu.style.left = '0px';
      waifu.style.top = '';
      waifu.style.bottom = '';
      waifu.style.width = '';
      waifu.style.height = '';
      waifu.style.transform = '';

      if (canvas) {
        canvas.style.width = '';
        canvas.style.height = '';
        canvas.style.transform = '';
      }

      if (canvasContainer) {
        canvasContainer.style.width = '';
        canvasContainer.style.height = '';
      }

      // Clear stored layout
      try { localStorage.removeItem('waifu-custom-layout'); } catch (e) { /* ignore */ }
      try { localStorage.removeItem('waifu-edit-before'); } catch (e) { /* ignore */ }

      // Reset scale and custom position
      waifu.style.removeProperty('--waifu-scale');

      // If still in edit mode, recompute position from bottom:0 before switching to top/left
      if (isEditing) {
        // Force reflow so getBoundingClientRect reflects bottom:0 positioning
        waifu.classList.remove('waifu-custom-pos');
        const rect = waifu.getBoundingClientRect();
        waifu.classList.add('waifu-custom-pos');
        waifu.style.top = rect.top + 'px';
        waifu.style.left = rect.left + 'px';
      } else {
        waifu.classList.remove('waifu-custom-pos');
      }

      // Re-autofit model
      if (api && typeof api.autoFitModel === 'function') {
        setTimeout(() => api.autoFitModel(0.72), 150);
      }

      showMessage('已還原初始位置與大小', 2000, 10);
    }

    function closeEditMode() {
      if (!isEditing) return;

      // Restore to state before entering edit mode
      if (savedState) {
        const canvas = document.getElementById('live2d');
        const canvasContainer = waifu.querySelector('#waifu-canvas');

        waifu.style.left = savedState.left;
        waifu.style.top = savedState.top;
        waifu.style.bottom = savedState.bottom;
        waifu.style.width = savedState.width;
        waifu.style.height = savedState.height;
        waifu.style.transform = savedState.transform;

        if (canvas) {
          canvas.style.width = savedState.canvasWidth;
          canvas.style.height = savedState.canvasHeight;
        }
        if (canvasContainer) {
          canvasContainer.style.width = savedState.canvasContainerWidth;
          canvasContainer.style.height = savedState.canvasContainerHeight;
        }
      }

      isEditing = false;
      waifu.classList.remove('waifu-edit-mode');
      // Restore waifu-custom-pos to the state before editing
      if (savedState && savedState.customPos) {
        waifu.classList.add('waifu-custom-pos');
      } else {
        waifu.classList.remove('waifu-custom-pos');
      }

      showMessage('已取消編輯', 2000, 10);
    }

    // Titlebar button listeners
    const btnDone = waifu.querySelector('.titlebar-btn.btn-done');
    const btnReset = waifu.querySelector('.titlebar-btn.btn-reset');
    const btnClose = waifu.querySelector('.titlebar-btn.btn-close');

    if (btnDone) btnDone.addEventListener('click', (e) => { e.stopPropagation(); exitEditMode(); });
    if (btnReset) btnReset.addEventListener('click', (e) => { e.stopPropagation(); resetLayout(); });
    if (btnClose) btnClose.addEventListener('click', (e) => { e.stopPropagation(); closeEditMode(); });

    // Titlebar drag (move in edit mode)
    const titlebar = waifu.querySelector('#waifu-edit-titlebar');
    if (titlebar) {
      titlebar.addEventListener('mousedown', (e) => {
        if (!isEditing) return;
        if (e.target.closest('.titlebar-btn')) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = waifu.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const w = rect.width;
        const h = rect.height;

        const headerEl2 = document.querySelector('header');
        const headerBottom = headerEl2 ? headerEl2.getBoundingClientRect().bottom : 0;
        const minTopEdit = Math.max(0, headerBottom);

        function onMove(ev) {
          let left = ev.clientX - offsetX;
          let top = ev.clientY - offsetY;
          if (left < 0) left = 0;
          if (top < minTopEdit) top = minTopEdit;
          if (left > winW - Math.min(w, 50)) left = winW - Math.min(w, 50);
          if (top > winH - Math.min(h, 50)) top = winH - Math.min(h, 50);
          // Ensure waifu-custom-pos is active to override bottom:0 !important
          if (!waifu.classList.contains('waifu-custom-pos')) {
            waifu.classList.add('waifu-custom-pos');
          }
          waifu.style.left = left + 'px';
          waifu.style.top = top + 'px';
        }

        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    // Resize handles (corners + edges)
    function initResize() {
      const handles = waifu.querySelectorAll('.waifu-resize-handle, .waifu-resize-edge');

      handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          if (!isEditing) return;
          e.preventDefault();
          e.stopPropagation();

          const dir = handle.dataset.dir;
          const startX = e.clientX;
          const startY = e.clientY;
          const startRect = waifu.getBoundingClientRect();
          const startW = startRect.width;
          const startH = startRect.height;
          const startL = startRect.left;
          const startT = startRect.top;

          const hdrEl = document.querySelector('header');
          const hdrBottom = hdrEl ? hdrEl.getBoundingClientRect().bottom : 0;
          const minTopResize = Math.max(0, hdrBottom);

          function onMove(ev) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            let newW = startW, newH = startH, newL = startL, newT = startT;

            // Compute new dimensions based on direction
            if (dir.includes('e')) newW = startW + dx;
            if (dir.includes('w')) { newW = startW - dx; newL = startL + dx; }
            if (dir.includes('s')) newH = startH + dy;
            if (dir.includes('n')) { newH = startH - dy; newT = startT + dy; }

            // Enforce min/max
            if (newW < MIN_SIZE) {
              if (dir.includes('w')) newL = startL + startW - MIN_SIZE;
              newW = MIN_SIZE;
            }
            if (newW > MAX_SIZE) {
              if (dir.includes('w')) newL = startL + startW - MAX_SIZE;
              newW = MAX_SIZE;
            }
            if (newH < MIN_SIZE) {
              if (dir.includes('n')) newT = startT + startH - MIN_SIZE;
              newH = MIN_SIZE;
            }
            if (newH > MAX_SIZE) {
              if (dir.includes('n')) newT = startT + startH - MAX_SIZE;
              newH = MAX_SIZE;
            }

            // Boundary check (header + left)
            if (newL < 0) { newW += newL; newL = 0; }
            if (newT < minTopResize) { newH -= (minTopResize - newT); newT = minTopResize; }

            waifu.style.width = newW + 'px';
            waifu.style.height = newH + 'px';
            waifu.style.left = newL + 'px';
            waifu.style.top = newT + 'px';
            waifu.style.bottom = 'auto';

            // Scale canvas and container to match (subtract titlebar height)
            const canvas = document.getElementById('live2d');
            const canvasContainer = waifu.querySelector('#waifu-canvas');
            const titlebar = waifu.querySelector('#waifu-edit-titlebar');
            const titlebarH = titlebar ? titlebar.offsetHeight : 0;
            const canvasH = Math.max(newH - titlebarH, MIN_SIZE);

            if (canvas) {
              canvas.style.width = newW + 'px';
              canvas.style.height = canvasH + 'px';
            }
            if (canvasContainer) {
              canvasContainer.style.width = newW + 'px';
              canvasContainer.style.height = canvasH + 'px';
            }

            updateScale();
          }

          function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          }

          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });

        // Touch support
        handle.addEventListener('touchstart', (e) => {
          if (!isEditing) return;
          const touch = e.touches[0];
          if (!touch) return;
          e.preventDefault();
          e.stopPropagation();

          const dir = handle.dataset.dir;
          const startX = touch.clientX;
          const startY = touch.clientY;
          const startRect = waifu.getBoundingClientRect();
          const startW = startRect.width;
          const startH = startRect.height;
          const startL = startRect.left;
          const startT = startRect.top;

          const hdrEl2 = document.querySelector('header');
          const hdrBottom2 = hdrEl2 ? hdrEl2.getBoundingClientRect().bottom : 0;
          const minTopResizeT = Math.max(0, hdrBottom2);

          function onTouchMove(ev) {
            const t = ev.touches[0];
            if (!t) return;
            const dx = t.clientX - startX;
            const dy = t.clientY - startY;
            let newW = startW, newH = startH, newL = startL, newT = startT;

            if (dir.includes('e')) newW = startW + dx;
            if (dir.includes('w')) { newW = startW - dx; newL = startL + dx; }
            if (dir.includes('s')) newH = startH + dy;
            if (dir.includes('n')) { newH = startH - dy; newT = startT + dy; }

            if (newW < MIN_SIZE) { if (dir.includes('w')) newL = startL + startW - MIN_SIZE; newW = MIN_SIZE; }
            if (newW > MAX_SIZE) { if (dir.includes('w')) newL = startL + startW - MAX_SIZE; newW = MAX_SIZE; }
            if (newH < MIN_SIZE) { if (dir.includes('n')) newT = startT + startH - MIN_SIZE; newH = MIN_SIZE; }
            if (newH > MAX_SIZE) { if (dir.includes('n')) newT = startT + startH - MAX_SIZE; newH = MAX_SIZE; }
            if (newL < 0) { newW += newL; newL = 0; }
            if (newT < minTopResizeT) { newH -= (minTopResizeT - newT); newT = minTopResizeT; }

            waifu.style.width = newW + 'px';
            waifu.style.height = newH + 'px';
            waifu.style.left = newL + 'px';
            waifu.style.top = newT + 'px';
            waifu.style.bottom = 'auto';

            const canvas = document.getElementById('live2d');
            const canvasContainer = waifu.querySelector('#waifu-canvas');
            const titlebar2 = waifu.querySelector('#waifu-edit-titlebar');
            const titlebarH2 = titlebar2 ? titlebar2.offsetHeight : 0;
            const canvasH2 = Math.max(newH - titlebarH2, MIN_SIZE);
            if (canvas) { canvas.style.width = newW + 'px'; canvas.style.height = canvasH2 + 'px'; }
            if (canvasContainer) { canvasContainer.style.width = newW + 'px'; canvasContainer.style.height = canvasH2 + 'px'; }
            updateScale();
          }

          function onTouchEnd() {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
          }

          document.addEventListener('touchmove', onTouchMove);
          document.addEventListener('touchend', onTouchEnd);
        });
      });
    }

    initResize();

    // Restore layout from localStorage on load
    try {
      const savedLayout = localStorage.getItem('waifu-custom-layout');
      if (savedLayout) {
        const layout = JSON.parse(savedLayout);
        if (layout.left) waifu.style.left = layout.left;
        if (layout.top) {
          // Validate top is within viewport bounds
          let topVal = parseInt(layout.top, 10);
          const headerEl = document.querySelector('header');
          const minTopRestore = headerEl ? headerEl.getBoundingClientRect().bottom : 0;
          if (topVal < minTopRestore) topVal = minTopRestore;
          if (topVal > window.innerHeight - 50) topVal = window.innerHeight - 50;
          waifu.style.top = topVal + 'px';
        }
        if (layout.bottom) waifu.style.bottom = layout.bottom;
        if (layout.width) waifu.style.width = layout.width;
        if (layout.height) waifu.style.height = layout.height;

        const canvas = document.getElementById('live2d');
        const canvasContainer = waifu.querySelector('#waifu-canvas');
        if (canvas && layout.canvasWidth) canvas.style.width = layout.canvasWidth;
        if (canvas && layout.canvasHeight) canvas.style.height = layout.canvasHeight;
        if (canvasContainer && layout.canvasContainerWidth) canvasContainer.style.width = layout.canvasContainerWidth;
        if (canvasContainer && layout.canvasContainerHeight) canvasContainer.style.height = layout.canvasContainerHeight;

        // Mark as custom position so injected !important rules are overridden
        if (layout.top) waifu.classList.add('waifu-custom-pos');

        updateScale();
      }
    } catch (e) { /* ignore */ }

    // Expose for the quit/setting toolbutton
    window.waifuEditMode = {
      toggle: () => { if (isEditing) exitEditMode(); else enterEditMode(); },
      enter: enterEditMode,
      exit: exitEditMode,
      reset: resetLayout,
      close: closeEditMode,
      get active() { return isEditing; }
    };
  })();

  if (config.drag) {
    const waifu = document.getElementById('waifu');
    if (waifu) {
      let winW = window.innerWidth, winH = window.innerHeight;

      const LONG_PRESS_MS = 250;

      waifu.addEventListener('mousedown', (e) => {
        if (e.button === 2) return;
        if (window.waifuEditMode && window.waifuEditMode.active) return;
        const canvas = document.getElementById('live2d');
        if (e.target !== canvas) return;
        e.preventDefault();

        const rect = waifu.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        // 計算 header 的底部（相對於 viewport），拖曳時不能超出此頂部區域
        const headerEl = document.querySelector('header');
        let headerRect = headerEl ? headerEl.getBoundingClientRect() : { bottom: 0 };
        let minTop = Math.max(0, headerRect.bottom);

        let dragging = false;
        let longPressTimer = setTimeout(() => { dragging = true; }, LONG_PRESS_MS);

        function onMove(ev) {
          if (!dragging) return;
          // Ensure waifu-custom-pos is active FIRST to avoid bottom:0 conflict
          if (!waifu.classList.contains('waifu-custom-pos')) {
            waifu.classList.add('waifu-custom-pos');
          }
          // Use dynamic size to account for resized widget
          const w = waifu.offsetWidth, h = waifu.offsetHeight;
          const x = ev.clientX, y = ev.clientY;
          let left = x - offsetX, top = y - offsetY;
          // Same constraints as edit mode: header top boundary, viewport edges
          if (top < minTop) top = minTop;
          if (top > winH - Math.min(h, 50)) top = winH - Math.min(h, 50);
          if (left < 0) left = 0;
          if (left > winW - Math.min(w, 50)) left = winW - Math.min(w, 50);
          waifu.style.top = `${top}px`;
          waifu.style.left = `${left}px`;
        }

        function onUp(ev) {
          clearTimeout(longPressTimer);
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);

          if (!dragging) {
            window.dispatchEvent(new Event('live2d:tapbody'));
          } else {
            // Save position to localStorage so toggle remembers it
            try {
              const canvas = document.getElementById('live2d');
              const canvasContainer = waifu.querySelector('#waifu-canvas');
              localStorage.setItem('waifu-custom-layout', JSON.stringify({
                left: waifu.style.left, top: waifu.style.top,
                bottom: waifu.style.bottom, width: waifu.style.width, height: waifu.style.height,
                canvasWidth: canvas ? canvas.style.width : '', canvasHeight: canvas ? canvas.style.height : '',
                canvasContainerWidth: canvasContainer ? canvasContainer.style.width : '',
                canvasContainerHeight: canvasContainer ? canvasContainer.style.height : ''
              }));
            } catch (e) { /* ignore */ }
          }
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);

        window.onresize = () => { winW = window.innerWidth; winH = window.innerHeight; headerRect = headerEl ? headerEl.getBoundingClientRect() : { bottom: 0 }; minTop = Math.max(0, headerRect.bottom); };
      });

      waifu.addEventListener('touchstart', (e) => {
        if (window.waifuEditMode && window.waifuEditMode.active) return;
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        const canvas = document.getElementById('live2d');
        if (e.target !== canvas && e.target !== canvas.parentNode) return;
        e.preventDefault();

        const rect = waifu.getBoundingClientRect();
        const offsetX = touch.clientX - rect.left;
        const offsetY = touch.clientY - rect.top;

        // 計算 header 的底部（相對於 viewport），拖曳時不能超出此頂部區域
        const headerEl = document.querySelector('header');
        let headerRect = headerEl ? headerEl.getBoundingClientRect() : { bottom: 0 };
        let minTop = Math.max(0, headerRect.bottom);

        let dragging = false;
        let longPressTimer = setTimeout(() => { dragging = true; }, LONG_PRESS_MS);

        function onTouchMove(ev) {
          if (!dragging) return;
          const t = ev.touches && ev.touches[0];
          if (!t) return;
          // Ensure waifu-custom-pos is active FIRST to avoid bottom:0 conflict
          if (!waifu.classList.contains('waifu-custom-pos')) {
            waifu.classList.add('waifu-custom-pos');
          }
          // Use dynamic size to account for resized widget
          const w = waifu.offsetWidth, h = waifu.offsetHeight;
          const x = t.clientX, y = t.clientY;
          let left = x - offsetX, top = y - offsetY;
          // Same constraints as edit mode: header top boundary, viewport edges
          if (top < minTop) top = minTop;
          if (top > winH - Math.min(h, 50)) top = winH - Math.min(h, 50);
          if (left < 0) left = 0;
          if (left > winW - Math.min(w, 50)) left = winW - Math.min(w, 50);
          waifu.style.top = `${top}px`;
          waifu.style.left = `${left}px`;
        }

        function onTouchEnd(ev) {
          clearTimeout(longPressTimer);
          document.removeEventListener('touchmove', onTouchMove);
          document.removeEventListener('touchend', onTouchEnd);

          if (!dragging) {
            window.dispatchEvent(new Event('live2d:tapbody'));
          } else {
            // Save position to localStorage so toggle remembers it
            try {
              const canvas = document.getElementById('live2d');
              const canvasContainer = waifu.querySelector('#waifu-canvas');
              localStorage.setItem('waifu-custom-layout', JSON.stringify({
                left: waifu.style.left, top: waifu.style.top,
                bottom: waifu.style.bottom, width: waifu.style.width, height: waifu.style.height,
                canvasWidth: canvas ? canvas.style.width : '', canvasHeight: canvas ? canvas.style.height : '',
                canvasContainerWidth: canvasContainer ? canvasContainer.style.width : '',
                canvasContainerHeight: canvasContainer ? canvasContainer.style.height : ''
              }));
            } catch (e) { /* ignore */ }
          }
        }

        document.addEventListener('touchmove', onTouchMove);
        document.addEventListener('touchend', onTouchEnd);

        window.onresize = () => { winW = window.innerWidth; winH = window.innerHeight; headerRect = headerEl ? headerEl.getBoundingClientRect() : { bottom: 0 }; minTop = Math.max(0, headerRect.bottom); };
      });
    }
  }

  const waifuEl = document.getElementById('waifu');
  if (waifuEl) {
    // Wait two animation frames to allow WebGL texture uploads and the first frame to be prepared
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Notify external controllers that the model and initial frame are ready for a smooth entrance
    document.dispatchEvent(new Event('live2d:modelReady'));

    // --- Performance optimization: pause rendering when not visible ---
    let live2dPaused = false;

    function pauseLive2D() {
      if (live2dPaused) return;
      live2dPaused = true;
      try {
        if (api && api.cubism5model && typeof api.cubism5model.stop === 'function') {
          api.cubism5model.stop();
          logger.trace('Live2D rendering paused (Cubism5)');
        }
      } catch (e) { /* ignore */ }
    }

    function resumeLive2D() {
      if (!live2dPaused) return;
      live2dPaused = false;
      try {
        if (api && api.cubism5model && typeof api.cubism5model.run === 'function' && !api.cubism5model._drawFrameId) {
          api.cubism5model.run();
          logger.trace('Live2D rendering resumed (Cubism5)');
        }
      } catch (e) { /* ignore */ }
    }

    // Pause when page is hidden (tab switch)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseLive2D(); else resumeLive2D();
    });

    // Pause when canvas is scrolled out of viewport
    const live2dCanvas = document.getElementById('live2d');
    if (live2dCanvas && typeof IntersectionObserver !== 'undefined') {
      const visObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) resumeLive2D(); else pauseLive2D();
        }
      }, { threshold: 0.01 });
      visObserver.observe(waifuEl);
    }
  }
}

window.initWidget = function (config) {
  if (typeof config === 'string') return void logger.error('Your config for Live2D initWidget is outdated.');
  logger.setLevel(config.logLevel);
  document.body.insertAdjacentHTML('beforeend', '<div id="waifu-toggle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M96 64a64 64 0 1 1 128 0A64 64 0 1 1 96 64zm48 320l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-192.2L59.1 321c-9.4 15-29.2 19.4-44.1 10S-4.5 301.9 4.9 287l39.9-63.3C69.7 184 113.2 160 160 160s90.3 24 115.2 63.6L315.1 287c9.4 15 4.9 34.7-10 44.1s-34.7 4.9-44.1-10L240 287.8 240 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-32 0z"/></svg></div>');
  const toggle = document.getElementById('waifu-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    if (toggle.classList.contains('waifu-toggle-active')) toggle.classList.remove('waifu-toggle-active');
    if (toggle.getAttribute('first-time')) {
      loadWidget(config);
      toggle.removeAttribute('first-time');
    } else {
      if (localStorage.getItem('waifu-display')) {
        localStorage.removeItem('waifu-display');
        loadWidget(config);
      } else {
        localStorage.removeItem('waifu-display');
        document.getElementById('waifu')?.classList.remove('waifu-hidden');
        setTimeout(() => { document.getElementById('waifu')?.classList.add('waifu-active'); }, 0);
      }
    }
  });

  if (localStorage.getItem('waifu-display') && Date.now() - Number(localStorage.getItem('waifu-display')) <= 864e5) {
    toggle?.setAttribute('first-time', 'true');
    setTimeout(() => toggle?.classList.add('waifu-toggle-active'), 0);
  } else {
    loadWidget(config);
  }
};

export { logger as l };