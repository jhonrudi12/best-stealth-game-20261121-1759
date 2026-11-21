// The level, parsed once from the map in config.js: which tiles are solid (walls, crates,
// pillars), which hide the player (shrubs), where the lamps shine, and where the player,
// the relic, the gems and the exit sit. Line of sight and vision rays march across this
// grid, so cover really does block a guard's view.

import { COLS, MAP, PATROLS, ROWS, TILE } from './config.js';

function tileAt(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return '#';
  return MAP[row][col];
}

export function isSolidTile(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'C' || t === 'P';
}

export function isShrubTile(col, row) {
  return tileAt(col, row) === 'B';
}

function centre(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

export function createLevel() {
  const start = { x: 0, y: 0 };
  const relic = { x: 0, y: 0, taken: false };
  const exit = { x: 0, y: 0 };
  const gems = [];
  const lamps = [];
  const shrubs = [];
  const solids = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const t = MAP[row][col];
      const at = centre(col, row);
      if (t === 'S') { start.x = at.x; start.y = at.y; }
      else if (t === 'R') { relic.x = at.x; relic.y = at.y; }
      else if (t === 'E') { exit.x = at.x; exit.y = at.y; }
      else if (t === 'G') gems.push({ x: at.x, y: at.y, taken: false });
      else if (t === 'L') lamps.push({ x: at.x, y: at.y });
      else if (t === 'B') shrubs.push({ x: at.x, y: at.y, col, row });
      if (t === '#' || t === 'C' || t === 'P') solids.push({ x: at.x, y: at.y, col, row, kind: t });
    }
  }
  const patrols = PATROLS.map((p) => ({
    waypoints: p.waypoints.map(([col, row]) => centre(col, row)),
    colour: p.colour,
  }));

  /** True when the point sits inside a solid tile. */
  function solidAt(x, y) {
    return isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** True when the point sits inside a shrub tile (a hiding spot). */
  function inShrub(x, y) {
    return isShrubTile(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** True when the point sits inside a lamp's light pool. */
  function inLight(x, y) {
    for (const lamp of lamps) {
      const dx = x - lamp.x;
      const dy = y - lamp.y;
      if (dx * dx + dy * dy <= 135 * 135) return true;
    }
    return false;
  }

  /**
   * Line of sight between two points: sample along the segment; blocked the moment a
   * sample lands in a solid tile. Shrubs and lamps never block sight.
   */
  function hasLineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 7));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (solidAt(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  /**
   * How far a ray from (x, y) in direction `angle` travels before hitting a solid tile,
   * capped at maxDist. The renderer's vision cones are built from these rays.
   */
  function castRay(x, y, angle, maxDist) {
    const step = 6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let d = step;
    while (d < maxDist) {
      if (solidAt(x + cos * d, y + sin * d)) return d;
      d += step;
    }
    return maxDist;
  }

  /** Circle (x, y, r) against solid tiles: true when it would overlap one. */
  function circleHitsSolid(x, y, r) {
    const c0 = Math.floor((x - r) / TILE);
    const c1 = Math.floor((x + r) / TILE);
    const r0 = Math.floor((y - r) / TILE);
    const r1 = Math.floor((y + r) / TILE);
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        if (!isSolidTile(col, row)) continue;
        const nx = Math.max(col * TILE, Math.min(x, (col + 1) * TILE));
        const ny = Math.max(row * TILE, Math.min(y, (row + 1) * TILE));
        const dx = x - nx;
        const dy = y - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  return { start, relic, exit, gems, lamps, shrubs, solids, patrols, solidAt, inShrub, inLight, hasLineOfSight, castRay, circleHitsSolid };
}
