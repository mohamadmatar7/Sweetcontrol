const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Audio player binary (can be overridden via env)
const PLAYER_BIN = process.env.SFX_PLAYER || 'mpg123';

// Default audio output arguments (tuned for your container setup)
// Example: mpg123 -o alsa -a plughw:2,0 ...
const DEFAULT_PLAYER_ARGS = ['-o', 'alsa', '-a', 'plughw:2,0'];

// Optional override from environment: SFX_ARGS="-o alsa -a plughw:2,0"
const PLAYER_EXTRA_ARGS = process.env.SFX_ARGS
  ? process.env.SFX_ARGS.split(' ')
  : DEFAULT_PLAYER_ARGS;

// Directory where sound files live
const SOUND_DIR = path.join(__dirname, 'sounds');

// Known sound files
const FILES = {
  move: path.join(SOUND_DIR, 'move.mp3'),
  grab: path.join(SOUND_DIR, 'grab.mp3'),
  scanned: path.join(SOUND_DIR, 'scanned.mp3'),
};

const missingLogged = new Set();
const activeDirections = new Set();

let moveLoop = null; // currently running move player process (one-shot)

/**
 * Check that a sound file exists for the given key.
 * Logs a warning only once per missing key.
 */
function ensureFile(key) {
  const file = FILES[key];
  if (!file) return null;

  if (fs.existsSync(file)) {
    return file;
  }

  if (!missingLogged.has(key)) {
    missingLogged.add(key);
    console.warn(`[SFX] Missing sound file: ${file}`);
  }
  return null;
}

/**
 * Spawn the audio player process with proper arguments.
 */
function spawnPlayer(args, label) {
  try {
    // Prepend global audio args (device/driver) before specific args
    const fullArgs = [...PLAYER_EXTRA_ARGS, ...args];

    const child = spawn(PLAYER_BIN, fullArgs, {
      stdio: 'ignore', // no stdout/stderr noise in logs
    });

    child.on('error', (err) => {
      console.error(`[SFX] ${label} failed:`, err?.message || err);
    });

    return child;
  } catch (err) {
    console.error(`[SFX] Could not start ${label}:`, err?.message || err);
    return null;
  }
}

/**
 * Internal helper: play one "move" sound and, when it finishes,
 * restart it if at least one move direction is still active.
 */
function playMoveOnceAndMaybeRepeat(file) {
  if (activeDirections.size === 0) {
    return;
  }

  moveLoop = spawnPlayer(['-q', file], 'move loop');

  if (!moveLoop) {
    return;
  }

  moveLoop.on('exit', () => {
    moveLoop = null;

    // If still moving when the sound ends, start again
    if (activeDirections.size > 0) {
      playMoveOnceAndMaybeRepeat(file);
    }
  });
}

/**
 * Start repeating the move sound (if not already running).
 * The repeat is controlled from Node instead of mpg123 -l 0.
 */
function startMoveLoop() {
  if (moveLoop) return;

  const file = ensureFile('move');
  if (!file) return;

  playMoveOnceAndMaybeRepeat(file);
}

/**
 * Stop the move loop if running.
 */
function stopMoveLoop() {
  if (moveLoop) {
    moveLoop.kill('SIGTERM');
    moveLoop = null;
  }
}

/**
 * Called when a movement direction is pressed.
 * Starts loop if at least one direction is active.
 */
function onMovePress(direction) {
  if (!direction) return;
  activeDirections.add(direction);
  startMoveLoop();
}

/**
 * Called when a movement direction is released.
 * Stops loop when no directions are active.
 */
function onMoveRelease(direction) {
  if (!direction) return;
  activeDirections.delete(direction);
  if (activeDirections.size === 0) {
    stopMoveLoop();
  }
}

/**
 * Stop all movement and loop.
 */
function stopAllMoves() {
  activeDirections.clear();
  stopMoveLoop();
}

/**
 * Play a single sound once (non-looping).
 */
function playOnce(key) {
  const file = ensureFile(key);
  if (!file) return;

  // -q: quiet mode (no console output)
  spawnPlayer(['-q', file], `${key} sfx`);
}

/**
 * Play the "grab" sound once.
 * Stops move loop first.
 */
function playGrab() {
  stopAllMoves();
  playOnce('grab');
}

/**
 * Play the "scanned" sound once.
 */
function playScanned() {
  playOnce('scanned');
}

/**
 * Cleanup for process shutdown.
 */
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
