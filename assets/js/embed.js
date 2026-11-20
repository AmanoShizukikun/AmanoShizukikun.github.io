// Loaded (as a classic script) by every legacy application under /legacy/.
// Inside the shell's app frame: hide the app's own copy of the old header/menu/settings.
// Opened directly: send the visitor to the shell route that hosts this app.
(function () {
  var embedded = false;
  try { embedded = window.top !== window.self; } catch (e) { embedded = true; }
  if (embedded) {
    var d = document.documentElement;
    d.classList.add('nx-embedded');
    var s = document.createElement('style');
    s.textContent = 'html.nx-embedded{--header-height:0px !important}' +
      'html.nx-embedded body>header,html.nx-embedded .settings-panel,html.nx-embedded .side-nav,html.nx-embedded .nav-overlay,html.nx-embedded #waifu,html.nx-embedded #waifu-toggle,' +
      'html.nx-embedded .gc-sidebar,html.nx-embedded #fpsOSD{display:none !important}';
    d.appendChild(s);
    var p = location.pathname;
    // The game centre's side rail and frame-rate monitor belong to the shell now (one rail for the library
    // and every game). The copies inside a game stay switched off, in the way the games themselves
    // understand, so their layout uses the full frame.
    try { localStorage.setItem('showSidebar', 'false'); localStorage.setItem('fpsOSDActive', 'false'); } catch (e) { /* private mode */ }
    var railOff = function () {
      var sb = document.getElementById('gcSidebar');
      if (!sb || sb.classList.contains('hidden-sidebar')) return false;
      sb.classList.add('hidden-sidebar');
      return true;
    };
    var seen = new MutationObserver(railOff);
    seen.observe(d, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () {
      seen.disconnect();
      railOff();
      var sb = document.getElementById('gcSidebar');
      if (sb) new MutationObserver(function () { if (railOff()) window.dispatchEvent(new Event('resize')); }).observe(sb, { attributes: true, attributeFilter: ['class'] });
    });
    // Two documents of the old site have been replaced by pages of the site itself: the game hub and the
    // Nagato Sakura project page. What is left of each is a stub that only loads this script; the documents
    // still in use keep linking to them (a game sends itself "back to the game centre").
    var gone = [[/\/game-center\/game-center\.html$/, '/apps/game-center/'], [/\/nagato-sakura\/nagato-sakura\.html$/, '/apps/nagato-sakura/']];
    var replaced = function (pathname) {
      for (var i = 0; i < gone.length; i++) if (gone[i][0].test(pathname)) return gone[i][1];
      return null;
    };
    // A trip to one of them is stopped before the frame navigates (so the browser's history is not littered
    // with a page nobody sees) and the shell makes the trip instead.
    if (window.navigation && window.navigation.addEventListener) {
      window.navigation.addEventListener('navigate', function (e) {
        try {
          var to = e.cancelable && replaced(new URL(e.destination.url).pathname);
          if (to) {
            e.preventDefault();
            window.parent.postMessage({ nx: 'go', href: to }, location.origin);
          }
        } catch (err) { /* leave the navigation alone */ }
      });
    }
    // where that is not possible the stub loads inside the frame, and hands the trip to the shell from there
    var here = replaced(p);
    if (here) {
      d.style.visibility = 'hidden';
      try { window.parent.postMessage({ nx: 'go', href: here }, location.origin); } catch (e) { /* not same-origin */ }
      return;
    }
    // games and the tuning calculator wear the site's skin (shape, type, layout)
    if (/\/projects\/(game-center\/games\/(snake|piano|wallclimber|cyberrace)\/|forza-tuning-calculator\/)/.test(p)) {
      d.classList.add('nx-skin');
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = '/assets/css/game-skin.css';
      (document.head || d).appendChild(l);
      // the skin is dark, like every page of the site: keep these documents on their dark variant
      var dark = function () { if (d.getAttribute('data-theme') !== 'dark') d.setAttribute('data-theme', 'dark'); };
      dark();
      new MutationObserver(dark).observe(d, { attributes: true, attributeFilter: ['data-theme'] });
    }
    // keyboard-and-mouse games get a gamepad through the bridge (Cyber Race reads the pad itself)
    if (/\/game-center\/games\/(snake|wallclimber)\//.test(p)) {
      var b = document.createElement('script');
      b.src = '/assets/js/pad-bridge.js';
      (document.head || d).appendChild(b);
    }
    return;
  }
  var map = [
    [/\/nagato-sakura\/nagato-sakura\.html$/, 'nagato-sakura'],
    [/\/music-player\//, 'music'],
    [/\/forza-tuning-calculator\//, 'forza'],
    [/\/games\/cyberrace\//, 'cyber-race'],
    [/\/games\/nsroom\//, 'ns-room'],
    [/\/games\/snake\//, 'snake'],
    [/\/games\/piano\//, 'piano'],
    [/\/games\/wallclimber\//, 'wall-climber'],
    [/\/game-center\//, 'game-center']
  ];
  for (var i = 0; i < map.length; i++) {
    if (map[i][0].test(location.pathname)) { location.replace('/apps/' + map[i][1] + '/'); return; }
  }
})();
