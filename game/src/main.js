// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, caught, win and over.
//
// ?seed=N fixes the patrol pattern. ?shot=start|play|alert|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createLevel } from './level.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_GEM, EVENT_OVER, EVENT_PEBBLE, EVENT_RELIC, EVENT_SUSPICIOUS, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const level = createLevel();
const world = createWorld(level, createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// Read-only handle for play-testing and debugging: the live world and level.
window.__mothlight = { world, level };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, level, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    input.takeClick();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Golden Moth and reach the exit unseen.');
  }

  function handleCaught() {
    world.state.lives -= 1;
    audio.caught();
    if (world.state.lives <= 0) {
      screen = SCREEN_OVER;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Caught. Game over. Score ${world.state.score}. Best ${best}.`);
    } else {
      screen = SCREEN_CAUGHT;
      announce(`Caught. ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
    }
  }

  function handleWin() {
    screen = SCREEN_WIN;
    audio.win();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Clean getaway. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_CAUGHT) {
        world.respawn();
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, 0, false, null, true);
      return;
    }
    const move = input.move();
    const click = input.takeClick();
    const throwAt = click === null ? null : renderer.toWorld(click.x, click.y);
    const events = world.step(STEP, move.x, move.y, input.sneaking(), throwAt);
    if (events & EVENT_GEM) {
      audio.gem();
      announce('Moon gem taken. Plus one pebble.');
    }
    if (events & EVENT_RELIC) {
      audio.relic();
      announce('Golden Moth taken. The exit is open.');
    }
    if (events & EVENT_PEBBLE) audio.pebble();
    if (events & EVENT_SUSPICIOUS) {
      audio.suspicious();
      announce('A guard is suspicious.');
    }
    if (events & EVENT_ALERT) {
      audio.alert();
      announce('Spotted! A guard is chasing you.');
    }
    if (events & EVENT_CAUGHT) handleCaught();
    else if (events & EVENT_WIN) handleWin();
    else if (events & EVENT_OVER) {
      screen = SCREEN_OVER;
      announce('Game over.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, level, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Mothlight Heist. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
