// Markup of 長門櫻的日常 (/apps/ns-room/), a small life simulation in her room; used by tools/build.mjs.
// Behaviour: assets/js/pages/room.js (and assets/js/room/*), content: assets/js/data/room.js, styles: css/room.css.
// The stage fills the window; over it: who she is and what she is doing, the visitor's queue of requests, the
// clock and its speed, her needs, a diary, and the menus that open on furniture or on her.
// Without JavaScript or WebGL the page says what it is and shows the room as a picture.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const SPEED = [
  ['0', '暫停', svg('<path d="M8 5v14M16 5v14"/>')],
  ['1', '一般速度', svg('<path d="M8 5l10 7-10 7Z"/>')],
  ['2', '快轉', svg('<path d="M4 5l8 7-8 7Z M12 5l8 7-8 7Z"/>')],
  ['3', '最快', svg('<path d="M2 5l7 7-7 7Z M9 5l7 7-7 7Z M16 5l7 7-7 7Z"/>')],
];

export function roomBody(entry, { needs }) {
  return `<div class="rm" id="rm">
  <div class="rm-stage" data-rm="stage">
    <canvas class="rm-canvas" data-rm="canvas" tabindex="0" aria-label="長門櫻的房間。點家具可以請她做事，點她本人可以跟她互動；拖曳轉動鏡頭，滾輪縮放。"></canvas>
    <div class="rm-layer" aria-hidden="false">
      <i class="rm-mark" data-rm="mark" hidden></i>
      <p class="rm-bubble" data-rm="bubble" hidden></p>
      <div class="rm-menu" data-rm="menu" role="menu" hidden></div>
    </div>

    <div class="rm-hud" data-rm="hud" hidden>
      <section class="rm-who" aria-label="長門櫻">
        <img src="/assets/img/room/sakura.webp" alt="" width="160" height="160">
        <div>
          <p class="rm-name">長門櫻<small>NAGATO SAKURA</small></p>
          <p class="rm-doing" data-rm="doing" aria-live="polite">—</p>
          <p class="rm-mood"><i data-rm="dot"></i><span data-rm="mood">—</span></p>
        </div>
      </section>
      <ol class="rm-queue" data-rm="queue" aria-label="你請她做的事"></ol>

      <section class="rm-clock" aria-label="時間">
        <p class="rm-time"><b data-rm="time">00:00</b><span data-rm="day">DAY 1</span></p>
        <div class="rm-speed" role="radiogroup" aria-label="時間速度">${SPEED.map(([v, label, icon]) => `<button type="button" role="radio" data-speed="${v}" aria-checked="false" title="${label}（${v === '0' ? '空白鍵' : v}）" aria-label="${label}">${icon}</button>`).join('')}</div>
      </section>

      <section class="rm-needs" aria-label="她的需求">${needs.map((n) => `
        <div class="rm-need" data-need="${n.id}"><span>${esc(n.zh)}</span><i><b></b></i><em>—</em></div>`).join('')}
      </section>

      <section class="rm-log" aria-label="日記"><h2>日記<small>DIARY</small></h2><ol data-rm="log"></ol></section>

      <div class="rm-tools">
        <button type="button" data-act="follow" aria-pressed="false" title="鏡頭跟著她（F）">跟著她</button>
        <button type="button" data-act="view" title="重置鏡頭（R）">重置鏡頭</button>
        <button type="button" data-act="help" aria-expanded="false">玩法</button>
      </div>
    </div>

    <div class="rm-help" data-rm="help" hidden>
      <h2>長門櫻的日常</h2>
      <p>這是她的房間。她會照自己的需求過日子：累了去睡、無聊了看書或用筆電、寂寞了等你來。</p>
      <ul>
        <li><b>點家具</b>：請她做事，例如睡覺、看書、看窗外。請求會排在左上角，可以取消。</li>
        <li><b>點她</b>：打招呼、摸摸頭、聊天，或叫她去休息。她睡著時可以叫醒她。</li>
        <li><b>點地板</b>：請她走過去。</li>
        <li><b>時間</b>：右上角暫停或快轉（空白鍵、1、2、3）。這裡的一分鐘是一秒；她的狀態會記在這台裝置上。</li>
        <li><b>鏡頭</b>：拖曳轉動、滾輪或雙指縮放，右鍵拖曳平移；「跟著她」讓鏡頭追著她走。</li>
      </ul>
      <button type="button" class="hm-cta" data-act="help-close">開始<b aria-hidden="true">→</b></button>
    </div>

    <div class="rm-load" data-rm="load" role="status">
      <p data-rm="msg">正在走進她的房間</p>
      <i><b data-rm="bar"></b></i>
      <span data-rm="bytes"></span>
    </div>
  </div>

  <section class="rm-about">
    <p class="pg-kicker">3D WORKS / LIFE</p>
    <h1 class="rm-h">${esc(entry.title)}<small>${esc(entry.en || '')}</small></h1>
    <p>${esc(entry.desc)}</p>
    <img src="/assets/models/ns-room/poster.webp" alt="長門櫻的房間" width="1600" height="1000" loading="lazy">
    <p><a class="hm-cta" href="/apps/models/">看 3D 作品蒐藏庫<b aria-hidden="true">→</b></a></p>
  </section>
</div>`;
}
