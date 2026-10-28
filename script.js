(function () {
  var root = document.documentElement;

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // Language toggle (EN <-> BG)
  document.getElementById("langBtn").addEventListener("click", function () {
    root.lang = root.lang === "bg" ? "en" : "bg";
    save("lang", root.lang);
  });

  // Theme toggle: flips whatever is currently shown
  document.getElementById("themeBtn").addEventListener("click", function () {
    var current = root.dataset.theme ||
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    root.dataset.theme = current === "light" ? "dark" : "light";
    save("theme", root.dataset.theme);
  });

  // Mobile menu
  var menuBtn = document.getElementById("menuBtn");
  var navLinks = document.getElementById("navLinks");
  function setMenu(open) {
    navLinks.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", function () {
    setMenu(!navLinks.classList.contains("is-open"));
  });
  navLinks.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });

  // Nav border on scroll + current section highlight
  var nav = document.querySelector(".nav");
  var links = Array.prototype.slice.call(navLinks.querySelectorAll("a"));
  window.addEventListener("scroll", function () {
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }, { passive: true });

  if ("IntersectionObserver" in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle("is-current", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main section[id]").forEach(function (s) { sectionObserver.observe(s); });

    // Reveal on scroll
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".section__head, .about__body, .card, .skill, .timeline li, .contact__box")
      .forEach(function (el) {
        el.classList.add("reveal");
        revealObserver.observe(el);
      });
  }

  // Project filters
  var chips = document.querySelectorAll(".chip");
  var cards = document.querySelectorAll(".projects .card");
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var filter = chip.dataset.filter;
      chips.forEach(function (c) { c.classList.toggle("is-active", c === chip); });
      cards.forEach(function (card) {
        var tags = card.dataset.tags.split(" ");
        card.classList.toggle("is-hidden", filter !== "all" && tags.indexOf(filter) === -1);
      });
    });
  });

  // Copy email
  var copyBtn = document.getElementById("copyBtn");
  copyBtn.addEventListener("click", function () {
    var email = copyBtn.dataset.email;
    var done = function () {
      copyBtn.classList.add("is-copied");
      setTimeout(function () { copyBtn.classList.remove("is-copied"); }, 1800);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(email).then(done, function () {});
  });

  document.getElementById("year").textContent = new Date().getFullYear();
})();
