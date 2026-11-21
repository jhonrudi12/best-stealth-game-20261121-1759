// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (each step it tries eight directions, keeps the one no guard can see that still moves
// toward the relic or the exit), so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { EVENT_CAUGHT, EVENT_OVER, EVENT_WIN } from './world.js';
import { PLAYER, STEP } from './config.js';
import { SCREEN_CAUGHT, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const LIMIT_SECONDS = 150;
const DIRECTIONS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Worst visibility across guards for a player standing at (x, y), sneaking. */
function worstVisibility(world, x, y) {
  let worst = 0;
  for (const guard of world.state.guards) {
    const v = world.playerVisibility(guard, x, y, true, true);
    if (v > worst) worst = v;
  }
  return worst;
}

/** Pick a direction: unseen first, then the one that closes most on the target. */
export function autopilot(world, targetX, targetY) {
  const p = world.state.player;
  const speed = PLAYER.sneakSpeed * STEP;
  // When a guard already sees us, forget the target: only getting unseen matters.
  const currentlySeen = worstVisibility(world, p.x, p.y);
  let best = [0, 0];
  let bestScore = Infinity;
  for (const [dx, dy] of DIRECTIONS) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = p.x + (dx / len) * speed;
    const ny = p.y + (dy / len) * speed;
    if (world.level.circleHitsSolid(nx, ny, PLAYER.radius)) continue;
    const seen = worstVisibility(world, nx, ny);
    const distNow = Math.hypot(targetX - p.x, targetY - p.y);
    const distNext = Math.hypot(targetX - nx, targetY - ny);
    const progress = distNow - distNext;
    // A faint glimpse is worth risking for progress; a hard stare is not.
    const score = currentlySeen > 0.12 ? seen * 200 : Math.max(0, seen - 0.12) * 200 - progress;
    if (score < bestScore) {
      bestScore = score;
      best = [dx / len, dy / len];
    }
  }
  return best;
}

/** Waypoint routes through the museum's corridors (tile coordinates). The greedy
 * autopilot alone stalls in the wall corners: it must first walk away from its goal
 * to go around a wall, so the route leads it down the left gap to the relic, then
 * along the bottom corridor and up the middle gap to the exit. */
const RELIC_ROUTE = [[5, 1], [5, 6], [5, 8], [5, 12], [9, 15], [12, 15]];
const EXIT_ROUTE = [[17, 16], [17, 8], [17, 2], [29, 1]];

function tileCentre(col, row) {
  return { x: (col + 0.5) * 40, y: (row + 0.5) * 40 };
}
function seekGuard(world) {
  const p = world.state.player;
  let nearest = null;
  let nearestDist = Infinity;
  for (const guard of world.state.guards) {
    const d = Math.hypot(guard.x - p.x, guard.y - p.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = guard;
    }
  }
  if (nearest === null) return [0, 0];
  const dx = nearest.x - p.x;
  const dy = nearest.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

/**
 * Set `world` to the named scene (start, play, alert or win; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'alert' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, 0, false, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'alert') {
    for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
      const dir = seekGuard(world);
      const events = world.step(STEP, dir[0], dir[1], false, null);
      const alerted = state.guards.some((g) => g.state === 'alert');
      if (alerted && state.maxDetection >= 1) return { screen: SCREEN_PLAY, best: state.score };
      if (events & (EVENT_CAUGHT | EVENT_OVER)) return { screen: SCREEN_CAUGHT, best: state.score };
    }
    return { screen: SCREEN_PLAY, best: state.score };
  }
  const limit = name === 'win' ? LIMIT_SECONDS : PLAY_SECONDS;
  const relicRoute = RELIC_ROUTE.map(([c, r]) => tileCentre(c, r));
  const exitRoute = EXIT_ROUTE.map(([c, r]) => tileCentre(c, r));
  let route = relicRoute;
  let routeIndex = 0;
  for (let i = 0; i < limit / STEP; i += 1) {
    if (state.relicTaken && route === relicRoute) {
      route = exitRoute;
      routeIndex = 0;
    }
    let target;
    if (routeIndex < route.length) {
      target = route[routeIndex];
      if (Math.hypot(target.x - state.player.x, target.y - state.player.y) < 24) {
        routeIndex += 1;
        target = routeIndex < route.length ? route[routeIndex] : null;
      }
    }
    if (target === undefined || target === null) {
      target = state.relicTaken ? world.level.exit : world.level.relic;
    }
    const dir = autopilot(world, target.x, target.y);
    const events = world.step(STEP, dir[0], dir[1], true, null);
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: state.score };
    if (events & (EVENT_CAUGHT | EVENT_OVER)) return { screen: SCREEN_CAUGHT, best: state.score };
    if (name === 'play' && state.relicTaken) return { screen: SCREEN_PLAY, best: state.score };
  }
  return { screen: state.status === 'won' ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
}
