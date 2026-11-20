// Markup of the Live2D works page (used by tools/build.mjs; behaviour in assets/js/pages/live2d.js,
// content in assets/js/data/live2d.js).
// The models run live on a stage that stays on screen; the copy scrolls past it, and each section asks the
// stage for a different view of the same model (data-shot):
//   00 序 — she stands there and looks at the pointer        01 檔案 — the three models, one file each
//   02 拆圖 sheet — every part back on its texture atlas      03 網格 mesh — the triangles
//   04 層次 fan — the draw order pulled apart                 05 參數 bust — X / Y / Z, then every slider
//   06 物理 full — the pendulums                              07 軌跡 — where it started      08 接續
// Without WebGL (or JavaScript) the stage is absent and the page reads as a document with a capture per model.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (i) => String(i).padStart(2, '0');
const num = (n) => Number(n).toLocaleString('en-US');

export function live2dBody({ models, faces, timeline, rules }) {
  const sections = [['序', 'LIVE'], ['檔案', 'FILES'], ['拆圖', 'PARTS'], ['網格', 'MESH'], ['層次', 'LAYERS'], ['參數', 'PARAMETERS'], ['物理', 'PHYSICS'], ['軌跡', 'ORIGIN'], ['接續', 'STAY']];
  const head = (i) => `<h2 class="l2-h" id="l2-h${i}"><i>${two(i)}</i><span>${sections[i][0]}</span><small>${sections[i][1]}</small></h2>`;
  const m0 = models[0];
  const probe = (hint) => `<div class="l2-probe" data-l2="probe">
        <p class="l2-probe__hint"><span class="l2-mouse">${hint[0]}</span><span class="l2-touch">${hint[1]}</span></p>
        <dl><div><dt>零件</dt><dd data-p="id">—</dd></div><div><dt>頂點</dt><dd data-p="verts">—</dd></div><div><dt>三角形</dt><dd data-p="tris">—</dd></div><div><dt>繪製順序</dt><dd data-p="order">—</dd></div></dl>
      </div>`;

  return `<div class="l2" id="l2">
  <div class="l2-scrim" aria-hidden="true"></div>

  <!-- the stage: one canvas, drawn by assets/js/live2d/stage.js. .l2-frame is where the model stands (CSS decides). -->
  <div class="l2-stage" aria-hidden="true">
    <div class="l2-plate"></div>
    <canvas class="l2-canvas" data-l2="canvas"></canvas>
    <div class="l2-frame" data-l2="frame"></div>
    <p class="l2-tag"><b data-l2="tag-code">${esc(m0.code)}</b><span data-l2="tag-view">LIVE</span></p>
    <p class="l2-load" data-l2="load">LOADING</p>
  </div>

  <div class="l2-cast" role="group" aria-label="選擇舞台上的模型">${models.map((m, i) => `
    <button type="button" data-model="${i}" aria-pressed="${i ? 'false' : 'true'}"><i>${two(i + 1)}</i><b>${esc(m.code)}</b><span>${esc(m.name)}</span></button>`).join('')}
  </div>

  <nav class="hm-rail l2-rail" aria-label="Live2D 作品章節">${sections.map(([zh], i) => `
    <a href="#l2-${i}"><i>${two(i)}</i><span>${zh}</span></a>`).join('')}
  </nav>

  <div class="l2-doc">
    <!-- 00 LIVE -->
    <header class="l2-sec l2-hero" id="l2-0" data-sec data-shot="full">
      <p class="pg-kicker">CODE WL2D / LIVE2D WORKS</p>
      <h1 class="l2-title"><span>把一張畫</span><span>叫醒</span><small>LIVE2D 作品</small></h1>
      <p class="l2-lead">Live2D 不重畫任何一格。它把一張圖拆成零件，替每個零件鋪上網格，再用幾十個參數去拉動它們——於是她會轉頭、眨眼，頭髮會慢半拍跟上。這裡是我做的模型，每一個都是當場運算出來的，不是影片。</p>
      <dl class="l2-stats">
        <div><dt>MODELS</dt><dd>${two(models.length)}</dd></div>
        <div><dt>SINCE</dt><dd>2021</dd></div>
        <div class="l2-live-only"><dt>RENDER</dt><dd class="l2-ok">REALTIME</dd></div>
      </dl>
      <p class="l2-p l2-static-only">這個瀏覽器沒有啟動 WebGL（或 JavaScript），所以這裡只有靜態畫面：模型不會動，也不能拆開。</p>
      <p class="l2-hint l2-live-only"><span class="l2-mouse">移動游標，她會看著你。點她一下試試。</span><span class="l2-touch">點畫面任何一處，她會看過去。點她本人試試。</span></p>
      <p class="l2-go"><a class="hm-cta" href="#l2-1">看三個模型<b aria-hidden="true">↓</b></a><a class="hm-cta" href="#l2-2">把她拆開<b aria-hidden="true">↓</b></a></p>
    </header>

    <!-- 01 FILES -->
    <section class="l2-sec" id="l2-1" data-sec data-shot="file" aria-labelledby="l2-h1">
      ${head(1)}
      <p class="l2-say">三個模型，<br>三個不同的起點。</p>
      <p class="l2-p l2-live-only">選一個，舞台上就換成她。之後每一段拆的、動的，都是你選的這一個。</p>
      <ol class="l2-files">${models.map((m, i) => `
        <li class="l2-file${i ? '' : ' is-on'}" id="${m.id}" data-file="${i}">
          <button type="button" class="l2-file__hit" data-model="${i}" aria-pressed="${i ? 'false' : 'true'}">
            <i>${two(i + 1)}</i><strong>${esc(m.code)}</strong><span>${esc(m.name)}<small>${esc(m.ver)}</small></span>
          </button>
          <div class="l2-file__body"><div>
            <img class="l2-file__img" src="/assets/img/live2d/${m.id}.webp" alt="${esc(m.code)} ${esc(m.name)} 的模型畫面" loading="lazy" decoding="async" width="720" height="1080">
            <p class="l2-file__line">${esc(m.line)}</p>
            <p class="l2-file__desc">${esc(m.desc)}</p>
            <dl class="l2-file__credits">${m.credits.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
            <dl class="l2-nums">
              <div><dt>零件</dt><dd>${num(m.stats.meshes)}</dd></div><div><dt>頂點</dt><dd>${num(m.stats.verts)}</dd></div><div><dt>三角形</dt><dd>${num(m.stats.tris)}</dd></div>
              <div><dt>參數</dt><dd>${num(m.stats.params)}</dd></div><div><dt>物理</dt><dd>${num(m.stats.physics)}</dd></div><div><dt>畫布</dt><dd>${m.stats.canvas.join(' × ')}</dd></div>
            </dl>${m.outfits ? `
            <p class="l2-outfit l2-live-only"><span>服裝</span>${m.outfits.map(([label, v], k) => `<button type="button" data-outfit="${v}" aria-pressed="${k ? 'false' : 'true'}">${esc(label)}</button>`).join('')}</p>` : ''}
          </div></div>
        </li>`).join('')}
      </ol>
    </section>

    <!-- 02 PARTS -->
    <section class="l2-sec" id="l2-2" data-sec data-shot="sheet" aria-labelledby="l2-h2">
      ${head(2)}
      <p class="l2-say">在會動之前，<br>她是一張被拆開的圖。</p>
      <p class="l2-p"><b data-l2="n-meshes">${num(m0.stats.meshes)}</b> 個零件，排在一張 <b data-l2="n-atlas">${m0.atlas} × ${m0.atlas}</b> 的貼圖上。<span class="l2-live-only">右邊就是那張貼圖——剛才的她，每一塊都在這裡。</span></p>
      <ol class="l2-rules">${rules.map(([t, d], i) => `
        <li><i>${two(i + 1)}</i><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}
      </ol>
      <p class="l2-note l2-live-only">往回捲，零件會一塊一塊飛回她身上。</p>
    </section>

    <!-- 03 MESH -->
    <section class="l2-sec" id="l2-3" data-sec data-shot="mesh" aria-labelledby="l2-h3">
      ${head(3)}
      <p class="l2-say">會動的不是圖，<br>是網格。</p>
      <p class="l2-p">每個零件都鋪上一張三角網格。參數移動的是網格的頂點；圖只是貼在上面，跟著被拉開、擠壓。</p>
      <dl class="l2-nums l2-nums--lg">
        <div><dt>頂點</dt><dd data-l2="n-verts">${num(m0.stats.verts)}</dd></div><div><dt>三角形</dt><dd data-l2="n-tris">${num(m0.stats.tris)}</dd></div>
      </dl>
      ${probe(['把游標移到她身上，看那一塊零件的網格。', '點她身上任何一處，看那一塊零件的網格。'])}
    </section>

    <!-- 04 LAYERS -->
    <section class="l2-sec" id="l2-4" data-sec data-shot="fan" aria-labelledby="l2-h4">
      ${head(4)}
      <p class="l2-say">把她側過來，<br>是一疊紙。</p>
      <p class="l2-p">零件沒有前後的深度，只有先畫、後畫的順序：後髮先畫，五官和瀏海後畫。把這個順序往旁邊拉開，就看得到每一層。</p>
      <p class="l2-p">有些層只在另一層的範圍裡出現——眼球只畫在眼白裡，所以眼睛怎麼轉，都不會跑到臉上。這個模型有 <b data-l2="n-masked">${num(m0.stats.masked)}</b> 個零件是這樣被剪裁的。</p>
      ${probe(['把游標移到任何一層上。', '點任何一層。'])}
    </section>

    <!-- 05 PARAMETERS -->
    <section class="l2-sec" id="l2-5" data-sec data-shot="bust" aria-labelledby="l2-h5">
      ${head(5)}
      <p class="l2-say">參數是她的關節。</p>
      <p class="l2-p">一個參數只管一件事：頭往左右轉、眼睛開合、嘴角上揚。建模的工作，就是替每個參數的兩端各擺好一次網格，中間交給內插。</p>
      <ol class="l2-axes l2-live-only" data-l2="axes">
        <li data-axis="x"><b>X</b><span>左右轉</span><i></i></li>
        <li data-axis="y"><b>Y</b><span>上下</span><i></i></li>
        <li data-axis="z"><b>Z</b><span>傾斜</span><i></i></li>
      </ol>
      <p class="l2-note l2-live-only">捲過這三行，她會依序轉給你看；往回捲就倒著轉。</p>
      <div class="l2-panel l2-live-only" data-l2="panel">
        <p class="l2-panel__h"><b>換你來</b><span><i data-l2="n-params">${num(m0.stats.params)}</i> 個參數，這裡列出能直接拉的</span></p>
        <div class="l2-faces" role="group" aria-label="表情">${faces.map((f, i) => `<button type="button" data-face="${f.id}" aria-pressed="${i ? 'false' : 'true'}">${esc(f.name)}</button>`).join('')}</div>
        <div class="l2-sliders" data-l2="sliders"></div>
        <p class="l2-panel__foot"><button type="button" data-act="reset">全部歸零</button></p>
      </div>
    </section>

    <!-- 06 PHYSICS -->
    <section class="l2-sec" id="l2-6" data-sec data-shot="full" aria-labelledby="l2-h6">
      ${head(6)}
      <p class="l2-say">剩下的，<br>交給重力。</p>
      <p class="l2-p">頭髮、耳朵、尾巴、裙擺沒有人在控制。它們是掛在身上的擺錘：身體一動，它們慢半拍跟上，晃幾下才停。<span class="l2-live-only">下面每一根，都是她身上正在算的那一組。</span></p>
      <div class="l2-phys l2-live-only">
        <ul class="l2-pend" data-l2="pend"></ul>
        <p class="l2-phys__go">
          <button type="button" class="hm-cta" data-act="push">推她一下<b aria-hidden="true">→</b></button>
          <label class="l2-wind"><span>風</span><input type="range" data-l2="wind" min="-1" max="1" step="0.01" value="0" aria-label="風向與風力"></label>
        </p>
      </div>
      <p class="l2-note l2-live-only">捲動也算數：這一段捲得越快，風越大。</p>
    </section>

    <!-- 07 ORIGIN -->
    <section class="l2-sec" id="l2-7" data-sec data-shot="full" aria-labelledby="l2-h7">
      ${head(7)}
      <p class="l2-say">這一頁的前身，<br>是高中時寫的教學網站。</p>
      <ol class="l2-time" data-l2="time">${timeline.map((t) => `
        <li><span class="l2-time__when">${esc(t.when)}</span><div><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p>${t.link ? `<p class="l2-time__more"><a href="${esc(t.link.href)}" target="_blank" rel="noopener noreferrer">${esc(t.link.label)} ↗</a>${t.link.note ? `<span>${esc(t.link.note)}</span>` : ''}</p>` : ''}</div></li>`).join('')}
      </ol>
    </section>

    <!-- 08 STAY -->
    <section class="l2-sec l2-end" id="l2-8" data-sec data-shot="full" aria-labelledby="l2-h8">
      <p class="pg-kicker">08 — 接續 / STAY</p>
      <h2 class="l2-end__h" id="l2-h8">她可以<br>留下來。</h2>
      <p class="l2-p">啟用看板娘，她會待在每一頁的角落，換頁也不會消失。<span class="l2-live-only">（在這一頁她已經站在舞台上，所以角落那個先讓開。）</span></p>
      <p class="l2-go"><button type="button" class="hm-cta" data-act="mascot" aria-pressed="false"><span>啟用看板娘</span><b aria-hidden="true">→</b></button></p>
      <ul class="l2-links">
        <li><a href="/apps/nagato-sakura/"><b>PROJECT</b><span>長門櫻計畫</span><i aria-hidden="true">→</i></a></li>
        <li><a href="/apps/nijigen/"><b>LORE</b><span>世界觀：常夜界的檔案</span><i aria-hidden="true">→</i></a></li>
        <li><a href="/apps/ns-room/"><b>3D</b><span>長門櫻的房間</span><i aria-hidden="true">→</i></a></li>
        <li><a href="/works/"><b>ARCHIVE</b><span>回到作品</span><i aria-hidden="true">→</i></a></li>
      </ul>
    </section>
  </div>
</div>`;
}
