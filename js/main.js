/* Single source of truth for "is the stacked layout active?" — reads the
   value CSS itself resolved, instead of trusting window.innerWidth. */
window.ovalStacked = function () {
  return getComputedStyle(document.documentElement)
           .getPropertyValue('--layout').trim() === 'stacked';
};

/* ══════════════════════════════════════════════════════════════
   EXPERIENCE — one-shot entrance for the 2x2 grid.
   Replaces the old scroll-driven deck: that made scroll advance the
   page AND swap cards at once, so a card never held still long
   enough to read. Now the cards settle in once and stay put.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var grid = document.getElementById('expGrid');
  if (!grid) return;

  function show() { grid.classList.add('is-in'); }
  function reset() { grid.classList.remove('is-in'); }

  if (!('IntersectionObserver' in window)) { show(); return; }

  /* Replays on every visit rather than firing once.
     Two thresholds, and the observer is never detached:
       ratio >= 0.15        -> play
       fully out of view    -> rearm
     Rearming only at ratio 0 matters — resetting while any part of the
     grid is still on screen would fade the cards out under the reader. */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.intersectionRatio >= 0.15) show();
      else if (!e.isIntersecting) reset();
    });
  }, { threshold: [0, 0.15] });

  io.observe(grid);

  /* ── Pointer sheen ──
     Feeds the cursor position to each card as --mx / --my; the highlight
     itself is a CSS radial-gradient, so only light moves and the text
     stays exactly where it is. Skipped where there is no hover. */
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  [].forEach.call(grid.querySelectorAll('.ecard'), function (card) {
    var pending = false, px = 0, py = 0;

    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 100;
      py = ((e.clientY - r.top) / r.height) * 100;

      /* One write per frame — pointermove fires far more often than that */
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        card.style.setProperty('--mx', px.toFixed(2) + '%');
        card.style.setProperty('--my', py.toFixed(2) + '%');
      });
    });

    /* Park it in the middle so the next hover fades in from centre
       rather than snapping from wherever the pointer last left */
    card.addEventListener('pointerleave', function () {
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
    });
  });
})();

/* ══════════════════════════════════════════════════════════════
   PROCESS — highlights whichever card is in the reading zone and
   lets the pinned list scroll to a step. Rect-polled in rAF, like
   the other sections, so it works regardless of scroll container.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var sec = document.getElementById('process');
  if (!sec) return;

  var steps = Array.prototype.slice.call(sec.querySelectorAll('.pw__step'));
  var cards = Array.prototype.slice.call(sec.querySelectorAll('.pw__card'));
  if (!steps.length || steps.length !== cards.length) return;

  /* Clicking a step scrolls its card into view */
  steps.forEach(function (step, i) {
    step.addEventListener('click', function () {
      cards[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var active = 0;

  function setActive(i) {
    if (i === active) return;
    active = i;
    steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
    cards.forEach(function (c, k) { c.classList.toggle('is-on', k === i); });
  }

  /* The last card whose top has crossed the reading line wins */
  function pick() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var line = vh * 0.45;
    var found = 0;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getBoundingClientRect().top <= line) found = i;
    }
    return found;
  }

  /* Runs at every width — stacked cards light up one by one on scroll too */
  function frame() {
    setActive(pick());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ══════════════════════════════════════════════════════════════
   SPECIALISTS — accordion. Hover opens a card, leaving the row
   restores the default one. Click/focus covered for touch + keyboard.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var row = document.getElementById('specRow');
  if (!row) return;

  var cards = Array.prototype.slice.call(row.querySelectorAll('.scard'));
  if (!cards.length) return;

  var DEFAULT = 0;
  var stacked = { get matches() { return window.ovalStacked(); } };

  function open(i) {
    cards.forEach(function (c, k) { c.classList.toggle('is-open', k === i); });
  }

  cards.forEach(function (card, i) {
    card.addEventListener('mouseenter', function () {
      if (!stacked.matches) open(i);
    });
    card.addEventListener('focus', function () {
      if (!stacked.matches) open(i);
    });
    card.addEventListener('click', function () { open(i); });
  });

  row.addEventListener('mouseleave', function () {
    if (!stacked.matches) open(DEFAULT);
  });
})();

(function () {
  var burger = document.getElementById('hamburger');
  var menu   = document.getElementById('mobileMenu');

  function setOpen(open) {
    burger.classList.toggle('is-open', open);
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  burger.addEventListener('click', function () {
    setOpen(!burger.classList.contains('is-open'));
  });

  /* closest(), not tagName: the rows wrap their text in spans now, so a tap
     usually lands on a child rather than the <a> itself. */
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a, button')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) setOpen(false);
  });
})();

