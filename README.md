# best-stealth-game-20261121-1759

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/jhonrudi12/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/jhonrudi12/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# Mothlight Heist

A top-down stealth game that runs in a desktop browser from static files, no network
requests. You are Pip, a moth-thief in the Grand Museum after dark. Steal the Golden
Moth, then slip out the green exit — unseen.

## How to play

Open `game/index.html` in desktop Chrome, or serve the folder (`node serve.ts`, then
http://localhost:8080).

- Move with WASD or the arrow keys. Hold Shift to sneak (slower, much harder to spot).
- Click anywhere within reach to toss a pebble: guards in earshot walk over to
  investigate the noise.
- Guards patrol the halls with lantern vision cones. Walls, crates and pillars block
  their sight; the eye in the top-right shows how close the most suspicious guard is
  to spotting you.
- Shrubs hide you — crouch in one and a guard barely sees you. Lamplight gives you
  away: standing in a lamp's glow fills the eye fast.
- Grab the Golden Moth to unlock the exit, collect moon gems for score and an extra
  pebble each. Three lives: get caught and you slip back to the entrance.
- P or Esc pauses. Space or click starts and restarts.

## Mechanics

- 4 guards with patrol loops, raycast vision cones, and three states: patrol,
  suspicious (walks to the last seen spot or a heard noise), and alert (chases you).
  Detection fills by distance, light, movement and cover, and drains when you are
  unseen; an alerted guard gives up after losing you for a few seconds.
- A fixed 32×18-tile museum: cover lanes, hiding shrubs, light pools, a locked
  exit, and a timed score bonus for a fast getaway.
- Deterministic: `?seed=N` staggers the guards' patrol phases, so every run with
  the same seed plays the same. `?shot=start|play|alert|win` stages a scene.
- Procedural WebAudio sounds (pickup, suspicion, alert, getaway) — no audio files.

## Files

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `config.js` (tuning, palette, level map, patrols), `level.js` (tiles, line of
  sight, vision rays), `world.js` (rules, guard AI, detection, noise, pickups),
  `input.js` (keyboard and mouse), `render.js` (canvas drawing, HUD, panels),
  `audio.js` (procedural sounds), `shots.js` (screenshot scenes), `main.js`
  (boot, loop, screens).
- `screenshots/` — 4 real renders of the game's own code: title, mid-game, alert,
  and a clean getaway.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes
  `/output/dossier.json` with the vendored make.fun library.
