const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PLAYER_BIN = process.env.SFX_PLAYER || 'mpg123';

const SFX_VOLUME = process.env.SFX_VOLUME
  ? parseInt(process.env.SFX_VOLUME, 10)
  : 150;

const DEFAULT_PLAYER_ARGS = ['-o', 'alsa', '-a', 'plughw:2,0'];
const PLAYER_EXTRA_ARGS = process.env.SFX_ARGS
  ? process.env.SFX_ARGS.split(' ')
  : DEFAULT_PLAYER_ARGS;

const SOUND_DIR = path.join(__dirname, 'sounds');

const FILES = {
  move: path.join(SOUND_DIR, 'move.mp3'),
  grab: path.join(SOUND_DIR, 'grab.mp3'),
  scanned: path.join(SOUND_DIR, 'scanned.mp3'),
};

const missingLogged = new Set();
const activeDirections = new Set();

let moveLoop = null;

// Watchdog: if move audio gets stuck, stop it automatically
const MOVE_WATCHDOG_MS = 5000;
let moveWatchdog = null;
let lastMoveKickAt = 0;

function kickMoveWatchdog() {
  lastMoveKickAt = Date.now();

  if (moveWatchdog) return;

  moveWatchdog = setInterval(() => {
    if (moveLoop && Date.now() - lastMoveKickAt > MOVE_WATCHDOG_MS) {
      stopMoveLoop();
    }

    if (!moveLoop) {
      clearInterval(moveWatchdog);
      moveWatchdog = null;
    }
  }, 500);
}

function ensureFile(key) {
  const file = FILES[key];
  if (!file) return null;

  if (fs.existsSync(file)) return file;

  if (!missingLogged.has(key)) {
    missingLogged.add(key);
    console.warn(`[SFX] Missing sound file: ${file}`);
  }
  return null;
}

function spawnPlayer(args, label) {
  try {
    const fullArgs = [...PLAYER_EXTRA_ARGS, '-g', String(SFX_VOLUME), ...args];

    const child = spawn(PLAYER_BIN, fullArgs, { stdio: 'ignore' });

    child.on('error', (err) => {
      console.error(`[SFX] ${label} failed:`, err?.message || err);
    });

    return child;
  } catch (err) {
    console.error(`[SFX] Could not start ${label}:`, err?.message || err);
    return null;
  }
}

function startMoveLoop() {
  if (moveLoop) {
    kickMoveWatchdog();
    return;
  }

  const file = ensureFile('move');
  if (!file) return;

  // Use mpg123 built-in infinite loop
  // --loop -1 is the most reliable for "forever" across builds
  moveLoop = spawnPlayer(['-q', '--loop', '-1', file], 'move loop');

  // Start watchdog once move is running
  kickMoveWatchdog();

  if (moveLoop) {
    moveLoop.on('exit', () => {
      moveLoop = null;
    });
  }
}

function stopMoveLoop() {
  if (!moveLoop) return;

  const proc = moveLoop;
  moveLoop = null;

  try {
    proc.kill('SIGTERM');
  } catch {}

  setTimeout(() => {
    try {
      proc.kill('SIGKILL');
    } catch {}
  }, 200);

  if (moveWatchdog) {
    clearInterval(moveWatchdog);
    moveWatchdog = null;
  }
}

function onMovePress(direction) {
  if (!direction) return;
  activeDirections.add(direction);

  // Kick watchdog on every move press
  kickMoveWatchdog();

  startMoveLoop();
}

function onMoveRelease(direction) {
  if (!direction) return;
  activeDirections.delete(direction);
  if (activeDirections.size === 0) {
    stopMoveLoop();
  }
}

function stopAllMoves() {
  activeDirections.clear();
  stopMoveLoop();
}

function playOnce(key) {
  const file = ensureFile(key);
  if (!file) return;

  spawnPlayer(['-q', file], `${key} sfx`);
}

function playGrab() {
  stopAllMoves();
  playOnce('grab');
}

function playScanned() {
  playOnce('scanned');
}

function cleanup() {
  stopAllMoves();
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', cleanup);

module.exports = {
  onMovePress,
  onMoveRelease,
  stopMoveLoop,
  stopAllMoves,
  playGrab,
  playScanned,
};