/* ══════════════════════════════════════════════════════════════
   ABOUT — scroll-driven word-by-word colour reveal
   ══════════════════════════════════════════════════════════════ */
(function () {
  var el = document.getElementById('aboutText');
  if (!el) return;

  /* ── 1. Split text nodes into word spans, preserving <br> ── */
  var words = [];

  (function split(node) {
    var kids = Array.prototype.slice.call(node.childNodes);

    kids.forEach(function (child) {
      if (child.nodeType === 3) {
        // Text node — break into words, keep the whitespace between them
        var frag  = document.createDocumentFragment();
        var parts = child.nodeValue.split(/(\s+)/);

        parts.forEach(function (part) {
          if (part === '') return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            var span = document.createElement('span');
            span.className = 'word';
            span.textContent = part;
            frag.appendChild(span);
            words.push(span);
          }
        });

        node.replaceChild(frag, child);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        split(child);
      }
    });
  })(el);

  if (!words.length) return;

  /* First word stays solid — matches the static Figma state */
  words[0].classList.add('word--anchor');

  /* Reduced motion is not a reason to disable this either — it is a
     scroll-position reveal, not autoplay. Same webview problem as the
     other two blocks, so it now always runs. */

  /* ── 3. Map scroll position → reveal progress ── */
  var FADE_MIN   = 0.2;  // starting alpha (Figma faded grey)
  var SOFTNESS   = 2.5;  // how many words cross-fade at once — higher = smoother

  function update() {

    var rect = el.getBoundingClientRect();
    var vh   = window.innerHeight || document.documentElement.clientHeight;

    /* Window: begins when the block's top passes 82% of the viewport,
       completes when its bottom clears 45% of the viewport. */
    var start = vh * 0.82;
    var end   = vh * 0.45 - rect.height;
    var span  = start - end;
    if (span <= 0) span = 1;

    var progress = (start - rect.top) / span;
    progress = Math.max(0, Math.min(1, progress));

    /* Head of the reveal, in word units */
    var head = progress * (words.length + SOFTNESS);

    for (var i = 0; i < words.length; i++) {
      var t = (head - i) / SOFTNESS;         // 0 → untouched, 1 → fully solid
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      t = t * t * (3 - 2 * t);               // smoothstep for a softer edge

      var alpha = FADE_MIN + (1 - FADE_MIN) * t;
      words[i].style.color = 'rgba(31,31,31,' + alpha.toFixed(3) + ')';
    }
  }

  /* Polled every frame rather than driven by scroll events: when the page is
     embedded in a full-height iframe the parent does the scrolling and
     `scroll` never fires inside the frame. A rect read per frame is cheap. */
  function frame() {
    update();
    requestAnimationFrame(frame);
  }

  update();
  requestAnimationFrame(frame);
})();

