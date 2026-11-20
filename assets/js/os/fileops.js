// File operations shared by the desktop and the file manager: the clipboard, and every action that asks or
// reports through a dialog. Each returns when it is finished; failures are shown, never thrown.
import { h, KIND, when } from './ui.js';
import { bytes } from './kernel.js';

export function createOps(os) {
  const { fs } = os;
  const guard = async (fn) => { try { return await fn(); } catch (e) { await os.ui.fail(e); return null; } };

  const ops = {
    clip: null,                    // { ids: [...], cut: boolean }
    copy(nodes) { ops.clip = { ids: nodes.map((n) => n.id), cut: false }; os.bus.emit('clip'); },
    cut(nodes) { ops.clip = { ids: nodes.filter((n) => !fs.isRO(n)).map((n) => n.id), cut: true }; os.bus.emit('clip'); },
    canPaste: (dir) => !!ops.clip && ops.clip.ids.some((id) => fs.get(id)) && fs.canWrite(dir) && dir.id !== 'trash',
    paste: (dir) => guard(async () => {
      if (!ops.clip) return [];
      const out = [];
      for (const id of ops.clip.ids) {
        const n = fs.get(id);
        if (!n) continue;
        out.push(ops.clip.cut ? fs.move(n, dir) : await fs.copy(n, dir));
      }
      if (ops.clip.cut) { ops.clip = null; os.bus.emit('clip'); }
      return out;
    }),
    /** Move `nodes` into `dir` (a drop). Dropping on the trash deletes. */
    drop: (nodes, dir) => guard(async () => {
      if (dir.id === 'trash') { ops.trash(nodes); return; }
      for (const n of nodes) if (n.id !== dir.id && n.parent !== dir.id) fs.move(n, dir);
    }),
    trash: (nodes) => guard(async () => {
      const list = nodes.filter((n) => !fs.isRO(n));
      if (!list.length) throw new Error('系統項目不能刪除。');
      list.forEach((n) => fs.trash(n));
      os.sound.play('trash');
    }),
    restore: (nodes) => guard(async () => nodes.forEach((n) => fs.restore(n))),
    remove: async (nodes) => {
      const text = nodes.length === 1 ? `永久刪除「${nodes[0].name}」？這個動作無法復原。` : `永久刪除這 ${nodes.length} 個項目？這個動作無法復原。`;
      if (!(await os.ui.confirm(text, { title: '永久刪除', ok: '刪除', danger: true }))) return false;
      await guard(async () => { for (const n of nodes) await fs.remove(n); });
      return true;
    },
    emptyTrash: async () => {
      const n = fs.children(fs.dir('trash')).length;
      if (!n) { await os.ui.alert('垃圾桶是空的。', '垃圾桶'); return; }
      if (!(await os.ui.confirm(`永久刪除垃圾桶裡的 ${n} 個項目？這個動作無法復原。`, { title: '清空垃圾桶', ok: '清空', danger: true }))) return;
      await guard(() => fs.emptyTrash());
      os.sound.play('trash');
    },
    rename: async (node) => {
      if (fs.isRO(node)) { await os.ui.fail(new Error('系統項目不能重新命名。')); return; }
      const name = await os.ui.prompt('新的名稱', node.name, { title: '重新命名', ok: '重新命名', stem: !node.dir });
      if (name == null || name.trim() === node.name) return;
      await guard(async () => fs.rename(node, name));
    },
    newFolder: (dir) => guard(async () => {
      const name = await os.ui.prompt('資料夾名稱', '新資料夾', { title: '新增資料夾', ok: '建立' });
      return name == null ? null : fs.mkdir(dir, name);
    }),
    newText: (dir) => guard(async () => {
      const name = await os.ui.prompt('檔案名稱', '新文件.txt', { title: '新增文字文件', ok: '建立', stem: true });
      return name == null ? null : fs.create(dir, name, { text: '' });
    }),
    /** Asks the device for files and stores them in `dir`. */
    addFiles: (dir, accept = '') => new Promise((resolve) => {
      const input = h('input', { type: 'file', multiple: true, accept });
      input.addEventListener('change', async () => resolve(await os.importFiles(input.files, dir)));
      input.addEventListener('cancel', () => resolve([]));
      input.click();
    }),
    props(node) {
      const k = fs.kind(node);
      const rows = [
        ['種類', node.id === 'trash' ? '垃圾桶' : KIND[k] + (k === 'link' ? `（${os.app(node.app)?.name || node.app}）` : '')],
        ['位置', fs.path(node)],
        ['大小', node.dir ? `${bytes(fs.size(node))} · ${fs.children(node).length} 個項目` : node.url ? '網站資源（隨網站提供）' : bytes(node.size || 0)],
        ['修改時間', node.url || node.fixed ? '—' : when(node.mtime)],
        ['儲存方式', node.url ? '唯讀 · 來自網站' : node.ro || node.fixed ? '系統項目' : node.blob ? (fs.volatile ? '記憶體（重新整理後消失）' : 'IndexedDB · 這台裝置') : node.dir ? '—' : 'localStorage · 這台裝置'],
      ];
      return os.ui.dialog({
        title: '內容', icon: 'info',
        body: h('div', { class: 'os-props' }, h('b', null, fs.label(node)), h('dl', null, rows.map(([a, b]) => h('div', null, h('dt', null, a), h('dd', null, b))))),
      });
    },
  };
  return ops;
}
