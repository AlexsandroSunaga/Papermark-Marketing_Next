(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    initQuoteCarousel();
    initCapList();
    initImpactCards();
    initNavMenus();
    initMobileMenu();
  });

  function initQuoteCarousel() {
    var pager = document.getElementById("quotePager");
    var slidesRoot = document.getElementById("quoteSlides");
    if (!pager || !slidesRoot) return;

    var dots = Array.from(pager.querySelectorAll("span"));
    var slides = Array.from(slidesRoot.querySelectorAll(".quote-slide"));
    var images = Array.from(document.querySelectorAll(".quote-imgs .quote-img"));
    if (!dots.length || !slides.length) return;

    var index = 0;
    var timer;

    function show(next) {
      index = (next + slides.length) % slides.length;
      dots.forEach(function (dot, i) {
        dot.classList.toggle("active", i === index);
      });
      slides.forEach(function (slide, i) {
        slide.classList.toggle("active", i === index);
      });
      images.forEach(function (image, i) {
        image.classList.toggle("active", i === index);
      });
    }

    dots.forEach(function (dot, i) {
      dot.style.cursor = "pointer";
      dot.addEventListener("click", function () {
        show(i);
        restart();
      });
    });

    function restart() {
      clearInterval(timer);
      timer = setInterval(function () {
        show(index + 1);
      }, 7000);
    }

    show(0);
    restart();
  }

  function initCapList() {
    var list = document.querySelector(".l11 .cap-list");
    var track = list && list.querySelector(".cap-track");
    if (!list || !track) return;

    var caps = Array.from(track.querySelectorAll(".cap"));
    var unique = caps.length / 3;
    if (!unique) return;

    var row = 0;
    setInterval(function () {
      row = (row + 1) % unique;
      track.style.setProperty("--cap-row", String(row));
      caps.forEach(function (cap, i) {
        cap.classList.toggle("active", i % unique === row);
      });
    }, 2200);
  }

  function initImpactCards() {
    var rail = document.getElementById("impactRail");
    if (!rail) return;

    var cards = Array.from(rail.querySelectorAll(".impact-card"));
    cards.forEach(function (card) {
      card.addEventListener("mouseenter", function () {
        cards.forEach(function (other) {
          other.classList.remove("is-active");
        });
        card.classList.add("is-active");
      });
    });
  }

  function initNavMenus() {
    var menus = [
      {
        label: "Why Papermark?",
        links: [
          { href: "/data-room", text: "Data Room" },
          { href: "/customers", text: "Customers" },
          { href: "/security", text: "Security" },
          { href: "/pricing", text: "Pricing" },
        ],
      },
      {
        label: "Developers",
        links: [
          { href: "/agents", text: "Agents & MCP" },
          { href: "https://docs.papermark.com", text: "Documentation" },
          { href: "https://github.com/mfts/papermark", text: "GitHub" },
        ],
      },
    ];

    menus.forEach(function (menu) {
      var trigger = Array.from(document.querySelectorAll("button[data-radix-collection-item]")).find(
        function (button) {
          return button.textContent.trim().startsWith(menu.label);
        },
      );
      if (!trigger) return;

      var wrapper = document.createElement("div");
      wrapper.className = "mirror-nav-dropdown";
      wrapper.style.position = "relative";

      var panel = document.createElement("div");
      panel.className = "mirror-nav-panel";
      panel.style.cssText =
        "display:none;position:absolute;top:calc(100% + 8px);left:0;min-width:200px;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:8px;padding:8px;box-shadow:0 12px 40px rgba(0,0,0,.12);z-index:1000;";
      menu.links.forEach(function (link) {
        var a = document.createElement("a");
        a.href = link.href;
        a.textContent = link.text;
        a.style.cssText =
          "display:block;padding:8px 10px;border-radius:6px;color:#0b0b0b;text-decoration:none;font-size:14px;";
        a.addEventListener("mouseenter", function () {
          a.style.background = "rgba(0,0,0,.05)";
        });
        a.addEventListener("mouseleave", function () {
          a.style.background = "transparent";
        });
        panel.appendChild(a);
      });

      trigger.parentElement.replaceWith(wrapper);
      wrapper.appendChild(trigger);
      wrapper.appendChild(panel);

      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        var open = panel.style.display === "block";
        document.querySelectorAll(".mirror-nav-panel").forEach(function (node) {
          node.style.display = "none";
        });
        panel.style.display = open ? "none" : "block";
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".mirror-nav-dropdown")) {
        document.querySelectorAll(".mirror-nav-panel").forEach(function (node) {
          node.style.display = "none";
        });
      }
    });
  }

  function initMobileMenu() {
    var toggle =
      document.querySelector("[data-mirror-mobile-toggle]") ||
      document.querySelector(".md\\:hidden button[type='button']");
    if (!toggle) return;

    var panel = document.createElement("div");
    panel.className = "mirror-mobile-nav";
    panel.style.cssText =
      "display:none;position:fixed;inset:80px 16px auto 16px;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px;padding:16px;z-index:1000;box-shadow:0 20px 60px rgba(0,0,0,.15);";
    [
      { href: "/data-room", text: "Data Room" },
      { href: "/pricing", text: "Pricing" },
      { href: "/security", text: "Security" },
      { href: "/blog", text: "Blog" },
      { href: "/customers", text: "Customers" },
      { href: "/login", text: "Log in" },
      { href: "/login", text: "Start now" },
    ].forEach(function (link) {
      var a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.text;
      a.style.cssText = "display:block;padding:12px 8px;color:#0b0b0b;text-decoration:none;font-size:16px;";
      panel.appendChild(a);
    });
    document.body.appendChild(panel);

    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      panel.style.display = panel.style.display === "block" ? "none" : "block";
    });
  }
})();
