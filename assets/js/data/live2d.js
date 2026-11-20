// Content of the Live2D works page (/apps/live2d/).
// Used by src/pages/live2d.mjs (static markup) and assets/js/pages/live2d.js (the live stage).
//
// Sources: the model files themselves (assets/live2d/model/), the 2021 tutorial site this page replaces
// (credits, the first model's story), and the export dates of the model files. The numbers in `stats` are what
// the Cubism Core reports for each .moc3 — the page shows the live values once the model is loaded; these are
// only what a visitor without WebGL reads.

const dir = '/assets/live2d';

// One entry per model.
//   moc / physics   the model's own files (shared with the corner mascot)
//   tex             web textures: the used square of the atlas at two sizes (made by tools/live2d-textures.mjs)
//   crop            that square, as a fraction of the atlas side measured from the top-left corner
//   atlas           side of the original atlas in pixels
//   eyes            the two "eye open" parameters (the first model named them its own way)
//   veil            meshes kept out of the take-apart views: the base body that is painted under the clothes
//   outfits         [label, value] of the outfit parameter, where the model has one: the buttons on this page, and the
//                   order the mascot cycles through them
//   labels          names for parameters that the shared dictionary below does not cover (or names differently)
export const models = [
  {
    id: 'ns-v5', code: 'NS-V5', ver: 'Ver 1.2', name: '長門櫻', en: 'NAGATO SAKURA', year: '2026',
    line: '長門櫻計畫的主角：金髮、狐耳、女僕裝的仿生電子狐娘。',
    desc: '目前最完整的一個。耳朵、尾巴、裙擺、圍裙和頭髮各自掛著擺錘，共十一組物理；手臂分成肩、肘、手三段，可以擺出姿勢；服裝做成一個參數，同一個模型可以換裝。',
    credits: [['角色', '長門櫻（長門櫻計畫）'], ['建模', '天野靜樹']],
    moc: `${dir}/model/NS-V5-Ver1.2/NS-V5-Ver1.2.moc3`,
    physics: `${dir}/model/NS-V5-Ver1.2/NS-V5-Ver1.2.physics3.json`,
    tex: [`${dir}/web/ns-v5-hi.webp`, `${dir}/web/ns-v5-lo.webp`], crop: 1, atlas: 4096,
    veil: ['body'],
    outfit: 'ParamCloth', outfits: [['女僕裝', 1], ['不穿圍裙', 0], ['只穿圍裙', -1], ['只穿內衣', -2]],
    stats: { meshes: 59, verts: 2793, tris: 4201, params: 47, physics: 11, masked: 7, canvas: [2894, 4093] },
    labels: {
      ParamArmLA: ['左肩', 'limb'], ParamArmRAngle: ['右肩', 'limb'], ParamForearmLAngle: ['左肘', 'limb'], ParamForearmRAngle: ['右肘', 'limb'],
      ParamHandLB: ['左手', 'limb'], ParamHandRB: ['右手', 'limb'], ParamLegLAngle: ['左腿', 'limb'], ParamLeg: ['右腿', 'limb'],
    },
  },
  {
    id: 'l2d-cmt-01', code: 'L2D-CMT-01', ver: 'Ver 2.3', name: 'SUMI', en: 'SUMI', year: '',
    line: '繪師 Sumi 筆下的角色，由我負責讓她動起來。',
    desc: '別人的畫、我的骨架：拿到的是一張完成的立繪，要自己判斷哪裡該拆、哪裡該補。鬢髮、側髮和辮子用蒙皮串成一節一節的旋轉，加上裙擺、緞帶與披紗，共十一組物理。',
    credits: [['繪師', 'Sumi'], ['建模', '天野靜樹']],
    moc: `${dir}/model/L2D-CMT-01ver2.3_vts/L2D-CMT-01.moc3`,
    physics: `${dir}/model/L2D-CMT-01ver2.3_vts/L2D-CMT-01.physics3.json`,
    tex: [`${dir}/web/l2d-cmt-01-hi.webp`, `${dir}/web/l2d-cmt-01-lo.webp`], crop: 0.578125, atlas: 8192,
    veil: ['body'],
    stats: { meshes: 56, verts: 2308, tris: 3203, params: 41, physics: 11, masked: 4, canvas: [3024, 4032] },
    labels: {
      ParamArmRA: ['右臂', 'limb'], ParamArmLA: ['左臂', 'limb'], ParamHandL: ['左手', 'limb'], ParamHandR: ['右手', 'limb'], ParamLeg: ['腿', 'limb'],
    },
  },
  {
    id: 'wl2d-01', code: 'WL2D-01', ver: '2021', name: '三和音', en: 'SGO', year: '2021',
    line: '第一個模型。從紙上的草圖開始，一個人畫完、拆完、綁完。',
    desc: '高中時做的第一個模型，代號 SGO：草圖、電繪、拆圖、建模全部自己來，大約花了十六個小時。頭部和身體都做了 X、Y、Z 三個方向，是當年那個教學網站的示範模型——參數的命名還看得出是初學者取的。',
    credits: [['繪圖', '天野靜樹'], ['建模', '天野靜樹']],
    moc: `${dir}/model/WL2D-01_vts/WL2D-01.moc3`,
    physics: `${dir}/model/WL2D-01_vts/WL2D-01.physics3.json`,
    tex: [`${dir}/web/wl2d-01-hi.webp`, `${dir}/web/wl2d-01-lo.webp`], crop: 0.75, atlas: 4096,
    eyes: ['ParamEyeLclozop', 'ParamEyeRclozop'],
    roles: { smileR: 'ParamEyeROpen' },
    stats: { meshes: 57, verts: 2014, tris: 2890, params: 36, physics: 4, masked: 4, canvas: [2480, 3508] },
    labels: {
      ParamEyeLclozop: ['左眼開合', 'eye'], ParamEyeRclozop: ['右眼開合', 'eye'], ParamEyeROpen: ['右眼微笑', 'eye'],
      BodyHZ: ['上半身 Z', 'body'], RArmX: ['右手臂', 'limb'], RHandX: ['右手', 'limb'], LArm: ['左手臂', 'limb'], LHandX: ['左手', 'limb'], RLeg: ['右腿', 'limb'], LLeg: ['左腿', 'limb'],
    },
  },
];

