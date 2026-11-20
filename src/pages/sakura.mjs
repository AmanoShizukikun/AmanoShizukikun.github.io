// Markup of the Nagato Sakura Project page (used by tools/build.mjs; behaviour in assets/js/pages/sakura.js,
// content in assets/js/data/sakura.js).
// The page sits on chapter 05 of the home timeline: scrolling gathers the particles into her figure, the copy is
// read in front of it, and the last screen flips the frame to the yellow poster.
//   00 file      01 premise + dispatch diagram      02 language core + layer stack
//   03 image restoration (before / after)      04 jobs (one module, one outfit)      05 timeline      06 to be continued
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (i) => String(i).padStart(2, '0');
const ext = 'target="_blank" rel="noopener noreferrer"';

// 01 — dispatch diagram: the core on the left, one node per module on the right
function dispatch(modules) {
  const W = 560, H = 344, cx = 92, cy = H / 2, x1 = 372, top = 26, step = (H - top * 2) / (modules.length - 1);
  const nodes = modules.map((m, i) => ({ m, y: top + i * step }));
  return `<svg class="ns-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="語言核心與各個工具模組之間的調度關係圖">
          <g class="ns-map__lines">${nodes.map(({ m, y }) => `
            <path data-line="${m.id}" d="M${cx + 46} ${cy} C ${cx + 150} ${cy}, ${x1 - 120} ${y}, ${x1 - 8} ${y}"/>`).join('')}
          </g>
          <g class="ns-map__core">
            <circle cx="${cx}" cy="${cy}" r="46"/><circle cx="${cx}" cy="${cy}" r="58" class="ns-map__ring"/>
            <text x="${cx}" y="${cy - 5}" text-anchor="middle" class="ns-map__t1">長門櫻</text>
            <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="ns-map__t2">LLM CORE</text>
          </g>${nodes.map(({ m, y }) => `
          <g class="ns-map__node" data-node="${m.id}">
            <rect x="${x1}" y="${y - 15}" width="${W - x1 - 4}" height="30"/>
            <text x="${x1 + 12}" y="${y + 4}" class="ns-map__t3">${esc(m.code)}</text>
            <text x="${W - 16}" y="${y + 5}" text-anchor="end" class="ns-map__t4">${esc(m.name)}</text>
          </g>`).join('')}
        </svg>`;
}

