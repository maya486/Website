/* Home page hero: a grid of solid color squares, red at the top stepping down
 * through five bands to yellow. Each band is a distinct horizontal section;
 * only a scatter of squares bleeds across the boundaries. Below the last band
 * the yellow breaks up into the page background. Seeded, so the pattern is
 * stable across reloads, and rebuilt on resize. */
(function () {
  var BANDS = [
    "rgb(206, 26, 38)",   // red
    "rgb(230, 62, 30)",   // red-orange
    "rgb(240, 110, 24)",  // orange
    "rgb(245, 160, 20)",  // amber
    "rgb(247, 206, 20)",  // yellow
    "rgb(250, 226, 26)"   // pale yellow
  ];
  var CELL = 22;            // square size in px
  var BAND_SPAN = 0.94;     // bands fill the top 94%, the rest fades out
  var BLEED_UP = 0.12;      // how far the background specks reach back up into them
  var EDGE_BLEED = 0.48;    // chance a square at a band edge takes its neighbour
  var EDGE_ZONE = 0.40;     // how much of a band counts as "near the edge"
  var SPECKLE = 0.05;       // chance any square takes a neighbouring band

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function build() {
    var hero = document.getElementById("hero");
    var art = hero && hero.querySelector(".hero-art");
    if (!art) return;

    // Build wide enough to also cover the space the sidebar occupies, so when
    // it collapses the squares already exist and simply slide into view. The
    // overflow is clipped by .hero until then, and nothing has to re-render.
    var sidebar = document.getElementById("sidebar");
    var reserve = sidebar ? sidebar.offsetWidth : 0;
    var cols = Math.ceil((hero.clientWidth + reserve) / CELL);
    var rows = Math.ceil(hero.clientHeight / CELL);
    if (!cols || !rows) return;

    var rand = mulberry32(20261026);
    var last = BANDS.length - 1;
    var out = [];

    for (var y = 0; y < rows; y++) {
      var t = rows > 1 ? y / (rows - 1) : 0;
      for (var x = 0; x < cols; x++) {
        var color = null;
        var pos = (Math.min(t, BAND_SPAN) / BAND_SPAN) * BANDS.length;
        var i = Math.min(last, Math.floor(pos));
        var frac = pos - Math.floor(pos);
        var j = i;
        // squares near a boundary often take the colour on the other side
        var hi = 1 - EDGE_ZONE;
        if (frac > hi && i < last && rand() < EDGE_BLEED * ((frac - hi) / EDGE_ZONE)) j = i + 1;
        else if (frac < EDGE_ZONE && i > 0 && rand() < EDGE_BLEED * ((EDGE_ZONE - frac) / EDGE_ZONE)) j = i - 1;
        else if (rand() < SPECKLE) j = Math.max(0, Math.min(last, i + (rand() < 0.5 ? -1 : 1)));
        color = BANDS[j];

        // towards the bottom, squares start dropping out to the page background,
        // and the scatter begins above the last band so background specks bleed
        // up into the colour the same way the colour bleeds down
        var start = BAND_SPAN - BLEED_UP;
        if (t > start) {
          var f = (t - start) / (1 - start);
          if (rand() >= Math.pow(1 - f, 2.1) * 0.95) color = null;
        }

        out.push(color ? '<i style="background:' + color + '"></i>' : "<i></i>");
      }
    }

    art.style.gridTemplateColumns = "repeat(" + cols + ", " + CELL + "px)";
    art.style.gridAutoRows = CELL + "px";
    art.innerHTML = out.join("");
  }

  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(build, 120); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  window.addEventListener("resize", schedule);
  // the page swaps #content in place, so rebuild whenever it changes
  document.addEventListener("content:swapped", build);
})();
