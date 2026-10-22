/* Flamegraph sidebar.
 * Edit TREE to add/remove pages. `href` is relative to the site root; each
 * page sets <body data-root="..."> so links resolve from nested folders.
 * `weight` sets a leaf frame's height in units of --leaf-h (default 1);
 * a parent's height is the sum of its children's, like a real flamegraph.
 */
(function () {
  var TREE = {
    label: "Home", href: "index.html", children: [
      { label: "Personal Projects", href: "pages/personal-projects.html", children: [
        { label: "Anthropic Performance Take-Home", href: "pages/anthropic-performance-take-home.html", weight: 2 },
        { label: "Highload Challenges", href: "pages/highload-challenges.html", children: [
          { label: "Parse Integers", href: "pages/parse-integers.html", weight: 0.85 },
          { label: "Median", href: "pages/median.html", weight: 0.85 },
          { label: "Count Uint8s", href: "pages/count-uint8s.html", weight: 0.85 }
        ]}
      ]},
      { label: "Books and Resources I Like", href: "pages/books-and-resources.html", weight: 2 },
      { label: "Cool Work at MIT", href: "pages/cool-work-at-mit.html", children: [
        { label: "MEng Thesis", href: "pages/meng-thesis.html", weight: 0.85 },
        { label: "6.S894", href: "pages/6s894.html", children: [
          { label: "H100 Matmul", href: "pages/h100-matmul.html", weight: 0.85 }
        ]},
        { label: "6.1060", href: "pages/6-1060.html", weight: 0.7 },
        { label: "6.1100", href: "pages/6-1100.html", weight: 0.7 }
      ]},
      { label: "About Me", href: "pages/about-me.html" }
    ]
  };

  function weight(node) {
    if (node.children && node.children.length)
      return node.children.reduce(function (n, c) { return n + weight(c); }, 0);
    return node.weight || 1;
  }

  /* Flamegraph palette: red at the root, shifting toward yellow with depth.
   * Each level owns a band of the red-to-yellow ramp; within a band a frame's
   * exact shade comes from its label, re-rolled until it is far enough from
   * its parent and from the sibling above it so neighbours never blend. */
  var COLORS = {};          // label -> chosen color, shared with the breadcrumb
  var MIN_DIFF = 70;        // smallest acceptable distance between neighbours
  // How far a shade may stray from its level's center. The root stays pinned
  // to red; deeper levels get a wide band so the palette keeps some variety.
  function band(depth) {
    if (depth === 0) return 10;                 // root stays red
    if (depth === DEPTH_MAX) return 62;         // leaves stay in the yellows
    return 38;
  }

  function maxDepth(node, d) {
    d = d || 0;
    var kids = node.children || [];
    var m = d;
    for (var i = 0; i < kids.length; i++) m = Math.max(m, maxDepth(kids[i], d + 1));
    return m;
  }
  var DEPTH_MAX = maxDepth(TREE, 0);

  // green carries the red -> yellow ramp: ~15 at the root, ~205 at the leaves
  function bandCenter(depth) {
    if (!DEPTH_MAX) return 110;
    return 15 + 198 * (depth / DEPTH_MAX);
  }

  function hashColor(label, salt, depth) {
    var s = salt ? label + "#" + salt : label, h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var t = DEPTH_MAX ? depth / DEPTH_MAX : 0;
    var jitter = (((h >> 8) & 0xff) / 255) * 2 - 1;   // -1 .. 1 within the band
    // deeper frames stay bright and warm, so the ramp ends in yellow not green
    var r = Math.round(205 + 30 * t + (50 - 30 * t) * ((h & 0xff) / 255));
    var g = Math.round(bandCenter(depth) + band(depth) * jitter);
    var b = Math.round(55 * (1 - 0.7 * t) * (((h >> 16) & 0xff) / 255));
    g = Math.max(0, Math.min(g, r - 20));            // green never rivals red
    // a brightness step gives neighbours a second way to differ, so crowded
    // levels can separate by shade when there is no hue left to move into
    // the root keeps full brightness so Home reads as a vivid red
    var vmin = depth === 0 ? 0.96 : 0.74;
    var v = vmin + (1 - vmin) * (((h >> 24) & 0xff) / 255);
    return { r: Math.round(r * v), g: Math.round(g * v), b: Math.round(b * v) };
  }

  // green dominates the visible difference in this palette, so weight it most
  function dist(a, b) {
    if (!a || !b) return Infinity;
    return Math.abs(a.g - b.g) + 0.5 * Math.abs(a.r - b.r) + 0.5 * Math.abs(a.b - b.b);
  }

  function pickColor(label, depth, neighbours) {
    var best = null, bestScore = -1;
    for (var salt = 0; salt < 200; salt++) {
      var c = hashColor(label, salt, depth);
      var worst = Infinity;
      for (var i = 0; i < neighbours.length; i++) worst = Math.min(worst, dist(c, neighbours[i]));
      if (worst >= MIN_DIFF) return c;
      if (worst > bestScore) { bestScore = worst; best = c; }
    }
    return best;
  }

  function rgb(c) { return "rgb(" + c.r + "," + c.g + "," + c.b + ")"; }

  function frameColor(label) {
    return COLORS[label] ? rgb(COLORS[label]) : "#e8642b";
  }

  // path from the root frame down to the page, for the breadcrumb
  function pathTo(page, node, trail) {
    trail = (trail || []).concat([node]);
    if (node.href.split("/").pop() === page) return trail;
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) {
      var hit = pathTo(page, kids[i], trail);
      if (hit) return hit;
    }
    return null;
  }

  function renderCrumb(page, root) {
    var el = document.querySelector("#topbar .crumb");
    if (!el) return;
    var trail = pathTo(page, TREE, []);
    if (!trail) return;
    el.textContent = "";
    trail.forEach(function (node, i) {
      if (i) {
        var sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.textContent = "/";
        el.appendChild(sep);
      }
      var a = document.createElement("a");
      a.className = "crumb-link";
      a.href = new URL(root + node.href, location.href).href;
      a.textContent = node.label;
      a.style.background = frameColor(node.label);
      if (i === trail.length - 1) a.setAttribute("aria-current", "page");
      el.appendChild(a);
    });
  }

  function currentPage() {
    var p = location.pathname.split("/").pop() || "index.html";
    return p;
  }

  function render(node, depth, root, current, parentColor, ownColor) {
    var frame = document.createElement("div");
    frame.className = "frame depth-" + depth;
    frame.style.setProperty("--w", weight(node));

    var color = ownColor || pickColor(node.label, depth, [parentColor]);
    COLORS[node.label] = color;

    var a = document.createElement("a");
    a.className = "box";
    // absolute URL, so the link stays correct after in-place navigation
    // changes the document's location (relative hrefs would re-resolve)
    a.href = new URL(root + node.href, location.href).href;
    a.textContent = node.label;
    a.title = node.label;
    a.style.background = rgb(color);
    if (node.href.split("/").pop() === current) a.className += " active";
    frame.appendChild(a);

    if (node.children && node.children.length) {
      var kids = document.createElement("div");
      kids.className = "children";
      var placed = [color];
      node.children.forEach(function (c) {
        // each child differs from this frame and from every sibling already placed
        var cc = pickColor(c.label, depth + 1, placed);
        kids.appendChild(render(c, depth + 1, root, current, color, cc));
        placed.push(cc);
      });
      frame.appendChild(kids);
    }
    return frame;
  }

  var canSwap = /^https?:$/.test(location.protocol) && "fetch" in window && "pushState" in history;

  function setActive(page) {
    var boxes = document.querySelectorAll("#flame .box");
    for (var i = 0; i < boxes.length; i++) {
      var isActive = boxes[i].getAttribute("href").split("/").pop() === page;
      boxes[i].classList.toggle("active", isActive);
    }
  }

  // Load a page's content into the current document without reloading the sidebar.
  function swapTo(url, push) {
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var newContent = doc.getElementById("content");
      var content = document.getElementById("content");
      if (!newContent || !content) throw new Error("no #content");
      content.innerHTML = newContent.innerHTML;
      document.title = doc.title;
      var newRoot = doc.body.getAttribute("data-root") || "";
      document.body.setAttribute("data-root", newRoot);
      if (push) history.pushState({ url: url }, "", url);
      var page = url.split("/").pop().split(/[?#]/)[0] || "index.html";
      setActive(page);
      renderCrumb(page, newRoot);
      window.scrollTo(0, 0);
    });
  }

  function onNavClick(e) {
    if (!canSwap) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("#flame .box, .crumb-link") : null;
    if (!a) return;
    e.preventDefault();
    var url = a.href;
    if (url === location.href) return;
    swapTo(url, true).catch(function () { location.href = url; });
  }

  // On tall screens, grow the frames so the graph reaches the bottom of the
  // sidebar. Never shrink below the CSS --leaf-h, so short screens are unchanged.
  function fitHeight() {
    var sidebar = document.getElementById("sidebar");
    var flame = document.getElementById("flame");
    var header = sidebar && sidebar.querySelector("header");
    if (!sidebar || !flame) return;
    var cs = getComputedStyle(flame);
    var pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var base = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--leaf-h-base")) || 52;
    var avail = sidebar.clientHeight - (header ? header.offsetHeight : 0) - pad;
    var total = weight(TREE);
    if (!total || avail <= 0) return;
    flame.style.setProperty("--leaf-h", Math.max(base, Math.floor(avail / total)) + "px");
  }

  function build() {
    var root = document.body.getAttribute("data-root") || "";
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    sidebar.innerHTML =
      '<header></header>' +
      '<nav id="flame" aria-label="Site navigation">' +
      '<div class="graph"></div></nav>';
    sidebar.querySelector(".graph").appendChild(render(TREE, 0, root, currentPage(), null, null));
    sidebar.addEventListener("click", onNavClick);
    var topbar = document.getElementById("topbar");
    if (topbar) topbar.addEventListener("click", onNavClick);
    renderCrumb(currentPage(), root);
    if (canSwap) {
      history.replaceState({ url: location.href }, "", location.href);
      window.addEventListener("popstate", function () {
        swapTo(location.href, false).catch(function () { location.reload(); });
      });
    }

    fitHeight();
    window.addEventListener("resize", fitHeight);

    // no slide animation on the initial paint
    document.body.classList.add("preload");
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      document.body.classList.remove("preload");
    }); });

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
