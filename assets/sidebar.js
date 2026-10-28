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
        { label: "HighLoad Challenges", href: "pages/highload-challenges.html", children: [
          { label: "Parse Integers", href: "pages/parse-integers.html", weight: 0.85 },
          { label: "Median", href: "pages/median.html", weight: 0.85 },
          { label: "Count Uint8s", href: "pages/count-uint8s.html", weight: 0.85 },
          { label: "Unique Strings", href: "pages/unique-strings.html", weight: 0.85 }
        ]}
      ]},
      { label: "Resources", href: "pages/books-and-resources.html", weight: 2 },
      { label: "College Work", href: "pages/cool-work-at-mit.html", children: [
        { label: "MEng\nThesis", href: "pages/meng-thesis.html", weight: 0.85 },
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

  /* Classic flamegraph "hot" palette: every frame gets its own warm color,
   * seeded from its label so it is stable across reloads. A frame must differ
   * from its parent and from every sibling already placed, so neighbours never
   * blend together; when a color is too close it is re-rolled with a new salt. */
  var COLORS = {};          // label -> chosen color, shared with the breadcrumb
  var MIN_DIFF = 90;        // smallest acceptable distance between neighbours

  function hashColor(label, salt) {
    // salt 0 is the plain label hash, so frames that already differ keep their color
    var s = salt ? label + "#" + salt : label, h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var r = 205 + Math.round(50 * ((h & 0xff) / 255));
    var g = Math.round(230 * (((h >> 8) & 0xff) / 255));
    var b = Math.round(55 * (((h >> 16) & 0xff) / 255));
    // keep the yellows warm: red always leads green by a clear margin, so no
    // frame drifts into chartreuse
    r = Math.min(255, Math.max(r, g + 40));
    g = Math.min(g, r - 40);
    return { r: r, g: g, b: b };
  }

  // green dominates the visible difference in this palette, so weight it most
  function dist(a, b) {
    if (!a || !b) return Infinity;
    return Math.abs(a.g - b.g) + 0.5 * Math.abs(a.r - b.r) + 0.5 * Math.abs(a.b - b.b);
  }

  /* The six bands of the home page gradient. Every frame snaps to whichever
   * of these its generated colour is closest to, so the sidebar and the hero
   * share one palette. A frame never takes the same band as its parent or as
   * a sibling already placed; when the nearest is taken it falls to the next
   * nearest. */
  var PALETTE = [
    { r: 206, g: 26,  b: 38 },
    { r: 230, g: 62,  b: 30 },
    { r: 240, g: 110, b: 24 },
    { r: 245, g: 160, b: 20 },
    { r: 247, g: 206, b: 20 },
    { r: 250, g: 226, b: 26 }
  ];

  function pickColor(label, neighbours) {
    // the colour this frame would have had on its own
    var best = null, bestScore = -1;
    for (var salt = 0; salt < 200; salt++) {
      var c = hashColor(label, salt);
      var worst = Infinity;
      for (var i = 0; i < neighbours.length; i++) worst = Math.min(worst, dist(c, neighbours[i]));
      if (worst >= MIN_DIFF) { best = c; break; }
      if (worst > bestScore) { bestScore = worst; best = c; }
    }

    // snap it to the nearest band the neighbours are not already using
    var taken = [];
    for (var n = 0; n < neighbours.length; n++) {
      if (neighbours[n] && typeof neighbours[n].band === "number") taken.push(neighbours[n].band);
    }
    var order = [];
    for (var p = 0; p < PALETTE.length; p++) order.push(p);
    order.sort(function (a, b) { return dist(PALETTE[a], best) - dist(PALETTE[b], best); });
    for (var k = 0; k < order.length; k++) {
      if (taken.indexOf(order[k]) === -1) {
        return { r: PALETTE[order[k]].r, g: PALETTE[order[k]].g, b: PALETTE[order[k]].b, band: order[k] };
      }
    }
    var f = order[0];
    return { r: PALETTE[f].r, g: PALETTE[f].g, b: PALETTE[f].b, band: f };
  }

  function rgb(c) { return "rgb(" + c.r + "," + c.g + "," + c.b + ")"; }

  function frameColor(label) {
    return COLORS[label] ? rgb(COLORS[label]) : rgb(hashColor(label, 0));
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

  // Links that point at another page of this site render as colored chips,
  // matching the breadcrumb: the page's own flamegraph color, in bold.
  var PAGE_BY_FILE = (function () {
    var m = {};
    (function walk(n) {
      m[n.href.split("/").pop()] = n.label;
      (n.children || []).forEach(walk);
    })(TREE);
    return m;
  })();

  function decorateLinks() {
    var links = document.querySelectorAll("#content a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.host !== location.host) continue;            // leave external links alone
      var file = a.pathname.split("/").pop();
      var label = PAGE_BY_FILE[file];
      if (!label || !COLORS[label]) continue;            // not a site page
      a.classList.add("page-chip");
      a.style.background = rgb(COLORS[label]);
    }
  }

  function renderCrumb(page, root) {
    var el = document.querySelector("#topbar .crumb");
    if (!el) return;
    var trail = pathTo(page, TREE, []);
    if (!trail) return;
    // the home page has no trail left: hide the bar entirely
    document.body.classList.toggle("no-crumb", trail.length <= 1);  // home shows no bar
    el.textContent = "";
    trail.forEach(function (node, i) {
      if (i) {
        var sep = document.createElement("span");
        sep.className = "crumb-sep";
        sep.textContent = "\u25B6";
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

    var color = ownColor || pickColor(node.label, [parentColor]);
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
        var cc = pickColor(c.label, placed);
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
      decorateLinks();
      buildBanner(page, newRoot);
      document.dispatchEvent(new CustomEvent("content:swapped"));
      window.scrollTo(0, 0);
    });
  }

  function onNavClick(e) {
    if (!canSwap) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("#flame .box, .crumb-link, #content a.page-chip") : null;
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

  /* Each interior page gets a thin band in its own flamegraph colour: one
   * flat colour that breaks up into the page background along the bottom. */
  var BAND_CELL = 18;
  var BAND_FILL = 0.62;     // solid colour down to here, then it drops off
  var BAND_DRIP = 0.16;     // per-column variation, so the colour runs down in drips

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function seedFrom(label) {
    var h = 2166136261;
    for (var i = 0; i < label.length; i++) { h ^= label.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }

  function paintBand(art, box, color, seed) {
    var sidebar = document.getElementById("sidebar");
    var reserve = sidebar ? sidebar.offsetWidth : 0;
    var cols = Math.ceil((box.clientWidth + reserve) / BAND_CELL);
    var rows = Math.ceil(box.clientHeight / BAND_CELL);
    if (!cols || !rows) return;

    var fill = rgb(color);
    var rand = mulberry32(seed || 7919);

    // the solid part has to run past the bottom of the title, so it backs the
    // text completely however many lines it wraps to
    // the solid part must clear whatever sits on the band: title plus subtitle
    var title = box.querySelector(".page-sub") || box.querySelector("h1");
    var solid = BAND_FILL;
    if (title && box.clientHeight) {
      solid = (title.offsetTop + title.offsetHeight + 14) / box.clientHeight;
      solid = Math.max(0.35, Math.min(0.9, solid));
    }

    // each column gets its own reach, so the edge breaks into drips rather
    // than an even scatter
    var drip = [];
    for (var c = 0; c < cols; c++) drip.push(rand() * BAND_DRIP);

    var out = [];
    for (var y = 0; y < rows; y++) {
      var t = box.clientHeight ? (y * BAND_CELL) / box.clientHeight : 0;
      // a square whose bottom would fall past the band is left empty, so a
      // deep drip can never be sliced in half by the edge
      var fits = (y + 1) * BAND_CELL <= box.clientHeight;
      for (var x = 0; x < cols; x++) {
        var on = true;
        // the scatter starts well above the solid edge and runs well past it,
        // so colour and background overlap through a wide, uneven zone
        var start = solid;
        var tt = t - drip[x];
        if (tt > start) {
          var f = Math.max(0, Math.min(1, (tt - start) / Math.max(0.01, 0.90 - start)));
          on = rand() < Math.pow(1 - f, 1.5) * 0.99;
        }
        out.push(on && fits ? '<i style="background:' + fill + '"></i>' : "<i></i>");
      }
    }
    art.style.gridTemplateColumns = "repeat(" + cols + ", " + BAND_CELL + "px)";
    art.style.gridAutoRows = BAND_CELL + "px";
    art.innerHTML = out.join("");
  }

  function buildBanner(page, root) {
    var content = document.getElementById("content");
    if (!content || content.querySelector(".hero")) return;      // home has its own
    var h1 = content.querySelector("h1");
    if (!h1 || h1.closest(".page-band")) return;
    var trail = pathTo(page, TREE, []);
    if (!trail) return;
    var color = COLORS[trail[trail.length - 1].label];
    if (!color) return;

    var band = document.createElement("div");
    band.className = "page-band";
    var art = document.createElement("div");
    art.className = "band-art";
    art.setAttribute("aria-hidden", "true");
    var sub = h1.nextElementSibling;
    if (!sub || !sub.classList.contains("page-sub")) sub = null;
    h1.parentNode.insertBefore(band, h1);
    band.appendChild(art);
    band.appendChild(h1);
    if (sub) band.appendChild(sub);
    paintBand(art, band, color, seedFrom(trail[trail.length - 1].label));
  }

  function build() {
    var root = document.body.getAttribute("data-root") || "";
    var sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    sidebar.innerHTML =
      '<nav id="flame" aria-label="Site navigation">' +
      '<div class="graph"></div></nav>';
    sidebar.querySelector(".graph").appendChild(render(TREE, 0, root, currentPage(), null, null));
    sidebar.addEventListener("click", onNavClick);
    var topbar = document.getElementById("topbar");
    if (topbar) topbar.addEventListener("click", onNavClick);
    var content = document.getElementById("content");
    if (content) content.addEventListener("click", onNavClick);
    renderCrumb(currentPage(), root);
    decorateLinks();
    buildBanner(currentPage(), root);
    if (canSwap) {
      history.replaceState({ url: location.href }, "", location.href);
      window.addEventListener("popstate", function () {
        swapTo(location.href, false).catch(function () { location.reload(); });
      });
    }

    fitHeight();
    window.addEventListener("resize", fitHeight);
    var bandTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(bandTimer);
      bandTimer = setTimeout(function () {
        var band = document.querySelector(".page-band");
        var trail = pathTo(currentPage(), TREE, []);
        if (band && trail) {
          var lbl = trail[trail.length - 1].label;
          paintBand(band.querySelector(".band-art"), band, COLORS[lbl], seedFrom(lbl));
        }
      }, 120);
    });

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
        toggle.textContent = closed ? "\u25B6" : "\u25C0";
      }
      try { localStorage.setItem(KEY, closed ? "1" : "0"); } catch (e) {}
    }
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    apply(saved === null ? currentPage() === "index.html" : saved === "1");
    if (toggle) toggle.addEventListener("click", function () {
      apply(!document.body.classList.contains("sidebar-closed"));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
