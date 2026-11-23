(function () {
  var root = document.documentElement;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  function save(key, value, store) {
    try { (store || localStorage).setItem(key, value); } catch (e) {}
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // 0..1 progress of p inside [a, b]
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  // ---------- Smooth scroll (Lenis, if it loaded) ----------
  var lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
  }
  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else (typeof target === "number" ? window.scrollTo(0, target) : target.scrollIntoView());
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    var target = id === "#top" ? 0 : document.querySelector(id);
    if (target == null) return;
    e.preventDefault();
    setMenu(false);
    scrollToTarget(target);
  });

  // ---------- Preloader ----------
  (function () {
    if (!root.classList.contains("is-loading")) return;
    var loader = document.getElementById("loader");
    var num = document.getElementById("loaderNum");
    var bar = document.getElementById("loaderBar");
    var start = performance.now(), loaded = document.readyState === "complete", shown = 0;
    if (lenis) lenis.stop();
    window.addEventListener("load", function () { loaded = true; });
    var last = start;
    (function tick(now) {
      // count to 90 on a timer, the last 10% waits for the page to finish loading
      var dt = Math.min(100, now - last);
      last = now;
      var timed = easeOut(clamp((now - start) / 1600, 0, 1)) * 90;
      var target = loaded ? 100 : timed;
      shown = Math.min(target, shown + Math.max(dt * 0.04, (target - shown) * (1 - Math.exp(-dt / 120))));
      num.textContent = String(Math.round(shown)).padStart(3, "0");
      bar.style.transform = "scaleX(" + shown / 100 + ")";
      if (shown < 100) return requestAnimationFrame(tick);
      setTimeout(function () {
        loader.classList.add("is-done");
        setTimeout(function () {
          root.classList.remove("is-loading");
          if (lenis) lenis.start();
          save("loaded", "1", sessionStorage);
        }, 700);
      }, 250);
    })(start);
  })();

  // ---------- Language / menu ----------
  document.getElementById("langBtn").addEventListener("click", function () {
    root.lang = root.lang === "bg" ? "en" : "bg";
    save("lang", root.lang);
  });

  var menuBtn = document.getElementById("menuBtn");
  var navLinks = document.getElementById("navLinks");
  function setMenu(open) {
    navLinks.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  menuBtn.addEventListener("click", function () {
    setMenu(!navLinks.classList.contains("is-open"));
  });

  // ---------- Laptop scroll sequence ----------
  var seq = (function () {
    var sec = document.getElementById("seq");
    if (!sec) return null;

    var stage = document.getElementById("stage");
    var lid = document.getElementById("lid");
    var screen = document.getElementById("screen");
    var boot = document.getElementById("boot");
    var bootBar = document.getElementById("bootBar");
    var ide = document.getElementById("ide");
    var codeEl = document.getElementById("code");
    var termLines = document.querySelectorAll("#term p");
    var glow = sec.querySelector(".seq__glow");
    var grid = sec.querySelector(".seq__grid");
    var fade = sec.querySelector(".seq__fade");
    var eyebrow = sec.querySelector(".seq__eyebrow");
    var corners = sec.querySelectorAll(".seq__corner");
    var caps = Array.prototype.map.call(sec.querySelectorAll(".seq__cap"), function (el) {
      return { el: el, from: parseFloat(el.dataset.from), to: parseFloat(el.dataset.to) };
    });

    // Keyboard keys (flex-grow per key)
    var rows = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],
      [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.9],
      [2.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.4],
      [1, 1, 1, 1.3, 5.6, 1.3, 1, 3]
    ];
    document.getElementById("kbd").innerHTML = rows.map(function (keys, i) {
      return '<div class="kbd__row' + (i === 0 ? " kbd__row--fn" : "") + '">' +
        keys.map(function (g) { return '<span style="flex-grow:' + g + '"></span>'; }).join("") + "</div>";
    }).join("");

    // Split the name into letters that fly apart
    var name = sec.querySelector(".seq__name");
    name.innerHTML = name.textContent.trim().split(" ").map(function (word, wi) {
      return '<span class="seq__line' + (wi ? " seq__line--o" : "") + '">' +
        word.split("").map(function (c) { return '<span class="ch">' + c + "</span>"; }).join("") + "</span>";
    }).join("");
    var letters = [];
    Array.prototype.forEach.call(name.querySelectorAll(".seq__line"), function (line, li) {
      var chars = line.querySelectorAll(".ch");
      var mid = (chars.length - 1) / 2;
      Array.prototype.forEach.call(chars, function (el, i) {
        var off = i - mid;
        letters.push({
          el: el,
          x: (off === 0 ? (li ? 1 : -1) * .4 : off) * 0.9 + (off < 0 ? -1.2 : 1.2),
          y: (li ? 1 : -1) * (0.6 + Math.abs(off) * 0.25),
          r: off * 9
        });
      });
    });

    // Code typed on screen. ⟦cls|text⟧ marks highlighted tokens.
    var SRC = [
      "⟦k|from⟧ fastapi ⟦k|import⟧ FastAPI",
      "⟦k|from⟧ anatoli ⟦k|import⟧ Engineer",
      "",
      "app = ⟦f|FastAPI⟧(title=⟦s|\"Anatoli Valev\"⟧)",
      "me = ⟦f|Engineer⟧(age=⟦n|19⟧, coding_since=⟦n|2021⟧)",
      "",
      "⟦d|@app.get⟧(⟦s|\"/about\"⟧)",
      "⟦k|async def⟧ ⟦f|about⟧():",
      "    ⟦k|return⟧ {",
      "        ⟦s|\"role\"⟧: ⟦s|\"Backend Engineer\"⟧,",
      "        ⟦s|\"focus\"⟧: ⟦s|\"APIs, data, automation\"⟧,",
      "        ⟦s|\"stack\"⟧: [⟦s|\"FastAPI\"⟧, ⟦s|\"PostgreSQL\"⟧, ⟦s|\"Docker\"⟧],",
      "        ⟦s|\"standard\"⟧: ⟦s|\"tested, documented, shipped\"⟧,",
      "    }",
      "",
      "⟦d|@app.post⟧(⟦s|\"/projects\"⟧)",
      "⟦k|async def⟧ ⟦f|start_project⟧(idea: Idea):",
      "    ⟦c|# your idea → production⟧",
      "    ⟦k|return await⟧ me.⟦f|build⟧(idea, quality=⟦s|\"exceptional\"⟧)"
    ];
    var tokens = [];
    SRC.join("\n").replace(/⟦(\w)\|([^⟧]*)⟧|([^⟦]+)/g, function (_, cls, txt, plain) {
      tokens.push(plain != null ? ["", plain] : [cls, txt]);
      return "";
    });
    var totalChars = tokens.reduce(function (n, t) { return n + t[1].length; }, 0);
    document.getElementById("gutter").textContent =
      SRC.map(function (_, i) { return i + 1; }).join("\n");

    function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    var typedCount = -1;
    function typeTo(n) {
      if (n === typedCount) return;
      typedCount = n;
      var html = "", left = n;
      for (var i = 0; i < tokens.length && left > 0; i++) {
        var txt = tokens[i][1].slice(0, left);
        left -= txt.length;
        html += tokens[i][0] ? '<span class="c-' + tokens[i][0] + '">' + esc(txt) + "</span>" : esc(txt);
      }
      codeEl.innerHTML = html + '<span class="type-caret"></span>';
    }

    // Geometry measured on resize
    var top = 0, len = 1, vh = 1, zoomScale = 3, screenDy = 0;
    function measure() {
      vh = window.innerHeight;
      top = sec.getBoundingClientRect().top + window.scrollY;
      len = Math.max(1, sec.offsetHeight - vh);
      var sw = screen.offsetWidth, sh = screen.offsetHeight;
      zoomScale = Math.max(window.innerWidth / sw, vh / sh) * 1.04;
      screenDy = screen.offsetTop + sh / 2 - stage.offsetHeight / 2;
    }

    function render(p) {
      var split = easeOut(seg(p, 0, .14));
      var rise = ease(seg(p, 0, .18));
      var open = easeOut(seg(p, .05, .3));
      var bootT = seg(p, .22, .36);
      var ideT = seg(p, .34, .38);
      var typeT = seg(p, .38, .6);
      var termT = seg(p, .6, .68);
      var zoom = ease(seg(p, .7, .88));
      var deep = ease(seg(p, .86, 1));
      var push = ease(seg(p, .38, .66));

      // Title letters split apart
      var unit = Math.min(window.innerWidth, 1200) * .09;
      for (var i = 0; i < letters.length; i++) {
        var L = letters[i];
        L.el.style.transform = "translate3d(" + (L.x * unit * split) + "px," + (L.y * unit * .6 * split) +
          "px,0) rotate(" + (L.r * split) + "deg)";
        L.el.style.opacity = 1 - split;
      }
      var chrome = 1 - seg(p, 0, .06);
      eyebrow.style.opacity = chrome;
      eyebrow.style.transform = "translateY(" + (-40 * split) + "px)";
      for (var c = 0; c < corners.length; c++) corners[c].style.opacity = chrome;

      // Laptop: rise, open, push in, then dive into the screen
      var lidAngle = lerp(-89, 12, open) - 12 * zoom;
      var tilt = lerp(lerp(lerp(-32, -20, rise), -12, push), 0, zoom);
      var s0 = lerp(lerp(.72, .9, rise), 1, push);
      // zoom fills the viewport with the screen, deep keeps diving into the code
      var scale = s0 * Math.pow(zoomScale / s0, zoom) * Math.pow(2.8, deep);
      var lift = window.innerHeight > window.innerWidth * 1.2 ? .08 : 0; // portrait phones: sit higher
      var ty = lerp(lerp(lerp(vh * .05, vh * (.1 - lift), rise), vh * (.07 - lift), push), -screenDy * scale, zoom);
      stage.style.transform = "translate3d(0," + ty + "px,0) scale3d(" + scale + "," + scale + "," + scale +
        ") rotateX(" + tilt + "deg)";
      lid.style.transform = "translateY(-2px) rotateX(" + lidAngle + "deg)";

      // Screen: boot logo, then editor, typing and terminal
      boot.style.opacity = Math.min(seg(bootT, 0, .2), 1 - ideT);
      bootBar.style.transform = "scaleX(" + seg(bootT, .25, .95) + ")";
      ide.style.opacity = ideT;
      typeTo(Math.round(typeT * totalChars));
      for (var j = 0; j < termLines.length; j++) {
        termLines[j].classList.toggle("on", termT > 0 && termT >= parseFloat(termLines[j].dataset.at));
      }

      glow.style.opacity = .25 + .75 * open - .5 * zoom;
      grid.style.opacity = .5 * (1 - open);

      // Captions
      for (var k = 0; k < caps.length; k++) {
        var cp = caps[k], local = seg(p, cp.from, cp.to);
        var o = Math.min(seg(local, 0, .25), 1 - seg(local, .75, 1));
        cp.el.style.opacity = o;
        cp.el.style.transform = "translateY(" + ((local < .5 ? 1 : -1) * (1 - o) * 36) + "px)";
      }

      fade.style.opacity = seg(p, .9, 1);
    }

    function progress() { return clamp((window.scrollY - top) / len, 0, 1); }

    if (reduceMotion) {
      sec.classList.add("seq--static");
      measure();
      render(.63);
      return null;
    }

    measure();
    return { measure: measure, render: render, progress: progress };
  })();

  // ---------- Split headings into words ----------
  function wrapWords(el, make) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (!node.nodeValue.trim()) return;
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        frag.appendChild(/^\s+$/.test(part) ? document.createTextNode(part) : make(part, node));
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  each("[data-split]", function (el) {
    var counters = new Map();
    wrapWords(el, function (word, node) {
      var group = node.parentElement.closest("[lang]") || el;
      var i = counters.get(group) || 0;
      counters.set(group, i + 1);
      var w = document.createElement("span");
      w.className = "w";
      w.innerHTML = '<i style="--i:' + i + '"></i>';
      w.firstChild.textContent = word;
      return w;
    });
  });

  // Manifesto: words light up as you scroll through it
  var manifesto = document.getElementById("manifesto");
  wrapWords(manifesto, function (word) {
    var s = document.createElement("span");
    s.className = "mw";
    s.textContent = word;
    return s;
  });

  // ---------- Reveal on scroll + nav highlight + counters ----------
  var nav = document.querySelector(".nav");
  var links = Array.prototype.slice.call(navLinks.querySelectorAll("a"));

  function countUp(el) {
    var to = parseFloat(el.dataset.count), from = parseFloat(el.dataset.from || 0);
    var suffix = el.dataset.suffix || "", start = performance.now(), dur = 1800;
    (function step(now) {
      var t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(lerp(from, to, 1 - Math.pow(1 - t, 4))) + suffix;
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle("is-current", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    each("main section[id]", function (s) { sectionObserver.observe(s); });

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        if (entry.target.dataset.count && !reduceMotion) countUp(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    each("[data-split], .stat strong[data-count]", function (el) { revealObserver.observe(el); });
    each(".case", function (el) {
      el.classList.add("clip");
      revealObserver.observe(el);
    });
    each(".label, .reveal-me, .stat, .svc__row, .rows li, .tile, .pr__item, .edu__list li, .contact__row, .footer__top", function (el) {
      // stagger siblings
      var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
      if (el.matches(".stat, .svc__row, .rows li, .tile, .pr__item, .edu__list li")) {
        el.style.setProperty("--d", (idx % 6) * 0.07 + "s");
      }
      el.classList.add("reveal");
      revealObserver.observe(el);
    });
  }

  // ---------- Pointer effects ----------
  var cursor = document.getElementById("cursor");
  var cursorDot = document.getElementById("cursorDot");
  var cursorLabel = document.getElementById("cursorLabel");
  var mouse = { x: innerWidth / 2, y: innerHeight / 2 }, ring = { x: mouse.x, y: mouse.y };

  if (finePointer && !reduceMotion) {
    root.classList.add("has-cursor");
    window.addEventListener("pointermove", function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      cursorDot.style.transform = "translate3d(" + mouse.x + "px," + mouse.y + "px,0)";
      cursor.classList.remove("is-hidden");
    });
    document.addEventListener("pointerleave", function () { cursor.classList.add("is-hidden"); });
    document.addEventListener("pointerover", function (e) {
      var labelled = e.target.closest("[data-cursor]");
      var link = e.target.closest("a, button, .svc__row");
      cursor.classList.toggle("is-label", !!labelled);
      cursor.classList.toggle("is-link", !labelled && !!link);
      if (labelled) cursorLabel.textContent = labelled.dataset.cursor;
    });

    each(".magnetic", function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        var k = el.classList.contains("orb") ? 0.3 : 0.22;
        el.style.transform = "translate(" + dx * k + "px," + dy * k + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });

    var bento = document.getElementById("bento");
    bento.addEventListener("pointermove", function (e) {
      each(".tile", function (t) {
        var r = t.getBoundingClientRect();
        t.style.setProperty("--mx", e.clientX - r.left + "px");
        t.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });
  }

  // Index list: floating preview that follows the cursor
  var preview = document.getElementById("preview");
  var pv = { x: 0, y: 0, on: false, active: null, rot: 0 };
  if (finePointer && !reduceMotion) {
    each(".row", function (row) {
      row.addEventListener("pointerenter", function () {
        if (pv.active) pv.active.classList.remove("is-on");
        pv.active = document.getElementById(row.dataset.preview);
        if (pv.active) pv.active.classList.add("is-on");
        if (!pv.on) { pv.x = mouse.x; pv.y = mouse.y; }
        pv.on = true;
        preview.classList.add("is-on");
      });
    });
    document.getElementById("rows").addEventListener("pointerleave", function () {
      pv.on = false;
      preview.classList.remove("is-on");
    });
  }

  // ---------- Marquee ----------
  var marquees = Array.prototype.map.call(document.querySelectorAll(".marquee__row"), function (row) {
    var track = row.querySelector(".marquee__track");
    row.appendChild(track.cloneNode(true));
    row.appendChild(track.cloneNode(true));
    return { row: row, track: track, dir: parseFloat(row.dataset.speed) || 1, x: 0 };
  });

  // ---------- Stacking case studies ----------
  var cases = Array.prototype.slice.call(document.querySelectorAll(".case"));
  var caseTop = 110, stacking = false;
  function placeCases() {
    caseTop = innerWidth <= 640 ? 84 : 110;
    cases.forEach(function (c, i) { c.style.top = caseTop + i * 18 + "px"; });
    stacking = cases.length > 0 && getComputedStyle(cases[0]).position === "sticky";
    if (!stacking) cases.forEach(function (c) { c.style.transform = ""; c.style.removeProperty("--dim"); });
  }
  placeCases();

  // ---------- One loop for everything scroll/pointer-linked ----------
  var progressBar = document.getElementById("progress");
  var mwords = manifesto.querySelectorAll(".mw");
  var footerWord = document.querySelector(".footer__word");
  var seqP = seq ? seq.progress() : 0;
  var lastY = window.scrollY, velocity = 0, lastNavY = 0;

  function frame(time) {
    if (lenis) lenis.raf(time);
    var y = window.scrollY, vh = window.innerHeight;
    velocity = lerp(velocity, y - lastY, 0.12);
    lastY = y;

    var max = document.documentElement.scrollHeight - vh;
    progressBar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";

    // nav: glass after the top, hides while scrolling down, returns on scroll up
    nav.classList.toggle("is-scrolled", y > 20);
    if (Math.abs(y - lastNavY) > 6) {
      nav.classList.toggle("is-hidden", y > lastNavY && y > vh * .5 && !navLinks.classList.contains("is-open"));
      lastNavY = y;
    }

    if (seq) {
      var target = seq.progress();
      seqP += (target - seqP) * (lenis ? 0.35 : 0.12);
      if (Math.abs(target - seqP) < 0.0004) seqP = target;
      if (seqP !== seq.last) seq.render(seqP);
      seq.last = seqP;
    }

    // manifesto words
    var mr = manifesto.getBoundingClientRect();
    if (mr.bottom > 0 && mr.top < vh) {
      var mp = clamp((vh * .85 - mr.top) / (mr.height + vh * .25), 0, 1);
      var lit = reduceMotion ? mwords.length : Math.round(mp * mwords.length * 1.1);
      for (var w = 0; w < mwords.length; w++) mwords[w].classList.toggle("on", w < lit);
    }

    if (!reduceMotion) {
      // stacking cards shrink and dim as the next one slides over (only while they stick)
      for (var i = 0; stacking && i < cases.length - 1; i++) {
        var nextTop = cases[i + 1].getBoundingClientRect().top;
        var h = cases[i].offsetHeight;
        var t = clamp(1 - (nextTop - caseTop - (i + 1) * 18) / h, 0, 1);
        cases[i].style.transform = "scale(" + (1 - t * .06) + ")";
        cases[i].style.setProperty("--dim", (t * .55).toFixed(3));
      }

      // cursor ring + floating preview
      if (finePointer) {
        ring.x = lerp(ring.x, mouse.x, 0.18);
        ring.y = lerp(ring.y, mouse.y, 0.18);
        cursor.style.transform = "translate3d(" + ring.x + "px," + ring.y + "px,0)";
        var dx = mouse.x - pv.x;
        pv.x = lerp(pv.x, mouse.x, 0.12);
        pv.y = lerp(pv.y, mouse.y, 0.12);
        pv.rot = lerp(pv.rot, clamp(dx * 0.05, -10, 10), 0.1);
        preview.style.transform = "translate3d(" + pv.x + "px," + pv.y + "px,0) translate(-50%,-50%) rotate(" +
          pv.rot + "deg) scale(" + (pv.on ? 1 : .6) + ")";
      }

      var boost = 1 + Math.min(Math.abs(velocity) * 0.25, 8);
      var skew = clamp(velocity * 0.3, -8, 8);
      marquees.forEach(function (m) {
        var mw = m.track.offsetWidth;
        m.x -= 0.6 * boost * m.dir * (velocity < 0 ? -1 : 1);
        if (m.x <= -mw) m.x += mw;
        if (m.x > 0) m.x -= mw;
        m.row.style.transform = "translate3d(" + m.x + "px,0,0) skewX(" + (-skew) + "deg)";
      });

      // footer wordmark rises into place
      var fr = footerWord.getBoundingClientRect();
      if (fr.top < vh) {
        var fp = clamp((vh - fr.top) / (fr.height + 60), 0, 1);
        footerWord.style.transform = "translateY(" + (1 - easeOut(fp)) * 40 + "%)";
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function remeasure() {
    placeCases();
    if (!seq) return;
    seq.measure();
    seq.last = null;
  }
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);

  // ---------- Clock (Bulgaria) ----------
  var clock = document.getElementById("clock");
  function tickClock() {
    try {
      clock.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" }).format(new Date());
    } catch (e) {}
  }
  tickClock();
  setInterval(tickClock, 15000);

  // ---------- Copy email ----------
  var copyBtn = document.getElementById("copyBtn");
  copyBtn.addEventListener("click", function () {
    var done = function () {
      copyBtn.classList.add("is-copied");
      setTimeout(function () { copyBtn.classList.remove("is-copied"); }, 1800);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(copyBtn.dataset.email).then(done, function () {});
  });

  document.getElementById("year").textContent = new Date().getFullYear();
})();
