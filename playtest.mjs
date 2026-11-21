// Play-test driver for Mothlight Heist: launches headless Chromium, drives the game
// over CDP (stdlib WebSocket only, no dependencies), and captures real screenshots.
// Usage: node playtest.mjs [port] — the game server must already run on that port.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const PORT = Number(process.argv[2] || 8080);
const OUT = new URL('./screenshots/', import.meta.url).pathname;
const SHOTS = [
  { name: '1-title.jpg', query: '?shot=start&seed=1' },
  { name: '2-play.jpg', query: '?shot=play&seed=1' },
  { name: '3-alert.jpg', query: '?shot=alert&seed=1' },
  { name: '4-win.jpg', query: '?shot=win&seed=1' },
];

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--remote-debugging-port=9222',
  '--window-size=1280,720',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      const json = await res.json();
      return json.webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('chrome devtools did not come up');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onopen = () => resolve({
      ws,
      events,
      send(method, params) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
        });
      },
    });
    ws.onerror = reject;
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && pending.has(data.id)) {
        const { res, rej } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) rej(new Error(JSON.stringify(data.error)));
        else res(data.result);
      } else if (data.method) {
        events.push(data);
      }
    };
  });
}

async function main() {
  const browserWs = await getWsUrl();
  const browser = await connect(browserWs);
  const target = await browser.send('Target.createTarget', { url: 'about:blank' });
  const targetWs = await connect(`ws://127.0.0.1:9222/devtools/page/${target.targetId}`);
  await targetWs.send('Runtime.enable');
  await targetWs.send('Page.enable');
  await targetWs.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  const evalJs = async (expression) => {
    const r = await targetWs.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('evaluate failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  };
  const shot = async (file) => {
    const r = await targetWs.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    writeFileSync(OUT + file, Buffer.from(r.data, 'base64'));
    console.log('saved', file);
  };
  const navigate = async (url) => {
    await targetWs.send('Page.navigate', { url });
    await sleep(1200);
  };
  const key = async (type, code, keyName) => {
    await targetWs.send('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: 32 });
  };

  // 1. Interactive play-test: title -> start -> move -> pebble -> pause.
  await navigate(`http://127.0.0.1:${PORT}/`);
  console.log('title status:', await evalJs(`document.getElementById('status').textContent`));
  console.log('player at start:', await evalJs(`JSON.stringify({x: Math.round(__mothlight.world.state.player.x), y: Math.round(__mothlight.world.state.player.y)})`));
  await shot('test-title.jpg');
  await key('keyDown', 'Space', ' ');
  await key('keyUp', 'Space', ' ');
  await sleep(500);
  console.log('after Space status:', await evalJs(`document.getElementById('status').textContent`));
  // Hold D (right) for 1s, then S (down) for 1s: the player must move.
  await targetWs.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyD', key: 'd' });
  await sleep(1000);
  await targetWs.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyD', key: 'd' });
  const moved = await evalJs(`JSON.stringify({x: Math.round(__mothlight.world.state.player.x), y: Math.round(__mothlight.world.state.player.y)})`);
  console.log('player after moving right 1s:', moved);
  await targetWs.send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyS', key: 's' });
  await sleep(700);
  await targetWs.send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyS', key: 's' });
  console.log('player after moving down:', await evalJs(`JSON.stringify({x: Math.round(__mothlight.world.state.player.x), y: Math.round(__mothlight.world.state.player.y)})`));
  // Click to toss a pebble: pebblesLeft must drop by one.
  console.log('pebbles before click:', await evalJs(`__mothlight.world.state.pebblesLeft`));
  await targetWs.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 300, button: 'left', clickCount: 1 });
  await targetWs.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 300, button: 'left', clickCount: 1 });
  await sleep(600);
  console.log('pebbles after click:', await evalJs(`__mothlight.world.state.pebblesLeft`));
  console.log('guards after pebble:', await evalJs(`JSON.stringify(__mothlight.world.state.guards.map(g => g.state))`));
  await shot('test-play.jpg');
  // Pause with P.
  await key('keyDown', 'KeyP', 'p');
  await key('keyUp', 'KeyP', 'p');
  await sleep(300);
  console.log('after P status:', await evalJs(`document.getElementById('status').textContent`));
  await shot('test-paused.jpg');

  // 2. Staged screenshot scenes (the real submission screenshots).
  for (const s of SHOTS) {
    await navigate(`http://127.0.0.1:${PORT}/${s.query}`);
    let ready = false;
    for (let i = 0; i < 40; i += 1) {
      ready = await evalJs(`window.__shotReady === true`);
      if (ready) break;
      await sleep(250);
    }
    console.log(s.query, 'shotReady:', ready);
    await sleep(200);
    await shot(s.name);
  }

  // 3. Console errors collected across all pages.
  const errors = targetWs.events.filter((e) => (e.method === 'Runtime.exceptionThrown') || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
  console.log('console errors/exceptions:', errors.length);
  for (const e of errors.slice(0, 5)) console.log(JSON.stringify(e.params).slice(0, 400));

  chrome.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('PLAYTEST FAILED:', err.message);
  chrome.kill();
  process.exit(1);
});
