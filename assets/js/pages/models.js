// The 3D works gallery (/apps/models/). Markup: src/pages/models.mjs · content: data/models.js · styles: css/models.css.
// Every card is already in the page; this only filters and orders them:
//   search  name, English name, kind, tags and tools        kinds  one at a time        tags  one at a time
//   sort    newest · oldest · name · most triangles · smallest file
// The choice lives in the address (?q=&kind=&tag=&sort=), so a filtered gallery can be linked to, and the tags on a
// model's page lead back here with that tag chosen.

export async function mount(main) {
  const root = main.querySelector('.m3');
  if (!root) return null;
  const $ = (k) => root.querySelector(`[data-m3="${k}"]`);
  const grid = $('grid'), q = $('q'), sort = $('sort'), count = $('count'), empty = $('empty');
  const cards = [...grid.children];
  const kindBtns = [...$('kinds').querySelectorAll('[data-kind]')], tagBtns = [...$('tags').querySelectorAll('[data-tag]')];
  const SORTS = {
    new: (a, b) => (a.dataset.date < b.dataset.date ? 1 : -1),
    old: (a, b) => (a.dataset.date > b.dataset.date ? 1 : -1),
    name: (a, b) => a.dataset.name.localeCompare(b.dataset.name, 'zh-Hant'),
    tris: (a, b) => b.dataset.tris - a.dataset.tris,
    small: (a, b) => a.dataset.bytes - b.dataset.bytes,
  };
  const state = { q: '', kind: '', tag: '', sort: 'new' };
  const off = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); off.push(() => el.removeEventListener(type, fn)); };

  function read() {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.kind = kindBtns.some((b) => b.dataset.kind === p.get('kind')) ? p.get('kind') : '';
    state.tag = tagBtns.some((b) => b.dataset.tag === p.get('tag')) ? p.get('tag') : '';
    state.sort = SORTS[p.get('sort')] ? p.get('sort') : 'new';
  }
  function write() {
    const p = new URLSearchParams();
    for (const k of ['q', 'kind', 'tag']) if (state[k]) p.set(k, state[k]);
    if (state.sort !== 'new') p.set('sort', state.sort);
    const url = location.pathname + (p.toString() ? `?${p}` : '');
    if (url !== location.pathname + location.search) history.replaceState(history.state, '', url);
  }
  function apply() {
    q.value = state.q;
    sort.value = state.sort;
    kindBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === state.kind)));
    tagBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tag === state.tag)));
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const c of cards) {
      const hit = (!state.kind || c.dataset.kind === state.kind)
        && (!state.tag || c.dataset.tags.split('|').includes(state.tag))
        && words.every((w) => c.dataset.find.includes(w));
      c.hidden = !hit;
      if (hit) shown++;
    }
    [...cards].sort(SORTS[state.sort]).forEach((c) => grid.appendChild(c));
    count.textContent = String(shown).padStart(2, '0');
    empty.hidden = shown > 0;
    write();
  }

  on(q, 'input', () => { state.q = q.value.trim(); apply(); });
  on(sort, 'change', () => { state.sort = sort.value; apply(); });
  kindBtns.forEach((b) => on(b, 'click', () => { state.kind = b.dataset.kind; apply(); }));
  tagBtns.forEach((b) => on(b, 'click', () => { state.tag = state.tag === b.dataset.tag ? '' : b.dataset.tag; apply(); }));
  on($('clear'), 'click', () => { Object.assign(state, { q: '', kind: '', tag: '' }); apply(); q.focus(); });
  // "/" puts the cursor in the search box, as on most galleries
  on(window, 'keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault(); q.focus();
  });
  read();
  apply();
  root.classList.add('m3--ui');
  return () => off.forEach((f) => f());
}
