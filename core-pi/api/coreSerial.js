// Keeps in-memory sugar index state and broadcasts changes via Pusher.

const Pusher = require('pusher');
const sfx = require('./sfx');

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

/**
 * In-memory sugar state.
 * - index: visual sugar index (50–250)
 * - effect: last numeric delta
 * - lastLabel: last classified item name (e.g. "Cola")
 * - updatedAt: ISO timestamp
 */
let sugarIndex = 100;
let lastEffect = null;
let lastLabel = null;
let updatedAt = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

  sugarIndex = clamp(sugarIndex + effect, 50, 250);
  lastEffect = effect;
  lastLabel = label || null;
  updatedAt = new Date().toISOString();

  const payload = {
    index: sugarIndex,
    effect: lastEffect,
    lastLabel,
    updatedAt,
  };

  sfx.playScanned();
  safeTrigger('public-chat', 'sugar-update', payload);
}

/**
 * Returns the current sugar state for the /api/sugar endpoint.
 */
function getSugarState() {
  return {
    index: sugarIndex,
    effect: lastEffect,
    lastLabel,
    updatedAt,
  };
}

module.exports = {
  applyCoreValue,
  getSugarState,
};
