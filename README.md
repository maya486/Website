# Website

Static personal site with a flamegraph-style sidebar. No build step: open `index.html` in a browser.

- `index.html` — home page
- `pages/*.html` — one page per sidebar section (currently empty placeholders)
- `assets/sidebar.js` — the sidebar and the breadcrumb (both generated from the same tree, so a page's breadcrumb colors match its flamegraph frames). Edit `TREE` at the top to add, rename, or move pages; the flamegraph relayouts itself (each frame's height is proportional to the number of leaf pages beneath it).
- `assets/img/` — images. Save a file here and reference it as `../assets/img/<name>.png` from a page in `pages/`.
- `assets/style.css` — styles. Flamegraph colors are the `--d0`..`--d4` variables (one per depth); `--col-w` and `--leaf-h` control frame size.

The sidebar is open by default. The ☰ button in the top-left corner hides/shows it and remembers the choice in `localStorage`.

When served over HTTP (for example `python3 -m http.server`), clicking a frame swaps in the target page's content without reloading, so the sidebar never flickers. When opened directly from disk (`file://`), browsers block that, and clicks fall back to normal page loads.


## Links still missing a URL

These point at `#` and have a TODO comment beside them:

- `pages/meng-thesis.html` — the thesis PDF
- `pages/cool-work-at-mit.html` — the xv6 source
- `pages/6-1100.html` — the group's final design document
