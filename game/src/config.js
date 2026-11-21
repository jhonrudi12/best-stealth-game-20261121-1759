// Every tuning number, colour and the level map in one place. The playfield is a fixed
// 1280x720 logical area (32 by 18 tiles of 40 px); the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  runSpeed: 178,
  sneakSpeed: 88,
  /** Detection multiplier while standing still. */
  stillFactor: 0.7,
  /** Detection multiplier while sneaking (Shift held). */
  sneakFactor: 0.5,
  /** Detection multiplier while running. */
  runFactor: 1.2,
};

export const LIVES = 3;
export const PEBBLES_START = 5;
export const PEBBLE_RANGE = 420;
export const PEBBLE_HEAR_RADIUS = 280;

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  investigateSpeed: 112,
  chaseSpeed: 168,
  /** Vision range in px, and half-angle of the cone in radians. */
  viewRange: 245,
  viewHalfAngle: 0.61,
  /** Detection fills 0..1 at this rate when the player is fully visible up close. */
  detectRate: 0.95,
  /** Detection drains at this rate per second while the player is unseen. */
  forgetRate: 0.45,
  /** Above this the guard gets suspicious and walks to the last seen spot. */
  suspiciousAt: 0.55,
  /** Seconds of seeing nothing before an alerted guard gives up and returns to patrol. */
  giveUpAfter: 3.0,
  /** Distance at which a chasing guard catches the player. */
  catchDistance: 28,
};

/** Light pools make the player easier to spot; darkness and bushes hide them. */
export const LIGHT = {
  radius: 135,
  inLightFactor: 1.6,
  darkFactor: 0.6,
  bushFactor: 0.2,
};

export const SCORE = { gem: 100, relic: 500, pebbleBonus: 1 };
export const BEST_KEY = 'mothlight-heist.best';

/**
 * The museum floor. Legend:
 *   # wall   C crate (cover, blocks sight and movement)
 *   P pillar (cover, blocks sight and movement)
 *   B shrub (hide inside: guards barely see you; does not block movement)
 *   L lamp (light pool)   S player start   R golden moth relic
 *   G moon gem (optional)   E exit door   . open floor
 */
export const MAP = [
  '################################',
  '#S....C.......L......C........E#',
  '#.............##...............#',
  '#..P....C.....##.....C....P..G.#',
  '#.............##...............#',
  '#....B......L.##..L......B.....#',
  '#.............##...............#',
  '####...##########..#########...#',
  '#.............##C..............#',
  '#..C..G...L...##B...L......C...#',
  '#.............##...............#',
  '#....P....C...##...C....P......#',
  '#.............##...............#',
  '#..B.......L..##..L.......B....#',
  '#.............##...............#',
  '#.....C.....R......C.....G.....#',
  '#..............................#',
  '################################',
];

/** Guard patrol loops, in tile coordinates (converted to pixel centres by the level). */
export const PATROLS = [
  { waypoints: [[2, 2], [12, 2], [12, 4], [2, 4]], colour: '#e5534b' },
  { waypoints: [[17, 9], [26, 9], [26, 12], [17, 12]], colour: '#e8833a' },
  { waypoints: [[2, 16], [29, 16]], colour: '#c94b7c' },
  { waypoints: [[9, 10], [13, 10]], colour: '#8a5cf6' },
];

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#232833',
  floorDark: '#1d222c',
  floorLight: '#2e3442',
  wall: '#454e63',
  wallTop: '#5a6480',
  crate: '#7a5a34',
  crateTop: '#a07c46',
  pillar: '#6b7280',
  pillarTop: '#8b93a3',
  shrub: '#2f5d3a',
  shrubTop: '#3f7d4e',
  lampGlow: '#f2c94c',
  exit: '#4ade80',
  exitLocked: '#64748b',
  relic: '#ffd94d',
  gem: '#7dd3fc',
  player: '#f5d76e',
  playerSneak: '#d9b64a',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneAlert: 'rgba(229, 83, 75, 0.30)',
  coneSuspicious: 'rgba(232, 131, 58, 0.26)',
  text: '#eef1f5',
  muted: '#9aa3b2',
  panel: '#171b24',
  danger: '#e5534b',
  good: '#4ade80',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
