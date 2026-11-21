// The game's rules and state, with no drawing and no browser in it: the moth-thief, the
// patrolling guards and their vision, detection, noise, pickups and the win. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld returns.

import { FIELD, GUARD, LIGHT, PEBBLE_HEAR_RADIUS, PEBBLE_RANGE, PEBBLES_START, PLAYER, SCORE, STEP } from './config.js';

export const EVENT_GEM = 1;
export const EVENT_RELIC = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_PEBBLE = 16;
export const EVENT_ALERT = 32;
export const EVENT_SUSPICIOUS = 64;
export const EVENT_OVER = 128;

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

function clampAngle(a) {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

export function createWorld(level, seed) {
  const player = { x: level.start.x, y: level.start.y, angle: 0, moving: false, sneaking: false };
  // The seed staggers the guards' patrol phases, so ?seed=N changes the pattern.
  const phase = (seed || 0) >>> 0;
  const guards = level.patrols.map((patrol, index) => ({
    x: patrol.waypoints[(phase + index) % patrol.waypoints.length].x,
    y: patrol.waypoints[(phase + index) % patrol.waypoints.length].y,
    angle: 0,
    colour: patrol.colour,
    waypoints: patrol.waypoints,
    waypoint: ((phase + index + 1) % patrol.waypoints.length),
    state: 'patrol',
    waitTimer: ((phase >> (index * 3)) % 10) / 10 * 0.8,
    scanPhase: index * 1.7,
    detection: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    unseenTimer: 0,
    investigateX: 0,
    investigateY: 0,
  }));
  const pebbles = [];
  for (let i = 0; i < 8; i += 1) pebbles.push({ active: false, x: 0, y: 0, age: 0, targetX: 0, targetY: 0 });
  const rings = [];
  for (let i = 0; i < 4; i += 1) rings.push({ active: false, x: 0, y: 0, age: 0 });
  const state = {
    player,
    guards,
    pebbles,
    rings,
    score: 0,
    lives: 3,
    gemsTaken: 0,
    gemsTotal: level.gems.length,
    relicTaken: false,
    exitOpen: false,
    elapsed: 0,
    pebblesLeft: PEBBLES_START,
    maxDetection: 0,
    status: 'playing',
  };

  function placeGuards() {
    for (let index = 0; index < guards.length; index += 1) {
      const guard = guards[index];
      const startAt = (phase + index) % guard.waypoints.length;
      guard.x = guard.waypoints[startAt].x;
      guard.y = guard.waypoints[startAt].y;
      guard.angle = 0;
      guard.waypoint = (startAt + 1) % guard.waypoints.length;
      guard.state = 'patrol';
      guard.waitTimer = ((phase >> (index * 3)) % 10) / 10 * 0.8;
      guard.detection = 0;
      guard.unseenTimer = 0;
    }
  }

  function reset() {
    player.x = level.start.x;
    player.y = level.start.y;
    player.angle = 0;
    player.moving = false;
    player.sneaking = false;
    placeGuards();
    for (const pebble of pebbles) pebble.active = false;
    for (const ring of rings) ring.active = false;
    for (const gem of level.gems) gem.taken = false;
    level.relic.taken = false;
    state.score = 0;
    state.lives = 3;
    state.gemsTaken = 0;
    state.relicTaken = false;
    state.exitOpen = false;
    state.elapsed = 0;
    state.pebblesLeft = PEBBLES_START;
    state.maxDetection = 0;
    state.status = 'playing';
  }

  function respawn() {
    player.x = level.start.x;
    player.y = level.start.y;
    player.angle = 0;
    placeGuards();
    for (const pebble of pebbles) pebble.active = false;
    for (const ring of rings) ring.active = false;
    state.maxDetection = 0;
    state.status = 'playing';
  }

  function moveCircle(entity, dx, dy, radius) {
    const nx = entity.x + dx;
    if (!level.circleHitsSolid(nx, entity.y, radius)) entity.x = nx;
    const ny = entity.y + dy;
    if (!level.circleHitsSolid(entity.x, ny, radius)) entity.y = ny;
  }

  function freePebble() {
    for (const p of pebbles) if (!p.active) return p;
    return null;
  }

  function freeRing() {
    for (const r of rings) if (!r.active) return r;
    return null;
  }

  function throwPebble(x, y) {
    if (state.pebblesLeft <= 0) return false;
    const dx = x - player.x;
    const dy = y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PEBBLE_RANGE || dist < 20) return false;
    if (level.solidAt(x, y)) return false;
    const pebble = freePebble();
    if (pebble === null) return false;
    state.pebblesLeft -= 1;
    pebble.active = true;
    pebble.x = player.x;
    pebble.y = player.y;
    pebble.startX = player.x;
    pebble.startY = player.y;
    pebble.targetX = x;
    pebble.targetY = y;
    pebble.age = 0;
    return true;
  }

  function landPebble(pebble) {
    pebble.active = false;
    const ring = freeRing();
    if (ring !== null) {
      ring.active = true;
      ring.x = pebble.targetX;
      ring.y = pebble.targetY;
      ring.age = 0;
    }
    for (const guard of guards) {
      const d = Math.hypot(guard.x - pebble.targetX, guard.y - pebble.targetY);
      if (d > PEBBLE_HEAR_RADIUS) continue;
      if (guard.state === 'alert') continue;
      guard.investigateX = pebble.targetX;
      guard.investigateY = pebble.targetY;
      if (guard.state !== 'suspicious') guard.state = 'suspicious';
      guard.waitTimer = 0;
    }
  }

  /**
   * How visible a player standing at (x, y) would be to this guard: 0 when unseen.
   * The autopilot in shots.js uses it to pick a route the guards cannot see.
   */
  function playerVisibility(guard, x, y, moving, sneaking) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.viewRange) return 0;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD.viewHalfAngle) return 0;
    if (!level.hasLineOfSight(guard.x, guard.y, x, y)) return 0;
    let factor = 1 - (0.65 * dist) / GUARD.viewRange;
    factor *= level.inLight(x, y) ? LIGHT.inLightFactor : LIGHT.darkFactor;
    if (level.inShrub(x, y)) factor *= LIGHT.bushFactor;
    if (!moving) factor *= PLAYER.stillFactor;
    else if (sneaking) factor *= PLAYER.sneakFactor;
    else factor *= PLAYER.runFactor;
    return factor;
  }

  /** How visible the player is to this guard right now: 0 when unseen, up to ~1.9. */
  function visibility(guard) {
    return playerVisibility(guard, player.x, player.y, player.moving, player.sneaking);
  }

  function moveGuard(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const stepLen = Math.min(dist, speed * dt);
    const nx = guard.x + (dx / dist) * stepLen;
    const ny = guard.y + (dy / dist) * stepLen;
    guard.angle = clampAngle(Math.atan2(dy, dx));
    if (!level.circleHitsSolid(nx, guard.y, GUARD.radius)) guard.x = nx;
    if (!level.circleHitsSolid(guard.x, ny, GUARD.radius)) guard.y = ny;
    return dist - stepLen < 4;
  }

  function updateGuard(guard, dt, events) {
    const seen = visibility(guard);
    if (seen > 0) {
      guard.detection = Math.min(1, guard.detection + GUARD.detectRate * seen * dt);
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
      guard.unseenTimer = 0;
    } else {
      guard.detection = Math.max(0, guard.detection - GUARD.forgetRate * dt);
      guard.unseenTimer += dt;
    }
    if (guard.detection > state.maxDetection) state.maxDetection = guard.detection;

    if (guard.state !== 'alert' && guard.detection >= 1) {
      guard.state = 'alert';
      guard.unseenTimer = 0;
      events.value |= EVENT_ALERT;
    } else if (guard.state === 'patrol' && guard.detection >= GUARD.suspiciousAt) {
      guard.state = 'suspicious';
      guard.investigateX = guard.lastSeenX;
      guard.investigateY = guard.lastSeenY;
      guard.waitTimer = 0;
      events.value |= EVENT_SUSPICIOUS;
    }

    if (guard.state === 'patrol') {
      if (guard.waitTimer > 0) {
        guard.waitTimer -= dt;
        guard.scanPhase += dt;
        guard.angle = clampAngle(guard.angle + Math.sin(guard.scanPhase * 1.4) * 0.9 * dt);
      } else {
        const target = guard.waypoints[guard.waypoint];
        if (moveGuard(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
          guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
          guard.waitTimer = 0.8;
        }
      }
    } else if (guard.state === 'suspicious') {
      if (guard.waitTimer > 0) {
        guard.waitTimer -= dt;
        guard.scanPhase += dt;
        guard.angle = clampAngle(guard.angle + Math.sin(guard.scanPhase * 2.2) * 1.4 * dt);
        if (guard.waitTimer <= 0) {
          guard.state = 'patrol';
          guard.detection = Math.min(guard.detection, 0.3);
          let best = 0;
          let bestDist = Infinity;
          for (let i = 0; i < guard.waypoints.length; i += 1) {
            const w = guard.waypoints[i];
            const d = Math.hypot(w.x - guard.x, w.y - guard.y);
            if (d < bestDist) { bestDist = d; best = i; }
          }
          guard.waypoint = best;
        }
      } else if (moveGuard(guard, guard.investigateX, guard.investigateY, GUARD.investigateSpeed, dt)) {
        guard.waitTimer = 1.2;
      }
    } else if (guard.state === 'alert') {
      const targetX = seen > 0 ? player.x : guard.lastSeenX;
      const targetY = seen > 0 ? player.y : guard.lastSeenY;
      if (guard.unseenTimer > GUARD.giveUpAfter) {
        guard.state = 'suspicious';
        guard.investigateX = guard.lastSeenX;
        guard.investigateY = guard.lastSeenY;
        guard.waitTimer = 0;
        guard.detection = 0.6;
      } else {
        moveGuard(guard, targetX, targetY, GUARD.chaseSpeed, dt);
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchDistance) {
        events.value |= EVENT_CAUGHT;
      }
    }
  }

  /**
   * One fixed step. moveX/moveY is the player's wished direction (-1..1 each),
   * sneaking is Shift, throwAt is a world point to toss a pebble at, or null.
   * With `demo` set (the title screen's backdrop) the guards patrol but never
   * spot the player, and nothing is picked up or won.
   */
  function step(dt, moveX, moveY, sneaking, throwAt, demo) {
    let events = 0;
    const boxed = { value: 0 };
    if (!demo) state.elapsed += dt;

    if (throwAt !== null) {
      if (throwPebble(throwAt.x, throwAt.y)) events |= EVENT_PEBBLE;
    }

    const len = Math.hypot(moveX, moveY);
    player.moving = len > 0.01;
    player.sneaking = sneaking && player.moving;
    if (player.moving) {
      const nx = moveX / (len || 1);
      const ny = moveY / (len || 1);
      player.angle = Math.atan2(ny, nx);
      const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.runSpeed;
      moveCircle(player, nx * speed * dt, ny * speed * dt, PLAYER.radius);
    }
    player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x));
    player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y));

    for (const pebble of pebbles) {
      if (!pebble.active) continue;
      pebble.age += dt;
      const flight = 0.28;
      const t = Math.min(1, pebble.age / flight);
      pebble.x = pebble.startX + (pebble.targetX - pebble.startX) * t;
      pebble.y = pebble.startY + (pebble.targetY - pebble.startY) * t;
      if (pebble.age >= flight) landPebble(pebble);
    }
    for (const ring of rings) {
      if (!ring.active) continue;
      ring.age += dt;
      if (ring.age > 0.9) ring.active = false;
    }

    for (const guard of guards) {
      if (demo) {
        guard.detection = 0;
        if (guard.waitTimer > 0) {
          guard.waitTimer -= dt;
          guard.scanPhase += dt;
          guard.angle = clampAngle(guard.angle + Math.sin(guard.scanPhase * 1.4) * 0.9 * dt);
        } else {
          const target = guard.waypoints[guard.waypoint];
          if (moveGuard(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
            guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
            guard.waitTimer = 0.8;
          }
        }
      } else {
        updateGuard(guard, dt, boxed);
      }
    }
    events |= boxed.value;

    if (demo) return events;

    for (const gem of level.gems) {
      if (gem.taken) continue;
      if (Math.hypot(player.x - gem.x, player.y - gem.y) < 26) {
        gem.taken = true;
        state.gemsTaken += 1;
        state.score += SCORE.gem;
        state.pebblesLeft += SCORE.pebbleBonus;
        events |= EVENT_GEM;
      }
    }
    if (!level.relic.taken && Math.hypot(player.x - level.relic.x, player.y - level.relic.y) < 28) {
      level.relic.taken = true;
      state.relicTaken = true;
      state.exitOpen = true;
      state.score += SCORE.relic;
      events |= EVENT_RELIC;
    }
    if (state.exitOpen && Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < 30) {
      state.status = 'won';
      state.score += Math.max(0, 600 - Math.floor(state.elapsed) * 2);
      events |= EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, level, reset, respawn, step, playerVisibility, STEP };
}
