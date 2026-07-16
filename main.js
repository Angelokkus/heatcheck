// ============================================================================
//  HeatCheck landing — vanilla JS (no frameworks, no trackers)
// ============================================================================

// ⚙️  ЗАМЕНИТЬ НА РЕАЛЬНЫЕ ССЫЛКИ ПОСЛЕ ПУБЛИКАЦИИ.
//    Пока значение '#' — кнопка показывает состояние «Скоро / Coming soon».
//    Ожидаемые адреса после одобрения (просто раскомментируйте/вставьте):
//      firefox: 'https://addons.mozilla.org/firefox/addon/heatcheck-faceit-cs2-stats/'
//      opera:   'https://addons.opera.com/ru/extensions/details/heatcheck-faceit-cs2-stats/'
//      chrome:  'https://chromewebstore.google.com/detail/<ID>'
//      yandex → используйте ту же ссылку, что и chrome (ставится из Chrome Web Store)
const LINKS = {
  chrome: '#',
  firefox: '#',
  opera: '#', // ставится из Chrome Web Store
  yandex: '#', // ставится из Chrome Web Store
};

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Год в футере
// ---------------------------------------------------------------------------
document.getElementById('year').textContent = String(new Date().getFullYear());

// ---------------------------------------------------------------------------
// Кнопки установки: состояние по LINKS + автоопределение браузера
// ---------------------------------------------------------------------------
function detectBrowser() {
  const ua = navigator.userAgent;
  if (/YaBrowser/i.test(ua)) return 'yandex';
  if (/OPR\/|Opera/i.test(ua)) return 'opera';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Edg\//i.test(ua)) return 'chrome'; // Edge — тоже Chromium
  if (/Chrome|Chromium/i.test(ua)) return 'chrome';
  return null;
}

(function initInstall() {
  const current = detectBrowser();
  document.querySelectorAll('.install-card').forEach(card => {
    const key = card.dataset.browser;
    const url = LINKS[key];
    const available = url && url !== '#';

    if (available) {
      card.classList.add('available');
      card.href = url;
    } else {
      card.classList.add('soon');
      card.setAttribute('aria-disabled', 'true');
      card.removeAttribute('target');
      card.addEventListener('click', e => e.preventDefault());
    }

    if (key === current) {
      card.classList.add('recommended');
      const badge = card.querySelector('.rec-badge');
      if (badge) badge.hidden = false;
    }
  });
})();

// ---------------------------------------------------------------------------
// Появление секций при скролле (Intersection Observer)
// ---------------------------------------------------------------------------
(function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (REDUCED || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );
  items.forEach(el => io.observe(el));
})();

// ---------------------------------------------------------------------------
// Фоновая техно-сетка на <canvas>
// ---------------------------------------------------------------------------
(function initGrid() {
  const canvas = document.getElementById('bg-grid');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;

  const GAP = 46; // шаг сетки, px
  const NODE = 'rgba(31, 31, 36, 1)'; // #1F1F24
  const LINE = 'rgba(31, 31, 36, 0.55)';
  const ACCENT = [255, 90, 31]; // #FF5A1F

  // Статичная сетка рендерится ОДИН раз в offscreen-канвас и потом просто
  // блитится — это на порядок дешевле, чем перерисовывать её каждый кадр.
  const grid = document.createElement('canvas');
  const gctx = grid.getContext('2d');

  let dpr = 1, w = 0, h = 0, gw = 0, gh = 0;
  let parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  let pulses = [], flashes = [];
  let raf = 0, running = false;
  let lastPulse = 0, lastFlash = 0;

  function rgba(a) { return `rgba(${ACCENT[0]},${ACCENT[1]},${ACCENT[2]},${a})`; }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGrid();
  }

  function buildGrid() {
    gw = w + GAP * 2;
    gh = h + GAP * 2;
    grid.width = Math.floor(gw * dpr);
    grid.height = Math.floor(gh * dpr);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.clearRect(0, 0, gw, gh);
    gctx.strokeStyle = LINE;
    gctx.lineWidth = 1;
    gctx.beginPath();
    for (let x = 0; x <= gw; x += GAP) { gctx.moveTo(x, 0); gctx.lineTo(x, gh); }
    for (let y = 0; y <= gh; y += GAP) { gctx.moveTo(0, y); gctx.lineTo(gw, y); }
    gctx.stroke();
    gctx.fillStyle = NODE;
    for (let x = 0; x <= gw; x += GAP)
      for (let y = 0; y <= gh; y += GAP) gctx.fillRect(x - 1, y - 1, 2, 2);
  }

  // Мягкая точка-«свечение» без дорогого shadowBlur — слоями полупрозрачных кругов.
  function glowDot(x, y, r, a) {
    ctx.fillStyle = rgba(a * 0.22); ctx.beginPath(); ctx.arc(x, y, r * 2.8, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(a * 0.45); ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(a);        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function blitGrid() {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(grid, -GAP + parallax.x, -GAP + parallax.y, gw, gh);
  }

  function spawnPulse() {
    if (Math.random() < 0.5) {
      const y = Math.round((Math.random() * h) / GAP) * GAP;
      const dir = Math.random() < 0.5 ? 1 : -1;
      pulses.push({ x: dir > 0 ? -20 : w + 20, y, vx: dir * (1.5 + Math.random() * 1.6), vy: 0 });
    } else {
      const x = Math.round((Math.random() * w) / GAP) * GAP;
      const dir = Math.random() < 0.5 ? 1 : -1;
      pulses.push({ x, y: dir > 0 ? -20 : h + 20, vx: 0, vy: dir * (1.5 + Math.random() * 1.6) });
    }
    if (pulses.length > 14) pulses.shift();
  }

  function spawnFlash() {
    flashes.push({ x: Math.round((Math.random() * w) / GAP) * GAP, y: Math.round((Math.random() * h) / GAP) * GAP, life: 1 });
    if (flashes.length > 10) flashes.shift();
  }

  function frame(t) {
    if (!running) return;
    parallax.x += (parallax.tx - parallax.x) * 0.05;
    parallax.y += (parallax.ty - parallax.y) * 0.05;

    blitGrid();

    if (t - lastPulse > 620) { spawnPulse(); lastPulse = t; }
    if (t - lastFlash > 1000) { spawnFlash(); lastFlash = t; }

    ctx.save();
    ctx.translate(parallax.x, parallax.y); // всё динамическое — в системе координат сетки

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) { pulses.splice(i, 1); continue; }
      // хвост
      const grad = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 7, p.y - p.vy * 7);
      grad.addColorStop(0, rgba(0.45)); grad.addColorStop(1, rgba(0));
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 7, p.y - p.vy * 7); ctx.stroke();
      glowDot(p.x, p.y, 1.7, 0.9);
    }

    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= 0.013;
      if (f.life <= 0) { flashes.splice(i, 1); continue; }
      glowDot(f.x, f.y, 1.6, f.life * 0.85);
      ctx.strokeStyle = rgba(f.life * 0.3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(f.x, f.y, 10 * (1 - f.life) + 2, 0, TAU); ctx.stroke();
    }

    ctx.restore();
    raf = requestAnimationFrame(frame);
  }

  function start() { if (running || REDUCED) return; running = true; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (!REDUCED) {
    window.addEventListener('mousemove', e => {
      parallax.tx = (e.clientX / w - 0.5) * -16;
      parallax.ty = (e.clientY / h - 0.5) * -16;
    }, { passive: true });
  }

  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { resize(); if (REDUCED) blitGrid(); }, 150);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  resize();
  if (REDUCED) blitGrid();
  else start();
})();
