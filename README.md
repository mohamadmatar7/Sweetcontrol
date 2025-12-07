## SweetControl

SweetControl is a two-container setup:

- **Core (API)** Express.js service that talks to the hardware, manages the game logic, queue, payments, and realtime events.
- **Web (Frontend)** Next.js app that shows the arcade UI, queue, and live controls for the player.

Everything is orchestrated via **Docker Compose**, with a lightweight **SQLite** database for persistence.

---

## Architecture Overview

### 1. Core (`api/`)

Runs on **Express.js** and exposes REST endpoints used by the frontend and by Mollie webhooks.

Main responsibilities:

- Payment flow (Mollie):
  - Create donation/payment intents
  - Handle Mollie webhook to confirm payments
  - Convert EUR → credits
- Game engine:
  - Queue management (`waiting`, `active`, `done`)
  - Credit timing (per-credit timers, first-move timeout, grab timers)
  - Talks to the claw machine via `gpio`
  - Realtime events via Pusher/Soketi (`queue-update`, `player-start`, `credit-start`, `player-timeout`, `player-end`)
- Core “sugar” state:
  - `coreSerial` module for receiving values from another device and broadcasting sugar-index state
- Admin API:
  - Management endpoints under `/api/admin` (protected by admin token)

Key files:

- `core/game.js`  
  Main game loop + state:
  - `maybeStartNext()` – activates next waiting player
  - `handlePaidDonation()` – called when Mollie confirms a payment
  - `startCreditTimerIfNeeded()` / `handleGrabIfAllowed()` – credit timing and grab logic
  - `broadcastQueue()` – sends queue snapshots to the frontend via Pusher
- `core/app.js`  
  Express app:
  - `/api/donations/create` – create Mollie payment
  - `/api/mollie/webhook` – Mollie webhook
  - `/api/play/claim` – get session token after payment
  - `/api/queue` – public queue endpoint
  - `/api/control/*` – control endpoints (press/release/grab)
  - `/api/me` – get current player by token
  - `/api/sugar` and `/api/core-value` – sugar-state integration
- `core/db.js`  
  SQLite access helpers for:
  - intents
  - donations
  - queue list
  - status updates

### 2. Web (`web/` or `app/`)

Built with **Next.js** (App Router) and Tailwind CSS.

Main responsibilities:

- Payment + claim flow:
  - Let the user enter name/amount
  - Open Mollie checkout
  - After redirect, call `/api/play/claim` and get a session `token`
- Live arcade screen:
  - Shows queue and your position
  - Shows controls when it’s your turn (`active` player)
  - Uses Pusher JS client (Soketi) to subscribe to `public-chat` channel
- Visual design:
  - “Sweet Control” arcade cabinet style
  - Responsive layout for projector / tablet / laptop

Key parts:

- `app/play` / `app/arcade` page:
  - Handles token from localStorage
  - Polls `/api/queue` and `/api/me`
  - Subscribes to Pusher events to stay in sync in realtime
- `components/Controls.js`:
  - Direction buttons (hold while pressed)
  - GRAB button (once per credit)
  - Sends requests to `/api/control/press`, `/api/control/release`, `/api/control/grab`
  - Has safety logic for iOS / visibility changes (releases stuck holds)

---

## Tech Stack

- **Core**
  - Node.js
  - Express.js
  - SQLite (via `better-sqlite3`)
  - Pusher-compatible server (Soketi)
  - Mollie Payments
  - NodeMailer
- **Web**
  - Next.js (App Router)
  - React
  - Tailwind CSS
  - Pusher JS

- **Infra**
  - Docker
  - Docker Compose

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/gdm-experttrack-imd/zie-mij-ne-keer-squad-helios.git
cd zie....
```

---

### 2. Core Environment (`.env`)

Inside the `root/` directory, create a `.env` file:

```bash
cp .env 
```

Minimal example for `.env`:

```env
# CLOUDFLARE
CLOUDFLARE_TUNNEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Public URLs
PUBLIC_WEB_URL=https://sweetcontrol.be
PUBLIC_API_URL=https://sweet-api.sweetcontrol.be

# Mollie
MOLLIE_API_KEY=live_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Pusher/Soketi (server-side)
NEXT_PUBLIC_SOKETI_KEY=xxxxxxxxxxx
NEXT_PUBLIC_SOKETI_WS_HOST=sweet-ws.sweetcontrol.be
NEXT_PUBLIC_SOKETI_FORCE_TLS=true
NEXT_PUBLIC_SOKETI_WS_PORT=443

