# 360 Panorama Viewer

A single-page equirectangular 360 panorama viewer built for cleanup work. The notable feature is interactive crop and pad on the source image — primarily for trimming the car / tripod off the bottom of Street View exports and padding the result back to a sensible aspect ratio.

Vite + Three.js + vanilla JS. Builds to a static site for GitHub Pages.

Try here - https://dobrosketchkun.github.io/360_panorama_viewer/

## Features

- Equirectangular input (2:1). Any size — large images may strain the browser.
- Load by drag-and-drop, clipboard paste, file picker, or URL. Drop and paste work anywhere on the page, anytime, even mid-fullscreen.
- Direct-link parameter: `…/?<image-url>` (or `…/?url=<encoded>`) auto-loads that image on page open. Subject to the host serving CORS headers.
- Optional depth map, appended as `&d=<depth-url>`: `…/?<image-url>&d=<depth-url>`. The same notation works in the URL field of the open dialog. The split only happens when the value after `&d=` is itself an `http(s)` URL, so panorama URLs carrying their own query string keep working. If the depth map fails to fetch, the panorama still loads and a warning is shown.
- Optional depth strength, appended as `&ds=<number>`: `…/?<image-url>&d=<depth-url>&ds=2.0`. Default is `2.0`. In the bare form `&ds=` must come **last**, since its value is a plain number with no URL shape to disambiguate it from a parameter belonging to the panorama URL; in the `?url=…` form position doesn't matter.
- Depth map enables a small 6DoF-lite parallax: the sphere is displaced by the map and `WASD`/`QE` lean the eye around the centre, springing back on release.
- Mouse / arrow / wheel controls. Touch supported (one-finger drag, two-finger pinch). No gyro.
- Auto-rotate mode with keyboard speed and direction controls.
- Fullscreen with auto-hiding chrome (compass + help badge + exit button).
- Compass: shows heading, click to reset to north.
- Crop and pad each edge of the image. Negative slider value = pad with black, positive = crop pixels. Each completed drag is one undo step.
- Hold `Ctrl` while dragging a crop/pad slider for fine (1 px per pointer pixel) control.
- Export the edited image as a PNG.

## Controls

| Input | Action |
|---|---|
| Mouse drag / arrow keys | Look around |
| Wheel / two-finger pinch | Zoom (FOV) |
| One-finger touch drag | Look around |
| `O` | Open dialog (URL or file picker) |
| `C` | Crop / Pad dialog |
| `Alt+S` | Save current image as PNG |
| `WASD` / `QE` | Lean the eye around the centre (depth map only) |
| `Shift` | Hold while leaning for fine control |
| `[` / `]` | Weaker / stronger depth (depth map only) |
| `F` | Toggle fullscreen |
| `R` | Toggle auto-rotate |
| `+` / `-` | Increase / decrease auto-rotate speed by 1 deg/s |
| `Alt++` / `Alt+-` | Fine-adjust auto-rotate speed by 0.1 deg/s |
| `*` | Flip auto-rotate direction |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo crop+pad |
| `Esc` | Close top dialog, then exit fullscreen |
| `?` | Show hotkey help |

Drop, paste, or pick to load an image at any moment — no dialog required.

## Repository layout

```
/                  the deployed site (GitHub Pages serves from here)
  index.html       built file, copied from app/dist/
  assets/          built files, copied from app/dist/
  README.md
  .gitignore
  app/             Node tooling and source — not deployed
    package.json
    vite.config.js
    index.html
    src/
      main.js, viewer.js, controls.js, pipeline.js, input.js,
      motion.js, depthprep.js, panospec.js,
      dialog.js, compass.js, fullscreen.js, hotkeys.js, style.css
      dialogs/
        cropPad.js, open.js, help.js
```

The repo root is the deployed site. The `app/` folder holds everything Node and is gitignored where possible (`node_modules/`, `dist/`).

## Build

```
cd app
npm install
npm run build
```

Output goes to `app/dist/`. Vite is configured with `base: './'` so the produced `index.html` references its assets with relative paths, which works under the `username.github.io/<repo>/` subpath.

## Local development

```
cd app
npm run dev
```

Vite dev server with hot reload. Use this for iteration; only run the production build when you are ready to publish.

## Deploy to GitHub Pages

After building:

1. From the repo root, delete the existing `index.html` and the entire `assets/` directory. Vite hashes filenames per build, so stale chunks would accumulate otherwise.
2. Copy `app/dist/index.html` and `app/dist/assets/` into the repo root.
3. Commit and push.

In GitHub Pages settings, configure the page to serve from the repository root of the main branch.
