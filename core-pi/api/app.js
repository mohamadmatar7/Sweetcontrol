const express = require('express');
const cors = require('cors');
const { createMollieClient } = require('@mollie/api-client');
const gpio = require('./gpio');
const game = require('./game');
const createAdminRouter = require('./admin');
const coreSerial = require('./coreSerial'); // Core sugar state (index/effect/label)
const sfx = require('./sfx');

const {
    createIntent,
    attachPaymentToIntent,
    getIntent,
    getDonationByPaymentId,
    getDonationByToken,
    listQueue,
    getMolliePaidTotals,
} = require('./db');

const app = express();

// Disable ETag to avoid any 304/stale behavior on strange proxies/browsers
// app.set('etag', false);

/**
 * CORS (production-safe)
 * - Allow only your web domain + localhost for dev
 * - Always answer preflight OPTIONS correctly
 */
const allowedOrigins = [
    'https://sweet-web.sweetcontrol.be',
    'https://sweetcontrol.be',
    'https://www.sweetcontrol.be',
    'http://localhost:3000',
];
const corsOptions = {
    origin: (origin, cb) => {
        // Allow non-browser requests (curl, Mollie webhook, camera Pi, etc.)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
    credentials: false,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight support

// Mollie webhook uses x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

/**
 * Hold safety watchdog:
 * - On weak networks or iOS Safari, "release" packets can be dropped.
 * - If a release does NOT arrive within MAX_HOLD_MS, auto-release server-side.
 * - This prevents stuck claw movement.
 */
const MAX_HOLD_MS = 5000; 
const holdTimers = new Map();

/**
* Variable to enable free mode (no payments)
*/
const FREE_MODE = String(process.env.FREE_MODE || "false").toLowerCase() === "true";


// LiveKit streaming (optional)
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_ROOM = process.env.LIVEKIT_ROOM || "sweet-control";
const LIVEKIT_ENABLED = Boolean(
    LIVEKIT_URL &&
    LIVEKIT_API_KEY &&
    LIVEKIT_API_SECRET
);

function armAutoRelease(direction) {
    if (holdTimers.has(direction)) {
        clearTimeout(holdTimers.get(direction));
    }

    const t = setTimeout(() => {
        gpio.release(direction);
        sfx.onMoveRelease(direction);
        holdTimers.delete(direction);
    }, MAX_HOLD_MS);

    holdTimers.set(direction, t);
}

/**
 * Create a Mollie payment (Intent-first)
 * Body: { name, amountEuros, email? }
 */
// app.post('/api/donations/create', async (req, res) => {
//     try {
//         const { name, amountEuros, email } = req.body;

//         if (!name || !amountEuros) {
//             return res.status(400).json({ error: 'name and amountEuros are required' });
//         }

//         const amountRequestedEur = Number(amountEuros);
//         if (Number.isNaN(amountRequestedEur) || amountRequestedEur <= 0) {
//             return res.status(400).json({ error: 'amountEuros must be a positive number' });
//         }

//         // 1) Create intent first (saved in SQLite)
//         const { intentId } = createIntent({
//             name: name.trim(),
//             email: email?.trim() || null,
//             amountRequestedEur,
//         });

//         // 2) Create Mollie payment tied to intentId
//         const payment = await mollie.payments.create({
//             amount: { currency: 'EUR', value: amountRequestedEur.toFixed(2) },
//             description: `SweetControl donation by ${name}`,
//             redirectUrl: `${process.env.PUBLIC_WEB_URL}/play?intent=${intentId}`,
//             webhookUrl: `${process.env.PUBLIC_API_URL}/api/mollie/webhook`,
//             metadata: { intentId },
//         });

//         // 3) Attach Mollie payment id to intent
//         attachPaymentToIntent(intentId, payment.id);

//         return res.json({
//             checkoutUrl: payment.getCheckoutUrl(),
//             intentId,
//         });
//     } catch (err) {
//         console.error('Create payment error:', err);
//         return res.status(500).json({ error: 'payment_create_failed' });
//     }
// });
app.post('/api/donations/create', async (req, res) => {
  try {
    const { name, amountEuros, email } = req.body;

    if (!name || !amountEuros) {
      return res.status(400).json({ error: 'name and amountEuros are required' });
    }

    const amountRequestedEur = Number(amountEuros);
    if (Number.isNaN(amountRequestedEur) || amountRequestedEur <= 0) {
      return res.status(400).json({ error: 'amountEuros must be a positive number' });
    }

    // 1) Create intent first (saved in SQLite)
    const { intentId } = createIntent({
      name: name.trim(),
      email: email?.trim() || null,
      amountRequestedEur,
    });

    // ✅ FREE MODE: skip Mollie and treat as paid immediately
    if (FREE_MODE) {
      const fakePaymentId = `free_${intentId}`; // unique per intent
      attachPaymentToIntent(intentId, fakePaymentId);

      // Mark as paid + credits + enqueue, exactly like Mollie paid
      game.handlePaidDonation({
        intentId,
        molliePaymentId: fakePaymentId,
        amountEur: amountRequestedEur,
      });

      return res.json({
        checkoutUrl: `${process.env.PUBLIC_WEB_URL}/play?intent=${intentId}`,
        intentId,
        freeMode: true,
      });
    }

    // 2) Create Mollie payment tied to intentId (normal mode)
    const payment = await mollie.payments.create({
      amount: { currency: 'EUR', value: amountRequestedEur.toFixed(2) },
      description: `SweetControl donation by ${name}`,
      redirectUrl: `${process.env.PUBLIC_WEB_URL}/play?intent=${intentId}`,
      webhookUrl: `${process.env.PUBLIC_API_URL}/api/mollie/webhook`,
      metadata: { intentId },
      locale: 'nl_BE', // Dutch (Flemish) for Belgium
    });

    // 3) Attach Mollie payment id to intent
    attachPaymentToIntent(intentId, payment.id);

    return res.json({
      checkoutUrl: payment.getCheckoutUrl(),
      intentId,
    });
  } catch (err) {
    console.error('Create payment error:', err);
    return res.status(500).json({ error: 'payment_create_failed' });
  }
});





/**
 * Mollie webhook (source of truth)
 * Mollie sends: id=tr_xxx
 */
app.post('/api/mollie/webhook', async (req, res) => {
    try {
        const paymentId = req.body.id;
        if (!paymentId) return res.status(400).send('missing id');

        const payment = await mollie.payments.get(paymentId);
        const intentId = payment.metadata?.intentId;

        // If no intentId, ignore safely
        if (!intentId) return res.status(200).send('ok');

        // Idempotency: ignore if already processed
        const existing = getDonationByPaymentId(paymentId);
        if (existing && existing.status !== 'created') {
            return res.status(200).send('ok');
        }

        if (payment.status === 'paid' || payment.status === 'authorized') {
            const amountEur = Number(payment.amount.value);

            game.handlePaidDonation({
                intentId,
                molliePaymentId: paymentId,
                amountEur,
            });

            // realtime mollie-paid stats Read ONLY
            try {
                const stats = getMolliePaidTotals();
                                safeTrigger('public-stats', 'mollie-total-update', stats);
            } catch (e) {
                console.error('Stats broadcast failed:', e);
            }
        }

        return res.status(200).send('ok');
    } catch (err) {
        console.error('Webhook error:', err);
        return res.status(500).send('error');
    }
});

/**
 * Claim a play session using intentId
 * Body: { intentId }
 * - If paid already => returns token
 * - If webhook late => fallback checks Mollie status
 * - If still not paid => pending (202)
 */
app.post('/api/play/claim', async (req, res) => {
    try {
        const { intentId } = req.body;
        if (!intentId) return res.status(400).json({ error: 'intentId required' });

        let donation = getIntent(intentId);
        if (!donation) return res.status(403).json({ error: 'not_found' });

        // Fallback: if webhook didn’t arrive yet, re-check Mollie
        if (donation.status === 'created' && donation.mollie_payment_id) {
            const payment = await mollie.payments.get(donation.mollie_payment_id);
            if (payment.status === 'paid' || payment.status === 'authorized') {
                const amountEur = Number(payment.amount.value);

                game.handlePaidDonation({
                    intentId,
                    molliePaymentId: donation.mollie_payment_id,
                    amountEur,
                });

                donation = getIntent(intentId);
            }
        }

        if (donation.status === 'created') {
            return res.status(202).json({ ok: false, status: 'pending' });
        }

// ✅ Ensure queue is started even if webhook was late or nodemon restarted.
game.maybeStartNext();
game.broadcastQueue();



        // Re-read so status/credits are fresh after maybeStartNext()
        donation = getIntent(intentId);

        const creditsRemaining = donation.credits_total - donation.credits_used;

        return res.json({
            ok: true,
            token: donation.session_token,
            creditsRemaining,
        });

    } catch (err) {
        console.error('Claim error:', err);
        return res.status(500).json({ error: 'claim_failed' });
    }
});

/**
 * Queue state for UI (+ active state for refresh sync)
 */
app.get('/api/queue', (req, res) => {
    // Hard-disable caching at browser/CDN/proxy level
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    // Ensure the queue starts even if a webhook was delayed/missed
    game.maybeStartNext();

    const queue = listQueue().map((d, idx) => ({
        id: d.id,
        name: d.name,
        creditsRemaining: d.credits_total - d.credits_used,
        status: d.status,
        position: idx + 1,
    }));

    const activeState = game.getActiveState();
    return res.json({ queue, ...activeState });
});

/**
 * LiveKit viewer token (read-only subscriber)
 */
app.get('/api/livekit/token', async (req, res) => {
    res.set('Cache-Control', 'no-store');

    if (!LIVEKIT_ENABLED) {
        return res.status(503).json({ ok: false, error: 'livekit_not_configured' });
    }

    try {
        const { AccessToken } = await import('livekit-server-sdk');
        const room = String(req.query.room || LIVEKIT_ROOM);
        const identity = `viewer-${Math.random().toString(36).slice(2)}`;

        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
        at.addGrant({
            room,
            roomJoin: true,
            canPublish: false,
            canSubscribe: true,
        });

        const token = await at.toJwt();
        return res.json({ ok: true, url: LIVEKIT_URL, token, room });
    } catch (err) {
        console.error('LiveKit token error:', err);
        return res.status(500).json({ ok: false, error: 'livekit_token_failed' });
    }
});

/**
 * Control press (hold direction)
 * Body: { token, direction } direction: up|down|left|right
 */
app.post('/api/control/press', (req, res) => {
    const { token, direction } = req.body;
    const donation = getDonationByToken(token);

    if (!game.isActiveTokenDonation(donation)) {
        return res.status(403).json({ error: 'not_active_player' });
    }

    if (!['up', 'down', 'left', 'right'].includes(direction)) {
        return res.status(400).json({ error: 'invalid_direction' });
    }

    // Timer starts on first movement
    game.startCreditTimerIfNeeded();

    // Start holding the direction
    gpio.hold(direction);
    sfx.onMovePress(direction);

    // Safety watchdog: auto-release if release packet is lost
    armAutoRelease(direction);

    return res.json({ ok: true });
});

/**
 * Control release (stop hold)
 * Body: { token, direction }
 */
app.post('/api/control/release', (req, res) => {
    const { token, direction } = req.body;
    const donation = getDonationByToken(token);

    if (!game.isActiveTokenDonation(donation)) {
        return res.status(403).json({ error: 'not_active_player' });
    }

    if (!['up', 'down', 'left', 'right'].includes(direction)) {
        return res.status(400).json({ error: 'invalid_direction' });
    }

    // Cancel watchdog timer for this direction
    if (holdTimers.has(direction)) {
        clearTimeout(holdTimers.get(direction));
        holdTimers.delete(direction);
    }

    gpio.release(direction);
    sfx.onMoveRelease(direction);
    return res.json({ ok: true });
});

/**
 * Grab = one per credit, ends credit early
 * Body: { token }
 */
app.post('/api/control/grab', (req, res) => {
    const { token } = req.body;
    const donation = getDonationByToken(token);

    if (!game.isActiveTokenDonation(donation)) {
        return res.status(403).json({ error: 'not_active_player' });
    }

    const result = game.handleGrabIfAllowed();

    if (!result.ok) {
        return res.status(403).json({ error: result.error });
    }

    sfx.playGrab();

    return res.json({ ok: true });
});

/**
 * Receive core value from the camera Pi over HTTP.
 * Body: { value, label? }
 * - value: numeric delta to apply to the sugar index
 * - label: item name ("Cola", "Insuline", ...)
 *
 * coreSerial.applyCoreValue():
 *   - updates in-memory sugar index
 *   - stores lastEffect + lastLabel
 *   - broadcasts 'sugar-update' via Pusher to the web UI
 */
app.post('/api/core-value', (req, res) => {
    try {
        const { value, label } = req.body || {};

        if (value === undefined || value === null) {
            return res.status(400).json({ ok: false, error: 'value_required' });
        }

        coreSerial.applyCoreValue({ value, label });

        return res.json({ ok: true });
    } catch (err) {
        console.error('Core value error:', err);
        return res.status(500).json({ ok: false, error: 'core_value_failed' });
    }
});

/**
 * Sugar state snapshot for the Graphic page.
 * - Used on initial load (before realtime Pusher updates arrive).
 * - Data is provided by coreSerial (index, effect, lastLabel, updatedAt).
 */
app.get('/api/sugar', (req, res) => {
    // Hard-disable caching so the UI always sees fresh values
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    const state = coreSerial.getSugarState();

    return res.json({
        ok: true,
        ...state,
    });
});

/**
 * Get current player by token
 * Query: ?token=xxx
 */
app.get('/api/me', (req, res) => {
    // Hard-disable caching for player state too
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'token required' });

    const donation = getDonationByToken(token);
    if (!donation) return res.status(404).json({ error: 'not_found' });

    const creditsRemaining = donation.credits_total - donation.credits_used;

    return res.json({
        id: donation.id,
        name: donation.name,
        status: donation.status,
        creditsTotal: donation.credits_total,
        creditsUsed: donation.credits_used,
        creditsRemaining,
    });
});

app.get("/api/config", (req, res) => {
  const FREE_MODE =
    String(process.env.FREE_MODE || "false").toLowerCase() === "true";

  res.set("Cache-Control", "no-store");
  return res.json({ freeMode: FREE_MODE });
});

/**
 * Public stats: Mollie paid donations only
 */
app.get('/api/stats/mollie-total', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');

  const stats = getMolliePaidTotals();
  return res.json({ ok: true, ...stats });
});


app.use('/api/admin', createAdminRouter(game));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
    game.maybeStartNext();
});
