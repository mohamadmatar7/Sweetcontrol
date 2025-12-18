const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'data', 'sweet.db');
const db = new Database(dbPath);

// Better durability
db.exec(`PRAGMA journal_mode = WAL;`);

/**
 * Base table definition
 * - For fresh installs this creates the full schema
 * - For existing DBs this is ignored and migration below fixes missing cols/indexes
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent_id TEXT,
    mollie_payment_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    amount_requested_eur REAL NOT NULL DEFAULT 0,
    amount_eur REAL,                    -- set when paid
    credits_total INTEGER NOT NULL DEFAULT 0,
    credits_used INTEGER NOT NULL DEFAULT 0,
    credits_pulsed INTEGER NOT NULL DEFAULT 0, -- credits pressed on machine once
    status TEXT NOT NULL DEFAULT 'created',    -- created | waiting | active | done
    session_token TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

/**
 * Simple migration for older DBs
 * - SQLite does NOT allow "ADD COLUMN ... UNIQUE", so we:
 *   1) Add columns without UNIQUE
 *   2) Create UNIQUE INDEXes separately
 */
function ensureColumn(name, typeSql) {
  const cols = db.prepare(`PRAGMA table_info(donations)`).all().map(c => c.name);
  if (!cols.includes(name)) {
    db.exec(`ALTER TABLE donations ADD COLUMN ${name} ${typeSql};`);
  }
}

