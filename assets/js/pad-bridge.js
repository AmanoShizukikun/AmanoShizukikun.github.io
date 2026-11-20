// Gamepad bridge for the games that were written for keyboard and mouse (loaded by embed.js inside the
// app frame; Cyber Race reads the pad itself and does not get this).
//
//   in a menu   d-pad / left stick moves between the buttons on screen · A presses · B goes back
//   in play     the pad is turned into the keys the game already listens for:
//     Neon Snake     d-pad / left stick = direction · START = pause · B = quit (asks first)
//     Wall Climber   left stick = move · right stick = look · A = jump / climb · B = crouch / slide ·
//                    X or L3 = run on/off · START = pause
// Leaving a game (hold VIEW) is handled by the shell, outside the frame.
(function () {
  var path = location.pathname;
  var name = /\/games\/snake\//.test(path) ? 'snake' : /\/games\/wallclimber\//.test(path) ? 'wall' : null;
  if (!name || !navigator.getGamepads) return;

  var BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, view: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15 };
  var q = function (sel) { return document.querySelector(sel); };
  var key = function (type, k, code) { document.dispatchEvent(new KeyboardEvent(type, { key: k, code: code, bubbles: true, cancelable: true })); };
  var tap = function (k, code) { key('keydown', k, code); key('keyup', k, code); };

  var GAMES = {
    snake: {
      playing: function () { return !!q('#gameMain.active') && !q('#gameOverPanel.active, #exitConfirmPanel.active'); },
      panels: ['#exitConfirmPanel.active', '#gameOverPanel.active', '#instructionsPanel.active', '#difficultyPanel.active'],
      back: ['#exitCancelBtn', '#difficultyBackBtn', '#instructionsBackBtn', '#menuBtn'],
      press: {
        up: function () { tap('ArrowUp', 'ArrowUp'); }, down: function () { tap('ArrowDown', 'ArrowDown'); },
        left: function () { tap('ArrowLeft', 'ArrowLeft'); }, right: function () { tap('ArrowRight', 'ArrowRight'); },
        start: function () { tap(' ', 'Space'); },
        b: function () { var e = q('#exitBtn'); if (e) e.click(); },
      },
    },
    wall: {
      // `gameRunning`, `gamePaused` and `player` are the game's own top-level bindings
      playing: function () { try { return gameRunning && !gamePaused; } catch (e) { return false; } },   // eslint-disable-line no-undef
      panels: ['#pauseOverlay.active', '#instructionsPanel.active'],
      back: ['#instructionsBackBtn', '#pauseResumeBtn'],
      hold: { up: ['w', 'KeyW'], down: ['s', 'KeyS'], left: ['a', 'KeyA'], right: ['d', 'KeyD'], a: [' ', 'Space'], b: ['c', 'KeyC'] },
      press: {
        x: function () { tap('Shift', 'ShiftLeft'); }, l3: function () { tap('Shift', 'ShiftLeft'); },
        start: function () { tap('Escape', 'Escape'); },
      },
      menuPress: { start: function () { try { if (gameRunning) tap('Escape', 'Escape'); } catch (e) { /* not started */ } } },   // eslint-disable-line no-undef
      look: function (x, y, dt) {
        try {
          player.yaw -= x * 2.6 * dt;                                                                      // eslint-disable-line no-undef
          player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - y * 2.0 * dt));                       // eslint-disable-line no-undef
        } catch (e) { /* not ready */ }
      },
    },
  };
  var game = GAMES[name];

  // ---------- menu focus ----------
  var focus = null;
  function buttons() {
    // an open panel takes the focus: only its own buttons count
    var scope = document;
    for (var j = 0; j < game.panels.length; j++) { var panel = q(game.panels[j]); if (panel) { scope = panel; break; } }
    var out = [], all = scope.querySelectorAll('button, [role="button"]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.disabled || el.closest('.gc-sidebar, .fps-osd, body > header, .settings-panel, .side-nav')) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue;
      var top = document.elementFromPoint(cx, cy);          // only what can actually be pressed right now
      if (!top || !(top === el || el.contains(top))) continue;
      out.push({ el: el, x: cx, y: cy });
    }
    return out;
  }
  function mark(el) {
    if (focus && focus !== el) focus.classList.remove('nx-pad-focus');
    focus = el || null;
    if (focus) { focus.classList.add('nx-pad-focus'); if (focus.scrollIntoView) focus.scrollIntoView({ block: 'nearest' }); }
  }
  function current(list) { for (var i = 0; i < list.length; i++) if (list[i].el === focus) return list[i]; return null; }
  function first(list) { list.sort(function (a, b) { return a.y - b.y || a.x - b.x; }); return list[0] ? list[0].el : null; }
  function menuMove(dir) {
    var list = buttons(), cur = current(list);
    if (!cur) { mark(first(list)); return; }
    var best = null, bestD = Infinity;
    for (var i = 0; i < list.length; i++) {
      var c = list[i], dx = c.x - cur.x, dy = c.y - cur.y;
      if (c.el === cur.el) continue;
      var along = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
      var across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
      if (along < 6) continue;
      var dist = along + across * 2.5;
      if (dist < bestD) { bestD = dist; best = c.el; }
    }
    if (best) mark(best);
  }
  function refocus() { if (!game.playing()) { var list = buttons(); if (!current(list)) mark(first(list)); } else mark(null); }
  function menuPress(k) {
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { menuMove(k); return; }
    if (k === 'a') {
      var list = buttons(), cur = current(list);
      if (!cur) { mark(first(list)); return; }
      cur.el.click();
      setTimeout(refocus, 260);                                // the screen behind the button has changed
      return;
    }
    if (k === 'b') {
      var all = buttons();
      for (var i = 0; i < game.back.length; i++) {
        var el = q(game.back[i]);
        if (el && all.some(function (c) { return c.el === el; })) { el.click(); setTimeout(refocus, 260); return; }
      }
      return;
    }
    if (game.menuPress && game.menuPress[k]) { game.menuPress[k](); setTimeout(refocus, 260); }
  }
  addEventListener('pointerdown', function () { mark(null); }, true);

  // ---------- polling ----------
  var timer = 0, was = null, held = {}, next = {}, lastT = 0, wasPlaying = false;
  function pad() { var l = navigator.getGamepads(); for (var i = 0; i < l.length; i++) if (l[i] && l[i].connected !== false) return l[i]; return null; }
  function release() { for (var k in held) if (held[k]) { key('keyup', game.hold[k][0], game.hold[k][1]); held[k] = false; } }
  // polled on a timer, not on animation frames: a short tap must not be lost when frames are slow
  function tick() {
    var now = performance.now();
    var p = pad(), dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!p || document.hidden) { release(); was = null; return; }
    var s = {};
    for (var k in BTN) { var b = p.buttons[BTN[k]]; s[k] = !!b && (b.pressed || b.value > 0.5); }
    var x = p.axes[0] || 0, y = p.axes[1] || 0, T = 0.5;
    if (y < -T) s.up = true; else if (y > T) s.down = true;
    if (x < -T) s.left = true; else if (x > T) s.right = true;
    if (!was) { was = s; return; }                              // what is already held when the game opens does not count
    var playing = game.playing();
    if (playing !== wasPlaying) { wasPlaying = playing; release(); setTimeout(refocus, 200); }
    for (var n in s) {
      var dirKey = n === 'up' || n === 'down' || n === 'left' || n === 'right';
      var fresh = s[n] && !was[n];
      var again = !playing && dirKey && s[n] && was[n] && now >= (next[n] || 0);
      if (fresh) next[n] = now + 380; else if (again) next[n] = now + 140;
      if (playing) {
        if (game.hold && game.hold[n]) {
          if (s[n] && !held[n]) { held[n] = true; key('keydown', game.hold[n][0], game.hold[n][1]); }
          else if (!s[n] && held[n]) { held[n] = false; key('keyup', game.hold[n][0], game.hold[n][1]); }
        } else if (fresh && game.press[n]) game.press[n]();
      } else if (fresh || again) menuPress(n);
    }
    if (playing && game.look) {
      var rx = p.axes[2] || 0, ry = p.axes[3] || 0, dead = 0.16;
      var curve = function (v) { return Math.abs(v) < dead ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - dead) / (1 - dead), 1.6); };
      game.look(curve(rx), curve(ry), dt);
    }
    was = s;
  }
  function start() { if (!timer) { lastT = performance.now(); timer = setInterval(tick, 16); } }
  addEventListener('gamepadconnected', start);
  if (pad()) start();
})();
