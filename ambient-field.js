/* ambient-field — vanilla web-component port of Playproof's AmbientBackground.
   A drifting colour-smoke field: soft blobs advected by a curl-ish flow field,
   tinted from a mood's base + drift colours, with a slow global "breath".
   Decorative, non-interactive, pauses when hidden, single static frame under
   prefers-reduced-motion. Usage:
     <ambient-field base="#13112A" drift="#1E2348,#E8A24E,#A9763C,#8A4A2A,#7E4A48"></ambient-field>
   Size/position it with CSS on the host (e.g. position:fixed; inset:0). */
(function () {
  function hexToRgb(hex) {
    var v = hex.replace('#', '').trim();
    var f = v.length === 3 ? v.split('').map(function (c) { return c + c; }).join('') : v;
    return { r: parseInt(f.slice(0, 2), 16), g: parseInt(f.slice(2, 4), 16), b: parseInt(f.slice(4, 6), 16) };
  }

  var CONFIG = {
    particleCount: 170, sharpness: 13, blobScale: 1.3, intensity: 0.6,
    breathDepth: 1, breathPeriodSec: 40, dprCap: 1.25, nightAlpha: 0.2,
  };

  function startSmoke(canvas, base, drift, opts) {
    opts = opts || {};
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, CONFIG.dprCap);
    var ctx = canvas.getContext('2d');
    if (!ctx) return function () {};

    var small = window.innerWidth < 760;
    var particleCount = opts.particleCount || (small ? 95 : CONFIG.particleCount);
    var intensity = opts.intensity || CONFIG.intensity;
    var palette = drift.length ? drift : ['#E8A24E'];

    // Pre-render one soft sprite per colour.
    var sprites = palette.map(function (hex) {
      var s = 160, c = document.createElement('canvas');
      c.width = c.height = s;
      var g = c.getContext('2d'), rgb = hexToRgb(hex);
      var grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.70)');
      grad.addColorStop(0.35, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.26)');
      grad.addColorStop(0.7, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.06)');
      grad.addColorStop(1, 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0)');
      g.fillStyle = grad; g.fillRect(0, 0, s, s);
      return c;
    });

    var W = 0, H = 0, resizeTimer;
    var attractors = palette.map(function () {
      return {
        bx: 0.2 + Math.random() * 0.6, by: 0.2 + Math.random() * 0.6,
        ax: 0.22 + Math.random() * 0.3, ay: 0.22 + Math.random() * 0.3,
        sx: 0.6 + Math.random() * 0.6, sy: 0.6 + Math.random() * 0.6,
        phx: Math.random() * Math.PI * 2, phy: Math.random() * Math.PI * 2,
        rate: 0.024 + Math.random() * 0.04,
      };
    });
    var attX = function (a, t) { return (a.bx + Math.sin(t * a.rate * a.sx + a.phx) * a.ax) * W; };
    var attY = function (a, t) { return (a.by + Math.cos(t * a.rate * a.sy + a.phy) * a.ay) * H; };

    function pickColor(x, y, t) {
      var sum = 0, w = [];
      for (var i = 0; i < attractors.length; i++) {
        var dx = (x - attX(attractors[i], t)) / W, dy = (y - attY(attractors[i], t)) / H;
        var wi = Math.exp(-(dx * dx + dy * dy) * CONFIG.sharpness);
        w.push(wi); sum += wi;
      }
      var r = Math.random() * sum;
      for (var j = 0; j < w.length; j++) { r -= w[j]; if (r <= 0) return j; }
      return w.length - 1;
    }

    var particles = [];
    function spawn(p, t) {
      p.x = Math.random() * W; p.y = Math.random() * H;
      p.vx = (Math.random() - 0.5) * 0.12; p.vy = (Math.random() - 0.5) * 0.12;
      p.size = (150 + Math.random() * 240) * CONFIG.blobScale;
      p.life = 0; p.maxLife = 900 + Math.random() * 1000;
      p.ci = pickColor(p.x, p.y, t);
      p.phase = Math.random() * Math.PI * 2; p.pulse = 0.5 + Math.random() * 0.9;
    }

    function resize() {
      var host = canvas.parentElement || canvas;
      var r = host.getBoundingClientRect();
      var newW = r.width || window.innerWidth, newH = r.height || window.innerHeight;
      // Skip the canvas-clear if nothing meaningful changed (prevents flicker when
      // the mobile URL bar hides/shows and briefly changes the reported height).
      if (newW === W && newH === H) return;
      W = newW; H = newH;
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (!particles.length) {
        for (var i = 0; i < particleCount; i++) { var p = {}; spawn(p, 0); particles.push(p); }
      }
    }
    resize();
    // Debounce so rapid mobile scroll events (URL-bar show/hide triggers ResizeObserver
    // every few ms) don't cause repeated canvas.width resets that blank the frame.
    var ro = new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });
    ro.observe(canvas.parentElement || canvas);

    function flow(x, y, t) {
      var a = Math.sin(x * 0.0035 + t * 0.2) + Math.cos(y * 0.004 - t * 0.15);
      var b = Math.cos(x * 0.003 - t * 0.17) + Math.sin(y * 0.0045 + t * 0.22);
      return Math.atan2(b, a);
    }

    var breathRate = (2 * Math.PI) / CONFIG.breathPeriodSec;
    var t = 0, raf = 0, running = !reduced;

    function draw() {
      t += 0.016;
      var breath = 0.5 + 0.5 * Math.sin(t * breathRate);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var ang = flow(p.x, p.y, t);
        p.vx += Math.cos(ang) * 0.01; p.vy += Math.sin(ang) * 0.01;
        p.vx *= 0.95; p.vy *= 0.95; p.x += p.vx; p.y += p.vy;
        if (p.x < -p.size) p.x += W + p.size * 2; else if (p.x > W + p.size) p.x -= W + p.size * 2;
        if (p.y < -p.size) p.y += H + p.size * 2; else if (p.y > H + p.size) p.y -= H + p.size * 2;
        p.life++;
        if (p.life >= p.maxLife) { spawn(p, t); continue; }
        var fade = Math.sin(Math.min(1, p.life / p.maxLife) * Math.PI);
        var localBreath = 1 + Math.sin(t * 0.45 * p.pulse + p.phase) * 0.35 * CONFIG.breathDepth;
        var sz = p.size * (1 + (breath - 0.5) * 0.6 * CONFIG.breathDepth) * localBreath;
        ctx.globalAlpha = CONFIG.nightAlpha * fade * intensity * (1 + (breath - 0.5) * CONFIG.breathDepth);
        ctx.drawImage(sprites[p.ci], p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(draw);
    }

    if (reduced) draw(); else raf = requestAnimationFrame(draw);

    function onVis() {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduced && !running) { running = true; raf = requestAnimationFrame(draw); }
    }
    document.addEventListener('visibilitychange', onVis);

    return function () {
      running = false; cancelAnimationFrame(raf);
      ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
    };
  }

  if (!customElements.get('ambient-field')) {
    customElements.define('ambient-field', class extends HTMLElement {
      connectedCallback() {
        if (this._canvas) return;
        var c = this._canvas = document.createElement('canvas');
        c.setAttribute('aria-hidden', 'true');
        c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
        if (getComputedStyle(this).position === 'static') this.style.position = 'absolute';
        this.style.display = 'block';
        if (!this.style.width) this.style.width = '100%';
        if (!this.style.height) this.style.height = '100%';
        this.style.inset = this.style.inset || '0';
        this.appendChild(c);
        var base = this.getAttribute('base') || '#13112A';
        var drift = (this.getAttribute('drift') || '#1E2348,#E8A24E,#A9763C,#8A4A2A,#7E4A48')
          .split(',').map(function (s) { return s.trim(); });
        this._stop = startSmoke(c, base, drift);
      }
      disconnectedCallback() { if (this._stop) { this._stop(); this._stop = null; } this._canvas = null; }
    });
  }
})();