// Parameter panel: groups in display order, and the names of the standard Cubism parameters.
export const groups = [['head', '頭部'], ['body', '身體'], ['eye', '眼睛'], ['brow', '眉毛'], ['face', '嘴與臉'], ['limb', '手腳']];
export const labels = {
  ParamAngleX: ['頭 X · 左右', 'head'], ParamAngleY: ['頭 Y · 上下', 'head'], ParamAngleZ: ['頭 Z · 傾斜', 'head'],
  ParamBodyAngleX: ['身體 X', 'body'], ParamBodyAngleY: ['身體 Y', 'body'], ParamBodyAngleZ: ['身體 Z', 'body'],
  ParamEyeLOpen: ['左眼開合', 'eye'], ParamEyeROpen: ['右眼開合', 'eye'], ParamEyeLSmile: ['左眼微笑', 'eye'], ParamEyeRSmile: ['右眼微笑', 'eye'],
  ParamEyeBallX: ['眼球 X', 'eye'], ParamEyeBallY: ['眼球 Y', 'eye'],
  ParamBrowLY: ['左眉上下', 'brow'], ParamBrowRY: ['右眉上下', 'brow'], ParamBrowLX: ['左眉左右', 'brow'], ParamBrowRX: ['右眉左右', 'brow'],
  ParamBrowLAngle: ['左眉角度', 'brow'], ParamBrowRAngle: ['右眉角度', 'brow'], ParamBrowLForm: ['左眉變形', 'brow'], ParamBrowRForm: ['右眉變形', 'brow'],
  ParamMouthForm: ['嘴型', 'face'], ParamMouthOpenY: ['嘴開合', 'face'], ParamTeeth: ['牙齒', 'face'], ParamTongue: ['舌頭', 'face'], ParamCheek: ['臉頰紅暈', 'face'],
};
// parameters the panel never offers: breathing runs by itself, the outfit has its own control
export const hidden = ['ParamBreath', 'ParamCloth'];

