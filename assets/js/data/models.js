// The 3D works gallery (/apps/models/) and its viewer pages (/apps/models/<id>/). One entry per model; the gallery,
// the viewer, the works index and the sitemap all come from this list. What can be counted from the file itself
// (triangles, bones, animations, file size …) is not written here: tools/models-scan.mjs puts it in models-scan.js.
//
// Adding a model (README「3D 作品頁面」has the long version):
//   1. the file goes to assets/models/<id>/model.glb
//        from Blender: blender -b work.blend --python tools/blend-to-glb.py -- assets/models/<id>/model.glb
//   2. add an entry below (newest first is only a habit; the gallery sorts by date)
//   3. node tools/models-scan.mjs
//   4. node tools/serve.mjs, open /apps/models/<id>/, frame it, press 設為封面 (writes assets/models/<id>/poster.webp;
//      the button exists only on the preview server). 複製視角 copies the camera as `view.camera` for step 2.
//   5. node tools/build.mjs
//
// Fields
//   id       folder name and address: lower case, digits and hyphens
//   title    name on the card and the page          en   the same in capitals, for the line under it
//   kind     one of `kinds` below                   date YYYY-MM-DD (sorting, and the year on the card)
//   tags     words the gallery can filter by        tools what it was made with
//   desc     one paragraph per string
//   file     only when the model lives somewhere else than assets/models/<id>/model.glb
//   view     how the viewer opens it (all optional):
//              camera  { position: [x, y, z], target: [x, y, z], fov } — otherwise framed to fit
//              light   'studio' | 'dusk' | 'night'                     — default 'studio'
//              mode    'flat' (shadeless) | 'material' | 'clay' | 'wire' | 'normal' — default: characters 'flat', the rest 'material'
//              spin    turn slowly until touched (true/false)          — default true
//              ground  a soft shadow under it (true/false)             — default true
//   links    [{ label, href }] shown under the description
export const kinds = [
  { id: 'character', zh: '角色', en: 'CHARACTER' },
  { id: 'scene', zh: '場景', en: 'SCENE' },
  { id: 'prop', zh: '道具', en: 'PROP' },
  { id: 'other', zh: '其他', en: 'OTHER' },
];

export const models = [
  {
    id: 'nagato-sakura', title: '長門櫻', en: 'NAGATO SAKURA', kind: 'character', date: '2026-11-05',
    tags: ['長門櫻', '女僕', '狐耳', '骨架', '表情'], tools: ['Blender'],
    desc: [
      '長門櫻的 3D 角色模型（v48）：金色長髮、狐耳、黑白女僕裝。全身綁好骨架，連手指、腳趾、頭髮、裙擺與狐耳都有骨頭；臉上有眨眼、微笑、驚訝與口形等表情。',
      '預設以「無光影」顯示，也就是只有貼圖本身的顏色。原始檔近 100 MB，網頁版把貼圖縮成 2K 的 WebP、拿掉測試用的動畫，縮到約 14 MB。',
    ],
    view: { light: 'studio' },
  },
  {
    id: 'ns-room', title: '長門櫻的房間', en: "NAGATO SAKURA'S ROOM", kind: 'scene', date: '2026-09-18',
    tags: ['長門櫻', '室內', '微縮場景'], tools: ['Blender', 'Three.js'],
    desc: [
      '長門櫻的房間，做成放在基座上的微縮場景：靠窗的床、書桌與滾輪椅、書櫃、衣櫃、冷氣、窗簾與窗外的景色，每一件家具都是在 Blender 裡分開建好再組進來的。',
      '這裡看的是模型本身。長門櫻每天在這裡過日子——睡覺、看書、用筆電、看窗外——那是另一頁「長門櫻的日常」。',
    ],
    // seen from the open corner, where the two missing walls would be
    view: { light: 'dusk', camera: { position: [-7.672, 5.468, 9.024], target: [-2.243, 1.26, 2.238], fov: 36 } },
    links: [{ label: '看她在房間裡的日常', href: '/apps/ns-room/' }],
  },
];

export const fileOf = (m) => m.file || `/assets/models/${m.id}/model.glb`;
export const posterOf = (m) => `/assets/models/${m.id}/poster.webp`;
export const kindOf = (m) => kinds.find((k) => k.id === m.kind) || kinds.at(-1);
/** The models in the order the gallery shows them first: newest first. */
export const byDate = (list = models) => [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
