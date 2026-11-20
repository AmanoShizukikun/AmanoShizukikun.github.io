// Zero-dependency static page generator.
//   node tools/build.mjs
// SOURCES  src/pages/ — one file per page: its body, as plain HTML (.html) or as a function that writes it from
//          the site's data (.mjs). The head/body template every page shares is below.
// OUTPUT   index.html, 404.html, profile/, works/, apps/<id>/ (+ robots.txt, sitemap.xml) at the project root,
//          because that is where GitHub Pages serves them from. Each one says on its second line which source it
//          was written from — never edit them by hand, the next build overwrites them.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (name) => import(pathToFileURL(path.join(root, 'src/pages', name)).href);
const { worksBody, worksCards } = await load('works.mjs');
const { appBody } = await load('app.mjs');
const { gamesBody } = await load('games.mjs');
const { sakuraBody } = await load('sakura.mjs');
const { live2dBody } = await load('live2d.mjs');
const { musicBody } = await load('music.mjs');
const { webosBody } = await load('webos.mjs');
const { loreBody } = await load('lore.mjs');
const live2d = await import(pathToFileURL(path.join(root, 'assets/js/data/live2d.js')).href);
const music = await import(pathToFileURL(path.join(root, 'assets/js/data/music.js')).href);
const musicScan = await import(pathToFileURL(path.join(root, 'assets/js/data/music-scan.js')).href);
const sakura = await import(pathToFileURL(path.join(root, 'assets/js/data/sakura.js')).href);
const lore = await import(pathToFileURL(path.join(root, 'assets/js/data/lore.js')).href);
const { site, nav, works, apps, hrefOf, linkAttrs, gameCats, WORKS_STAGED } = await import(pathToFileURL(path.join(root, 'assets/js/data/site.js')).href);

// Build id: a fingerprint of the site's own code and views. Every page carries it, and the router compares it
// on each navigation — a tab that is still running older scripts reloads instead of mixing two versions.
const build = (() => {
  const h = createHash('sha1');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else { h.update(e.name); h.update(fs.readFileSync(p)); }
  });
  ['assets/js', 'assets/css', 'src/pages'].forEach((d) => walk(path.join(root, d)));
  return h.digest('hex').slice(0, 8);
})();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A page written as plain HTML: its title and description are the header of the file, the rest is the body.
const view = (name) => {
  const text = fs.readFileSync(path.join(root, 'src/pages', name), 'utf8');
  const head = text.match(/^<!--\r?\ntitle: (.*)\r?\ndesc: (.*)\r?\n-->\r?\n/);
  if (!head) throw new Error(`src/pages/${name} must start with a header:\n<!--\ntitle: …\ndesc: …\n-->`);
  return { src: name, title: head[1].trim(), desc: head[2].trim(), body: text.slice(head[0].length) };
};
const home = view('home.html');

const template = ({ url, page, title, desc, body, src, attrs = '', jsonld = '' }) => `<!doctype html>
<!-- GENERATED FILE 自動產生，請勿手改 — source 來源: src/pages/${src} — rebuild 重建: node tools/build.mjs -->
<html lang="zh-Hant-TW" data-theme="dark">
<head>
<meta charset="utf-8">
<script>
(function(){try{var d=document.documentElement,t=localStorage.getItem('theme')||'dark';d.setAttribute('data-theme',t);d.classList.add('js');}catch(e){}})();
(function(){try{var d=document.documentElement,m=window.WebGL2RenderingContext&&matchMedia(${JSON.stringify(WORKS_STAGED)});if(!m)return;var s=function(){d.classList.toggle('wk-staged',m.matches&&!d.classList.contains('no-gl'));};s();m.addEventListener('change',s);}catch(e){}})();
</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="${esc(site.nameZh)}">
<meta name="theme-color" content="#0b0c0d">
<link rel="canonical" href="${site.origin}${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${site.origin}${url}">
<meta property="og:image" content="${site.origin}/assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/icon-32.png">
<link rel="apple-touch-icon" href="/assets/img/icon-180.png">
<link rel="preload" href="/assets/fonts/barlow-condensed-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/pages.css">
<link rel="stylesheet" href="/assets/css/home.css">
<link rel="stylesheet" href="/assets/css/live2d.css">
<link rel="stylesheet" href="/assets/css/music.css">
<link rel="stylesheet" href="/assets/css/lore.css">
<script type="importmap">{"imports":{"three":"/assets/vendor/three/three.module.js"}}</script>
<script type="module" src="/assets/js/app.js"></script>${jsonld}
</head>
<body>
<a class="nx-skip" href="#view">跳到主要內容</a>
<noscript><nav class="nx-noscript">${nav.map((n) => `<a href="${n.href}">${esc(n.zh)}</a>`).join(' · ')}</nav></noscript>
<main id="view" tabindex="-1" data-build="${build}" data-page="${page}" data-title="${esc(title)}" data-desc="${esc(desc)}"${attrs}>
${body}
</main>
</body>
</html>
`;

const personLd = `
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Person', name: site.nameZh, alternateName: ['Amano Shizuki', 'AmanoShizukikun'],
  url: site.origin + '/', jobTitle: 'AI Developer', image: site.origin + '/assets/img/og.jpg', sameAs: site.links.map((l) => l.href),
})}</script>`;