// Add missing columns (if any) WITHOUT UNIQUE
ensureColumn('intent_id', 'TEXT');
ensureColumn('mollie_payment_id', 'TEXT');
ensureColumn('amount_requested_eur', 'REAL NOT NULL DEFAULT 0');
ensureColumn('amount_eur', 'REAL');
ensureColumn('credits_total', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('credits_used', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('credits_pulsed', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('status', "TEXT NOT NULL DEFAULT 'created'");
ensureColumn('session_token', 'TEXT');
ensureColumn('created_at', "TEXT NOT NULL DEFAULT ''");
ensureColumn('updated_at', "TEXT NOT NULL DEFAULT ''");

// Enforce uniqueness with indexes (safe if already exist)
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_intent_id ON donations(intent_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_mollie_payment_id ON donations(mollie_payment_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_session_token ON donations(session_token);
`);

function nowIso() {
  return new Date().toISOString();
}

function newIntentId() {
  return crypto.randomBytes(16).toString('hex');
}

function newSessionToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create donation intent BEFORE Mollie payment
 */
function createIntent({ name, email, amountRequestedEur }) {
  const intentId = newIntentId();
  const sessionToken = newSessionToken();

  db.prepare(`
    INSERT INTO donations
      (intent_id, name, email, amount_requested_eur, status, session_token, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, 'created', ?, ?, ?)
  `).run(
    intentId,
    name,
    email || null,
    amountRequestedEur,
    sessionToken,
    nowIso(),
    nowIso()
  );

  return { intentId, sessionToken };
}

function attachPaymentToIntent(intentId, molliePaymentId) {
  db.prepare(`
    UPDATE donations
    SET mollie_payment_id = ?, updated_at = ?
    WHERE intent_id = ?
  `).run(molliePaymentId, nowIso(), intentId);
}

function getIntent(intentId) {
  return db.prepare(`SELECT * FROM donations WHERE intent_id = ?`).get(intentId);
}

function getDonationById(id) {
  return db.prepare(`SELECT * FROM donations WHERE id = ?`).get(id);
}

function getDonationByPaymentId(molliePaymentId) {
  return db.prepare(`SELECT * FROM donations WHERE mollie_payment_id = ?`).get(molliePaymentId);
}

function markIntentPaid({ intentId, molliePaymentId, amountEur, creditsTotal }) {
  const now = nowIso();
  db.prepare(`
    UPDATE donations SET
      mollie_payment_id = COALESCE(mollie_payment_id, ?),
      amount_eur = ?,
      credits_total = ?,
      status = 'waiting',
      created_at = ?,       -- payment time defines queue order
      updated_at = ?
    WHERE intent_id = ?
  `).run(molliePaymentId, amountEur, creditsTotal, now, now, intentId);
}

function setDonationStatus(id, status) {
  db.prepare(`
    UPDATE donations
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, nowIso(), id);
}

/**
 * Move player to the end of queue (used when they don't move in time).
 * We keep status waiting but refresh created_at so they go last.
 */
function requeueToEnd(id) {
  const now = nowIso();
  db.prepare(`
    UPDATE donations
    SET status = 'waiting',
        created_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, now, id);
}

/**
 * Mark that machine credits were already pulsed for this donation.
 * This prevents double-crediting if player gets re-queued and becomes active again.
 */
function markCreditsPulsed(id) {
  db.prepare(`
    UPDATE donations
    SET credits_pulsed = 1, updated_at = ?
    WHERE id = ?
  `).run(nowIso(), id);
}

function useOneCredit(id) {
  db.prepare(`
    UPDATE donations
    SET credits_used =
      CASE
        WHEN credits_used + 1 > credits_total THEN credits_total
        ELSE credits_used + 1
      END,
      updated_at = ?
    WHERE id = ?
  `).run(nowIso(), id);
}


function getDonationByToken(token) {
  return db.prepare(`SELECT * FROM donations WHERE session_token = ?`).get(token);
}

function listQueue() {
  return db.prepare(`
    SELECT id, name, credits_total, credits_used, credits_pulsed, status, created_at
    FROM donations
    WHERE status IN ('waiting','active')
    ORDER BY created_at ASC
  `).all();
}

/**
 * Admin: full list for dashboard.
 */
function listAllDonations() {
  return db.prepare(`
    SELECT *
    FROM donations
    ORDER BY created_at DESC
  `).all();
}

/**
 * Admin: add/subtract credits safely.
 * - credits_total is clamped to >= credits_used and >= 0.
 */
function adjustCredits(id, delta) {
  const row = getDonationById(id);
  if (!row) return null;

  const nextTotal = Math.max(0, (row.credits_total || 0) + delta);
  const clampedTotal = Math.max(nextTotal, row.credits_used || 0);

  db.prepare(`
    UPDATE donations
    SET credits_total = ?, updated_at = ?
    WHERE id = ?
  `).run(clampedTotal, nowIso(), id);

  return getDonationById(id);
}

/**
 * Admin: set total credits safely.
 */
function setCreditsTotal(id, creditsTotal) {
  const row = getDonationById(id);
  if (!row) return null;

  const nextTotal = Math.max(0, creditsTotal);
  const clampedTotal = Math.max(nextTotal, row.credits_used || 0);

  db.prepare(`
    UPDATE donations
    SET credits_total = ?, updated_at = ?
    WHERE id = ?
  `).run(clampedTotal, nowIso(), id);

  return getDonationById(id);
}

/**
 * Admin: set used credits safely.
 */
function setCreditsUsed(id, creditsUsed) {
  const row = getDonationById(id);
  if (!row) return null;

  const nextUsed = Math.max(0, Math.min(creditsUsed, row.credits_total || 0));

  db.prepare(`
    UPDATE donations
    SET credits_used = ?, updated_at = ?
    WHERE id = ?
  `).run(nextUsed, nowIso(), id);

  return getDonationById(id);
}

/**
 * Admin: delete a single donation row.
 */
function deleteDonationById(id) {
  db.prepare(`DELETE FROM donations WHERE id = ?`).run(id);
}

/**
 * Admin: delete all donations.
 */
function deleteAllDonations() {
  db.prepare(`DELETE FROM donations`).run();
}

/**
 * Stats: total paid donations from Mollie only
 * ✅ Counts ONLY from 16/12/2025 8:30 AM (local time)
 */
function getMolliePaidTotals() {
  // 16/12/2025 at 8:30 AM (local time)
  // Note: months are 0-indexed in JavaScript (11 = December)
  const cutoff = new Date(2025, 11, 16, 8, 30, 0, 0).toISOString();

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(amount_eur), 0) AS totalEur,
      COALESCE(COUNT(*), 0) AS count
    FROM donations
    WHERE amount_eur IS NOT NULL
      AND mollie_payment_id IS NOT NULL
      AND mollie_payment_id LIKE 'tr_%'
      AND created_at >= ?
  `).get(cutoff);

  return {
    totalEur: Number(row.totalEur || 0),
    count: Number(row.count || 0),
  };
}

/**
 * Admin stats: comprehensive metrics
 */
function getAdminStats() {
  // All time donated
  const totalDonated = db.prepare(`
    SELECT COALESCE(SUM(amount_eur), 0) AS total
    FROM donations
    WHERE amount_eur IS NOT NULL
  `).get();

  // All time plays (credits used)
  const totalPlays = db.prepare(`
    SELECT COALESCE(SUM(credits_used), 0) AS total
    FROM donations
  `).get();

  // All time players (unique paid donations)
  const totalPlayers = db.prepare(`
    SELECT COUNT(*) AS total
    FROM donations
    WHERE amount_eur IS NOT NULL
  `).get();

  // Games over time (by date) - only completed donations with payment
  const gamesOverTime = db.prepare(`
    SELECT 
      DATE(created_at) AS date,
      COUNT(*) AS donations,
      SUM(credits_used) AS plays
    FROM donations
    WHERE status = 'done' 
      AND amount_eur IS NOT NULL
      AND amount_eur > 0
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all();

  return {
    totalDonated: Number(totalDonated.total || 0),
    totalPlays: Number(totalPlays.total || 0),
    totalPlayers: Number(totalPlayers.total || 0),
    gamesOverTime: gamesOverTime.map(row => ({
      date: row.date,
      donations: Number(row.donations || 0),
      plays: Number(row.plays || 0),
    })),
  };
}

// ============================================================================
// SUGAR STATE & CAUGHT ITEMS
// ============================================================================

/**
 * Create tables for sugar state and caught items tracking
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS sugar_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    index_value INTEGER NOT NULL DEFAULT 100,
    last_effect INTEGER,
    last_label TEXT,
    updated_at TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS caught_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    before_value INTEGER NOT NULL,
    after_value INTEGER NOT NULL,
    effect INTEGER NOT NULL,
    caught_at TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS sugar_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    index_value INTEGER NOT NULL,
    effect INTEGER,
    label TEXT,
    is_caught_item INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_caught_items_caught_at ON caught_items(caught_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sugar_history_created_at ON sugar_history(created_at DESC);
`);

/**
 * Initialize sugar state if it doesn't exist
 */
function initSugarState() {
  const existing = db.prepare(`SELECT * FROM sugar_state WHERE id = 1`).get();
  if (!existing) {
    db.prepare(`
      INSERT INTO sugar_state (id, index_value, updated_at)
      VALUES (1, 100, ?)
    `).run(nowIso());
  }
}

// Initialize on module load
initSugarState();

/**
 * Get current sugar state from database
 */
function getSugarState() {
  const row = db.prepare(`SELECT * FROM sugar_state WHERE id = 1`).get();
  if (!row) {
    initSugarState();
    return getSugarState();
  }
  return {
    index: row.index_value,
    effect: row.last_effect,
    lastLabel: row.last_label,
    updatedAt: row.updated_at,
  };
}

/**
 * Update sugar state in database
 */
function updateSugarState({ index, effect, lastLabel }) {
  const now = nowIso();
  db.prepare(`
    UPDATE sugar_state
    SET index_value = ?,
        last_effect = ?,
        last_label = ?,
        updated_at = ?
    WHERE id = 1
  `).run(
    index,
    effect !== undefined ? effect : null,
    lastLabel || null,
    now
  );
}

/**
 * Record a caught item
 */
function recordCaughtItem({ label, beforeValue, afterValue, effect }) {
  db.prepare(`
    INSERT INTO caught_items (label, before_value, after_value, effect, caught_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(label || 'unknown', beforeValue, afterValue, effect, nowIso());
}

/**
 * Get caught items history (for admin/stats)
 */
function getCaughtItemsHistory(limit = 100) {
  return db.prepare(`
    SELECT * FROM caught_items
    ORDER BY caught_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Record a sugar state change in history (both caught items and fluctuations)
 */
function recordSugarHistory({ index, effect, label, isCaughtItem }) {
  db.prepare(`
    INSERT INTO sugar_history (index_value, effect, label, is_caught_item, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    index,
    effect !== undefined ? effect : null,
    label || null,
    isCaughtItem ? 1 : 0,
    nowIso()
  );
}

/**
 * Get sugar history (last N data points)
 */
function getSugarHistory(limit = 60) {
  return db.prepare(`
    SELECT 
      index_value AS index,
      effect,
      label,
      is_caught_item AS isCaughtItem,
      created_at AS t
    FROM sugar_history
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit).reverse(); // Reverse to get chronological order (oldest first)
}



module.exports = {
  db,
  createIntent,
  attachPaymentToIntent,
  getIntent,
  getDonationById,
  getDonationByPaymentId,
  markIntentPaid,
  setDonationStatus,
  requeueToEnd,
  markCreditsPulsed,
  useOneCredit,
  getDonationByToken,
  listQueue,

  // Admin exports
  listAllDonations,
  adjustCredits,
  setCreditsTotal,
  setCreditsUsed,
  deleteDonationById,
  deleteAllDonations,

  // Stats
  getMolliePaidTotals,
  getAdminStats,

  // Sugar state exports
  getSugarState,
  updateSugarState,
  recordCaughtItem,
  getCaughtItemsHistory,
  recordSugarHistory,
  getSugarHistory,
};