/* ══════════════════════════════════════════════════════════════
   PROMISE — scroll-driven choreography

   Timeline is a chain of phases:
     draw  →  hold(card)  →  draw  →  hold(card)  →  draw  →  hold(card)

   • draw : the ball rides the head of the growing thread
   • hold : ball fades out at the card's entry, a circular reveal
            expands from that contact point, then the thread draws
            through the card and the ball fades back in at the exit

   Scroll position drives a target value; the rendered value eases
   toward it, so scrubbing backward retraces the identical path.
   Card boxes never change size — only clarity and reveal radius.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var sec = document.getElementById('promise');
  if (!sec) return;

  var line  = document.getElementById('threadLine');
  var ball  = document.getElementById('threadBall');
  var cards = Array.prototype.slice.call(sec.querySelectorAll('.pc'));
  var dots  = Array.prototype.slice.call(sec.querySelectorAll('.thread-dot'));

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Cards render fully open by default. Bail out only when there is genuinely
     nothing to drive, and say why — silent bails were impossible to diagnose. */
  if (!line || !ball) return;
  /* NOTE: no early return on the stacked layout. The check lives in the frame
     loop instead, because a one-shot decision is fragile — hosts emit bursts of
     resize/relayout during startup, and a single transient narrow reading used
     to kill the sequence permanently with no way back. */
  /* prefers-reduced-motion is NOT a reason to bail here — nothing autoplays,
     the whole sequence is bound to scroll position. Honouring the flag by
     stripping the content states would just hide the design. Instead the
     scrub easing is dropped, so the reveal tracks the scrollbar exactly.
     This is what made the block dead inside embedded webviews, which report
     `reduce` even when the host OS doesn't. */
  var smooth = !reduced.matches;

  /* ── Path geometry, computed in JS ───────────────────────────
     The path is sampled from its own Bezier data rather than via
     getTotalLength()/getPointAtLength(). Those APIs return 0 or throw on
     elements that are not currently rendered, which varies by engine and
     silently killed the whole sequence in embedded webviews.
     ────────────────────────────────────────────────────────── */
  var START = [880, 150];
  var SEGS = [
    [[872, 200], [888, 225], [901, 293]],
    [[914, 361], [913, 470], [913, 536]],
    [[913, 602], [740, 645], [609, 630]],
    [[478, 615], [490, 780], [524, 843]],
    [[558, 906], [600, 985], [700, 985]],
    [[800, 985], [840, 942], [894, 940]],
    [[948, 938], [1002, 992], [1040, 1048]]
  ];

  var PTS = [START], CUM = [0];
  (function sample() {
    var cur = START, PER = 300;
    for (var s = 0; s < SEGS.length; s++) {
      var c1 = SEGS[s][0], c2 = SEGS[s][1], e = SEGS[s][2];
      for (var i = 1; i <= PER; i++) {
        var t = i / PER, u = 1 - t;
        var x = u*u*u*cur[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*e[0];
        var y = u*u*u*cur[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*e[1];
        var pv = PTS[PTS.length - 1];
        CUM.push(CUM[CUM.length - 1] + Math.sqrt((x-pv[0])*(x-pv[0]) + (y-pv[1])*(y-pv[1])));
        PTS.push([x, y]);
      }
      cur = e;
    }
  })();

  var total = CUM[CUM.length - 1];

  /* Prefer the engine's own length for the dash pattern when available —
     both are in user units, and `drawn` is a fraction either way. */
  var dashTotal = total;
  try {
    var m = line.getTotalLength();
    if (m && isFinite(m) && m > 0) dashTotal = m;
  } catch (err) {}

  function pointAt(f) {
    var target = (f < 0 ? 0 : f > 1 ? 1 : f) * total;
    var lo = 0, hi = CUM.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (CUM[mid] < target) lo = mid + 1; else hi = mid;
    }
    var i = lo < 1 ? 1 : lo;
    var span = CUM[i] - CUM[i - 1];
    var k = span > 0 ? (target - CUM[i - 1]) / span : 0;
    return {
      x: PTS[i-1][0] + (PTS[i][0] - PTS[i-1][0]) * k,
      y: PTS[i-1][1] + (PTS[i][1] - PTS[i-1][1]) * k
    };
  }

  /* Anchor → fraction along the path */
  var ANCHORS = {
    start: START,
    c1e: [901, 293], c1x: [913, 536],
    c2e: [609, 630], c2x: [524, 843],
    c3e: [894, 940],
    end: [1040, 1048]
  };

  var F = {};
  Object.keys(ANCHORS).forEach(function (key) {
    var a = ANCHORS[key], bi = 0, bd = Infinity;
    for (var i = 0; i < PTS.length; i++) {
      var dx = PTS[i][0] - a[0], dy = PTS[i][1] - a[1];
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = i; }
    }
    F[key] = CUM[bi] / total;
  });

  /* ── Timeline ──────────────────────────────────────────────── */
  /* Share of the timeline each hold consumes. Lower = the ball spends
     more of its scroll budget gliding and less of it parked, which
     reads calmer since the distance between cards is fixed by layout. */
  var HOLD = 0.13;

  var phases = [
    { hold: -1, a: 'start', b: 'c1e' },
    { hold:  0, a: 'c1e',   b: 'c1x' },
    { hold: -1, a: 'c1x',   b: 'c2e' },
    { hold:  1, a: 'c2e',   b: 'c2x' },
    { hold: -1, a: 'c2x',   b: 'c3e' },
    { hold:  2, a: 'c3e',   b: 'end' }
  ];

  var weight = phases.map(function (ph) {
    return ph.hold < 0 ? (F[ph.b] - F[ph.a]) : HOLD;
  });
  var sum = weight.reduce(function (x, y) { return x + y; }, 0);

  var acc = 0;
  phases.forEach(function (ph, i) {
    ph.s = acc / sum;
    acc += weight[i];
    ph.e = acc / sum;
    ph.fa = F[ph.a];
    ph.fb = F[ph.b];
  });

  /* Each card's hold window, for the reveal + dot */
  var holdOf = [];
  phases.forEach(function (ph) { if (ph.hold >= 0) holdOf[ph.hold] = ph; });

  /* ── Helpers ───────────────────────────────────────────────── */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function remap(v, a, b) { return clamp01((v - a) / (b - a)); }
  function easeInOut(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function easeOut(t) { var u = 1 - t; return 1 - u * u * u; }

  /* Reveal radius ceiling, in --u units (1 unit = 1 design px at 1512).
     Farthest contact-to-corner span is ~495 design px, and the mask's solid
     core reaches only 55% of the radius, so the ceiling is 495 / 0.55 ≈ 900
     design px → 60 units. 66 leaves headroom. */
  var MAX_R = 66;

  /* Sub-timings inside a hold (local t, 0→1).
     The through-card draw finishes exactly when the ball starts fading
     back in, so the ball is always sitting on the thread's leading tip
     — never somewhere in the middle of an already-drawn stretch. */
  var BALL_OUT     = 0.22;   // ball fully faded out at the entry
  var REVEAL_IN    = 0.02;   // circular reveal starts
  var REVEAL_OUT   = 0.68;   // reveal complete — card fully legible
  var DRAW_IN      = 0.70;   // thread starts threading through the card
  var DRAW_OUT     = 0.88;   // thread reaches the exit
  var BALL_IN      = 0.88;   // ball starts reappearing — at the exit
  var BALL_IN_END  = 1.00;   // ball fully back

  /* ── Render one frame at progress p ───────────────────────── */
  function render(p) {
    /* Locate the active phase */
    var ph = phases[phases.length - 1];
    for (var i = 0; i < phases.length; i++) {
      if (p <= phases[i].e) { ph = phases[i]; break; }
    }
    var t = ph.e > ph.s ? clamp01((p - ph.s) / (ph.e - ph.s)) : 1;

    /* Thread length + ball opacity */
    var drawn, opacity;

    if (ph.hold < 0) {
      drawn   = ph.fa + (ph.fb - ph.fa) * easeInOut(t);
      opacity = 1;
    } else {
      drawn   = ph.fa + (ph.fb - ph.fa) * easeInOut(remap(t, DRAW_IN, DRAW_OUT));
      opacity = Math.max(
        1 - remap(t, 0, BALL_OUT),               // fade out at the entry
        remap(t, BALL_IN, BALL_IN_END)           // fade in at the exit
      );
    }

    /* Fade the ball in as it leaves the heading, out as the route ends */
    opacity *= remap(p, 0, 0.03);
    if (p > 0.985) opacity *= 1 - remap(p, 0.985, 1);

    line.style.strokeDashoffset = dashTotal * (1 - drawn);

    var pt = pointAt(drawn);
    ball.setAttribute('transform', 'translate(' + pt.x.toFixed(2) + ',' + pt.y.toFixed(2) + ')');
    ball.setAttribute('opacity', opacity.toFixed(3));

    /* Per-card reveal */
    cards.forEach(function (card, i) {
      var h = holdOf[i];
      var r, on;

      if (p >= h.e)      { r = MAX_R; on = true; }
      else if (p <= h.s) { r = 0;     on = false; }
      else {
        var ht = (p - h.s) / (h.e - h.s);
        /* easeInOut, not easeOut — no sudden arrival at full radius */
        r  = MAX_R * easeInOut(remap(ht, REVEAL_IN, REVEAL_OUT));
        on = true;
      }

      card.style.setProperty('--rn', r.toFixed(3));
      dots[i].classList.toggle('is-on', on);
    });
  }

  /* ── Scroll mapping ────────────────────────────────────────
     Driven purely by getBoundingClientRect() deltas — no scroll events and
     no pageYOffset. That matters because the page may be embedded in a
     full-height iframe whose *parent* does the scrolling: inside such a
     frame `scroll` never fires and window.scrollY stays pinned at 0.

     x = -sec.top increases monotonically as the section rises through the
     viewport, whichever element actually scrolls. Contact for card i is
     pinned to x_i = (card centre offset within the section) - vh/2, i.e.
     exactly when that card's centre crosses the viewport's centre line.
     ────────────────────────────────────────────────────────── */
  var stops = [];

  function rebuild() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var secTop = sec.getBoundingClientRect().top;

    var contacts = cards.map(function (c, i) {
      var r = c.getBoundingClientRect();
      /* Both rects sampled in the same frame, so this is layout-only */
      var offset = (r.top - secTop) + r.height / 2;
      return { x: offset - vh / 2, p: holdOf[i].s };
    });

    var legX = contacts[1].x - contacts[0].x;
    var legP = contacts[1].p - contacts[0].p;
    var rate = (legX > 0 && legP > 0) ? legX / legP : vh * 2;

    var lead = Math.max(rate * contacts[0].p,       vh * 0.30);
    var tail = Math.max(rate * (1 - contacts[2].p), vh * 0.30);

    stops = [{ x: contacts[0].x - lead, p: 0 }]
      .concat(contacts)
      .concat([{ x: contacts[2].x + tail, p: 1 }]);
  }

  function progress() {
    if (stops.length < 2) return 0;
    var x = -sec.getBoundingClientRect().top;

    if (x <= stops[0].x) return 0;
    if (x >= stops[stops.length - 1].x) return 1;

    for (var i = 1; i < stops.length; i++) {
      var a = stops[i - 1], b = stops[i];
      if (x <= b.x) {
        var span = b.x - a.x;
        return a.p + (b.p - a.p) * (span <= 0 ? 1 : (x - a.x) / span);
      }
    }
    return 1;
  }

  /* ── Frame loop ────────────────────────────────────────────
     Polls position every frame instead of waiting for events. One rect read
     per frame is cheap, and it is immune to whatever container scrolls.
     ────────────────────────────────────────────────────────── */
  var current = progress(), lastDrawn = -1;

  var wasStacked = null;

  function frame() {
    var stacked = window.ovalStacked();

    /* Reconciled every frame, so the block recovers by itself whichever way
       the layout flips — and a transient bad measurement costs one frame
       instead of the whole animation. */
    if (stacked !== wasStacked) {
      wasStacked = stacked;
      sec.classList.toggle('is-animated', !stacked);
      if (stacked) {
        cards.forEach(function (c) { c.style.removeProperty('--rn'); });
        dots.forEach(function (dt) { dt.classList.remove('is-on'); });
      } else {
        rebuild();
        lastDrawn = -1;
      }
    }

    if (!stacked) {
      var target = progress();
      var d = target - current;
      current += (!smooth || Math.abs(d) < 0.0004) ? d : d * 0.11;   /* scrub smoothing */

      if (Math.abs(current - lastDrawn) > 0.00015) {
        render(current);
        lastDrawn = current;
      }
    }
    requestAnimationFrame(frame);
  }

  /* ── Activate ─────────────────────────────────────────────── */
  line.style.strokeDasharray = dashTotal;
  rebuild();
  current = progress();
  requestAnimationFrame(frame);

  function onResize() {
    rebuild();
    current = progress();
    lastDrawn = -1;
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('load', onResize);
  if (document.fonts) document.fonts.ready.then(onResize);

  /* `stops` are cached from measured card positions, so any reflow after init
     — late fonts, late images, a changed navbar height — would leave the
     scroll mapping stale and the sequence stranded outside its own range.
     Re-measure whenever the section's box actually changes. */
  if (window.ResizeObserver) {
    var lastH = 0;
    new ResizeObserver(function () {
      var hNow = sec.offsetHeight;
      if (Math.abs(hNow - lastH) > 1) { lastH = hNow; onResize(); }
    }).observe(sec);
  }

  /* Crossing into a narrow viewport: drop the thread, open every card */

})();

