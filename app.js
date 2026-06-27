/* Playproof site — font loading + dyslexia-friendly toggle.
   Default: Atkinson Hyperlegible (legible for everyone), loaded here so there's
   no CSS @import. Toggle flips the whole site to self-hosted OpenDyslexic and
   remembers the choice. */
(function () {
  // Load Atkinson Hyperlegible (the default UI font).
  var pc1 = document.createElement('link'); pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com';
  var pc2 = document.createElement('link'); pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'; pc2.crossOrigin = '';
  var css = document.createElement('link'); css.rel = 'stylesheet';
  css.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&display=swap';
  document.head.appendChild(pc1); document.head.appendChild(pc2); document.head.appendChild(css);

  var KEY = 'pp-dyslexic';
  function apply(on) { document.documentElement.classList.toggle('dys', on); }
  apply(localStorage.getItem(KEY) === '1');

  function addToggle() {
    var foot = document.querySelector('footer .wrap');
    if (!foot) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fonttoggle';
    btn.setAttribute('aria-pressed', document.documentElement.classList.contains('dys'));
    function label() {
      var on = document.documentElement.classList.contains('dys');
      btn.innerHTML = 'Aa Dyslexia-friendly font: <b>' + (on ? 'On' : 'Off') + '</b>';
      btn.setAttribute('aria-pressed', on);
    }
    label();
    btn.addEventListener('click', function () {
      var on = !document.documentElement.classList.contains('dys');
      apply(on); localStorage.setItem(KEY, on ? '1' : '0'); label();
    });
    foot.appendChild(btn);
  }
  if (document.readyState !== 'loading') addToggle();
  else document.addEventListener('DOMContentLoaded', addToggle);
})();
