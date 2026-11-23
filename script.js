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
    lenis = new window.Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.95 });
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

  // run fn once macbook3d.js (an ES module, loads after this script) is ready
  function on3D(fn) {
    if (window.MacBook3D) fn();
    else window.addEventListener("macbook3d-ready", fn, { once: true });
  }

  // ---------- Laptop keyboards (flex-grow per key) ----------
  var KEY_ROWS = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],
    [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.9],
    [2.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.4],
    [1, 1, 1, 1.3, 5.6, 1.3, 1, 3]
  ];
  each(".kbd", function (kbd) {
    kbd.innerHTML = KEY_ROWS.map(function (keys, i) {
      return '<div class="kbd__row' + (i === 0 ? " kbd__row--fn" : "") + '">' +
        keys.map(function (g) { return '<span style="flex-grow:' + g + '"></span>'; }).join("") + "</div>";
    }).join("");
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
      if (hero3d) hero3d.resize();
    }

    // Realistic WebGL MacBook (macbook3d.js); the CSS laptop above stays as the fallback
    var hero3d = null;
    function init3D() {
      if (hero3d || !window.MacBook3D) return;
      try {
        hero3d = window.MacBook3D.createMacbook(document.getElementById("heroMac"), screen, {
          fov: 26,
          // HDRI / fonts finished loading: draw the current frame again
          onNeedsRender: function () { if (seq) seq.last = null; }
        });
        root.classList.add("has-3d");
      } catch (e) { hero3d = null; }
    }
    function render3D(open, rise, push, zoom, deep) {
      var cam = hero3d.camera, t = Math.tan(cam.fov * Math.PI / 360);
      // distance that keeps the open laptop comfortably in frame on any aspect ratio
      var dist = Math.max(34 / (0.74 * 2 * t * cam.aspect), 30 / (0.6 * 2 * t));
      var lidRad = lerp(1.555, -0.3, open);
      // orbit: closed under the title, then open, then pushed in
      var elev = lerp(lerp(34, 17, rise), 9, push) * Math.PI / 180;
      var d = dist * lerp(lerp(1.05, 1, rise), 0.84, push);
      var ly = lerp(lerp(13, 11, rise), 12, push), lz = lerp(lerp(0, -3, rise), -6, push);
      var pos = { x: 0, y: ly + Math.sin(elev) * d, z: lz + Math.cos(elev) * d };
      var look = { x: 0, y: ly, z: lz };
      if (zoom > 0) {
        // fly along the screen normal until the display covers the viewport, then keep going
        var S = hero3d.screenInfo(lidRad);
        var dc = hero3d.coverDistance() * 0.985 / Math.pow(2.8, deep);
        pos = { x: lerp(pos.x, S.pos.x + S.n.x * dc, zoom), y: lerp(pos.y, S.pos.y + S.n.y * dc, zoom), z: lerp(pos.z, S.pos.z + S.n.z * dc, zoom) };
        look = { x: lerp(look.x, S.pos.x, zoom), y: lerp(look.y, S.pos.y, zoom), z: lerp(look.z, S.pos.z, zoom) };
      }
      hero3d.render({ lid: lidRad, pos: pos, look: look });
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
      if (hero3d) render3D(open, rise, push, zoom, deep);
      else renderCss(open, rise, push, zoom, deep);

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

    function renderCss(open, rise, push, zoom, deep) {
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
    }

    function progress() { return clamp((window.scrollY - top) / len, 0, 1); }

    if (reduceMotion) {
      sec.classList.add("seq--static");
      measure();
      render(.63);
      on3D(function () { init3D(); measure(); render(.63); });
      return null;
    }

    measure();
    return { measure: measure, render: render, progress: progress, init3D: init3D };
  })();

  if (seq) on3D(function () { seq.init3D(); seq.measure(); seq.last = null; });

  // ---------- Through the code: fly through real snippets from the projects ----------
  var tunnel = (function () {
    var track = document.getElementById("tunnelTrack");
    if (!track) return null;
    var world = document.getElementById("tunnelWorld");
    var stars = document.getElementById("tunnelStars");
    var intro = document.getElementById("tunnelIntro");
    var hud = track.querySelector(".tunnel__hud");
    var numEl = document.getElementById("tunnelNum");
    var fileEl = document.getElementById("tunnelFile");
    var barEl = document.getElementById("tunnelBar");
    var fade = document.getElementById("tunnelFade");

    var SNIPPETS = [
      { tag: "Fuel API", file: "fuel-api/apps/api/app/routers/fuel.py", code: [
        '@router.get("/fuel/latest")',
        "async def get_latest_fuel_prices(",
        "    currency: str = Query(",
        '        default="EUR", regex="^(EUR|USD)$", description="Currency type (EUR or USD)"',
        "    ),",
        '    country: Optional[str] = Query(default=None, description="Filter by country name"),',
        "    db: DatabaseManager = Depends(get_db),",
        "):",
        '    """',
        "    Get latest fuel prices for all countries or specific country",
        '    """'] },
      { tag: "Scraper", file: "fuel-api/apps/scraper/scraper/web_scraping.py", code: [
        "def get_soup(self, url: str) -> Optional[BeautifulSoup]:",
        '    """Get BeautifulSoup object from URL with error handling"""',
        "    try:",
        '        logger.info(f"Fetching data from: {url}")',
        "        response = self.session.get(url, timeout=self.timeout)",
        "        response.raise_for_status()",
        '        return BeautifulSoup(response.content, "html.parser")',
        "    except requests.RequestException as e:",
        '        logger.error(f"Error fetching data from {url}: {e}")',
        "        return None"] },
      { tag: "YouTube → MP3", file: "youtube-mp3-diploma/src/app/download_manager.py", code: [
        "# Execute download command",
        "creationflags = 0",
        'if sys.platform == "win32":',
        "    creationflags = subprocess.CREATE_NO_WINDOW",
        "process = subprocess.Popen(",
        "    cmd,",
        "    stdout=subprocess.PIPE,",
        "    stderr=subprocess.STDOUT,",
        "    text=True,",
        "    universal_newlines=True,",
        "    creationflags=creationflags,",
        ")"] },
      { tag: "Gold Lab · MQL5", file: "gold-trading-bot/mt5/XAUUSD_CappedBasket/include/RiskManager.mqh", code: [
        "const double equity=AccountInfoDouble(ACCOUNT_EQUITY);",
        "const double target_risk=equity*risk_percent/100.0;",
        "double loss_one_lot=0.0;",
        "// OrderCalcProfit performs the broker/account-currency conversion for one lot.",
        "const ENUM_ORDER_TYPE market_type=(direction==DIRECTION_LONG ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);",
        "if(equity<=0.0 || target_risk<=0.0 ||",
        "   !OrderCalcProfit(market_type,symbol,1.0,entry,stop_loss,loss_one_lot))",
        "  {",
        '   reason="REJECT_POSITION_SIZE_ERROR";',
        "   return false;",
        "  }"] },
      { tag: "This site", file: "agvalev.github.io/macbook3d.js", code: [
        "// staircase: each layer rises and slides back so the one below stays visible",
        "parts.tray.position.set(0, -2.5 * t, 9 * t);",
        "parts.battery.position.set(0, 1.2 * t, 5 * t);",
        "parts.board.position.set(0, 5.2 * t, -1 * t);",
        "parts.topcase.position.set(0, 12 * t, -15 * t);",
        "deck.position.set(0, 12 * t, -15 * t);",
        "lid.position.y = BH + 0.035 + 17 * t;",
        "lid.position.z = -D / 2 + 0.46 - 25 * t;"] }
    ];
    var WORDS = [["APIs", 0.6], ["Data", 1.6], ["<em>Automation</em>", 2.6], ["Desktop", 3.55], ["3D", 4.5]];

    // tiny highlighter: comments, strings, numbers, keywords, decorators, calls
    var KW = "from|import|def|async|await|return|try|except|if|else|for|in|not|None|True|False|class|as|const|double|bool|void|true|false|var|function|new";
    var RE = new RegExp('(#[^\\n]*|//[^\\n]*|"""|f?"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|\\b\\d+(?:\\.\\d+)?\\b|\\b(?:' + KW + ')\\b|@\\w+(?:\\.\\w+)*|\\b[A-Za-z_]\\w*(?=\\())', "g");
    function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function hl(line) {
      var out = "", last = 0, m;
      RE.lastIndex = 0;
      while ((m = RE.exec(line))) {
        out += esc(line.slice(last, m.index));
        var t = m[0], cls = /^(#|\/\/)/.test(t) ? "c" : /^(f?["']|""")/.test(t) ? "s" : /^\d/.test(t) ? "n" : t[0] === "@" ? "d" :
          new RegExp("^(?:" + KW + ")$").test(t) ? "k" : "f";
        out += '<span class="c-' + cls + '">' + esc(t) + "</span>";
        last = m.index + t.length;
      }
      return out + esc(line.slice(last));
    }

    var GAP = 1150, START = 700;
    var narrow = window.innerWidth <= 860;
    var items = SNIPPETS.map(function (s, i) {
      var el = document.createElement("div");
      el.className = "tpanel";
      el.innerHTML = '<div class="tpanel__bar"><span class="dots"><i></i><i></i><i></i></span><span class="tpanel__file"></span><span class="tpanel__tag"></span></div><pre></pre>';
      el.querySelector(".tpanel__file").textContent = s.file;
      el.querySelector(".tpanel__tag").textContent = s.tag;
      el.querySelector("pre").innerHTML = s.code.map(function (l, k) { return '<span class="ln">' + (k + 1) + "</span>" + hl(l); }).join("\n");
      world.appendChild(el);
      var side = i % 2 ? 1 : -1;
      return { el: el, z: -(START + i * GAP), side: side, data: s };
    });
    var words = WORDS.map(function (w, i) {
      var el = document.createElement("p");
      el.className = "tword";
      el.innerHTML = w[0];
      world.appendChild(el);
      return { el: el, z: -(START + w[1] * GAP), side: i % 2 ? -1 : 1 };
    });
    numEl.textContent = "01";
    document.getElementById("tunnelTotal").textContent = String(items.length).padStart(2, "0");
    var depth = START + (items.length - 1) * GAP + 1200;

    // star field drawn on a canvas with the same perspective as the CSS scene
    var ctx = stars.getContext("2d"), pts = [], dpr = Math.min(window.devicePixelRatio || 1, 2);
    var seed = 9;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 900; i++) pts.push({ x: (rnd() - .5) * 3200, y: (rnd() - .5) * 2000, z: -rnd() * (depth + 2000), g: rnd() });

    var top = 0, len = 1, p = 0, last = -1, lastCam = 0;
    function measure() {
      top = track.getBoundingClientRect().top + window.scrollY;
      len = Math.max(1, track.offsetHeight - window.innerHeight);
      narrow = window.innerWidth <= 860;
      stars.width = Math.round(stars.clientWidth * dpr);
      stars.height = Math.round(stars.clientHeight * dpr);
      last = -1;
    }

    function render(q) {
      var cam = lerp(-200, depth, ease(seg(q, .06, .94)));
      var vw = window.innerWidth, vh = window.innerHeight, P = 1000;
      var spread = narrow ? 0.12 : 0.24;
      world.style.transform = "translateZ(" + cam.toFixed(1) + "px)";
      var active = 0;
      items.forEach(function (it, i) {
        var eff = it.z + cam;                     // distance in front of the camera (negative = ahead)
        var o = Math.min(clamp((eff + 5200) / 2600, 0, 1), clamp(1 - (eff - 250) / 420, 0, 1));
        it.el.style.opacity = o.toFixed(3);
        it.el.style.visibility = o > 0.002 ? "visible" : "hidden";
        var x = it.side * vw * spread, y = (i % 3 - 1) * vh * (narrow ? .06 : .1);
        it.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px," + it.z + "px) rotateY(" + (-it.side * (narrow ? 6 : 16)) + "deg)";
        if (eff > -GAP * 0.75) active = i;
      });
      words.forEach(function (w) {
        var eff = w.z + cam;
        var o = Math.min(clamp((eff + 4200) / 2000, 0, 1), clamp(1 - (eff - 100) / 500, 0, 1));
        w.el.style.opacity = o.toFixed(3);
        w.el.style.transform = "translate3d(" + (w.side * vw * (narrow ? .05 : .2) - (narrow ? vw * .4 : vw * .25)).toFixed(1) + "px," + (-vh * .08).toFixed(1) + "px," + w.z + "px)";
      });
      intro.style.opacity = 1 - seg(q, .02, .09);
      intro.style.transform = "translateY(-50%) scale(" + (1 + seg(q, 0, .09) * .5).toFixed(3) + ")";
      hud.classList.toggle("is-on", q > .08 && q < .95);
      numEl.textContent = String(active + 1).padStart(2, "0");
      fileEl.textContent = items[active].data.file;
      barEl.style.transform = "scaleX(" + seg(q, .06, .94).toFixed(3) + ")";
      fade.style.opacity = seg(q, .93, 1);

      // stars: dots that stretch into streaks with speed
      var speed = clamp(Math.abs(cam - lastCam), 0, 260);
      lastCam = cam;
      var W = stars.width, H = stars.height, cx = W / 2, cy = H / 2;
      ctx.clearRect(0, 0, W, H);
      // corridor: rounded frames every 650px that we fly through
      for (var zr = -300; zr > -(depth + 1600); zr -= 650) {
        var er = zr + cam;
        if (er > P - 80) continue;
        var fr = P / (P - er);
        var ar = clamp(1 - (-er) / 6500, 0, 1) * clamp((P - 80 - er) / 500, 0, 1) * 0.32;
        if (ar <= 0.004) continue;
        var hw = vw * (narrow ? .62 : .58) * fr * dpr, hh = vh * .6 * fr * dpr, rr = 40 * fr * dpr;
        ctx.strokeStyle = "rgba(216,183,122," + ar.toFixed(3) + ")";
        ctx.lineWidth = Math.max(1, 1.2 * fr) * dpr;
        ctx.beginPath();
        ctx.moveTo(cx - hw + rr, cy - hh);
        ctx.arcTo(cx + hw, cy - hh, cx + hw, cy + hh, rr); ctx.arcTo(cx + hw, cy + hh, cx - hw, cy + hh, rr);
        ctx.arcTo(cx - hw, cy + hh, cx - hw, cy - hh, rr); ctx.arcTo(cx - hw, cy - hh, cx + hw, cy - hh, rr);
        ctx.closePath();
        ctx.stroke();
      }
      for (var k = 0; k < pts.length; k++) {
        var s = pts[k], z = s.z + cam;
        if (z > P - 40) continue;
        var f = P / (P - z), f2 = P / (P - z + speed * 2.2);
        var px = cx + s.x * f * dpr, py = cy + s.y * f * dpr;
        if (px < -50 || px > W + 50 || py < -50 || py > H + 50) continue;
        var a = clamp(1 - (-z) / 5000, 0, 1) * (0.35 + s.g * 0.65);
        ctx.strokeStyle = s.g > .82 ? "rgba(243,223,180," + a.toFixed(3) + ")" : "rgba(220,220,230," + (a * .6).toFixed(3) + ")";
        ctx.lineWidth = (0.6 + f * 1.4) * dpr;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(cx + s.x * f2 * dpr + 0.01, cy + s.y * f2 * dpr);
        ctx.stroke();
      }
    }

    function update() {
      var r = track.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var target = clamp((window.scrollY - top) / len, 0, 1);
      p = reduceMotion ? target : p + (target - p) * (lenis ? 0.2 : 0.12);
      if (Math.abs(target - p) < 0.0002) p = target;
      if (p === last) return;
      last = p;
      render(p);
    }
    measure();
    return { measure: measure, update: update };
  })();

  // ---------- Inside: exploded MacBook with HUD callouts ----------
  var inside = (function () {
    var track = document.getElementById("insideTrack");
    if (!track) return null;
    var host = document.getElementById("insideMac");
    var head = track.querySelector(".inside__head");
    var cos = Array.prototype.map.call(track.querySelectorAll(".co"), function (el) {
      return { el: el, anchor: el.dataset.anchor };
    });
    var mac = null, top = 0, len = 1, p = 0, last = -1;

    // callout boxes line up in two columns (like Apple's exploded views); leader lines run to the parts
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "co__svg");
    track.querySelector(".callouts").prepend(svg);
    cos.forEach(function (c) {
      c.dot = c.el.querySelector(".co__dot");
      c.box = c.el.querySelector(".co__box");
      c.path = document.createElementNS(NS, "path");
      c.path.setAttribute("pathLength", "1");
      svg.appendChild(c.path);
    });

    function layoutCallouts(q, ex) {
      var W = host.clientWidth, H = host.clientHeight, narrow = W < 860;
      var boxW = narrow ? 168 : 250, boxH = narrow ? 58 : 118, gap = narrow ? 8 : 16, margin = narrow ? 12 : W * 0.045;
      var cols = [[], []];
      // phones: one callout at a time, as a caption under the model
      var current = -1;
      cos.forEach(function (c, i) { if (ex > .96 && q > .44 + i * .045 && q < .84) current = i; });
      cos.forEach(function (c, i) {
        var show = narrow ? i === current : ex > .96 && q > .44 + i * .045 && q < .84;
        c.el.classList.toggle("is-on", show);
        c.path.classList.toggle("is-on", show);
        c.pt = mac.project(c.anchor);
        if (narrow) {
          var bw = W - 24, bh = c.box.offsetHeight || 110;
          c.box.style.left = "12px";
          c.box.style.top = (H - bh - 28) + "px";
          c.box.style.width = bw + "px";
          c.dot.style.left = c.pt.x + "px";
          c.dot.style.top = c.pt.y + "px";
          c.path.setAttribute("d", "M" + c.pt.x.toFixed(1) + " " + c.pt.y.toFixed(1) + " L" + c.pt.x.toFixed(1) + " " + (H - bh - 28).toFixed(1));
          return;
        }
        c.box.style.width = "";
        cols[c.pt.x < W / 2 ? 0 : 1].push(c);
      });
      cols.forEach(function (col, side) {
        col.sort(function (a, b) { return a.pt.y - b.pt.y; });
        var total = col.length * boxH + Math.max(0, col.length - 1) * gap;
        var y0 = clamp(H * 0.58 - total / 2, H * 0.2, H - total - 24);
        col.forEach(function (c, k) {
          var bx = side ? W - margin - boxW : margin, by = y0 + k * (boxH + gap);
          c.el.classList.toggle("co--left", !side);
          c.box.style.left = bx + "px";
          c.box.style.top = by + "px";
          c.dot.style.left = c.pt.x + "px";
          c.dot.style.top = c.pt.y + "px";
          var x2 = side ? bx : bx + boxW, y2 = by + (narrow ? 22 : 30), xm = x2 + (side ? -28 : 28);
          c.path.setAttribute("d", "M" + c.pt.x.toFixed(1) + " " + c.pt.y.toFixed(1) + " L" + xm.toFixed(1) + " " + y2.toFixed(1) + " L" + x2.toFixed(1) + " " + y2.toFixed(1));
        });
      });
    }


    on3D(function () {
      try {
        mac = window.MacBook3D.createMacbook(host, document.getElementById("insideScreen"), {
          fov: 24, internals: true,
          onNeedsRender: function () { last = -1; }
        });
        measure();
      } catch (e) { mac = null; }
    });

    function measure() {
      top = track.getBoundingClientRect().top + window.scrollY;
      len = Math.max(1, track.offsetHeight - window.innerHeight);
      if (mac) { mac.resize(); last = -1; }
    }

    function render(q) {
      var cam = mac.camera, t = Math.tan(cam.fov * Math.PI / 360);
      var orbit = ease(seg(q, 0, .16));
      var ex = ease(seg(q, .12, .42)) * (1 - ease(seg(q, .86, 1)));
      var drift = seg(q, .42, .86);
      // camera: front → three-quarter, pulled back while the layers spread
      var az = (lerp(lerp(0, -38, orbit), -24, drift) + 38 * seg(q, .86, 1)) * Math.PI / 180;
      var el = (lerp(14, 30, orbit) - 16 * seg(q, .86, 1)) * Math.PI / 180;
      var fit = Math.max(38 / (0.8 * 2 * t * cam.aspect), 30 / (0.7 * 2 * t));
      var narrow = window.innerWidth <= 860;
      var d = fit * (1 + (narrow ? 0.45 : 0.78) * ex);
      // starts to the right of the headline, centres as it opens up
      var look = { x: -9 * (1 - orbit) * (narrow ? 0 : 1), y: 8 + 6.5 * ex - (narrow ? 9 * ex : 0), z: -2 - 8 * ex };
      mac.setExplode(ex, q * 46);
      mac.render({
        lid: -0.32,
        pos: { x: look.x + Math.sin(az) * Math.cos(el) * d, y: look.y + Math.sin(el) * d, z: look.z + Math.cos(az) * Math.cos(el) * d },
        look: look
      });
      head.style.opacity = 1 - seg(q, .1, .2) + seg(q, .9, 1);

      layoutCallouts(q, ex);
    }

    function update() {
      if (!mac) return;
      var r = track.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var target = clamp((window.scrollY - top) / len, 0, 1);
      p = reduceMotion ? target : p + (target - p) * (lenis ? 0.22 : 0.14);
      if (Math.abs(target - p) < 0.0003) p = target;
      if (p === last) return;
      last = p;
      render(p);
    }

    return { measure: measure, update: update };
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

  // ---------- Pointer effects: magnetic buttons, bento glow ----------
  if (finePointer && !reduceMotion) {
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

  // ---------- Trading chart: range, sweep below it, then the rally (drawn once) ----------
  (function () {
    var svg = document.getElementById("candles");
    if (!svg) return;
    var plot = svg.parentNode;
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var N = 64, W = 600, H = 300, price = 4012, bars = [];
    for (var i = 0; i < N; i++) {
      var drift = i < 18 ? 0 : i < 27 ? -1.3 : i < 31 ? -2.4 : 1.7;
      var o = price, c = o + drift + (rnd() - .5) * 4.4;
      bars.push({ o: o, c: c, h: Math.max(o, c) + rnd() * 2.4, l: Math.min(o, c) - rnd() * 2.4 });
      price = c;
    }
    var hi = -Infinity, lo = Infinity;
    bars.forEach(function (b) { hi = Math.max(hi, b.h); lo = Math.min(lo, b.l); });
    hi += 6; lo -= 8;
    function y(p) { return (hi - p) / (hi - lo) * H; }
    var bw = W / N, out = "";

    for (var g = 1; g < 6; g++) out += '<line class="g" x1="0" x2="' + W + '" y1="' + g * H / 6 + '" y2="' + g * H / 6 + '"/>';
    for (g = 1; g < 8; g++) out += '<line class="g" y1="0" y2="' + H + '" x1="' + g * W / 8 + '" x2="' + g * W / 8 + '"/>';

    // NY 09:00-10:00 range, then the lowest wick after it is the sweep
    var rHi = -Infinity, rLo = Infinity, sweep = 18;
    for (i = 4; i < 18; i++) { rHi = Math.max(rHi, bars[i].h); rLo = Math.min(rLo, bars[i].l); }
    for (i = 18; i < 40; i++) if (bars[i].l < bars[sweep].l) sweep = i;
    out += '<rect class="range" x="' + 4 * bw + '" y="' + y(rHi) + '" width="' + 14 * bw + '" height="' + (y(rLo) - y(rHi)) + '"/>';

    bars.forEach(function (b, k) {
      var cls = b.c >= b.o ? "up" : "dn", x = k * bw + bw / 2;
      out += '<line class="wick ' + cls + '" x1="' + x + '" x2="' + x + '" y1="' + y(b.h) + '" y2="' + y(b.l) + '"/>';
      out += '<rect class="' + cls + '" x="' + (k * bw + bw * .18) + '" width="' + bw * .64 + '" y="' + y(Math.max(b.o, b.c)) +
        '" height="' + Math.max(1, Math.abs(y(b.o) - y(b.c))) + '"/>';
    });

    var entry = bars[sweep + 2].c, sl = bars[sweep].l - 1.5, tp = entry + (entry - sl) * 2.2;
    [["entry", entry, "ENTRY", "#e3c48a"], ["sl", sl, "SL", "#ff5d73"], ["tp", tp, "TP", "#3ddc97"]].forEach(function (L) {
      out += '<line class="lvl ' + L[0] + '" x1="' + (sweep + 2) * bw + '" x2="' + W + '" y1="' + y(L[1]) + '" y2="' + y(L[1]) + '"/>';
      var tag = document.createElement("span");
      tag.className = "mt5__tag";
      tag.style.cssText = "right:6px;top:" + y(L[1]) / H * 100 + "%;background:" + L[3];
      tag.textContent = L[2] + " " + L[1].toFixed(2);
      plot.appendChild(tag);
    });
    svg.innerHTML = out;

    var note = document.createElement("span");
    note.className = "mt5__note";
    note.style.cssText = "left:" + 4 / N * 100 + "%;top:" + (y(rHi) / H * 100 - 7) + "%";
    note.textContent = "NY 09:00–10:00";
    plot.appendChild(note);
    var sw = document.createElement("span");
    sw.className = "mt5__note mt5__note--sweep";
    sw.style.cssText = "left:" + (sweep + .5) / N * 100 + "%;top:" + (y(bars[sweep].l) / H * 100 + 3) + "%";
    sw.textContent = "▲ sweep";
    plot.appendChild(sw);

    var last = bars[N - 1];
    document.getElementById("ohlc").textContent = "O " + last.o.toFixed(2) + "  H " + last.h.toFixed(2) +
      "  L " + last.l.toFixed(2) + "  C " + last.c.toFixed(2);
  })();

  // ---------- Websites showcase: MacBook + iPhone ----------
  var sites = (function () {
    var track = document.getElementById("sitesTrack");
    if (!track) return null;
    var buttons = track.querySelectorAll("#siteList button");
    var details = track.querySelectorAll(".sd");
    var laptopShots = track.querySelectorAll('[data-device="laptop"] .shot');
    var phoneShots = track.querySelectorAll('[data-device="phone"] .shot');
    var num = document.getElementById("siteNum");
    var count = track.querySelector(".sites__count");
    var stageWrap = document.getElementById("sitesStage");
    var laptop = document.getElementById("laptop2");
    var phone = document.getElementById("phone");
    var glows = ["rgba(196, 255, 64, .2)", "rgba(216, 183, 122, .3)", "rgba(255, 98, 40, .24)",
      "rgba(255, 212, 0, .22)", "rgba(214, 128, 64, .26)", "rgba(222, 196, 160, .26)", "rgba(20, 184, 166, .26)"];
    var n = laptopShots.length, top = 0, len = 1, cur = -1, p = 0;
    var mac3d = null, ph3d = null, lastLocal = 0, D2R = Math.PI / 180;
    on3D(function () {
      try {
        mac3d = window.MacBook3D.createMacbook(document.getElementById("sitesMac"), laptop.querySelector(".screen"), {
          fov: 24,
          onNeedsRender: function () { if (mac3d) renderMac(); }
        });
        stageWrap.classList.add("has-mac3d");
        if (window.MacBook3D.createIphone) {
          try {
            ph3d = window.MacBook3D.createIphone(document.getElementById("sitesPhone"), phone.querySelector(".phone__screen"), {
              fov: 18,
              onNeedsRender: function () { if (ph3d) renderPhone(); }
            });
            stageWrap.classList.add("has-phone3d");
          } catch (e2) { ph3d = null; }
        }
        update(true);
        renderMac();
      } catch (e) { mac3d = null; }
    });
    function renderMac() {
      var cam = mac3d.camera, t = Math.tan(cam.fov * Math.PI / 360);
      var d = Math.max(38 / (0.9 * 2 * t * cam.aspect), 34 / (0.78 * 2 * t));
      var az = lerp(-32, -16, p) * Math.PI / 180, el = 15 * Math.PI / 180;
      var look = { x: 0, y: 9.5, z: -1 };
      mac3d.render({
        lid: -0.32,
        pos: { x: look.x + Math.sin(az) * Math.cos(el) * d, y: look.y + Math.sin(el) * d, z: look.z + Math.cos(az) * Math.cos(el) * d },
        look: look
      });
    }

    function measure() {
      top = track.getBoundingClientRect().top + window.scrollY;
      len = Math.max(1, track.offsetHeight - window.innerHeight);
      if (mac3d) { mac3d.resize(); renderMac(); }
      if (ph3d) { ph3d.resize(); renderPhone(); }
    }
    // the titanium iPhone turns slowly with the scroll and lifts a little for every site
    function renderPhone() {
      var bob = Math.sin(lastLocal * Math.PI);
      ph3d.render({ ry: (-30 + p * 16 + bob * 6) * D2R, rx: (5 - bob * 2) * D2R, rz: 2 * D2R, y: bob * 0.35, fill: .8 });
    }
    function mark(list, i) {
      for (var k = 0; k < list.length; k++) list[k].classList.toggle("is-on", k === i);
    }
    function setActive(i) {
      if (i === cur) return;
      cur = i;
      mark(buttons, i); mark(details, i); mark(laptopShots, i); mark(phoneShots, i);
      num.textContent = String(i + 1).padStart(2, "0");
      stageWrap.style.setProperty("--site-glow", glows[i % glows.length]);
    }
    // scroll the screenshot inside its screen like someone browsing the site
    function browse(img, local) {
      var travel = img.offsetHeight - img.parentNode.offsetHeight;
      if (travel <= 0) return;
      var t = ease(clamp((local - .1) / .8, 0, 1));
      img.style.transform = "translate3d(0," + (-travel * .82 * t).toFixed(1) + "px,0)";
    }
    function update(instant) {
      var r = track.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var target = clamp((window.scrollY - top) / len, 0, 1);
      p = instant ? target : p + (target - p) * (lenis ? 0.22 : 0.14);
      if (Math.abs(target - p) < 0.0003) p = target;
      var x = p * n, i = Math.min(n - 1, Math.floor(x)), local = Math.min(1, x - i);
      setActive(i);
      browse(laptopShots[i], local);
      browse(phoneShots[i], local);
      count.style.setProperty("--sp", ((i + local) / n).toFixed(3));
      lastLocal = local;
      if (mac3d) renderMac();
      if (ph3d) renderPhone();
      if (!instant && !ph3d) {
        laptop.style.transform = "rotateX(" + (-15 + p * 5).toFixed(2) + "deg) rotateY(" + (-22 + p * 12).toFixed(2) + "deg)";
        phone.style.transform = "translateY(" + (-Math.sin(local * Math.PI) * 14).toFixed(1) +
          "px) rotateY(" + (-24 + p * 10).toFixed(2) + "deg) rotateX(6deg) rotateZ(1deg)";
      }
    }
    each("#siteList button", function (b) {
      b.addEventListener("click", function () {
        scrollToTarget(top + (parseInt(b.dataset.i, 10) + .5) / n * len);
      });
    });
    measure();
    setActive(0);
    return { measure: measure, update: update };
  })();

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

  // ---------- HUD: current chapter + scroll position in the corners ----------
  var hud = (function () {
    var el = document.getElementById("hud");
    if (!el) return null;
    var CH = [["#seq", "Intro", "Начало"], ["#tunnel", "Through the code", "През кода"], ["#about", "Manifesto", "Манифест"],
      ["#inside", "What's inside", "Отвътре"], [".services", "Services", "Услуги"], ["#work", "Selected work", "Проекти"],
      ["#sites", "Websites", "Сайтове"], ["#stack", "Stack", "Технологии"], [".principles", "Principles", "Принципи"],
      [".edu", "Education", "Образование"], ["#contact", "Contact", "Контакт"]];
    var list = [];
    CH.forEach(function (c) { var n = document.querySelector(c[0]); if (n) list.push({ el: n, en: c[1], bg: c[2] }); });
    var idx = document.getElementById("hudIdx"), name = document.getElementById("hudName"), pct = document.getElementById("hudPct");
    var cur = -1, lastPct = -1;
    setTimeout(function () { el.classList.add("is-on"); }, 600);
    return function (y, vh, max) {
      var a = 0;
      for (var k = 0; k < list.length; k++) if (list[k].el.getBoundingClientRect().top <= vh * .5) a = k;
      if (a !== cur) {
        cur = a;
        idx.textContent = String(a + 1).padStart(2, "0");
        name.innerHTML = '<span lang="en">' + list[a].en + '</span><span lang="bg">' + list[a].bg + "</span>";
        name.classList.remove("is-swap"); void name.offsetWidth; name.classList.add("is-swap");
      }
      var pc = max > 0 ? Math.round(y / max * 100) : 0;
      if (pc !== lastPct) { lastPct = pc; pct.textContent = String(pc).padStart(3, "0"); }
    };
  })();

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
    if (hud && y !== hud.y) { hud.y = y; hud(y, vh, max); }

    // nav: glass after the top, hides while scrolling down, returns on scroll up
    nav.classList.toggle("is-scrolled", y > 20);
    if (Math.abs(y - lastNavY) > 6) {
      nav.classList.toggle("is-hidden", y > lastNavY && y > vh * .5 && !navLinks.classList.contains("is-open"));
      lastNavY = y;
    }

    if (seq) {
      var target = seq.progress();
      seqP += (target - seqP) * (lenis ? 0.22 : 0.12);
      if (Math.abs(target - seqP) < 0.0004) seqP = target;
      if (seqP !== seq.last) seq.render(seqP);
      seq.last = seqP;
    }

    if (sites) sites.update(reduceMotion);
    if (inside) inside.update();
    if (tunnel) tunnel.update();

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

      // device mockups straighten up as their card scrolls into place
      for (var ci = 0; ci < cases.length; ci++) {
        var cr = cases[ci].getBoundingClientRect();
        if (cr.top > vh || cr.bottom < 0) continue;
        cases[ci].style.setProperty("--tilt", clamp((cr.top - vh * .1) / (vh * .75), 0, 1).toFixed(3));
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
    if (sites) sites.measure();
    if (inside) inside.measure();
    if (tunnel) tunnel.measure();
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

  // ---------- Contact sheet (every mailto link opens it) ----------
  var sheet = document.getElementById("sheet");
  var sheetReturn = null;
  function openSheet() {
    sheetReturn = document.activeElement;
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    if (lenis) lenis.stop();
    setTimeout(function () { sheet.querySelector(".sheet__opt").focus({ preventScroll: true }); }, 50);
  }
  function closeSheet() {
    if (!sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    if (lenis) lenis.start();
    if (sheetReturn && sheetReturn.focus) sheetReturn.focus({ preventScroll: true });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="mailto:"]');
    if (a && !a.hasAttribute("data-direct")) {
      e.preventDefault();
      openSheet();
      return;
    }
    if (e.target.closest("[data-close]")) closeSheet();
    if (e.target.closest("#sheet .sheet__opt[href]")) setTimeout(closeSheet, 300);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSheet();
  });
  var sheetCopy = document.getElementById("sheetCopy");
  sheetCopy.addEventListener("click", function () {
    var done = function () {
      sheetCopy.classList.add("is-copied");
      setTimeout(function () { sheetCopy.classList.remove("is-copied"); }, 1800);
    };
    if (navigator.clipboard) navigator.clipboard.writeText("anatoligvalev@gmail.com").then(done, function () {});
  });

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
