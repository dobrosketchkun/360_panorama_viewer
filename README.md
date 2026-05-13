# 360 Panorama Viewer

A single-page equirectangular 360 panorama viewer built for cleanup work. The notable feature is interactive crop and pad on the source image — primarily for trimming the car / tripod off the bottom of Street View exports and padding the result back to a sensible aspect ratio.

Vite + Three.js + vanilla JS. Builds to a static site for GitHub Pages.

## Features

- Equirectangular input (2:1). Any size — large images may strain the browser.
- Load by drag-and-drop, clipboard paste, file picker, or URL. Drop and paste work anywhere on the page, anytime, even mid-fullscreen.
- Mouse / arrow / wheel controls. Touch supported (one-finger drag, two-finger pinch). No gyro.
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
| `S` | Save current image as PNG |
| `F` | Toggle fullscreen |
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