/* ══════════════════════════════════════════════════════════════
   LEAD MODAL
   Every "Обсудить проект" / "Рассчитать смету" button opens it. The
   heading follows the trigger, so the same dialog serves both intents.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var modal = document.getElementById('leadModal');
  if (!modal) return;

  var dialog = modal.querySelector('.modal__dialog');
  var form   = document.getElementById('leadForm');
  var done   = document.getElementById('leadDone');
  var title  = document.getElementById('leadTitle');
  var sub    = document.getElementById('leadSub');
  var lastFocused = null;

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* ── Open / close ── */
  function open(trigger) {
    lastFocused = trigger || document.activeElement;

    var label = trigger ? (trigger.getAttribute('data-modal-title') ||
                           trigger.textContent.trim()) : 'Обсудить проект';
    title.textContent = label;
    sub.textContent = label === 'Рассчитать смету'
      ? 'Опишем объём и назовём вилку по стоимости.'
      : 'Оставьте контакт — ответим в течение рабочего дня.';

    reset();
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    /* Focus the first input once the dialog is actually visible */
    requestAnimationFrame(function () {
      var first = form.querySelector('input');
      if (first) first.focus();
    });
  }

  function close() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function clearErrors() {
    [].forEach.call(form.querySelectorAll('[data-field]'), function (f) {
      f.classList.remove('has-error');
      var e = f.querySelector('.field__error');
      if (e) e.textContent = '';
    });
  }

  function reset() {
    form.hidden = false;
    done.hidden = true;
    form.reset();
    clearErrors();
  }

  /* Any button whose label is one of these opens the dialog */
  var TRIGGERS = ['Обсудить проект', 'Рассчитать смету'];
  [].forEach.call(document.querySelectorAll('button'), function (b) {
    if (b.closest('#leadModal')) return;
    if (TRIGGERS.indexOf(b.textContent.trim()) === -1) return;
    b.addEventListener('click', function () { open(b); });
  });

  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-modal-close]')) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('is-open')) return;

    if (e.key === 'Escape') { close(); return; }

    /* Keep Tab inside the dialog while it is open */
    if (e.key === 'Tab') {
      var items = [].filter.call(dialog.querySelectorAll(FOCUSABLE), function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ── Validation ── */
  function fail(name, message) {
    var f = form.querySelector('[data-field="' + name + '"]');
    f.classList.add('has-error');
    var e = f.querySelector('.field__error');
    if (e) e.textContent = message;
    return f;
  }

  function looksLikeContact(v) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return true;      /* email */
    return (v.replace(/\D/g, '').length >= 10);                     /* phone */
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var name    = form.elements.name.value.trim();
    var contact = form.elements.contact.value.trim();
    var consent = form.elements.consent.checked;

    /* Collect every problem, don't short-circuit — `a = a || fail()` would
       stop calling fail() after the first hit and reveal the errors one at
       a time across repeated submits. */
    var bad = [];
    if (name.length < 2) bad.push(fail('name', 'Укажите имя'));
    if (!contact) bad.push(fail('contact', 'Укажите телефон или email'));
    else if (!looksLikeContact(contact)) bad.push(fail('contact', 'Проверьте телефон или email'));
    if (!consent) bad.push(fail('consent', ''));

    if (bad.length) {
      var input = bad[0].querySelector('input');
      if (input) input.focus();
      return;
    }

    /* ─────────────────────────────────────────────────────────────
       No backend yet. Everything the form collected is here:
       submit({ name: name, contact: contact }) — swap this stub for a
       fetch() to the real endpoint and keep the success state below.
       ───────────────────────────────────────────────────────────── */
    form.hidden = true;
    done.hidden = false;
    var closer = done.querySelector('[data-modal-close]');
    if (closer) closer.focus();
  });

  /* Clear a field's error as soon as the user edits it */
  form.addEventListener('input', function (e) {
    var f = e.target.closest('[data-field]');
    if (!f) return;
    f.classList.remove('has-error');
    var err = f.querySelector('.field__error');
    if (err) err.textContent = '';
  });
})();

