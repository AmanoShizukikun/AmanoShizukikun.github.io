// Markup of the world page (/apps/nijigen/; used by tools/build.mjs, behaviour in assets/js/pages/lore.js,
// content in assets/js/data/lore.js, styles in assets/css/lore.css).
// The page is laid out like the site of a game, and it is driven by pictures:
//   00 film     four paintings crossed by scrolling (a dot-matrix print resolves into the first one; fog
//               closes and opens between them), then the title
//   01 world    the five laws, each with its sign printed in dots
//   02 places   one painting fills the frame; scrolling goes from place to place
//   03 cast     a poster per character: a standing figure, a slanted block, the name in huge letters
//   04 story    sixteen chapters on a reel that scrolling pulls sideways
//   05 races    a ledger with a dot sign          06 terms, and the way out
// Without JavaScript nothing is pinned: every picture, place, character and chapter follows the last.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const two = (i) => String(i).padStart(2, '0');

export function loreBody({ world, prologue, laws, realms, races, groups, cast, acts, chronicle, terms }, has = () => true) {
  const pic = (img, alt = '', lazy = true) => (img && has(img) ? `<img src="/assets/img/${img}" alt="${esc(alt)}" ${lazy ? 'loading="lazy" ' : ''}decoding="async">` : '<span class="lr-nopic" aria-hidden="true"></span>');
  const head = (no, zh, en) => `<header class="lr-head"><i>${no}</i><h2>${esc(zh)}</h2><span>${esc(en)}</span></header>`;
  const facts = (rows) => `<dl class="lr-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  const figure = (c) => `lore/cast-${c.id}.webp`;
  const face = (c) => `lore/face-${c.id}.webp`;
  const secs = [['top', '00', '序'], ['world', '01', '世界'], ['realms', '02', '地域'], ['cast', '03', '角色'], ['story', '04', '故事'], ['races', '05', '種族'], ['terms', '06', '名詞']];
  const lead = cast.find((c) => c.id === prologue.at(-1).cast);

  return `<div class="lr" id="lr">
  <h1 class="nx-sr">世界觀：${esc(world.name)} ${esc(world.en)}</h1>
  <nav class="lr-rail" aria-label="章節">${secs.map(([id, no, zh]) => `<a href="#lr-${id}"><i>${no}</i><span>${zh}</span></a>`).join('')}</nav>

  <section class="lr-film" id="lr-top" data-sec style="--n:${prologue.length}">
    <div class="lr-film__stage">
      ${prologue.map((s, i) => `<figure class="lr-shot" data-shot="${i}">${pic(s.img, s.kicker, i > 0)}${s.cast && has(figure(lead)) ? `<img class="lr-shot__cast" src="/assets/img/${figure(lead)}" alt="" loading="lazy" decoding="async">` : ''}</figure>`).join('\n      ')}
      <canvas class="lr-film__dots" data-lr="dots" data-src="/assets/img/${prologue[0].img}" aria-hidden="true"></canvas>
      <div class="lr-fog" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="lr-film__title" data-lr="title">
        <p class="pg-kicker">WORLD ARCHIVE / 00</p>
        <p class="lr-title">${esc(world.name)}<small>${esc(world.en)}</small></p>
        <p class="lr-line">${esc(world.line)}</p>
      </div>
      ${prologue.map((s, i) => `<p class="lr-cap" data-cap="${i}"><i>${two(i + 1)} — ${esc(s.kicker)}</i>${s.line.map((l) => `<b>${esc(l)}</b>`).join('')}</p>`).join('\n      ')}
      <p class="lr-film__meter" aria-hidden="true"><b data-lr="pct">000</b><span>% / SCROLL ↓</span></p>
    </div>
  </section>

  <section class="lr-sec" id="lr-world" data-sec>
    ${head('01', '世界', 'HOW THE WORLD WORKS')}
    ${world.intro.map((p) => `<p class="lr-p lr-p--lead">${esc(p)}</p>`).join('\n    ')}
    <div class="lr-ledger" data-lr="ledger">
      <ol class="lr-ledger__list">${laws.map((l, i) => `
        <li data-glyph="${esc(l.glyph)}"${i === 0 ? ' class="is-on"' : ''}><i>${l.no}</i><div><h3>${esc(l.zh)}<small>${esc(l.en)}</small><b>${esc(l.key)}</b></h3><p>${esc(l.text)}</p></div></li>`).join('')}
      </ol>
      <div class="lr-ledger__sign" aria-hidden="true"><canvas></canvas><span>LAW</span></div>
    </div>
  </section>

  <section class="lr-atlas" id="lr-realms" data-sec data-lr="atlas" style="--n:${realms.length}">
    <div class="lr-atlas__stage">
      <div class="lr-atlas__pics" aria-hidden="true">${realms.map((r, i) => `<figure data-realm="${r.id}"${i === 0 ? ' class="is-on"' : ''}>${pic(r.img)}</figure>`).join('')}</div>
      <div class="lr-atlas__veil" aria-hidden="true"></div>
      ${head('02', '地域', 'PLACES')}
      <ol class="lr-atlas__list" role="tablist" aria-label="地域">${realms.map((r, i) => `
        <li><button type="button" role="tab" id="lr-rt-${r.id}" aria-controls="lr-r-${r.id}" aria-selected="${i === 0}" data-realm="${r.id}"><i>${r.no}</i><b>${esc(r.zh)}</b></button></li>`).join('')}
      </ol>
      <div class="lr-atlas__files">${realms.map((r, i) => `
        <article class="lr-place${i === 0 ? ' is-on' : ''}" id="lr-r-${r.id}" role="tabpanel" aria-labelledby="lr-rt-${r.id}" data-realm="${r.id}">
          <figure class="lr-place__pic">${pic(r.img, r.zh)}</figure>
          <p class="lr-place__kind">${r.no} — ${esc(r.kind)}</p>
          <h3>${esc(r.zh)}</h3>
          <p class="lr-place__line">${esc(r.line)}</p>
          <p class="lr-p">${esc(r.desc)}</p>
          ${facts(r.facts)}
          <p class="lr-place__en" aria-hidden="true">${esc(r.en)}</p>
        </article>`).join('')}
      </div>
      <p class="lr-atlas__count" aria-hidden="true"><b data-lr="realm-no">01</b>/ ${two(realms.length)}</p>
    </div>
  </section>

  <section class="lr-cast" id="lr-cast" data-sec data-lr="cast">
    <div class="lr-cast__back" aria-hidden="true"><i></i><i></i><p data-lr="cast-en">${esc(cast[0].en)}</p></div>
    ${head('03', '角色', 'CHARACTERS')}
    <ul class="lr-cast__groups">${groups.map(([id, zh, en], i) => `<li><button type="button" data-group="${id}" aria-pressed="${i === 0}"><b>${esc(zh)}</b><span>${esc(en)}</span></button></li>`).join('')}</ul>
    <div class="lr-cast__figures">${cast.map((c, i) => `
      <figure class="lr-fig${i === 0 ? ' is-on' : ''}" data-cast="${c.id}">${pic(figure(c), c.name, i > 0)}</figure>`).join('')}
    </div>
    <div class="lr-cast__files">${cast.map((c, i) => `
      <article class="lr-file${i === 0 ? ' is-on' : ''}" id="lr-c-${c.id}" role="tabpanel" aria-labelledby="lr-ct-${c.id}" data-cast="${c.id}" data-en="${esc(c.en)}" style="--tone:${c.tone}">
        <figure class="lr-file__pic">${pic(figure(c), c.name)}</figure>
        <p class="lr-file__code"><b>${esc(c.code)}</b>${esc(c.title)}</p>
        <h3>${esc(c.name)}</h3>
        <p class="lr-file__read">${esc(c.read)}<span>${esc(c.en)}</span></p>
        <p class="lr-file__tags"><i>${esc(c.race)}</i><i>${esc(c.from)}</i>${c.traits.map((t) => `<i>${esc(t)}</i>`).join('')}</p>
        <blockquote>${esc(c.quote)}</blockquote>
        <p class="lr-p">${esc(c.desc[0])}</p>
        <details class="lr-file__more">
          <summary><span>完整檔案</span><b aria-hidden="true">＋</b></summary>
          ${c.desc.slice(1).map((p) => `<p class="lr-p">${esc(p)}</p>`).join('\n          ')}
          ${facts(c.facts)}
          <h4>能力</h4>
          <ul class="lr-file__rows">${c.skills.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>
          <h4>關係</h4>
          <ul class="lr-file__rows">${c.ties.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>${c.links ? `
          <p class="lr-go">${c.links.map(([href, label]) => `<a class="hm-cta" href="${href}">${esc(label)}<b aria-hidden="true">→</b></a>`).join('')}</p>` : ''}
        </details>
      </article>`).join('')}
    </div>
    <ol class="lr-cast__tabs" role="tablist" aria-label="角色">${cast.map((c, i) => `
      <li data-group="${c.group}"><button type="button" role="tab" id="lr-ct-${c.id}" aria-controls="lr-c-${c.id}" aria-selected="${i === 0}" data-cast="${c.id}" title="${esc(c.name)}">${pic(face(c))}<span>${esc(c.name)}</span></button></li>`).join('')}
    </ol>
  </section>

  <section class="lr-reel" id="lr-story" data-sec data-lr="reel" style="--n:${chronicle.length}">
    <div class="lr-reel__stage">
      <div class="lr-reel__back" aria-hidden="true">${chronicle.map((c, i) => `<figure data-ch="${i}"${i === 0 ? ' class="is-on"' : ''}>${pic(c.img)}</figure>`).join('')}</div>
      ${head('04', '故事', 'THE STORY SO FAR')}
      <p class="lr-reel__act" aria-hidden="true"><b data-lr="act-no">${acts[0].no}</b><span data-lr="act-zh">${esc(acts[0].zh)}</span><i data-lr="act-en">${esc(acts[0].en)}</i></p>
      <ol class="lr-reel__strip">${chronicle.map((c, i) => `
        <li class="lr-ch" data-ch="${i}" data-act="${c.act}">
          <figure>${pic(c.img, c.zh)}</figure>
          <p class="lr-ch__no"><b>${c.no}</b><span>第 ${acts[c.act].no} 部・${esc(acts[c.act].zh)}</span><i>${esc(c.where)}</i></p>
          <h3>${esc(c.zh)}<small>${esc(c.en)}</small></h3>
          <p class="lr-ch__text">${esc(c.text)}</p>
          <ul>${c.beats.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        </li>`).join('')}
      </ol>
      <p class="lr-reel__bar" aria-hidden="true">${acts.map((a, i) => `<span style="--w:${chronicle.filter((c) => c.act === i).length}"><b>${a.no}</b>${esc(a.zh)}</span>`).join('')}<i></i></p>
    </div>
  </section>

  <section class="lr-sec" id="lr-races" data-sec>
    ${head('05', '種族', 'WHO LIVES HERE')}
    <div class="lr-ledger" data-lr="ledger">
      <ol class="lr-ledger__list">${races.map((r, i) => `
        <li data-glyph="${esc(r.glyph)}"${i === 0 ? ' class="is-on"' : ''}><i>${r.no}</i><div><h3>${esc(r.zh)}<small>${esc(r.en)}</small><b>${esc(r.home)}</b></h3><p>${esc(r.text)}</p></div></li>`).join('')}
      </ol>
      <div class="lr-ledger__sign" aria-hidden="true"><canvas></canvas><span>RACE</span></div>
    </div>
  </section>

  <section class="lr-sec" id="lr-terms" data-sec>
    ${head('06', '名詞', 'TERMS')}
    <dl class="lr-terms">${terms.map(([zh, en, text]) => `
      <div><dt>${esc(zh)}<small>${esc(en)}</small></dt><dd>${esc(text)}</dd></div>`).join('')}
    </dl>
    <div class="lr-end">
      <p class="lr-line">${esc(world.line)}</p>
      <p class="lr-p">你讀到這裡，這個世界就多了一個記得它的人。</p>
      <p class="lr-go"><a class="hm-cta" href="/apps/nagato-sakura/">長門櫻計畫<b aria-hidden="true">→</b></a><a class="hm-cta" href="/apps/live2d/">Live2D 作品<b aria-hidden="true">→</b></a><a class="hm-cta" href="/works/">回到作品<b aria-hidden="true">→</b></a></p>
    </div>
  </section>
</div>`;
}
