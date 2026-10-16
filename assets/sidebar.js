/* Flamegraph sidebar.
 * Edit TREE to add/remove pages. `href` is relative to the site root; each
 * page sets <body data-root="..."> so links resolve from nested folders.
 */
(function () {
  var TREE = {
    label: "Home", href: "index.html", children: [
      { label: "Personal Projects", href: "pages/personal-projects.html", children: [
        { label: "Anthropic Performance Take-Home", href: "pages/anthropic-performance-take-home.html" },
        { label: "Highload Challenges", href: "pages/highload-challenges.html", children: [
          { label: "Parse Integers", href: "pages/parse-integers.html" },
          { label: "Median", href: "pages/median.html" },
          { label: "Count Uint8s", href: "pages/count-uint8s.html" }
        ]}
      ]},
      { label: "Books and Resources I Like", href: "pages/books-and-resources.html" },
      { label: "Cool Work at MIT", href: "pages/cool-work-at-mit.html", children: [
        { label: "MEng Thesis", href: "pages/meng-thesis.html" },
        { label: "6.S894", href: "pages/6s894.html", children: [
          { label: "H100 Matmul", href: "pages/h100-matmul.html" }
        ]},
        { label: "6.1060", href: "pages/6-1060.html" },
        { label: "6.1100", href: "pages/6-1100.html" }
      ]},
      { label: "About Me", href: "pages/about-me.html" }
    ]
  };

  function leaves(node) {
    if (!node.children || !node.children.length) return 1;
    return node.children.reduce(function (n, c) { return n + leaves(c); }, 0);
  }

  /* Classic flamegraph "hot" palette: every frame gets its own warm color,
   * seeded from its label so it is stable across reloads. */
  function frameColor(label) {
    var h = 2166136261;
    for (var i = 0; i < label.length; i++) { h ^= label.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var r1 = (h & 0xff) / 255, r2 = ((h >> 8) & 0xff) / 255, r3 = ((h >> 16) & 0xff) / 255;
    var r = 205 + Math.round(50 * r1);
    var g = 0 + Math.round(230 * r2);
    var b = 0 + Math.round(55 * r3);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function currentPage() {
    var p = location.pathname.split("/").pop() || "index.html";
    return p;
  }

  function render(node, depth, root, current) {
    var frame = document.createElement("div");
    frame.className = "frame depth-" + depth;
    frame.style.setProperty("--leaves", leaves(node));

    var a = document.createElement("a");
    a.className = "box";
    a.href = root + node.href;
    a.textContent = node.label;
    a.title = node.label;
    a.style.background = frameColor(node.label);
    if (node.href.split("/").pop() === current) a.className += " active";
    frame.appendChild(a);

    if (node.children && node.children.length) {
      var kids = document.createElement("div");
      kids.className = "children";
      node.children.forEach(function (c) { kids.appendChild(render(c, depth + 1, root, current)); });
      frame.appendChild(kids);
    }
    return frame;
  }

  function build() {
    var root = document.body.getAttribute("data-root") || "";
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    sidebar.innerHTML =
      '<header></header>' +
      '<nav id="flame" aria-label="Site navigation">' +
      '<div class="graph"></div></nav>';
    sidebar.querySelector(".graph").appendChild(render(TREE, 0, root, currentPage()));

    // toggle: one fixed button in the top-left corner. The sidebar slides in
    // and out underneath it; only its label changes. Default open, remembered.
    var KEY = "sidebar-closed";
    var toggle = document.getElementById("toggle");
    function apply(closed) {
      document.body.classList.toggle("sidebar-closed", closed);
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(!closed));
        toggle.setAttribute("aria-label", closed ? "Show sidebar" : "Hide sidebar");
        toggle.title = closed ? "Show sidebar" : "Hide sidebar";
      }
      try { localStorage.setItem(KEY, closed ? "1" : "0"); } catch (e) {}
    }
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    apply(saved === "1");
    if (toggle) toggle.addEventListener("click", function () {
      apply(!document.body.classList.contains("sidebar-closed"));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
