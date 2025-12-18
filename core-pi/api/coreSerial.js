// Keeps sugar index state in database and broadcasts changes via Pusher.
// Handles server-side random fluctuations every minute.

const Pusher = require('pusher');
const sfx = require('./sfx');
const { getSugarState: dbGetSugarState, updateSugarState: dbUpdateSugarState, recordCaughtItem, recordSugarHistory } = require('./db');

const pusher = new Pusher({
  appId: process.env.SOKETI_APP_ID,
  key: process.env.SOKETI_APP_KEY,
  secret: process.env.SOKETI_APP_SECRET,
  host: 'sweetpi-soketi',
  port: 6001,
  useTLS: false,
});

/**
 * Safe trigger:
 * - Never crash the server if Soketi is down or restarting.
 */
function safeTrigger(channel, event, data) {
  try {
    const maybePromise = pusher.trigger(channel, event, data);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => {
        console.error('[CORE SERIAL] Pusher trigger failed:', err?.message || err);
      });
    }
  } catch (err) {
    console.error('[CORE SERIAL] Pusher trigger threw:', err?.message || err);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Broadcast current sugar state to all clients
 */
function broadcastSugarState() {
  const state = dbGetSugarState();
  const payload = {
    index: state.index,
    effect: state.effect,
    lastLabel: state.lastLabel,
    updatedAt: state.updatedAt,
  };
  safeTrigger('public-chat', 'sugar-update', payload);
}

/**
 * Apply an incoming value from the camera Pi.
 * @param {Object} param0
 * @param {number|string} param0.value  - numeric delta to apply to the index
 * @param {string} [param0.label]       - item label ("Cola", "Insuline", ...)
 */
function applyCoreValue({ value, label }) {
  const effect = Number(value);
  if (Number.isNaN(effect)) {
    console.warn('[CORE SERIAL] Ignoring non-numeric value:', value);
    return;
  }

  // Get current state
  const currentState = dbGetSugarState();
  const beforeValue = currentState.index;
  
  // Calculate new value
  const afterValue = clamp(beforeValue + effect, 50, 250);
  
  // Update database
  dbUpdateSugarState({
    index: afterValue,
    effect: effect,
    lastLabel: label || null,
  });
  
  // Record caught item in database
  recordCaughtItem({
    label: label || 'unknown',
    beforeValue: beforeValue,
    afterValue: afterValue,
    effect: effect,
  });
  
  // Record in history (caught item)
  recordSugarHistory({
    index: afterValue,
    effect: effect,
    label: label || null,
    isCaughtItem: true,
  });

  // Broadcast update
  sfx.playScanned();
  broadcastSugarState();
}

/**
 * Returns the current sugar state for the /api/sugar endpoint.
 */
function getSugarState() {
  return dbGetSugarState();
}

/**
 * Apply a random fluctuation (1-5 up or down)
 * Only fluctuates when sugar level is in safe range (70-180)
 */
function applyRandomFluctuation() {
  const state = dbGetSugarState();
  const currentIndex = state.index;
  
  // Only fluctuate if in safe range (70-180)
  if (currentIndex > 180 || currentIndex < 70) {
    return; // Don't fluctuate when too high or too low
  }
  
  // Generate random fluctuation: 1-5, randomly up or down
  const fluctuation = Math.floor(Math.random() * 5) + 1; // 1-5
  const direction = Math.random() < 0.5 ? -1 : 1; // Random up or down
  const change = fluctuation * direction;
  
  // Calculate new value
  const newIndex = clamp(currentIndex + change, 50, 250);
  
  // Update database (no label, this is a random fluctuation)
  dbUpdateSugarState({
    index: newIndex,
    effect: null, // Random fluctuations don't have an effect
    lastLabel: null, // Keep the last caught item label
  });
  
  // Record in history (fluctuation, not a caught item)
  recordSugarHistory({
    index: newIndex,
    effect: change, // Store the change amount
    label: null,
    isCaughtItem: false,
  });
  
  // Broadcast update (silently, no sound effect)
  broadcastSugarState();
}

// Start random fluctuation interval (every 1 minute)
let fluctuationInterval = null;

function startFluctuationInterval() {
  if (fluctuationInterval) {
    clearInterval(fluctuationInterval);
  }
  
  // Apply first fluctuation after 1 minute, then every minute
  fluctuationInterval = setInterval(() => {
    applyRandomFluctuation();
  }, 60000); // 60 seconds = 1 minute
  
  console.log('[CORE SERIAL] Random fluctuation interval started (every 1 minute)');
}

function stopFluctuationInterval() {
  if (fluctuationInterval) {
    clearInterval(fluctuationInterval);
    fluctuationInterval = null;
    console.log('[CORE SERIAL] Random fluctuation interval stopped');
  }
}

// Start the interval when module loads
startFluctuationInterval();

// Broadcast initial state on startup (after a short delay to ensure Pusher is ready)
setTimeout(() => {
  broadcastSugarState();
  console.log('[CORE SERIAL] Initial sugar state broadcast');
}, 1000);

module.exports = {
  applyCoreValue,
  getSugarState,
  startFluctuationInterval,
  stopFluctuationInterval,
};