// Expressions: [role, value] pairs; 'max' / 'min' mean the end of that parameter's range.
// Roles resolve to the standard ids unless the model says otherwise (`roles`, `eyes`).
export const roles = {
  eyeL: 'ParamEyeLOpen', eyeR: 'ParamEyeROpen', smileL: 'ParamEyeLSmile', smileR: 'ParamEyeRSmile',
  mouth: 'ParamMouthForm', open: 'ParamMouthOpenY', cheek: 'ParamCheek',
  browLY: 'ParamBrowLY', browRY: 'ParamBrowRY', browLF: 'ParamBrowLForm', browRF: 'ParamBrowRForm',
};
export const faces = [
  { id: 'rest', name: '平常', set: [] },
  { id: 'smile', name: '微笑', set: [['eyeL', 0], ['eyeR', 0], ['smileL', 1], ['smileR', 1], ['mouth', 'max']] },
  { id: 'wink', name: '眨單眼', set: [['eyeL', 0], ['smileL', 1], ['mouth', 'max'], ['open', 0.35]] },
  { id: 'wow', name: '驚訝', set: [['eyeL', 'max'], ['eyeR', 'max'], ['browLY', 1], ['browRY', 1], ['mouth', 0], ['open', 0.7]] },
  { id: 'shy', name: '害羞', set: [['cheek', 'max'], ['smileL', 0.6], ['smileR', 0.6], ['browLF', -0.6], ['browRF', -0.6], ['mouth', 0.4]] },
];

// Names of the pendulums, by the parameter each one drives.
export const pendulums = {
  ParamHairFront: '瀏海', ParamHairFrontR: '右前髮', ParamHairFrontL: '左前髮', ParamHairBack: '後髮', ParamHairSiderR: '右側髮', ParamHairSiderL: '左側髮',
  ParamEarR: '右耳', ParamEarL: '左耳', ParamTail: '尾巴', ParamSkirt: '裙擺', ParamApron: '圍裙', ParamUpClouth: '上衣',
  ParamParamHairFront: '瀏海', ParamSideupRibbon: '髮飾緞帶', ParamSkirt2: '裙擺（前後）', Param: '披紗',
  Param_Angle_Rotation_1_ArtMesh28: '鬢髮 A', Param_Angle_Rotation_1_ArtMesh29: '鬢髮 B', Param_Angle_Rotation_1_ArtMesh45: '側髮 A', Param_Angle_Rotation_1_ArtMesh44: '側髮 B', Param_Angle_Rotation_1_ArtMesh32: '辮子',
  Bang: '瀏海', Fowardhair: '前髮', CoatZ: '披風', HairMiddleZ: '中髮', BackHairZ: '後髮',
};

// 07 — where it started. Dates: the 2021 site's own note (2021/04/25) and the export dates of the model files.
// `link` is optional: { href, label, note } renders an outbound link under the entry.
export const timeline = [
  { when: '2021.04', title: 'WL2D-01 與第一個教學網站', text: '高中，為了一場網頁設計比賽，把剛學會的 Live2D 寫成一個教學網站：草圖、拆圖、建模、動畫、應用，一頁一頁教。示範用的模型就是 WL2D-01。當時中文資料很少，幾乎每一步都是試出來的。',
    link: { href: 'https://ericchen920114.wixsite.com/live2', label: '2021 年的原站', note: '保留當年的樣子：沒寫完，內容也已過時' } },
  { when: 'L2D-CMT-01', title: '替別人的畫建模', text: '繪師 Sumi 的角色。畫不是自己的，拆法就不能照自己的習慣來；這個模型一路改到 Ver 2.3。' },
  { when: '2025.12', title: '模型搬上個人網站', text: '兩個模型成為個人網站的看板娘：在瀏覽器裡用 Cubism Web SDK 即時運算，換頁也不重新載入。' },
  { when: '2026.03 — 04', title: 'NS-V5：長門櫻', text: 'Ver 1.0（3 月 9 日）、1.1（3 月 20 日）、1.2（4 月 2 日）。長門櫻有了可以動的身體：十一組物理、可換的服裝、能擺姿勢的手臂。' },
  { when: '2026.11', title: '這一頁', text: '重寫 2021 年的那個網站。當年用截圖和影片說明的事，現在讓模型自己示範——為此另外寫了一個繪製器，好把她一層一層拆開來看。' },
];

// 02 — what the 2021 tutorial taught about cutting a drawing apart, kept as the rules they are
export const rules = [
  ['一個東西，拆成好幾層', '一隻眼睛是眼白、眼球、高光、上睫毛、下睫毛；頭髮分瀏海、側髮、後髮。拆得越細，之後能動的地方越多。'],
  ['看不到的地方也要畫', '嘴巴裡面、被瀏海蓋住的額頭、被衣服蓋住的肩膀。平常看不到，一轉頭就露出來。'],
  ['關節畫得比看得到的長', '脖子、手臂的接合處要多畫一截，轉動時才不會露出破口。'],
];
