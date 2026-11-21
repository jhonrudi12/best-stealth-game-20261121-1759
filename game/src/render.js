// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Vision cones are raycast polygons, so walls and crates really cut them off.
// Flat shapes and canvas text for the HUD and the panels; text that holds a number is
// rebuilt only when the number changes, so a frame allocates nothing.
import { FIELD, FONT, GUARD, LIGHT, PALETTE, TILE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 78 };
const CONE_RAYS = 26;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const gemLabel = cachedLabel('Gems ');
  const pebbleLabel = cachedLabel('Pebbles ');
  const timeLabel = cachedLabel('');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const timeFinalLabel = cachedLabel('Time ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Canvas-pixel point (e.g. a mouse click) to playfield coordinates. */
  function toWorld(px, py) {
    return { x: (px * (window.devicePixelRatio || 1) - view.x) / view.scale, y: (py * (window.devicePixelRatio || 1) - view.y) / view.scale };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor(level) {
    for (let row = 0; row < FIELD.height / TILE; row += 1) {
      for (let col = 0; col < FIELD.width / TILE; col += 1) {
        const x = col * TILE;
        const y = row * TILE;
        context.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorDark;
        context.fillRect(x, y, TILE, TILE);
      }
    }
    // Lamp pools glow on the floor.
    for (const lamp of level.lamps) {
      const glow = context.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, LIGHT.radius);
      glow.addColorStop(0, 'rgba(242, 201, 76, 0.16)');
      glow.addColorStop(1, 'rgba(242, 201, 76, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(lamp.x, lamp.y, LIGHT.radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSolids(level) {
    for (const s of level.solids) {
      const x = s.col * TILE;
      const y = s.row * TILE;
      if (s.kind === '#') {
        context.fillStyle = PALETTE.wall;
        context.fillRect(x, y, TILE, TILE);
        context.fillStyle = PALETTE.wallTop;
        context.fillRect(x, y, TILE, 6);
      } else if (s.kind === 'C') {
        context.fillStyle = PALETTE.crate;
        context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        context.fillStyle = PALETTE.crateTop;
        context.fillRect(x + 3, y + 3, TILE - 6, 5);
        context.strokeStyle = 'rgba(0,0,0,0.35)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 3, y + 3);
        context.lineTo(x + TILE - 3, y + TILE - 3);
        context.moveTo(x + TILE - 3, y + 3);
        context.lineTo(x + 3, y + TILE - 3);
        context.stroke();
      } else if (s.kind === 'P') {
        context.fillStyle = PALETTE.pillar;
        context.beginPath();
        context.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 4, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.pillarTop;
        context.beginPath();
        context.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 11, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawShrubs(level) {
    for (const shrub of level.shrubs) {
      const cx = shrub.x;
      const cy = shrub.y;
      context.fillStyle = PALETTE.shrub;
      context.beginPath();
      context.arc(cx - 9, cy + 4, 11, 0, Math.PI * 2);
      context.arc(cx + 9, cy + 5, 12, 0, Math.PI * 2);
      context.arc(cx, cy - 7, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.shrubTop;
      context.beginPath();
      context.arc(cx - 4, cy - 3, 5, 0, Math.PI * 2);
      context.arc(cx + 7, cy + 1, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLamps(level) {
    for (const lamp of level.lamps) {
      context.fillStyle = '#3a3f4d';
      context.fillRect(lamp.x - 3, lamp.y - 3, 6, 6);
      context.fillStyle = PALETTE.lampGlow;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 240, 180, 0.9)';
      context.beginPath();
      context.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawExit(level, exitOpen) {
    const x = level.exit.x;
    const y = level.exit.y;
    context.fillStyle = exitOpen ? PALETTE.exit : PALETTE.exitLocked;
    context.fillRect(x - 17, y - 17, 34, 34);
    context.fillStyle = '#0b0d12';
    context.fillRect(x - 11, y - 11, 22, 22);
    context.fillStyle = exitOpen ? PALETTE.exit : PALETTE.exitLocked;
    context.beginPath();
    context.moveTo(x, y - 8);
    context.lineTo(x + 7, y + 6);
    context.lineTo(x - 7, y + 6);
    context.closePath();
    context.fill();
  }

  function drawRelic(level) {
    if (level.relic.taken) return;
    const x = level.relic.x;
    const y = level.relic.y + Math.sin(performance.now() / 350) * 3;
    context.fillStyle = 'rgba(255, 217, 77, 0.18)';
    context.beginPath();
    context.arc(x, y, 26, 0, Math.PI * 2);
    context.fill();
    // The Golden Moth: two wings, a body, antennae.
    context.fillStyle = PALETTE.relic;
    context.beginPath();
    context.ellipse(x - 9, y - 3, 9, 13, -0.5, 0, Math.PI * 2);
    context.ellipse(x + 9, y - 3, 9, 13, 0.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8a6d1f';
    context.beginPath();
    context.ellipse(x, y, 4, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#8a6d1f';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x - 2, y - 10);
    context.quadraticCurveTo(x - 8, y - 18, x - 12, y - 16);
    context.moveTo(x + 2, y - 10);
    context.quadraticCurveTo(x + 8, y - 18, x + 12, y - 16);
    context.stroke();
  }

  function drawGems(level) {
    for (const gem of level.gems) {
      if (gem.taken) continue;
      const x = gem.x;
      const y = gem.y + Math.sin(performance.now() / 300 + gem.x) * 2;
      context.fillStyle = PALETTE.gem;
      context.beginPath();
      context.moveTo(x, y - 10);
      context.lineTo(x + 8, y);
      context.lineTo(x, y + 10);
      context.lineTo(x - 8, y);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.75)';
      context.beginPath();
      context.moveTo(x, y - 10);
      context.lineTo(x + 4, y - 2);
      context.lineTo(x - 4, y - 2);
      context.closePath();
      context.fill();
    }
  }

  function drawCone(level, guard) {
    const colour = guard.state === 'alert' ? PALETTE.coneAlert : guard.state === 'suspicious' ? PALETTE.coneSuspicious : PALETTE.cone;
    context.fillStyle = colour;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const a = guard.angle - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / CONE_RAYS;
      const d = level.castRay(guard.x, guard.y, a, GUARD.viewRange);
      context.lineTo(guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d);
    }
    context.closePath();
    context.fill();
  }

  function drawGuard(guard) {
    // Detection ring above the guard's head.
    if (guard.detection > 0.03) {
      context.strokeStyle = guard.detection >= 1 ? PALETTE.danger : PALETTE.lampGlow;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(guard.x, guard.y - 24, 9, -Math.PI / 2, -Math.PI / 2 + guard.detection * Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = guard.colour;
    context.beginPath();
    context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0b0d12';
    context.beginPath();
    context.arc(guard.x + Math.cos(guard.angle) * 5, guard.y + Math.sin(guard.angle) * 5, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(guard.x + Math.cos(guard.angle) * 7, guard.y + Math.sin(guard.angle) * 7, 2, 0, Math.PI * 2);
    context.fill();
    if (guard.state === 'alert') {
      text('!', guard.x, guard.y - 34, 26, PALETTE.danger, 'center');
    } else if (guard.state === 'suspicious') {
      text('?', guard.x, guard.y - 34, 24, '#e8833a', 'center');
    }
  }

  function drawPlayer(state, level) {
    const p = state.player;
    const hidden = level.inShrub(p.x, p.y);
    const inLight = level.inLight(p.x, p.y);
    context.save();
    if (hidden) context.globalAlpha = 0.45;
    // Sneak ring.
    if (p.sneaking) {
      context.strokeStyle = 'rgba(245, 215, 110, 0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, 20, 0, Math.PI * 2);
      context.stroke();
    }
    // Hooded moth-thief: cloak, hood, two antennae.
    context.fillStyle = p.sneaking ? PALETTE.playerSneak : PALETTE.player;
    context.beginPath();
    context.arc(p.x, p.y, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#3a2f14';
    context.beginPath();
    context.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#3a2f14';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(p.x - 3, p.y - 10);
    context.quadraticCurveTo(p.x - 10, p.y - 18, p.x - 14, p.y - 14);
    context.moveTo(p.x + 3, p.y - 10);
    context.quadraticCurveTo(p.x + 10, p.y - 18, p.x + 14, p.y - 14);
    context.stroke();
    context.restore();
    if (inLight && !hidden) {
      text('IN LIGHT', p.x, p.y - 26, 13, PALETTE.lampGlow, 'center');
    } else if (hidden) {
      text('HIDDEN', p.x, p.y - 26, 13, PALETTE.good, 'center');
    }
  }

  function drawPebbles(state) {
    for (const pebble of state.pebbles) {
      if (!pebble.active) continue;
      context.fillStyle = '#cbd5e1';
      context.beginPath();
      context.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const ring of state.rings) {
      if (!ring.active) continue;
      const t = ring.age / 0.9;
      context.strokeStyle = `rgba(203, 213, 225, ${0.8 * (1 - t)})`;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(ring.x, ring.y, 6 + t * 46, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawHud(state, level) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 20, 14, 26, PALETTE.text, 'left');
    text(gemLabel(`${state.gemsTaken}/${state.gemsTotal}`), 200, 14, 26, PALETTE.gem, 'left');
    text(state.relicTaken ? 'Relic ✓' : 'Relic ✗', 330, 14, 26, state.relicTaken ? PALETTE.relic : PALETTE.muted, 'left');
    text(pebbleLabel(state.pebblesLeft), 470, 14, 26, PALETTE.text, 'left');
    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60);
    text(timeLabel(`${mins}:${String(secs).padStart(2, '0')}`), FIELD.width / 2, 14, 26, PALETTE.text, 'center');
    // The detection word sits under the timer, clear of the eye and the lives.
    const d = state.maxDetection;
    text(d >= 1 ? 'SPOTTED!' : d >= 0.55 ? 'SUSPICIOUS' : state.player.sneaking ? 'SNEAKING' : '', FIELD.width / 2, 48, 20, d >= 1 ? PALETTE.danger : d >= 0.55 ? '#e8833a' : PALETTE.muted, 'center');
    // Lives: little moths, top right.
    text('Lives', FIELD.width - 150, 14, 26, PALETTE.text, 'left');
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < state.lives ? PALETTE.player : '#3a3f4d';
      context.beginPath();
      context.arc(FIELD.width - 92 + i * 26, 27, 8, 0, Math.PI * 2);
      context.fill();
    }
    // The eye: how close the most suspicious guard is to spotting you.
    const eyeX = FIELD.width - 210;
    const eyeY = 27;
    context.fillStyle = d >= 1 ? PALETTE.danger : d >= 0.55 ? '#e8833a' : '#3a3f4d';
    context.beginPath();
    context.ellipse(eyeX, eyeY, 20, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0b0d12';
    context.beginPath();
    context.arc(eyeX, eyeY, 4 + d * 4, 0, Math.PI * 2);
    context.fill();
    context.textBaseline = 'alphabetic';
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 13, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = '#2e3442';
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 74, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.relic, 'center');
  }

  const TITLE_LINES = [
    'You are Pip, a moth-thief in the Grand Museum after dark.',
    'Steal the Golden Moth, then slip out the green exit — unseen.',
    'Guards patrol with lantern cones. Crates and pillars block sight.',
    'Shrubs hide you. Lamplight gives you away. Click to toss a pebble',
    'and lure a guard off. Hold Shift to sneak. Move with WASD or ←↑↓→.',
    '',
  ];
  const PAUSED_LINES = ['The guards hold their patrol.'];
  const CAUGHT_LINES = ['A guard caught you in the light.', 'One moth-life flutters away.'];
  const WIN_LINES = ['', '', ''];
  const OVER_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, level, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(level);
    drawExit(level, state.exitOpen);
    drawShrubs(level);
    drawGems(level);
    drawRelic(level);
    drawSolids(level);
    drawLamps(level);
    for (const guard of state.guards) drawCone(level, guard);
    for (const guard of state.guards) drawGuard(guard);
    drawPebbles(state);
    drawPlayer(state, level);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('MOTHLIGHT HEIST', TITLE_LINES, 'Press Space or click to begin');
      return;
    }
    drawHud(state, level);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('Caught!', CAUGHT_LINES, 'Press Space to slip back to the entrance');
    } else if (screen === SCREEN_WIN) {
      const mins = Math.floor(state.elapsed / 60);
      const secs = Math.floor(state.elapsed % 60);
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = timeFinalLabel(`${mins}:${String(secs).padStart(2, '0')}`);
      WIN_LINES[2] = bestLabel(best);
      drawPanel('Clean getaway!', WIN_LINES, 'Press Space to play again');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('The museum keeps its moth', OVER_LINES, 'Press Space to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld };
}
