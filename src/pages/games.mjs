// Markup of the game centre (used by tools/build.mjs; behaviour in assets/js/pages/games.js).
// The game centre is a library that manages its games:
//   library view — a featured banner that cycles through the games, category tabs, sort / filter, a grid of cards
//   detail view  — captures on one side; title, description, data, favourite and the launch button on the other
//   footer       — the controls for whichever device was used last (keyboard or gamepad)
// Without JavaScript the cards are plain links to the games.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (i) => String(i).padStart(2, '0');
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 4.6 13a4.7 4.7 0 0 1 6.65-6.65l.75.75.75-.75A4.7 4.7 0 0 1 19.4 13Z"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>';

export function gamesBody(hub, gameCats) {
  const catLabel = (c) => (gameCats.find(([id]) => id === c) || [c, c])[1];
  const g0 = hub.items[0], n = hub.items.length;
  return `<div class="gc" id="gc" data-view="lib">
  <div class="gc-lib" data-gc="lib">
    <section class="gc-hero" data-gc="hero" aria-roledescription="carousel" aria-label="精選遊戲">
      <div class="gc-hero__media" aria-hidden="true">${hub.items.map((g, i) => `<img${i ? '' : ' class="is-on"'} src="/assets/img/${g.img}" alt="" decoding="async" width="1280" height="800"${i ? ' loading="lazy"' : ''}>`).join('')}</div>
      <div class="gc-hero__copy">
        <p class="pg-kicker"><span class="gc-wide">${esc(hub.en)} — </span>FEATURED <b data-gc="hero-no">01</b> / ${two(n)}</p>
        <h2 class="gc-hero__title" data-gc="hero-title">${esc(g0.title)}</h2>
        <p class="gc-hero__en" data-gc="hero-en">${esc(g0.en)}</p>
        <p class="gc-hero__desc" data-gc="hero-desc">${esc(g0.desc)}</p>
        <p class="gc-hero__go"><a class="gc-play" data-gc="hero-play" href="/apps/${g0.id}/">啟動遊戲<b aria-hidden="true">→</b></a><button type="button" class="gc-ghost" data-act="hero-info">詳細資料</button></p>
      </div>
      <ol class="gc-hero__dots">${hub.items.map((g, i) => `<li><button type="button" data-hero="${i}" aria-label="精選：${esc(g.title)}"${i ? '' : ' aria-current="true"'}><i></i></button></li>`).join('')}</ol>
    </section>

    <header class="gc-bar">
      <div class="gc-bar__title"><h1 class="gc-h">遊戲庫<small>LIBRARY</small></h1><span class="gc-count" data-gc="count">${two(n)} ITEMS</span></div>
      <div class="gc-tabs">
        <button type="button" class="gc-key" data-act="tab-prev" aria-label="上一個分類"><kbd data-k="keys">Q</kbd><kbd data-k="pad">LB</kbd></button>
        <div class="gc-tabs__list" role="tablist" aria-label="分類" data-gc="tabs"></div>
        <button type="button" class="gc-key" data-act="tab-next" aria-label="下一個分類"><kbd data-k="keys">E</kbd><kbd data-k="pad">RB</kbd></button>
      </div>
      <div class="gc-tools">
        <button type="button" data-act="sort">排序<b data-gc="sort-label">最近遊玩</b></button>
        <button type="button" data-act="filter">篩選<b data-gc="filter-label">遊戲類型</b></button>
      </div>
    </header>

    <ul class="gc-grid" data-gc="grid">${hub.items.map((g, i) => `
      <li class="gc-card" data-id="${g.id}">
        <a class="gc-card__hit" href="/apps/${g.id}/" data-card>
          <span class="gc-card__img"><img src="/assets/img/${g.img}" alt="${esc(g.title)} 的畫面" loading="lazy" decoding="async" width="1280" height="800"></span>
          <span class="gc-card__no">${two(i + 1)}</span>
          <strong>${esc(g.title)}</strong>
          <span class="gc-card__meta">${esc(catLabel(g.cat))} · ${esc(g.note)}<i>${g.pad ? '手把' : '鍵鼠'}</i></span>
        </a>
        <button type="button" class="gc-fav" data-fav="${g.id}" aria-pressed="false" aria-label="將 ${esc(g.title)} 加入最愛">${HEART}</button>
      </li>`).join('')}
    </ul>
    <p class="gc-empty" data-gc="empty" hidden>沒有符合條件的遊戲</p>
  </div>

  <section class="gc-detail" data-gc="detail" aria-label="遊戲詳情" hidden>
    <div class="gc-media">
      <div class="gc-media__main">
        <button type="button" class="gc-media__shot" data-act="preview" aria-label="放大畫面"><img data-d="shot" alt="" width="1280" height="800"></button>
        <button type="button" class="gc-media__nav" data-act="media-prev" aria-label="上一張">‹</button>
        <button type="button" class="gc-media__nav gc-media__nav--next" data-act="media-next" aria-label="下一張">›</button>
        <p class="gc-media__cap"><b data-d="shot-no">01</b><span data-d="shot-cap"></span></p>
      </div>
      <ul class="gc-media__thumbs" data-d="thumbs"></ul>
    </div>
    <div class="gc-info">
      <header class="gc-info__head">
        <div>
          <p class="pg-kicker" data-d="kicker"></p>
          <h2 class="gc-detail__title" data-d="title"></h2>
          <p class="gc-info__en" data-d="en"></p>
        </div>
        <button type="button" class="gc-x" data-act="back" aria-label="返回遊戲庫">${CROSS}</button>
      </header>
      <div class="gc-info__body">
        <p class="gc-info__desc" data-d="desc"></p>
        <dl class="gc-info__meta" data-d="meta"></dl>
        <p class="gc-info__tags" data-d="tags"></p>
        <div class="gc-ctl" data-d="ctl"></div>
      </div>
      <p class="gc-info__go"><a class="gc-play" data-gc="launch" href="/apps/${g0.id}/">啟動遊戲<b aria-hidden="true">→</b></a><button type="button" class="gc-fav gc-fav--lg" data-act="fav" aria-pressed="false">${HEART}<span>加入最愛</span></button></p>
    </div>
  </section>

  <div class="gc-modal" data-gc="modal" role="dialog" aria-modal="true" hidden>
    <div class="gc-modal__box"><h2 data-gc="modal-title"></h2><ul data-gc="modal-list"></ul></div>
  </div>
  <div class="gc-preview" data-gc="preview" role="dialog" aria-modal="true" aria-label="畫面預覽" hidden>
    <img data-gc="preview-img" alt="">
    <p class="gc-preview__cap" data-gc="preview-cap"></p>
    <button type="button" class="gc-media__nav" data-act="media-prev" aria-label="上一張">‹</button>
    <button type="button" class="gc-media__nav gc-media__nav--next" data-act="media-next" aria-label="下一張">›</button>
    <button type="button" class="gc-x" data-act="back" aria-label="關閉預覽">${CROSS}</button>
  </div>

  <footer class="gc-foot">
    <div class="gc-hints" data-gc="hints"></div>
    <p class="gc-foot__id"><span data-gc="device">KEYBOARD</span><i></i>${esc(hub.en)}</p>
  </footer>
</div>`;
}
