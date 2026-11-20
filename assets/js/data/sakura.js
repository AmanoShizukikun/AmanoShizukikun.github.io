// Content of the Nagato Sakura Project page (/apps/nagato-sakura/).
// Used by src/pages/sakura.mjs (static HTML) and assets/js/pages/sakura.js (the interactive parts).
// Every figure here comes from the READMEs / changelogs of the repositories it names; nothing is estimated.

const GH = 'https://github.com/AmanoShizukikun';
const HF = 'https://huggingface.co/AmanoShizukikun';

export const links = {
  list: 'https://github.com/stars/AmanoShizukikun/lists/nagato-sakura-project',
  github: GH,
  hf: HF,
};

// 04 — one module, one job. `img` is that repository's own release illustration: the same character in the
// outfit of the job. `route` = the node this module has in the dispatch diagram of section 01.
export const modules = [
  {
    id: 'lm', code: 'NS-LM', job: '語言', name: '語言模型', en: 'LANGUAGE MODEL', img: 'sakura/role-lm.webp',
    alt: '長門櫻穿著制服與粉色開襟衫，在秋天的銀杏樹下揮手',
    desc: '自己實作的自回歸語言模型。從 tokenizer、訓練到推論，整條鏈路都在單人可以掌控的範圍內。',
    facts: ['Decoder-only Transformer', 'NS-LM 1.6 · 50M', 'NSLM-2 · 90M 研發中'],
    href: `${GH}/Nagato-Sakura-Language-Model`, ver: '1.6.2', date: '2026-09',
  },
  {
    id: 'charm', code: 'NS-IC', job: '修復', name: '影像魅影', en: 'IMAGE CHARM', img: 'sakura/role-charm.webp',
    alt: '長門櫻穿著巫女服，坐在插滿刀劍的荒野上',
    desc: '圖形化的影像增強與評估工具：AI 超分辨率、圖片與影片增強、品質評估，以及可在程式內安裝的擴充插件。',
    facts: ['鏡花 · 界律 · 斷律', 'CUDA · Apple MPS', '擴充插件管理器'],
    href: `${GH}/Nagato-Sakura-Image-Charm`, ver: '1.3.1', date: '2026-02',
  },
  {
    id: 'iqe', code: 'NS-IQE', job: '增強', name: '影像增強', en: 'IMAGE QUALITY ENHANCER', img: 'sakura/role-iqe.webp',
    alt: '長門櫻穿著白色和服，在紫藤花下吹笛',
    desc: '影像魅影的基礎組件：RRDB 加上自注意力的影像增強模型，以 Tile 分塊處理大圖，並內建即時預覽。',
    facts: ['RRDB + Self-Attention', 'Tile 分塊', 'CUDA · Intel XPU · MPS · CPU'],
    href: `${GH}/Nagato-Sakura-Image-Quality-Enhancer`, ver: '1.0.0', date: '2026-02',
  },
  {
    id: 'iqa', code: 'NS-IQA', job: '鑑定', name: '影像評分', en: 'IMAGE QUALITY ASSESSMENT', img: 'sakura/role-iqa.webp',
    alt: '長門櫻戴著眼鏡、穿著西裝外套，在落地窗前讀文件',
    desc: '替圖片的品質打分數。第二代改用輕量的 CNN 取代原本的 Transformer，並作為影像魅影的擴充插件。',
    facts: ['輕量 CNN（第二代）', '批次評分 GUI', '影像魅影擴充插件'],
    href: `${GH}/Nagato-Sakura-Image-Quality-Assessment`, ver: '2.0.0', date: '2025-08',
  },
  {
    id: 'nsc', code: 'NS-C', job: '分類', name: '影像分類', en: 'IMAGE CLASSIFICATION', img: 'sakura/role-nsc.webp',
    alt: '長門櫻扮成偵探，拿著放大鏡坐在書房裡',
    desc: '圖像分類的訓練器與模型。在影像魅影裡，它負責先看一眼圖片，再推薦該用哪一個修復模型。',
    facts: ['MobileNet v2 / v3 · EfficientNet-B0', '逐類別機率', '模型推薦'],
    href: `${GH}/Nagato-Sakura-Image-Classification`, ver: '1.0.0', date: '2025-08',
  },
  {
    id: 'sms', code: 'NS-SMS', job: '防護', name: '簡訊檢測', en: 'SMS CHECKER', img: 'sakura/role-sms.webp',
    alt: '長門櫻穿著黑色軍裝式制服，站在高樓之間',
    desc: '為了對付簡訊詐騙做的小型分類模型：分類簡訊類型、找出其中的電話與網址，並實際測試網址的回應狀態。',
    facts: ['簡訊分類', '電話 · 網址擷取', 'CLI · GUI · Web'],
    href: `${GH}/Nagato-Sakura-SMS-Checker`, ver: '1.0.5', date: '2024-03',
  },
  {
    id: 'bot', code: 'NS-BOT', job: '對話', name: 'Discord 機器人', en: 'DISCORD BOT', img: 'sakura/role-bot.webp',
    alt: '長門櫻在霓虹城市的夜空中回頭',
    desc: '和長門櫻說話的管道之一。以 Python 寫成，聊天功能可接上 ChatGLM、GLM-4 等語言模型，也能在語音頻道播放音樂。',
    facts: ['文字 · 語音 · 音樂', 'ChatGLM · GLM-4', 'Cog 模組化'],
    href: `${GH}/Nagato-Sakura-Discord-Bot-py`, ver: '2.1.0', date: '2025-09',
  },
];

