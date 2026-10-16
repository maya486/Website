# Website

Static personal site with a flamegraph-style sidebar. No build step: open `index.html` in a browser.

- `index.html` — home page
- `pages/*.html` — one page per sidebar section (currently empty placeholders)
- `assets/sidebar.js` — the sidebar. Edit `TREE` at the top to add, rename, or move pages; the flamegraph relayouts itself (each frame's height is proportional to the number of leaf pages beneath it).
- `assets/style.css` — styles. Flamegraph colors are the `--d0`..`--d4` variables (one per depth); `--col-w` and `--leaf-h` control frame size.

The sidebar is open by default. The toggle button at the top hides/shows it and remembers the choice in `localStorage`.
