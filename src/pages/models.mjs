// Markup of the 3D works gallery (/apps/models/) and of one viewer page per model (/apps/models/<id>/); used by
// tools/build.mjs. Content: assets/js/data/models.js (written by hand) and models-scan.js (counted from the files by
// tools/models-scan.mjs). Behaviour: assets/js/pages/models.js (gallery) and model.js (viewer).
//   gallery  a search box, kinds, tags and a sort order over a grid of cards — cover picture, name, triangles,
//            file size, year, and badges for what the file carries (bones, shape keys, animation)
//   viewer   the model live on a stage with the inspector's tools (spin, reset, shadeless / material / clay /
//            wireframe / normals, light, background, full screen), then the description and everything counted from the file
// Without JavaScript or WebGL the gallery still filters nothing but lists every card, and the viewer shows the cover.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (i) => String(i).padStart(2, '0');
const num = (n) => Number(n).toLocaleString('en-US');
export const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : num(n));
export const mb = (b) => `${(b / 1048576).toFixed(b >= 1048576 * 10 ? 0 : 1)} MB`;

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${extra}>${d}</svg>`;
export const ICON = {
  search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>'),
  tris: svg('<path d="M12 3.5L21 19.5H3Z M12 3.5L12 19.5 M7.5 11.5L16.5 11.5"/>'),
  file: svg('<path d="M6 3.5h8l4.5 4.5v12.5H6Z M14 3.5V8h4.5"/>'),
  bones: svg('<path d="M7 7l10 10 M5.5 4.5a2 2 0 1 0-1 3l1-1 1 1a2 2 0 1 0-1-3Z M18.5 19.5a2 2 0 1 0 1-3l-1 1-1-1a2 2 0 1 0 1 3Z"/>'),
  morph: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2 M9 9.5v1 M15 9.5v1"/>'),
  anim: svg('<path d="M4 5.5h16v13H4Z M10 9v6l5-3Z"/>'),
  cube: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9Z M4 7.5l8 4.5 8-4.5 M12 12v9"/>'),
};

const badges = (s) => [
  s && s.joints ? `<i title="骨架 ${s.joints} 根骨頭">${ICON.bones}</i>` : '',
  s && s.morphs ? `<i title="形狀鍵 ${s.morphs} 組">${ICON.morph}</i>` : '',
  s && s.animations.length ? `<i title="動畫 ${s.animations.length} 段">${ICON.anim}</i>` : '',
].join('');

const cover = (m, posterOf, has, eager) => (has(posterOf(m))
  ? `<img src="${posterOf(m)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="1600" height="1000">`
  : `<span class="m3-blank" aria-hidden="true">${ICON.cube}<b>NO COVER</b></span>`);

