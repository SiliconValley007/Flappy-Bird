# FLAP

A single-file Flappy Bird–style game. Tight physics, fullscreen on every screen size, no build step.

Open [index.html](index.html) in a browser, or play it on GitHub Pages website(link below description, top right side).

## Play

- **Fly:** tap, click, Space, or Enter
- **Pause:** pause button (top left), Esc, or P
- **Resume:** Resume, tap outside the menu, Esc, P, Space, or Enter
- **Restart:** Restart in the pause menu, or R while paused
- **Sound:** speaker button (top right), Sound in the pause menu, or M
- First tap/click/Space starts the run
- After a crash, tap again to retry immediately
- Switching apps or leaving the tab pauses automatically

High score and mute preference are stored in `localStorage` (private mode still plays; it just will not persist).

## Run locally

No install. From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

You can also open `index.html` directly as a file. Some browsers mute Web Audio until a gesture, which this game already waits for.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Push this project (at least `index.html` and this README) to the default branch.
3. In the repo: **Settings → Pages**.
4. Set **Source** to **Deploy from a branch**.
5. Choose your default branch and folder `/` (root).
6. Save. After a minute the site is live.

If the repo is named `<username>.github.io`, Pages serves it from the root of that domain.

## What is in the file

One self-contained `index.html` (inline CSS + JS). No CDNs, no assets, no frameworks.

- Velocity physics (gravity 0.52, jump -8.15, fall clamp, 60 Hz fixed step)
- Playable pipe gaps on portrait phones, landscape phones, tablets, and wide desktops
- Fullscreen canvas that follows `visualViewport` (iOS Safari URL bar / notch)
- Safe-area padding for notched phones
- Instant SFX via Web Audio API
- Score + best score, game over panel, fast retry loop
