// Markup of the WebOS page (/apps/webos/). The system builds its own interface (assets/js/os/); what is written
// here is only what a visitor sees before it starts — and all a visitor without JavaScript gets.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function webosBody(w) {
  return `<div class="osx">
  <h1 class="nx-sr">${esc(w.title)} ${esc(w.en)}</h1>
  <div class="os" data-os>
    <div class="os-pre">
      <p data-os-msg>SYSTEM LOADING</p>
      <noscript><p>${esc(w.desc)}</p><p>這個作品需要 JavaScript。<a href="/works/">回到作品</a></p></noscript>
    </div>
  </div>
</div>`;
}