// ---------- the gallery ----------
export function modelsBody(entry, { models, kinds, posterOf, kindOf, byDate }, scan, has) {
  const list = byDate(models);
  const tags = [...new Set(list.flatMap((m) => m.tags))];
  const count = (pred) => list.filter(pred).length;
  const cards = list.map((m, i) => {
    const s = scan[m.id], k = kindOf(m);
    return `
      <li class="m3-card" data-id="${m.id}" data-kind="${k.id}" data-date="${esc(m.date)}" data-tris="${s ? s.tris : 0}" data-bytes="${s ? s.bytes : 0}"
          data-name="${esc(m.title)}" data-tags="${esc(m.tags.join('|'))}" data-find="${esc([m.title, m.en, k.zh, ...m.tags, ...m.tools].join(' ').toLowerCase())}">
        <a class="m3-card__hit" href="/apps/models/${m.id}/">
          <span class="m3-card__img">${cover(m, posterOf, has, i < 4)}
            <span class="m3-card__kind">${esc(k.zh)}</span>
            <span class="m3-card__badges">${badges(s)}</span>
            <span class="m3-card__go" aria-hidden="true">檢視 3D<b>→</b></span>
          </span>
          <span class="m3-card__foot">
            <span class="m3-card__name"><strong>${esc(m.title)}</strong><span>${esc(m.en)}</span></span>
            <span class="m3-card__stats">${s ? `<span title="三角面">${ICON.tris}${short(s.tris)}</span><span title="檔案大小">${ICON.file}${mb(s.bytes)}</span>` : '<span>未掃描</span>'}<span title="日期">${esc(m.date.slice(0, 4))}</span></span>
          </span>
        </a>
      </li>`;
  }).join('');

  return `<div class="m3" id="m3">
  <header class="m3-head">
    <p class="pg-kicker">WORKS / 3D</p>
    <div class="m3-head__row">
      <h1 class="m3-h">${esc(entry.title)}<small>${esc(entry.en)}</small></h1>
      <p class="m3-count" aria-live="polite"><b data-m3="count">${two(list.length)}</b><span>/ ${two(list.length)} MODELS</span></p>
    </div>
    <p class="m3-lead">${esc(entry.desc)}</p>
  </header>

  <div class="m3-bar" role="search">
    <label class="m3-find">${ICON.search}<input type="search" data-m3="q" placeholder="搜尋名稱、標籤或工具" aria-label="搜尋 3D 作品" autocomplete="off"></label>
    <div class="m3-kinds" role="group" aria-label="分類" data-m3="kinds">
      <button type="button" data-kind="" aria-pressed="true">全部<i>${list.length}</i></button>${kinds.filter((k) => count((m) => kindOf(m).id === k.id)).map((k) => `
      <button type="button" data-kind="${k.id}" aria-pressed="false">${esc(k.zh)}<i>${count((m) => kindOf(m).id === k.id)}</i></button>`).join('')}
    </div>
    <label class="m3-sort"><span>排序</span><select data-m3="sort" aria-label="排序">
      <option value="new">最新</option><option value="old">最舊</option><option value="name">名稱</option><option value="tris">面數多到少</option><option value="small">檔案小到大</option>
    </select></label>
  </div>
  <div class="m3-tags" role="group" aria-label="標籤" data-m3="tags">${tags.map((t) => `<button type="button" data-tag="${esc(t)}" aria-pressed="false">#${esc(t)}<i>${count((m) => m.tags.includes(t))}</i></button>`).join('')}</div>

  <ul class="m3-grid" data-m3="grid">${cards}
  </ul>
  <p class="m3-empty" data-m3="empty" hidden>沒有符合條件的作品。<button type="button" data-m3="clear">清除條件</button></p>
  <p class="m3-note">每一件都在瀏覽器裡即時運算：點開可以旋轉、縮放、換成素模或線框看結構。面數、骨架與檔案大小是從模型檔本身算出來的。</p>
</div>`;
}

// ---------- one model ----------
export function modelBody(m, { models, posterOf, fileOf, kindOf, byDate }, scan, has) {
  const s = scan[m.id], k = kindOf(m), list = byDate(models), at = list.findIndex((x) => x.id === m.id);
  const prev = list[(at - 1 + list.length) % list.length], next = list[(at + 1) % list.length];
  const rows = s ? [
    ['三角面', num(s.tris)],
    ['頂點', num(s.verts)],
    ['網格', num(s.meshes)],
    ['材質', num(s.materials)],
    ['貼圖', s.textures ? `${s.textures} 張${s.maxTexture ? `，最大 ${s.maxTexture} px` : ''}` : '無'],
    ['骨架', s.joints ? `${s.joints} 根骨頭` : '無'],
    ['形狀鍵', s.morphs ? `${s.morphs} 組` : '無'],
    ['動畫', s.animations.length ? s.animations.map((a) => `${a.name}（${a.duration} 秒）`).join('、') : '無'],
    ['檔案', `${mb(s.bytes)} · glTF 2.0（GLB）`],
  ] : [['狀態', '尚未掃描：請執行 node tools/models-scan.mjs']];
  rows.push(['製作', m.tools.join('、')], ['日期', m.date]);
  const others = list.filter((x) => x.id !== m.id).slice(0, 4);
  const view = { ...(m.view || {}) };

  return `<div class="m3v" id="m3v" data-model="${m.id}">
  <nav class="m3v-crumbs" aria-label="位置">
    <a href="/apps/models/">3D 作品</a><i aria-hidden="true">/</i><span>${esc(m.title)}</span>
    <span class="m3v-step">${list.length > 1 ? `<a href="/apps/models/${prev.id}/" aria-label="上一件：${esc(prev.title)}">‹ 上一件</a><a href="/apps/models/${next.id}/" aria-label="下一件：${esc(next.title)}">下一件 ›</a>` : ''}</span>
  </nav>

  <section class="m3v-stage" data-m3v="stage" aria-label="3D 檢視器：${esc(m.title)}">
    <div class="m3v-poster" aria-hidden="true">${has(posterOf(m)) ? `<img src="${posterOf(m)}" alt="" decoding="async" fetchpriority="high">` : ''}</div>
    <canvas class="m3v-canvas" data-m3v="canvas" tabindex="0" aria-label="${esc(m.title)} 的 3D 模型。拖曳旋轉，滾輪縮放，方向鍵平移"></canvas>
    <div class="m3v-load" data-m3v="load" role="status">
      <p data-m3v="msg">載入模型</p>
      <i><b data-m3v="bar"></b></i>
      <span data-m3v="bytes">${s ? `0 / ${mb(s.bytes)}` : ''}</span>
    </div>
    <div class="m3v-tools" role="toolbar" aria-label="檢視工具" data-m3v="tools" hidden>
      <div class="m3v-tools__row">
        <button type="button" data-act="spin" aria-pressed="false" title="自動旋轉（A）">自動旋轉</button>
        <button type="button" data-act="reset" title="重置視角（R）">重置</button>
      </div>
      <div class="m3v-tools__row" role="radiogroup" aria-label="顯示方式" data-group="mode">
        <button type="button" role="radio" data-mode="flat" aria-checked="false" title="不受光影響，只有貼圖本身的顏色">無光影</button>
        <button type="button" role="radio" data-mode="material" aria-checked="false">材質</button>
        <button type="button" role="radio" data-mode="clay" aria-checked="false">素模</button>
        <button type="button" role="radio" data-mode="wire" aria-checked="false">線框</button>
        <button type="button" role="radio" data-mode="normal" aria-checked="false">法線</button>
      </div>
      <div class="m3v-tools__row" role="radiogroup" aria-label="光線" data-group="light">
        <button type="button" role="radio" data-light="studio" aria-checked="false">攝影棚</button>
        <button type="button" role="radio" data-light="dusk" aria-checked="false">黃昏</button>
        <button type="button" role="radio" data-light="night" aria-checked="false">夜晚</button>
      </div>
      <div class="m3v-tools__row">
        <button type="button" data-act="bg" title="切換背景（B）">背景</button>
        <button type="button" data-act="full" title="全螢幕（F）">全螢幕</button>
      </div>
    </div>
    <p class="m3v-hint" data-m3v="hint" hidden><span class="m3v-mouse">拖曳旋轉 · 右鍵拖曳平移 · 滾輪縮放 · 雙擊對焦</span><span class="m3v-touch">單指旋轉 · 雙指平移與縮放 · 點兩下對焦</span></p>
    <div class="m3v-dev" data-m3v="dev" hidden>
      <button type="button" data-act="poster">設為封面</button>
      <button type="button" data-act="camera">複製視角</button>
      <span data-m3v="devmsg">只在本機預覽出現</span>
    </div>
  </section>

  <div class="m3v-body">
    <div class="m3v-main">
      <p class="pg-kicker">3D WORKS / ${esc(k.en)} · ${esc(m.date.slice(0, 4))}</p>
      <h1 class="m3v-title">${esc(m.title)}<small>${esc(m.en)}</small></h1>
      <div class="m3v-desc">${m.desc.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      ${m.links && m.links.length ? `<p class="m3v-links">${m.links.map((l) => `<a class="hm-cta" href="${esc(l.href)}">${esc(l.label)}<b aria-hidden="true">→</b></a>`).join('')}</p>` : ''}
      <ul class="m3v-tags">${m.tags.map((t) => `<li><a href="/apps/models/?tag=${encodeURIComponent(t)}">#${esc(t)}</a></li>`).join('')}</ul>
      <section class="m3v-panel" data-m3v="morphs" hidden aria-labelledby="m3v-morphs-h">
        <h2 id="m3v-morphs-h">形狀鍵<small>SHAPE KEYS</small></h2>
        <div class="m3v-sliders" data-m3v="sliders"></div>
      </section>
      <section class="m3v-panel" data-m3v="anims" hidden aria-labelledby="m3v-anims-h">
        <h2 id="m3v-anims-h">動畫<small>ANIMATION</small></h2>
        <div class="m3v-clips" data-m3v="clips"></div>
      </section>
    </div>
    <aside class="m3v-side" aria-labelledby="m3v-info-h">
      <h2 id="m3v-info-h">模型資訊<small>MODEL INFO</small></h2>
      <dl class="m3v-stats">${rows.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
    </aside>
  </div>

  ${others.length ? `<section class="m3v-more" aria-labelledby="m3v-more-h">
    <h2 id="m3v-more-h">其他作品<small>MORE</small></h2>
    <ul class="m3-grid m3-grid--small">${others.map((o) => {
      const os = scan[o.id];
      return `
      <li class="m3-card"><a class="m3-card__hit" href="/apps/models/${o.id}/">
        <span class="m3-card__img">${cover(o, posterOf, has, false)}<span class="m3-card__kind">${esc(kindOf(o).zh)}</span><span class="m3-card__badges">${badges(os)}</span></span>
        <span class="m3-card__foot"><span class="m3-card__name"><strong>${esc(o.title)}</strong><span>${esc(o.en)}</span></span>
        <span class="m3-card__stats">${os ? `<span>${ICON.tris}${short(os.tris)}</span>` : ''}<span>${esc(o.date.slice(0, 4))}</span></span></span>
      </a></li>`;
    }).join('')}
    </ul>
  </section>` : ''}
  <script type="application/json" data-m3v="data">${JSON.stringify({ id: m.id, file: fileOf(m), kind: k.id, view, bytes: s ? s.bytes : 0 }).replace(/</g, '\\u003c')}</script>
</div>`;
}