// ---------- page list ----------
const pages = [
  {
    out: 'index.html', url: '/', page: 'home',
    ...home, body: home.body.replace('<!--WORKS_CARDS-->', worksCards(works, hrefOf, linkAttrs)), jsonld: personLd,
  },
  { out: 'profile/index.html', url: '/profile/', page: 'profile', ...view('profile.html') },
  {
    out: 'works/index.html', url: '/works/', page: 'works',
    title: `${site.nameZh} — 作品`,
    desc: '作品索引：長門櫻計畫、遊戲中心、WebOS、音樂播放器、3D 作品、Live2D 作品、世界觀與 GitHub 開源倉庫。',
    src: 'works.mjs', body: worksBody(works, hrefOf, linkAttrs, site.links.find((l) => l.id === 'youtube').href),
  },
  ...apps.map((w) => ({
    out: `apps/${w.id}/index.html`, url: `/apps/${w.id}/`, page: 'app',
    title: `${site.nameZh} — ${w.title}`, desc: w.desc,
    src: 'app.mjs', body: appBody(w), attrs: ` data-src="${esc(w.src)}" data-app="${esc(w.id)}" data-name="${esc(w.title)}" data-back="${esc(w.back)}"`,
  })),
  ...works.filter((w) => w.native === 'games').map((w) => ({
    out: `apps/${w.id}/index.html`, url: `/apps/${w.id}/`, page: 'games',
    title: `${site.nameZh} — ${w.title}`, desc: w.desc,
    src: 'games.mjs', body: gamesBody(w, gameCats), attrs: ` data-app="${esc(w.id)}" data-name="${esc(w.title)}" data-back="/works/"`,
  })),
  ...works.filter((w) => w.native === 'sakura').map((w) => ({
    out: `apps/${w.id}/index.html`, url: `/apps/${w.id}/`, page: 'sakura',
    title: `${site.nameZh} — ${w.title}`, desc: w.desc,
    src: 'sakura.mjs', body: sakuraBody(sakura), attrs: ` data-app="${esc(w.id)}" data-name="${esc(w.title)}" data-back="/works/"`,
  })),
  ...works.filter((w) => w.native === 'live2d').map((w) => ({
    out: `apps/${w.id}/index.html`, url: `/apps/${w.id}/`, page: 'live2d',
    title: `${site.nameZh} — ${w.title}`, desc: w.desc,
    src: 'live2d.mjs', body: live2dBody(live2d), attrs: ` data-app="${esc(w.id)}" data-name="${esc(w.title)}" data-back="/works/"`,
  })),
  ...works.filter((w) => w.native === 'music').map((w) => ({
    out: `apps/${w.id}/index.html`, url: `/apps/${w.id}/`, page: 'music',
    title: `${site.nameZh} — ${w.title}`, desc: w.desc,
    src: 'music.mjs', body: musicBody(music, musicScan), attrs: ` data-app="${esc(w.id)}" data-name="${esc(w.title)}" data-back="/works/"`,
  })),
  ...works.filter((w) => w.native === 'webos').map((w) => ({
    out: `apps/${w.id}/index.html`, url: `/apps/${w.id}/`, page: 'webos',
    title: `${site.nameZh} — ${w.title}`, desc: w.desc,
    src: 'webos.mjs', body: webosBody(w), attrs: ` data-app="${esc(w.id)}" data-name="${esc(w.title)}" data-back="/works/"`,
  })),
  ...works.filter((w) => w.native === 'lore').map((w) => ({
    out: `apps/${w.id}/index.html`, url: `/apps/${w.id}/`, page: 'lore',
    title: `${site.nameZh} — ${w.title}`, desc: w.desc,
    // an illustration that has not been made yet is not linked: the page shows the 3D world there instead
    src: 'lore.mjs', body: loreBody(lore, (img) => fs.existsSync(path.join(root, 'assets/img', img))), attrs: ` data-app="${esc(w.id)}" data-name="${esc(w.title)}" data-back="/works/"`,
  })),
  { out: '404.html', url: '/404.html', page: 'notfound', ...view('notfound.html') },
];

// Every generated page is signed: the second line carries a checksum of the rest of the file. A page that no
// longer matches its checksum was edited by hand after it was built — writing over it would throw that work
// away, so the build stops and names the file instead (node tools/build.mjs --force writes over it anyway).
const SIGN = /^(<!doctype html>\n<!-- GENERATED FILE [^\n]*?)( · [0-9a-f]{8})? -->\n/;
const sumOf = (text) => createHash('sha1').update(text.replace(SIGN, '')).digest('hex').slice(0, 8);
const signed = (text) => text.replace(SIGN, (m, head) => `${head} · ${sumOf(text)} -->\n`);

const edited = pages.filter((p) => {
  let old;
  try { old = fs.readFileSync(path.join(root, p.out), 'utf8').replace(/\r\n/g, '\n'); } catch { return false; }
  const m = old.match(SIGN);
  return !m || !m[2] || m[2].slice(3) !== sumOf(old);
});
if (edited.length && !process.argv.includes('--force')) {
  console.error('這些產生出來的頁面在上次建置之後被手動修改過，重新建置會蓋掉那些修改：');
  console.error('These generated pages were edited by hand after the last build; building would overwrite the edits:\n');
  edited.forEach((p) => console.error(`  ${p.out}    ← 來源 source: src/pages/${p.src}`));
  console.error('\n請把修改搬到來源檔再建置；確定要捨棄那些修改的話：node tools/build.mjs --force');
  process.exit(1);
}

for (const p of pages) {
  const file = path.join(root, p.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, signed(template(p)));
}

// ---------- robots / sitemap ----------
fs.writeFileSync(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /legacy/\n\nSitemap: ${site.origin}/sitemap.xml\n`);
fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.filter((p) => p.page !== 'notfound').map((p) => `  <url><loc>${site.origin}${p.url}</loc></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(root, '.nojekyll'), '');
console.log(`built ${pages.length} pages — build ${build}`);