# Admin
ADMIN_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Combell SMTP settings (Nodemailer)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=info@sweetcontrol.be
SMTP_PASS=xxxxxxxxxxx
SMTP_FROM="SweetControl <info@sweetcontrol.be>"
NODEMAILER_DEBUG=true

```

The SQLite database lives under:

```text
api/data/sweet.db
api/data/sweet.db-shm
api/data/sweet.db-wal
```

It will be created automatically on first run if missing.

---

### 3. Web Environment (`web/.env.local`)

Inside the web/frontend directory create `.env.local`:

```bash
cd ../web  
cp .env.local 
```

Minimal example for `web/.env.local`:

```env
# Base URL for the core API
NEXT_PUBLIC_API_BASE_URL=https://sweet-api.sweetcontrol.be

# Soketi / Pusher (client-side)
NEXT_PUBLIC_SOKETI_KEY=
NEXT_PUBLIC_SOKETI_WS_HOST=
NEXT_PUBLIC_SOKETI_WS_PORT=443
NEXT_PUBLIC_SOKETI_FORCE_TLS=true
```

---

## Running with Docker

From the project root (where `docker-compose.yml` lives):

### 1. Build the images

```bash
docker compose build
```

### 2. Start all services

```bash
docker compose up -d
```

This should start:

- **Core container** (API + game engine)
- **Web container** (Next.js frontend)
- **Claudflare**    (Tunnel)
- **Soketi**        (WebSocket)

You can then open the web app in your browser at the URL configured in your `docker-compose.yml` (often `http://localhost:3000` when running locally) or `https://sweet-web.sweetcontrol.be` by Claudflare

To see logs:

```bash
docker compose logs -f
```

To stop everything:

```bash
docker compose down
```

---

## Database

The project uses **SQLite** as the main data store for:

- Donations / payment intents
- Credits
- Queue
- Session tokens
- Names
- Emails 

Location (inside the project):

```text
api/data/sweet.db
```

If you want to reset everything to a clean state (⚠ **this will delete all data**):

```bash
rm api/data/sweet.db*
```

Then restart the core container. The database will be recreated automatically.

---

## Game Flow

1. User opens the web app and starts a donation:
   - Web calls `POST /api/donations/create` on the core.
   - Core creates an intent in SQLite and a Mollie payment.
   - Web redirects user to Mollie checkout.

2. Mollie confirms payment:
   - Mollie sends a webhook to `POST /api/mollie/webhook`.
   - Core verifies the payment, calculates credits, and creates/updates a donation.
   - Core calls `handlePaidDonation()` → `maybeStartNext()` to place the player into the queue and start playing if machine is free.

3. User returns to `/play?intent=...`:
   - Web calls `POST /api/play/claim` with `intentId`.
   - Core returns a session `token` and the remaining credits.
   - Web stores `sweet_token` in `localStorage`.

4. Arcade page (`/arcade`):
   - Polls `/api/queue` and `/api/me` for snapshots.
   - Subscribes to Soketi/Pusher channel for realtime `queue-update`, `player-start`, `credit-start`, `player-timeout`, `player-end` events.
   - When it’s the player’s turn (`status=active` and `activeDonationId` matches), the UI shows the **Controls** component.

5. Controls:
   - Direction buttons call:
     - `POST /api/control/press` → gpio.hold(direction)
     - `POST /api/control/release` → gpio.release(direction)
   - GRAB button calls:
     - `POST /api/control/grab` → `handleGrabIfAllowed()` in `game.js`
   - Server-side timers handle:
     - First movement timeout
     - Credit duration
     - Grab window

---

## Troubleshooting

- **Stuck in queue, always “waiting” and never sees controls**  
  - Restart the core container to clear any in-memory “ghost” active player:
    ```bash
    docker compose restart sweetpi-core
    ```

- **Weird old data / testing history causing issues**
  - You can reset SQLite:
    ```bash
    rm api/data/sweet.db*
    docker compose restart sweetpi-core
    ```

- **Front-end says session ended when multiple tabs are open**
  - Only one session per browser is expected in real use.
  - We added logic so each tab only clears `sweet_token` if it still matches its own token.

---