// further branches, listed without a card
export const branches = [
  ['Nagato-Sakura-Image-Charm-Trainer', '影像魅影的模型訓練器'],
  ['Nagato-Sakura-AutoReply', '在 100 MB 以內做出能正確回覆的模型（研究中）'],
  ['Nagato-Sakura-Bounce-py', '彈幕彈跳球遊戲，影像魅影裡的彩蛋'],
].map(([repo, note]) => ({ repo, note, href: `${GH}/${repo}` }));

// 01 — what one sentence sets in motion. A staged illustration of the dispatch, not a live model:
// `to` = the module that ends up doing the work, `via` = modules consulted on the way.
export const routes = [
  {
    say: '幫我把這張動漫截圖的壓縮痕跡修掉', to: 'charm', via: ['nsc'],
    steps: [['INTENT', '影像修復'], ['NS-C', '判斷圖片類型 → 動漫 · JPEG 壓縮'], ['MODEL', '推薦《鏡花》Kyouka'], ['NS-IC', '執行還原，回傳圖片']],
  },
  {
    say: '這張照片的畫質可以打幾分？', to: 'iqa', via: [],
    steps: [['INTENT', '品質評估'], ['NS-IQA', '載入評分模型'], ['SCORE', '回傳品質分數']],
  },
  {
    say: '這則簡訊是不是詐騙？', to: 'sms', via: [],
    steps: [['INTENT', '安全檢查'], ['NS-SMS', '分類簡訊類型'], ['EXTRACT', '找出電話與網址'], ['PROBE', '測試網址的回應狀態']],
  },
  {
    say: '陪我聊聊今天發生的事', to: 'lm', via: [],
    steps: [['INTENT', '閒聊'], ['NS-LM', '不呼叫工具，由語言核心直接回覆']],
  },
  {
    say: '在語音頻道放一首歌', to: 'bot', via: [],
    steps: [['INTENT', '音樂播放'], ['NS-BOT', '加入語音頻道'], ['PLAY', '開始串流']],
  },
];

// 02 — the language core
export const core = {
  // parts of the block; `in` = which generation uses it
  parts: [
    { id: 'rope', name: 'RoPE', zh: '旋轉位置編碼', note: '位置資訊直接轉進注意力的向量裡，長度可以動態擴充。', in: ['v1', 'v2'] },
    { id: 'rms', name: 'RMSNorm', zh: 'Pre-Norm 正規化', note: '每個子層之前先正規化，深層網路訓練起來比較穩。', in: ['v1', 'v2'] },
    { id: 'gqa', name: 'GQA', zh: '分組查詢注意力', note: '多個查詢頭共用較少的 Key／Value 頭。NSLM-2 是 8 個頭配 2 組 KV，省下快取記憶體。', in: ['v1', 'v2'] },
    { id: 'swiglu', name: 'SwiGLU', zh: '前饋層', note: '帶門控的前饋網路。寬度在 v1 約為隱藏層的 2.7 倍，NSLM-2 是 3 倍（1536）。', in: ['v1', 'v2'] },
    { id: 'tied', name: 'Tied Embedding', zh: '共享詞嵌入', note: '輸入與輸出共用同一張詞表矩陣，小模型可以省下一大塊參數。', in: ['v1', 'v2'] },
    { id: 'cce', name: 'Chunked CE', zh: '分塊交叉熵', note: '自訂反向傳播，不一次展開整個 logits 矩陣，壓低訓練時的顯存峰值。', in: ['v1'] },
    { id: 'qk', name: 'QK-Norm', zh: '查詢／鍵正規化', note: '消融實驗後留下的元件之一：注意力分數在相乘前先正規化。', in: ['v2'] },
    { id: 'gate', name: 'Attention Gate', zh: '逐頭注意力閘門', note: '每個注意力頭有自己的開關，讓模型學會何時不看。', in: ['v2'] },
    { id: 'vres', name: 'Value Residual', zh: 'Value 殘差', note: '把前面層的 Value 接回後面的層，消融實驗確認有收益後保留。', in: ['v2'] },
  ],
  gens: [
    {
      id: 'v1', name: 'NS-LM 1.x', state: '已公開', tone: 'ok',
      rows: [['模型', 'NS-LM-1.6-50M-Base · NS-LM-1.3-60M'], ['規模', '50M / 60M 參數'], ['上下文', '4,096'], ['精度', 'BF16'], ['發布', 'Hugging Face']],
      links: [['NS-LM-1.6-50M-Base', `${HF}/NS-LM-1.6-50M-Base`], ['NS-LM-1.3-60M', `${HF}/NS-LM-1.3-60M`]],
    },
    {
      id: 'v2', name: 'NSLM-2', state: '研發中 · 權重尚未公開', tone: 'dev',
      rows: [['模型', 'NSLM-2-90M'], ['規模', '89.3M 參數'], ['結構', '24 層 · 寬 512 · FFN 1536'], ['注意力', 'GQA 8 頭 / 2 KV'], ['Tokenizer', '32k byte-level BPE（繁中優化）'], ['聊天協定', 'nslm-chat/1.1 · 角色卡、記憶工具']],
      links: [],
    },
  ],
  // measured on the board (NSLM-2 README)
  edge: {
    board: 'RK3399 · 2 × A72 @ 1.8 GHz · 2 GB', format: 'ONNX Runtime · int8',
    rows: [['35.9', 'tok/s', '上下文 128'], ['25.6', 'tok/s', '上下文 1,024'], ['348', 'MB', '峰值記憶體']],
  },
  layers: 24,
};