(function () {
  /* Queried live inside the handler, never cached at load — otherwise
     resizing the window leaves the wrong behaviour wired up. */
  var mq    = window.matchMedia('(hover: none) and (min-width: 641px)');
  var cards = document.querySelectorAll('.fcard');
  if (!cards.length) return;

  [].forEach.call(cards, function (card) {
    card.addEventListener('click', function () {
      if (!mq.matches) return;
      var isOpen = card.classList.contains('is-flipped');
      /* Close all, then open the tapped one (unless it was already open) */
      [].forEach.call(cards, function (c) { c.classList.remove('is-flipped'); });
      if (!isOpen) card.classList.add('is-flipped');
    });
  });

  /* Leaving tablet range clears any card left open by a tap */
  function sync() {
    if (!mq.matches) {
      [].forEach.call(cards, function (c) { c.classList.remove('is-flipped'); });
    }
  }
  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync);
})();

(function () {
  var mq    = window.matchMedia('(max-width: 640px)');
  var cards = [].slice.call(document.querySelectorAll('.fcard'));
  if (!cards.length) return;

  var raf = null;

  function clear() {
    cards.forEach(function (c) { c.classList.remove('is-flipped'); });
  }

  function check() {
    if (!mq.matches) { stop(); return; }

    var vh  = window.innerHeight;
    var top = vh * 0.25;   /* band starts 25 % from top */
    var bot = vh * 0.75;   /* band ends   75 % from top */

    cards.forEach(function (card) {
      var r      = card.getBoundingClientRect();
      var centre = (r.top + r.bottom) / 2;

      if (centre >= top && centre <= bot) {
        card.classList.add('is-flipped');
      } else if (r.bottom < 0) {
        /* Card scrolled above fold — re-arm so flip replays on scroll back */
        card.classList.remove('is-flipped');
      }
    });

    raf = requestAnimationFrame(check);
  }

  function start() {
    if (raf !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cards.forEach(function (c) { c.classList.add('is-flipped'); });
      return;
    }
    raf = requestAnimationFrame(check);
  }

  function stop() {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    clear();
  }

  function sync() { if (mq.matches) start(); else stop(); }

  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync);

  sync();
})();
