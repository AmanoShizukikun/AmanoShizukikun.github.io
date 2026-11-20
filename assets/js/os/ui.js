// Shared interface pieces of the WebOS: the element builder, context menus, dialogs and the file picker.
import { svg } from './icons.js';
import { LABEL } from './vfs.js';

/** h('button', { class, data: {…}, onclick, … }, ...children) */
export function h(tag, a, ...kids) {
  const el = document.createElement(tag);
  if (a) {
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'data') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') { for (const p in v) { if (p.startsWith('--')) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; } }   // custom properties need setProperty
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (typeof v !== 'string' && k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export const ico = (name, cls) => h('span', { class: `os-ico${cls ? ` ${cls}` : ''}`, html: svg(name), 'aria-hidden': 'true' });
export const btn = (label, { icon, cls = '', title, ...rest } = {}) => h('button', { type: 'button', class: `os-btn ${cls}`.trim(), title, ...rest }, icon ? ico(icon) : null, label ? h('span', null, label) : null);
/** An icon-only button; `label` is its accessible name and tooltip. */
export const tool = (icon, label, rest = {}) => h('button', { type: 'button', class: 'os-tool', title: label, 'aria-label': label, ...rest, html: svg(icon) });

export const nodeIcon = (fs, n) => {
  if (n.id === 'trash') return 'trash';
  if (n.id === 'home') return 'home';
  if (n.id === 'desktop') return 'desktop';
  if (n.id === 'sys') return 'hdd';
  const k = fs.kind(n);
  return { dir: 'folder', link: 'link', text: 'fileText', image: 'image', audio: 'music', video: 'film', file: 'file' }[k];
};

/** The square badge that stands for an application: its glyph on a panel, marked with its own colour. */
export const appTile = (app, cls = '') => h('span', { class: `os-tile ${cls}`.trim(), style: { '--tint': app?.tint || '#ecebe5' }, html: svg(app?.icon || 'max'), 'aria-hidden': 'true' });
/** The badge of a file or folder; a shortcut wears the badge of its application. */
export function nodeTile(os, n, cls = '') {
  const fs = os.fs, k = fs.kind(n);
  if (k === 'link') { const t = appTile(os.app(n.app), `${cls} is-link`); return t; }
  const tint = { dir: 'var(--signal)', text: '#ecebe5', image: '#b79cff', audio: '#e58cf0', video: '#e58cf0', file: '#a9a79f' }[k];
  const e = n.dir ? '' : (n.name.includes('.') ? n.name.slice(n.name.lastIndexOf('.') + 1) : '').slice(0, 4).toUpperCase();
  return h('span', { class: `os-tile os-tile--file ${cls}`.trim(), style: { '--tint': tint }, 'aria-hidden': 'true', html: svg(nodeIcon(fs, n)) }, e ? h('i', null, e) : null);
}
export const KIND = { dir: '資料夾', link: '捷徑', text: '文字文件', image: '圖片', audio: '音訊', video: '影片', file: '檔案' };
export const when = (ms) => { if (!ms) return '—'; const d = new Date(ms), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

/**
 * Arrow keys move the focus between the buttons of a grid or a list, by where they are on screen.
 * Returns false when there is nothing further in that direction (the caller may then leave the group).
 */
export function arrowNav(e, container, selector = 'button') {
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!dir) return null;
  const all = [...container.querySelectorAll(selector)].filter((b) => !b.disabled && b.offsetParent);
  const from = all.includes(document.activeElement) ? document.activeElement : null;
  if (!from) { if (all[0]) { e.preventDefault(); all[0].focus(); return true; } return false; }
  const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestD = Infinity;
  for (const b of all) {
    if (b === from) continue;
    const r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay;
    const along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
    if (along < 4) continue;
    const d = along + across * 3;
    if (d < bestD) { bestD = d; best = b; }
  }
  e.preventDefault();
  if (!best) return false;
  best.focus({ preventScroll: true });
  best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}

export function createUi(os) {
  const layer = os.layers.pop;
  let openMenu = null;

  // ---------------------------------------------------------------- context menu
  function closeMenu() { openMenu?.close(); openMenu = null; }

  /**
   * items: { label, icon, hint, action, disabled, checked, danger, sub: [...] } · '-' · null (skipped)
   * at: { x, y } in viewport pixels, or { anchor: element, side: 'top' | 'bottom' | 'right' }
   */
  function menu(items, at, parent = null) {
    if (!parent) closeMenu();
    const list = items.filter((i) => i != null && i !== false);
    const el = h('div', { class: 'os-menu', role: 'menu', tabindex: '-1' });
    let child = null, cur = -1;
    const rows = [];
    const self = {
      el,
      close() {
        child?.close(); child = null;
        el.remove();
        if (!parent) { removeEventListener('pointerdown', outside, true); removeEventListener('blur', self.close); removeEventListener('resize', self.close); }
      },
    };
    const outside = (e) => { if (!e.target.closest?.('.os-menu')) closeMenu(); };
    const run = (item) => {
      if (item.disabled) return;
      if (item.sub) { openSub(item); return; }
      closeMenu();
      os.sound.play('tick');
      try { item.action?.(); } catch (e) { console.error(e); }
    };
    const openSub = (item) => {
      child?.close();
      child = menu(item.sub, { anchor: item.row, side: 'right' }, self);
    };
    list.forEach((item) => {
      if (item === '-') { el.append(h('i', { class: 'os-menu__sep', role: 'separator' })); return; }
      const row = h('button', { type: 'button', class: `os-menu__item${item.danger ? ' is-danger' : ''}`, role: item.checked != null ? 'menuitemcheckbox' : 'menuitem', disabled: !!item.disabled, 'aria-checked': item.checked != null ? String(!!item.checked) : null },
        h('span', { class: 'os-menu__ico', html: item.checked ? svg('check') : item.icon ? svg(item.icon) : '' }),
        h('span', { class: 'os-menu__label' }, item.label),
        item.hint ? h('kbd', null, item.hint) : null,
        item.sub ? h('span', { class: 'os-menu__more', html: svg('chevR') }) : null);
      item.row = row;
      row.addEventListener('click', () => run(item));
      row.addEventListener('pointerenter', () => { cur = rows.indexOf(item); mark(); if (item.sub && !item.disabled) openSub(item); else { child?.close(); child = null; } });
      rows.push(item);
      el.append(row);
    });
    const mark = () => rows.forEach((r, i) => r.row.classList.toggle('is-on', i === cur));
    const step = (d) => {
      if (!rows.length) return;
      for (let n = 0; n < rows.length; n++) { cur = (cur + d + rows.length) % rows.length; if (!rows[cur].disabled) break; }
      mark(); rows[cur].row.focus({ preventScroll: true });
    };
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight' && rows[cur]?.sub) { e.preventDefault(); openSub(rows[cur]); child?.el.focus(); }
      else if ((e.key === 'ArrowLeft' && parent) || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (parent) { self.close(); parent.el.focus(); } else closeMenu(); }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    layer.append(el);

    // place it inside the system's frame
    const frame = os.root.getBoundingClientRect(), w = el.offsetWidth, hgt = el.offsetHeight;
    let x, y;
    if (at.anchor) {
      const r = at.anchor.getBoundingClientRect();
      if (at.side === 'right') { x = r.right - 2; y = r.top - 5; if (x + w > frame.right) x = r.left - w + 2; }
      else if (at.side === 'top') { x = at.align === 'end' ? r.right - w : r.left; y = r.top - hgt - 6; }
      else { x = at.align === 'end' ? r.right - w : r.left; y = r.bottom + 4; }
    } else { x = at.x; y = at.y; if (y + hgt > frame.bottom - 4) y -= hgt; }
    x = Math.max(frame.left + 4, Math.min(x, frame.right - w - 4));
    y = Math.max(frame.top + 4, Math.min(y, frame.bottom - hgt - 4));
    el.style.left = `${x - frame.left}px`;
    el.style.top = `${y - frame.top}px`;
    if (!parent) {
      openMenu = self;
      setTimeout(() => { addEventListener('pointerdown', outside, true); addEventListener('blur', self.close); addEventListener('resize', self.close); });
      el.focus({ preventScroll: true });
    }
    return self;
  }

  // ---------------------------------------------------------------- dialogs
  /** Resolves with the value of the button that was pressed (null when dismissed). */
  function dialog({ title = '訊息', text, body, buttons = [{ label: '確定', value: true, primary: true }], icon, wide = false, onOpen } = {}) {
    return new Promise((resolve) => {
      closeMenu();
      const back = document.activeElement;
      const foot = h('footer', { class: 'os-dlg__foot' });
      const box = h('div', { class: `os-dlg${wide ? ' os-dlg--wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('header', { class: 'os-dlg__head' }, icon ? ico(icon) : null, h('b', null, title), h('span', { class: 'os-dlg__tag' }, 'SYSTEM DIALOG')),
        h('div', { class: 'os-dlg__body' }, text ? h('p', { class: 'os-dlg__text' }, text) : null, body || null),
        foot);
      const wrap = h('div', { class: 'os-modal' }, box);
      let done = false;
      const end = (v) => {
        if (done) return;
        done = true;
        wrap.classList.add('is-out');
        setTimeout(() => wrap.remove(), 160);
        try { back?.focus?.({ preventScroll: true }); } catch { /* gone */ }
        resolve(v);
      };
      buttons.forEach((b) => foot.append(btn(b.label, { cls: b.primary ? 'is-primary' : b.danger ? 'is-danger' : '', onclick: () => end(typeof b.value === 'function' ? b.value() : b.value), data: b.primary ? { primary: '1' } : null })));
      wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) end(null); });
      wrap.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); end(null); }
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); foot.querySelector('[data-primary]')?.click(); }
        else if (e.key === 'Tab') {
          const f = [...box.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter((x) => !x.disabled && x.offsetParent);
          if (!f.length) return;
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      });
      layer.append(wrap);
      const first = box.querySelector('input, textarea, select') || foot.querySelector('[data-primary]') || foot.querySelector('button');
      first?.focus({ preventScroll: true });
      if (first?.select && first.tagName === 'INPUT') first.select();
      onOpen?.({ box, end });
    });
  }
  const alert = (text, title = '訊息', icon = 'info') => dialog({ title, text, icon });
  const fail = (e, title = '無法完成') => { os.sound.play('error'); return dialog({ title, text: e?.message || String(e), icon: 'warn' }); };
  const confirm = (text, { title = '確認', ok = '確定', danger = false, icon = 'warn' } = {}) => dialog({ title, text, icon, buttons: [{ label: '取消', value: false }, { label: ok, value: true, primary: !danger, danger }] }).then((v) => v === true);
  function prompt(text, value = '', { title = '輸入', ok = '確定', placeholder = '', stem = false } = {}) {
    const input = h('input', { class: 'os-input', type: 'text', value, placeholder, spellcheck: false, autocomplete: 'off' });
    return dialog({
      title, text, body: input, icon: 'edit',
      buttons: [{ label: '取消', value: null }, { label: ok, value: () => input.value, primary: true }],
      onOpen: () => { if (stem) { const i = value.lastIndexOf('.'); input.setSelectionRange(0, i > 0 ? i : value.length); } },
    });
  }

  // ---------------------------------------------------------------- file picker
  /**
   * open: resolves with a file node.   save: resolves with { dir, name, node } (node = the file that will be replaced).
   * kinds: which kinds of file are listed (text, image, audio, video); all when omitted.
   */
  function pick({ mode = 'open', title, kinds = null, name = '', start = null } = {}) {
    const fs = os.fs;
    let dir = start && start.dir ? start : fs.dir('docs'), sel = null;
    const crumbs = h('div', { class: 'os-pick__path' });
    const listEl = h('div', { class: 'os-pick__list', role: 'listbox', tabindex: '0' });
    const nameIn = mode === 'save' ? h('input', { class: 'os-input', type: 'text', value: name, spellcheck: false, autocomplete: 'off', 'aria-label': '檔案名稱' }) : null;
    const side = h('div', { class: 'os-pick__side' });
    let finish = null;
    const draw = () => {
      crumbs.replaceChildren();
      const chain = [];
      for (let n = dir; n; n = fs.parent(n)) chain.unshift(n);
      chain.forEach((n, i) => {
        if (i) crumbs.append(h('i', null, '/'));
        crumbs.append(h('button', { type: 'button', onclick: () => { dir = n; sel = null; draw(); } }, n.id === 'root' ? '這台裝置' : fs.label(n)));
      });
      listEl.replaceChildren();
      const rows = fs.children(dir).filter((n) => n.dir || (!n.app && (!kinds || kinds.includes(fs.kind(n)))));
      if (!rows.length) listEl.append(h('p', { class: 'os-pick__none' }, '這裡沒有可以選的檔案'));
      rows.forEach((n) => {
        const row = h('button', { type: 'button', class: `os-pick__row${sel === n ? ' is-on' : ''}`, role: 'option' }, ico(nodeIcon(fs, n)), h('span', null, fs.label(n)));
        row.addEventListener('click', () => {
          if (n.dir) { dir = n; sel = null; draw(); return; }
          sel = n; if (nameIn) nameIn.value = n.name;
          listEl.querySelectorAll('.is-on').forEach((x) => x.classList.remove('is-on')); row.classList.add('is-on');
        });
        row.addEventListener('dblclick', () => { if (!n.dir) finish?.(); });
        listEl.append(row);
      });
      side.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.id === dir.id));
    };
    ['desktop', 'docs', 'pics', 'music', 'dl', 'sys'].forEach((id) => side.append(h('button', { type: 'button', data: { id }, onclick: () => { dir = fs.dir(id); sel = null; draw(); } }, ico(nodeIcon(fs, fs.dir(id))), h('span', null, LABEL[id]))));
    draw();
    const body = h('div', { class: 'os-pick' }, side, h('div', { class: 'os-pick__main' }, crumbs, listEl, nameIn ? h('label', { class: 'os-pick__name' }, h('span', null, '檔名'), nameIn) : null));
    return new Promise((resolve) => {
      const choose = async (end) => {
        if (mode === 'open') { if (sel) end(sel); return; }
        const nm = nameIn.value.trim();
        if (!nm) { nameIn.focus(); return; }
        if (!fs.canWrite(dir) || dir.id === 'trash') { await fail(new Error('這個位置是唯讀的，請選別的資料夾。')); return; }
        const hit = fs.named(dir, nm);
        if (hit && hit.dir) { dir = hit; draw(); return; }
        if (hit && !(await confirm(`「${nm}」已經存在，要取代它嗎？`, { title: '取代檔案', ok: '取代', danger: true }))) return;
        end({ dir, name: nm, node: hit || null });
      };
      dialog({
        title: title || (mode === 'save' ? '另存新檔' : '開啟檔案'), body, wide: true, icon: mode === 'save' ? 'save' : 'folderOpen',
        buttons: [{ label: '取消', value: null }, { label: mode === 'save' ? '儲存' : '開啟', value: () => undefined, primary: true }],
        onOpen: ({ box, end }) => {
          finish = () => choose(end);
          // the primary button decides itself whether the dialog may close
          const primary = box.querySelector('[data-primary]');
          const fresh = primary.cloneNode(true);
          primary.replaceWith(fresh);
          fresh.addEventListener('click', finish);
          (nameIn || listEl).focus();
        },
      }).then((v) => resolve(v === undefined ? null : v));
    });
  }

  // ---------------------------------------------------------------- tooltips
  // The system draws its own: a `title` is taken over the first time the pointer reaches it (and kept as the
  // accessible name of a control that has no other). "名稱（Alt A）" shows the part in brackets as a key.
  const tipEl = h('div', { class: 'os-tip', role: 'tooltip', hidden: true });
  layer.append(tipEl);
  let tipFor = null, tipTimer = 0;
  const hideTip = () => { clearTimeout(tipTimer); tipFor = null; tipEl.hidden = true; };
  const showTip = (el) => {
    const text = el.dataset.tip;
    if (!text || !el.isConnected) return;
    const m = /^(.*?)（([^（）]+)）$/.exec(text);
    tipEl.replaceChildren(h('span', null, m ? m[1] : text), m ? h('kbd', null, m[2]) : null);
    tipEl.hidden = false;
    const frame = os.root.getBoundingClientRect(), r = el.getBoundingClientRect(), w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    const above = r.top - frame.top > hgt + 14 && (r.bottom > frame.bottom - 90 || !!el.closest('.os-bar'));
    const x = Math.max(6, Math.min(r.left + r.width / 2 - w / 2 - frame.left, frame.width - w - 6));
    const y = above ? r.top - frame.top - hgt - 8 : Math.min(r.bottom - frame.top + 8, frame.height - hgt - 6);
    tipEl.style.left = `${Math.round(x)}px`; tipEl.style.top = `${Math.round(y)}px`;
    tipEl.dataset.side = above ? 'top' : 'bottom';
  };
  const onOver = (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.('[title], [data-tip]');
    if (!el || !os.root.contains(el) || el.tagName === 'IFRAME') { if (tipFor && !tipFor.contains(e.target)) hideTip(); return; }
    if (el.hasAttribute('title')) {
      const t = el.getAttribute('title');
      el.removeAttribute('title');
      if (t) { el.dataset.tip = t; if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t); }
    }
    if (el === tipFor) return;
    hideTip();
    if (!el.dataset.tip) return;
    tipFor = el;
    tipTimer = setTimeout(() => { if (tipFor === el) showTip(el); }, 460);
  };
  const onOut = (e) => { if (tipFor && !tipFor.contains(e.relatedTarget)) hideTip(); };
  os.root.addEventListener('pointerover', onOver);
  os.root.addEventListener('pointerout', onOut);
  os.root.addEventListener('pointerdown', hideTip, true);
  os.root.addEventListener('wheel', hideTip, { capture: true, passive: true });
  addEventListener('keydown', hideTip, true);

  return {
    menu, closeMenu, dialog, alert, fail, confirm, prompt, pick, hideTip,
    get menuOpen() { return !!openMenu; },
    dispose() { hideTip(); os.root.removeEventListener('pointerover', onOver); os.root.removeEventListener('pointerout', onOut); os.root.removeEventListener('pointerdown', hideTip, true); os.root.removeEventListener('wheel', hideTip, { capture: true }); removeEventListener('keydown', hideTip, true); },
  };
}
