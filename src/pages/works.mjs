// Markup of the works index (/works/) and of the works cards on the home page (used by tools/build.mjs;
// behaviour in assets/js/pages/works.js, content: the works list of assets/js/data/site.js).
// One list, two presentations (works.js decides):
//  · staged   — wide screens with WebGL: the list is fixed beside the archive helix, the entry in front is open,
//               and scrolling turns the helix from one entry to the next
//  · stacked  — phones, short windows, no WebGL, no JS: every entry open, one after another, with its capture
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (i) => String(i).padStart(2, '0');

const thumb = (w) => (w.img
  ? `<img src="/assets/img/${w.img}" alt="" loading="lazy" decoding="async">`
  : `<span class="wk-blank" aria-hidden="true"><i></i><b>NO CAPTURE</b></span>`);

// an entry that leaves the site (linkAttrs → target=_blank) says so with ↗ instead of →
const arrow = (w, linkAttrs) => (linkAttrs(w) ? '↗' : '→');

// the cards of the home page's works chapter (home.html: <!--WORKS_CARDS-->)
export const worksCards = (works, hrefOf, linkAttrs) => works.map((w, i) => `
        <li class="hm-card">
          <a href="${hrefOf(w)}"${linkAttrs(w)}>
            <span class="hm-card__no">${two(i + 1)}</span>
            <span class="hm-card__img">${thumb(w)}</span>
            <span class="hm-card__kind">${esc(w.kind)}</span>
            <strong class="hm-card__title">${esc(w.title)}</strong>
            <span class="hm-card__en">${esc(w.en)}</span>
          </a>
        </li>`).join('');

// `youtube`: the channel's address, the one link of the EXTERNAL row
// The first entry is open from the start: the staged layout can show before any script runs (see works.js).
export function worksBody(works, hrefOf, linkAttrs, youtube) {
  const items = works.map((w, i) => `
      <li class="wk-item${i ? '' : ' is-on'}" id="wk-${w.id}" data-id="${w.id}">
        <a class="wk-item__head" href="${hrefOf(w)}"${linkAttrs(w)}><i>${two(i + 1)}</i><strong>${esc(w.title)}</strong><span>${esc(w.kind)}</span></a>
        <div class="wk-item__body"><div>
          <span class="wk-item__img">${thumb(w)}</span>
          <p class="wk-item__en">${esc(w.en)} — ${esc(w.year)}</p>
          <p class="wk-item__desc">${esc(w.desc)}</p>
          <p class="wk-item__tech">${w.tech.map((t) => `<i>${esc(t)}</i>`).join('')}</p>
          <p class="wk-item__go"><a class="hm-cta" href="${hrefOf(w)}"${linkAttrs(w)}>開啟<b aria-hidden="true">${arrow(w, linkAttrs)}</b></a></p>
        </div></div>
      </li>`).join('');

  return `<div class="wk" id="wk" style="--n:${works.length}">
  <div class="wk-track" aria-hidden="true"></div>
  <div class="wk-stage">
    <header class="wk-head">
      <p class="pg-kicker">ARCHIVE / 02</p>
      <div class="wk-head__row">
        <h1 class="wk-h">作品<small>WORKS</small></h1>
        <p class="wk-count" aria-hidden="true"><b data-wk="no">01</b>/ ${two(works.length)}</p>
      </div>
    </header>
    <ol class="wk-index">${items}
    </ol>
    <p class="wk-ext"><span>EXTERNAL</span><a href="${youtube}" target="_blank" rel="noopener noreferrer">YouTube 頻道 ↗</a></p>
  </div>
  <p class="wk-hint" aria-hidden="true">SCROLL ↓ NEXT<br>SCROLL ↑ PREVIOUS</p>
</div>`;
}
