/* Dev-server client — injected by scripts/dev.mjs only, never part of a build.
 * Reloads on rebuild and keeps you on the scene you were looking at.
 * URL: ?scene=N (1-based) jumps to a scene on load. */
(function () {
  var KEY = 'vigil.dev.scene';
  function current() { return window.VIGIL && window.VIGIL.App ? window.VIGIL.App.cur : null; }

  var es = new EventSource('/__vigil/events');
  es.addEventListener('reload', function () {
    var i = current();
    try { if (i !== null) sessionStorage.setItem(KEY, String(i)); } catch (e) { }
    location.reload();
  });

  addEventListener('DOMContentLoaded', function () {
    // Runs after the app's own DOMContentLoaded boot() (registered earlier).
    if (!window.VIGIL || !window.VIGIL.App.ready) return;
    var want = null;
    var q = new URLSearchParams(location.search).get('scene');
    if (q) want = parseInt(q, 10) - 1;
    else { try { var v = sessionStorage.getItem(KEY); if (v !== null) want = parseInt(v, 10); } catch (e) { } }
    if (want !== null && want >= 0 && want < window.VIGIL.SCENES.length) {
      window.VIGIL.hop(want);
      // Any non-F12 key dismisses the boot card; Shift is otherwise unhandled.
      dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    }
  });
})();