// 03 — image restoration. Each pair is the same picture before and after the model (1280 × 624).
export const models = [
  {
    id: 'kyouka', name: '鏡花', en: 'KYOUKA', line: '碎裂之象，在鏡中重構原初之姿。',
    use: '動漫 JPEG 壓縮還原', ver: 'v6（MQ 為 v7）', train: '10K', variants: ['Kyouka', 'Kyouka-LQ', 'Kyouka-MQ'],
    focus: [36, 34], href: `${HF}/NS-IC-Kyouka`,
  },
  {
    id: 'kairitsu', name: '界律', en: 'KAIRITSU', line: '幻象之律重編破碎時因，塵封記憶再現為清晰輪廓。',
    use: '寫實 JPEG 壓縮還原', ver: 'v9', train: '25K', variants: ['Kairitsu'],
    focus: [55, 56], href: `${GH}/Nagato-Sakura-Image-Charm`,
  },
  {
    id: 'ritsuka', name: '斷律', en: 'RITSUKA', line: '格狀的影塊，是序斷的殘響。在光與影的律動中，復甦真實之形。',
    use: '動漫馬賽克還原（2–4 格像素）', ver: 'v7', train: '10K', variants: ['Ritsuka-HQ'],
    focus: [44, 52], href: `${GH}/Nagato-Sakura-Image-Charm`,
  },
];

// 05 — dated from the changelogs
export const timeline = [
  ['2021', '計畫開始', '以「做出理想的女僕」為目標，先從 Discord 機器人著手。'],
  ['2023.09', 'NS-LM-Chat-GLM2', '長門櫻第一個語言模型透過微調 Chat-GLM2 完成。'],
  ['2023.09', 'Discord Bot 1.0.0', '長門櫻第一個公開的身體：能在 Discord 上被呼叫。'],
  ['2024.02', 'SMS Checker 1.0.0', '為了對付詐騙簡訊訓練的小型分類模型。'],
  ['2024.06', 'Discord Bot 2.0.0', '正式接上語言模型，開始能聊天。'],
  ['2024.09', 'Image Classification 0.0.1', '視覺分支起步：圖像分類的訓練與測試程式。'],
  ['2025.03', 'Image Quality Assessment 1.0.0', '學會替一張圖的品質打分數。'],
  ['2025.04', 'Image Charm 1.0.0', '影像魅影發布：圖形化的影像增強與評估工具。'],
  ['2025.08', 'Image Charm 1.3.0', '擴充插件管理器；評分與分類改為可安裝的插件。'],
  ['2026.02', 'Image Quality Enhancer 1.0.0', '增強模型獨立成基礎組件，支援 Intel XPU。'],
  ['2026.04', 'NS-LM 1.2.0', '自己實作的語言模型，更新記錄從這一版開始。'],
  ['2026.08', 'NS-LM 1.6.0', '架構大幅重整，效率提升、記憶體用量下降。'],
  ['2026.11', 'NSLM-2', '第二代語言模型研發中：在 RK3399 開發板上完成實機量測。'],
].map(([when, title, note]) => ({ when, title, note }));