export function sakuraBody({ modules, branches, routes, core, models, timeline, links }) {
  const m0 = models[0];
  const sections = [['序', 'FILE'], ['構想', 'PREMISE'], ['語言核心', 'LANGUAGE CORE'], ['影像', 'IMAGE RESTORATION'], ['職能', 'ONE MAID, MANY JOBS'], ['軌跡', 'TIMELINE'], ['接續', 'TO BE CONTINUED']];
  const head = (i) => `<h2 class="ns-h" id="ns-h${i}"><i>${two(i)}</i><span>${sections[i][0]}</span><small>${sections[i][1]}</small></h2>`;
  return `<div class="ns" id="ns">
  <div class="ns-scrim" aria-hidden="true"></div>

  <!-- instruments: values are written by assets/js/pages/sakura.js -->
  <div class="ns-hud" aria-hidden="true">
    <div class="hud hud-bl"><b data-ns="pct">000.0</b><span>% FILE</span></div>
    <div class="hud hud-br"><span>SUBJECT — NS-001</span><span data-ns="phase">PHASE — GATHERING</span></div>
  </div>

  <nav class="hm-rail ns-rail" aria-label="長門櫻計畫章節">${sections.map(([zh], i) => `
    <a href="#ns-${i}"><i>${two(i)}</i><span>${zh}</span></a>`).join('')}
  </nav>

  <div class="ns-doc">
    <!-- 00 FILE -->
    <header class="ns-sec ns-hero" id="ns-0" data-sec>
      <p class="pg-kicker">PROJECT FILE / NS-001</p>
      <h1 class="ns-title"><span>長門櫻</span><span>計畫</span><small>NAGATO SAKURA PROJECT</small></h1>
      <p class="ns-lead">創造理想的智能女僕。以語言模型為大腦、以一群各司其職的小模型為手腳——她從一行一行的程式裡，慢慢長出自己的樣子。</p>
      <dl class="ns-stats">
        <div><dt>SINCE</dt><dd>2021</dd></div>
        <div><dt>MODULES</dt><dd>${two(modules.length)}</dd></div>
        <div><dt>CORE</dt><dd>NSLM-2<small>89.3M</small></dd></div>
        <div><dt>STATUS</dt><dd class="ns-ok">ACTIVE</dd></div>
      </dl>
      <p class="ns-go"><a class="hm-cta" href="${links.list}" ${ext}>GitHub 專案清單<b aria-hidden="true">↗</b></a><a class="hm-cta" href="/apps/nijigen/#sakura">她的世界觀<b aria-hidden="true">→</b></a></p>
      <p class="ns-coh" aria-hidden="true"><span>COHERENCE</span><b data-ns="coh">000</b><i></i><em>SCROLL ↓</em></p>
    </header>

    <!-- 01 PREMISE -->
    <section class="ns-sec" id="ns-1" data-sec aria-labelledby="ns-h1">
      ${head(1)}
      <div class="ns-premise">
        <div class="ns-copy">
          <p class="ns-quote">不管是語音、文字，還是丟一個檔案給她——叫她一聲，她就去把事情辦好。</p>
          <p>長門櫻計畫的目標，是一位萬能的女僕。做法不是訓練一個什麼都會的巨大模型，而是讓<b>語言模型當大腦</b>，負責聽懂你要什麼；再透過<b>工具調用</b>，把工作交給各自專精的小模型去完成。</p>
          <p>於是一句話就能驅動整個生態系：她判斷意圖、決定該找誰、把結果帶回來。</p>
        </div>
        <div class="ns-route" data-ns="route">
          <p class="ns-cap">DISPATCH<span>選一句話，看她會找誰</span></p>
          <ul class="ns-route__say">${routes.map((r, i) => `
            <li><button type="button" data-route="${i}" aria-pressed="${i === 0}">${esc(r.say)}</button></li>`).join('')}
          </ul>
          <div class="ns-route__map">
        ${dispatch(modules)}
          </div>
          <ol class="ns-route__log" data-ns="route-log" aria-live="polite">${routes[0].steps.map(([tag, text]) => `<li><b>${esc(tag)}</b><span>${esc(text)}</span></li>`).join('')}</ol>
          <p class="ns-note">示意圖：呈現「語言模型判斷意圖後呼叫工具」的流程，不是連線中的模型。</p>
        </div>
      </div>
    </section>

    <!-- 02 LANGUAGE CORE -->
    <section class="ns-sec" id="ns-2" data-sec aria-labelledby="ns-h2">
      ${head(2)}
      <div class="ns-core">
        <div class="ns-copy">
          <p>大腦是可以換的。日常對話接的是開源的大模型（GLM-4、Qwen3，以 NF4 量化在單張顯示卡上執行）；另一條線，是從零開始訓練一個完全屬於她的語言模型。</p>
          <p><b>NS-LM</b> 是標準的 Pre-Norm Decoder-only Transformer，目標是架構透明、依賴極少、一個人就能掌控整條訓練與推論鏈路。第二代 <b>NSLM-2</b> 專注在繁體中文（台灣）的角色扮演與陪伴聊天，而且要能在一塊只有 2 GB 記憶體的開發板上跑起來。</p>
          <div class="ns-gens">${core.gens.map((g) => `
            <article class="ns-gen" data-gen="${g.id}">
              <h3>${esc(g.name)}<span class="ns-state ns-state--${g.tone}">${esc(g.state)}</span></h3>
              <dl>${g.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${g.links.length ? `
              <p class="ns-gen__links">${g.links.map(([label, href]) => `<a href="${href}" ${ext}>${esc(label)} ↗</a>`).join('')}</p>` : ''}
            </article>`).join('')}
          </div>
        </div>
        <div class="ns-stack" data-ns="stack">
          <p class="ns-cap">NSLM-2-90M<span>${core.layers} LAYERS × 512</span></p>
          <ol class="ns-stack__layers" aria-hidden="true">${Array.from({ length: core.layers }, (_, i) => `<li style="--i:${i}"></li>`).join('')}</ol>
          <ul class="ns-parts">${core.parts.map((p, i) => `
            <li><button type="button" data-part="${i}" aria-pressed="${i === 0}"><b>${esc(p.name)}</b><span>${esc(p.zh)}</span><i>${p.in.includes('v1') ? '1.x' : ''}${p.in.length > 1 ? ' · ' : ''}${p.in.includes('v2') ? '2' : ''}</i></button></li>`).join('')}
          </ul>
          <p class="ns-stack__note" data-ns="part-note" aria-live="polite">${esc(core.parts[0].note)}</p>
        </div>
      </div>
      <div class="ns-edge">
        <p class="ns-cap">ON THE BOARD<span>${esc(core.edge.board)} — ${esc(core.edge.format)}</span></p>
        <dl>${core.edge.rows.map(([n, unit, label]) => `<div><dd>${esc(n)}<small>${esc(unit)}</small></dd><dt>${esc(label)}</dt></div>`).join('')}</dl>
      </div>
    </section>

    <!-- 03 IMAGE RESTORATION -->
    <section class="ns-sec" id="ns-3" data-sec aria-labelledby="ns-h3">
      ${head(3)}
      <p class="ns-intro">影像魅影（Image Charm）是她的眼睛與手：把被壓縮、被打碎的畫面修回來。三個模型系列各有名字與職責——拖動中線，比較修復前後。</p>
      <div class="ns-cmp" data-ns="cmp">
        <div class="ns-cmp__tabs" role="tablist" aria-label="修復模型">${models.map((m, i) => `
          <button type="button" role="tab" id="ns-tab-${m.id}" data-model="${i}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}"><i>${two(i + 1)}</i>${esc(m.name)}<small>${esc(m.en)}</small></button>`).join('')}
        </div>
        <div class="ns-cmp__stage" data-ns="cmp-stage" style="--x:50%;--z:2;--fx:${m0.focus[0]}%;--fy:${m0.focus[1]}%">
          <div class="ns-cmp__layer"><img data-ns="cmp-off" src="/assets/img/sakura/${m0.id}-off.webp" alt="${esc(m0.name)}：修復前" width="1280" height="624" loading="lazy" decoding="async" draggable="false"></div>
          <div class="ns-cmp__layer ns-cmp__layer--on"><img data-ns="cmp-on" src="/assets/img/sakura/${m0.id}-on.webp" alt="${esc(m0.name)}：修復後" width="1280" height="624" loading="lazy" decoding="async" draggable="false"></div>
          <span class="ns-cmp__tag">OFF<small>原圖</small></span><span class="ns-cmp__tag ns-cmp__tag--on">ON<small>修復後</small></span>
          <div class="ns-cmp__bar" aria-hidden="true"><i>◂ ▸</i></div>
          <input type="range" class="ns-cmp__range" data-ns="cmp-range" min="0" max="100" value="50" aria-label="修復前後的分界位置">
        </div>
        <div class="ns-cmp__side">
          <p class="ns-cmp__name"><span data-ns="cmp-name">${esc(m0.name)}</span><small data-ns="cmp-en">${esc(m0.en)}</small></p>
          <p class="ns-cmp__line" data-ns="cmp-line">${esc(m0.line)}</p>
          <dl class="ns-cmp__meta" data-ns="cmp-meta"><div><dt>適用</dt><dd>${esc(m0.use)}</dd></div><div><dt>版本</dt><dd>${esc(m0.ver)}</dd></div><div><dt>訓練參數</dt><dd>${esc(m0.train)}</dd></div><div><dt>型號</dt><dd>${m0.variants.map(esc).join(' · ')}</dd></div></dl>
          <div class="ns-cmp__zoom" role="group" aria-label="放大倍率"><span>ZOOM</span>${[1, 2, 3].map((z) => `<button type="button" data-zoom="${z}" aria-pressed="${z === 2}">×${z}</button>`).join('')}</div>
          <p class="ns-cmp__more"><a data-ns="cmp-link" href="${m0.href}" ${ext}>模型與說明 ↗</a></p>
        </div>
      </div>
    </section>

    <!-- 04 JOBS -->
    <section class="ns-sec ns-pin" id="ns-4" data-sec data-ns="pin" aria-labelledby="ns-h4">
      <div class="ns-pin__in">
        ${head(4)}
        <p class="ns-intro">每個分支都是她的一種職能，也各有一套自己的制服。插圖來自各個專案的發行頁。</p>
        <div class="ns-strip" data-ns="strip">
          <ol class="ns-strip__track" data-ns="track">${modules.map((m, i) => `
            <li class="ns-role" id="ns-role-${m.id}">
              <figure><img src="/assets/img/${m.img}" alt="${esc(m.alt)}" width="1120" height="560" loading="lazy" decoding="async"></figure>
              <div class="ns-role__body">
                <p class="ns-role__job"><b>${two(i + 1)}</b><span>${esc(m.job)}</span><i>${esc(m.code)}</i></p>
                <h3>${esc(m.name)}<small>${esc(m.en)}</small></h3>
                <p class="ns-role__desc">${esc(m.desc)}</p>
                <p class="ns-role__facts">${m.facts.map((f) => `<i>${esc(f)}</i>`).join('')}</p>
                <p class="ns-role__foot"><span>v${esc(m.ver)} · ${esc(m.date)}</span><a href="${m.href}" ${ext} aria-label="${esc(m.name)} 的 GitHub 倉庫">GitHub ↗</a></p>
              </div>
            </li>`).join('')}
          </ol>
        </div>
        <p class="ns-strip__bar" aria-hidden="true"><i></i></p>
      </div>
    </section>
    <ul class="ns-branches" aria-label="其他分支">
      <li class="ns-branches__cap">OTHER BRANCHES</li>${branches.map((b) => `
      <li><a href="${b.href}" ${ext}><b>${esc(b.repo)}</b><span>${esc(b.note)}</span></a></li>`).join('')}
    </ul>

    <!-- 05 TIMELINE -->
    <section class="ns-sec" id="ns-5" data-sec aria-labelledby="ns-h5">
      ${head(5)}
      <ol class="ns-time" data-ns="time">${timeline.map((t) => `
        <li><span class="ns-time__when">${esc(t.when)}</span><div><h3>${esc(t.title)}</h3><p>${esc(t.note)}</p></div></li>`).join('')}
      </ol>
    </section>

    <!-- 06 TO BE CONTINUED — the frame flips to the poster -->
    <section class="ns-sec ns-end" id="ns-6" data-sec aria-label="接續">
      <p class="pg-kicker">TO BE CONTINUED / 06</p>
      <p class="ns-end__line">她還在長大。</p>
      <p class="ns-end__sub">語言核心還在訓練，新的職能還在路上。目前公開的程式碼與模型都在這裡：</p>
      <ul class="ns-links">
        <li><a href="${links.list}" ${ext}><b>GitHub</b><span>長門櫻計畫 專案清單</span><i aria-hidden="true">↗</i></a></li>
        <li><a href="${links.hf}" ${ext}><b>Hugging Face</b><span>已發布的模型權重</span><i aria-hidden="true">↗</i></a></li>
        <li><a href="/apps/nijigen/"><b>LORE</b><span>世界觀：常夜界的檔案</span><i aria-hidden="true">→</i></a></li>
        <li><a href="/apps/live2d/#ns-v5"><b>LIVE2D</b><span>看她的 Live2D 模型</span><i aria-hidden="true">→</i></a></li>
      </ul>
      <p class="ns-next"><a class="hm-cta" href="/works/">回到作品<b aria-hidden="true">→</b></a></p>
    </section>
  </div>
</div>`;
}
