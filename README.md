# Ashline

Ashline is an original browser-playable 3D tactical shooter prototype built with Vite and Three.js. It uses procedural textures, generated audio, dust particles, shadows, simple bots, and a round-based plant/defuse loop.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/Ashline.github.io/`.

## Production Build

```bash
npm run build
npm run preview
```

The preview URL is usually `http://localhost:4173/Ashline.github.io/`.

## GitHub Pages

This project is configured for the repository `QMApplicationUnofficial/Ashline.github.io`.

The Vite base path is set to:

```js
base: '/Ashline.github.io/'
```

For GitHub Pages, enable Pages in the repository settings and select **Deploy from a branch** as the source. Use:

- Branch: `gh-pages`
- Folder: `/ (root)`

The workflow in `.github/workflows/deploy.yml` builds `dist/` and publishes the static output to the `gh-pages` branch.

Expected project Pages URL:

```text
https://qmapplicationunofficial.github.io/Ashline.github.io/
```

Note: `https://github.com/QMApplicationUnofficial/Ashline.github.io` is the repository URL, not the playable Pages URL.

## Controls

- `WASD`: Move
- Mouse: Look
- Left click: Shoot
- `R`: Reload
- `1`, `2`, `3`: Switch weapon
- `Shift`: Sprint
- `Ctrl` or `C`: Crouch
- `Space`: Jump
- `E`: Plant or interact
- `B`: Buy/loadout menu during buy phase
- `Esc`: Pause

## Current Prototype Limits

The game is intentionally lightweight for browser performance. Bots use simple navigation and procedural proxy characters rather than full animated rigs. Textures, decals, dust, and audio are generated in code so the game can ship without external paid assets.
