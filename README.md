# FLAP

A fullscreen Flappy Bird-style browser game. Vanilla JS, no build step, no CDN, no backend. Strict `'self'` CSP. Installable PWA with offline play.

**Play live:** https://siliconvalley007.github.io/Flappy-Bird/

## Features

- **Classic, Daily, and Practice modes.** Daily uses a date-seeded PRNG for pipe layouts; Practice is slower and forgiving and never records a best.
- **Five bird skins** unlocked by best score: Sunny (0), Ember (10), Frost (25), Solar (50), Void (100). The selection persists.
- **Local records:** best score, total flaps, total runs, best streak, and a Top-10 run history. Daily best resets each day.
- **Share score** from the game-over card on `http`/`https` (Web Share when `canShare` allows it, otherwise clipboard). Hidden on `file://` and when neither API works.
- **Fullscreen toggle** when the browser supports it. Also `F`.
- 60 Hz fixed physics with interpolated rendering; adaptive DPR and effects quality if frame time exceeds 20 ms.
- Pre-rendered procedural music and SFX: 8-voice cap, limiter, pause/hidden gain ducking, silent keepalive, resume-only recovery; nothing plays before a user gesture.
- Parallax sky, clouds, hills, particles, score count-up, NEW BEST celebration, animated start/game-over screens, first-run tutorial.
- Reduced-motion support, colorblind-safe contrast, 44 px minimum touch targets, safe-area aware layout.
- PWA: installable, offline cache, update banner, Daily/Classic app shortcuts.
- Gamepad: A/RT flap, Start pause, Y mute, X fullscreen.

## Controls

- **Fly / start / retry:** tap, click, Space, Enter, ArrowUp, or gamepad A
- **Pause:** pause button, Esc, P, gamepad Start, or switching away from the tab
- **Resume:** Resume, tap outside the menu, Esc, P, Space, Enter, or gamepad Start
- **Restart:** Restart in the pause menu, or R while paused
- **Sound:** speaker button, Sound in the pause menu, M, or gamepad Y
- **Music:** Music in the pause menu
- **Skins / history:** Skins and Top 10 in the pause or game-over card, `K` / `H`
- **Fullscreen:** fullscreen icon, F, or gamepad X (hidden if unsupported)

Best score, settings, skins, stats, daily result, and Top-10 history are saved in `localStorage` under a versioned key. Existing `flap-best-v1`, `flap-set-v2`, and `flap-mute-v1` values are migrated automatically. Private mode still plays; it just may not persist.

## Audio

Sound is synthesized at runtime into mono `AudioBuffer`s at the context sample rate (capped at 48 kHz): no audio files, no requests. Buffers render in short idle slices shortly after load, silently, so gameplay never blocks and the first flap is instant; the active mode's music loop is ready first and other modes follow. Nothing is audible until the first user gesture. One looping music source is started per mode and kept running; pause ducks it to half, tab-hide and mute ramp it to zero. SFX are short-lived buffer sources capped at 8 concurrent voices with a 40 ms rate limit per sound. The graph is master gain (0.55) -> compressor/limiter (threshold -6 dB, ratio 20, knee 0) -> output trim, with a brief music dip under SFX (forced back to 1 after 600 ms) and a looping ~-70 dB noise keepalive through the limiter. A 2 s watchdog plus gesture/visibility/focus self-heal restart a missing music source or a stuck-zero gain without tearing down a healthy graph. Suspend/interrupt only call `resume()` (debounced). A closed or silently-stuck context is rebuilt on the next user gesture, never from a timer. Window blur does not pause the game or audio. Append `?debug=1` to overlay context state, music, gains, duck, voices, resumes, and rebuilds.

## PWA

- The **INSTALL** button appears when installation is available.
- Offline: the service worker precaches the game and serves the cached shell if the network fails.
- Updates: when a new build is waiting, **Update ready — tap to reload** appears. Tap it to activate the new worker and reload.
- Shortcuts launch directly into Daily or Classic (`./?mode=daily`, `./?mode=classic`).

## Run locally

No install. From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

You can also open `index.html` directly; service-worker registration is skipped on `file://`. Append `?debug=1` to expose the read-only `window.__FLAP__` state hook used by automated tests; production builds do not expose it. Some browsers block audio or clipboard until a gesture or secure context; the game handles the gesture unlock.

## Deploy

GitHub: **Settings → Pages → Source: GitHub Actions**. Push to `main` or `master`, or run the workflow manually.

`.github/workflows/pages.yml`:

- stamps `__BUILD__` in `sw.js` and `game.js` with the commit SHA
- stamps `sitemap.xml` `lastmod` with the UTC build date
- runs `node --check` on every JavaScript file
- verifies referenced files exist
- stages referenced files plus new top-level assets
- deploys with `actions/upload-pages-artifact` and `actions/deploy-pages`

There is no server, database, account system, or analytics. Everything runs in the browser.

## File tree

```
.
├── index.html
├── style.css
├── game.js
├── sw.js
├── manifest.webmanifest
├── icon-192.png
├── icon-512.png
├── icon-maskable-512.png
├── apple-touch-icon.png
├── icon-192.svg
├── icon-512.svg
├── og-image.png
├── og-image.svg
├── 404.html
├── robots.txt
├── sitemap.xml
├── LICENSE
├── README.md
├── .nojekyll
├── .editorconfig
├── .gitattributes
├── .gitignore
└── .github/workflows/pages.yml
```

## License

MIT. See `LICENSE`.
