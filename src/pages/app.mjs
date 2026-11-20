// Markup of a page that hosts an old application in a frame (/apps/<id>/ of every entry with `src` in
// assets/js/data/site.js; used by tools/build.mjs, behaviour in assets/js/pages/app.js).
// The frame itself is added by app.js; without JavaScript the page is a plain link to the application.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function appBody(w) {
  return `<div class="app">
  <h1 class="nx-sr">${esc(w.title)} ${esc(w.en)}</h1>
  <div class="app-stage" data-app-stage>
    <noscript><p class="app-nojs">這個作品需要 JavaScript。<a href="${w.src}">直接開啟</a>　<a href="/works/">回到作品</a></p></noscript>
  </div>
</div>`;
}
