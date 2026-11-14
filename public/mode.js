// Day or night, decided before the page is first drawn, so it doesn't open in one and jump to
// the other: the choice kept in this browser if there is one, or else the system's setting.
// (src/mode.js takes over from here; the rule itself is modeOf in core/mode.js. This is a
// file of its own, not a script in the page, because the site's Content-Security-Policy only
// runs scripts that come from the site.)
(function(){
  var mode = null;
  try { mode = localStorage.getItem('rs:mode'); } catch (_) {}
  if (mode !== 'day' && mode !== 'night') mode = matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  document.documentElement.setAttribute('data-mode', mode);
})();
