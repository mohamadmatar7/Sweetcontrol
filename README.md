# SweetControl

**SweetControl** is an interactive, real-time system that connects a **web interface**, **Raspberry Pi hardware**, and **audio, led feedback** to simulate glucose and activity interactions.  
It is built using **Docker**, **Next.js**, **Node.js (Express)**, **Soketi (Pusher)**, and **Cloudflare Tunnel** for secure global access.

---

## System Architecture

SweetControl runs as a set of Docker containers that work together:

| Component                  | Description                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Web (Next.js)**          | Front-end interface where users interact with the joystick, motor, and graphic dashboards.                                    |
| **Core (Node/Express)**    | The system brain. Processes all events, manages shared game state, triggers GPIO and audio, and updates clients in real-time. |
| **Soketi (Pusher Server)** | WebSocket layer that provides instant two-way communication between Web and Core.                                             |
| **Nginx**                  | Reverse proxy that routes all incoming requests to the correct service (web or core).                                         |
| **Cloudflared**            | Secure Cloudflare Tunnel giving public HTTPS access without opening local ports.                                              |
| **GPIO & Audio**           | Physical Raspberry Pi control of LEDs/motors and audio feedback through `ledControl.js` and `audio.js`.                       |

---

## Project Structure

```
sweetcontrol/
│
├── core/
│   ├── server.js               # Express + Pusher backend
│   ├── containers/
│   │   ├── motor/ledControl.js # GPIO LED & motor control
│   │   ├── audio/audio.js      # Sound effects and background music
│   └── data/
│       ├── state.json          # Persisted game state
│       ├── food_bg_impact.json
│       └── exercise_bg_effects.json
│
├── web/
│   ├── src/app/
│   │   ├── joystick/page.js    # User joystick controller
│   │   ├── motor/page.js       # Motor simulation display
│   │   ├── graphic/page.js     # Glucose dashboard
│   │   └── globals.css
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

## How the System Works

1. A player moves the joystick from the web app.
2. The Web container sends the event through **Soketi (Pusher)** → **Core**.
3. Core interprets the event:
   - Moves the motor (GPIO).
   - Plays sound via `audio.js`.
   - Calculates blood-glucose impact based on grabbed objects.
4. Core then broadcasts updates to all connected clients:
   - Motor page updates claw position and objects.
   - Graphic page animates glucose level changes.
5. Everything stays synchronized in real-time, locally and remotely through **Cloudflare Tunnel**.

---

## Smart Sugar Lamp (GPIO Pin 25)

| Condition                | LED Behavior                           |
| ------------------------ | -------------------------------------- |
| Glucose > 200 mg/dL      | Lamp blinks continuously               |
| Glucose ≤ 200 mg/dL      | Lamp stays off                         |
| System restart           | Lamp restores previous correct state   |
| Graphic dashboard reload | Lamp resets only from the graphic page |

---

## Multi-User Synchronization

- All clients share the same **global game state** (positions + objects).
- The Core handles concurrency safely: multiple joysticks or dashboards can connect simultaneously.
- Refreshing any page no longer resets the world — only the **graphic dashboard** can re-initialize glucose and lamp states.

---

## Development & Setup

### Prerequisites

- Raspberry Pi (4 recommended)
- Docker + Docker Compose
- Cloudflare account (for tunnel)
- Node 18+

### Steps

```bash
git clone https://github.com/mohamadmatar7/Sweetcontrol.git
cd sweetcontrol
docker compose up --build
```

Access the services:

- Web interface → `http://localhost:3100`
- Core API → `http://localhost:4000`
- Public URL (via Cloudflare Tunnel) → `https://app.sweetcontrol.be`

---

## Environment Variables

`.env` (example):

```env
PORT=4000
PUSHER_APP_ID=sweetcontrol
PUSHER_KEY=app-key
PUSHER_SECRET=app-secret
PUSHER_HOST=soketi
PUSHER_PORT=6001
PUSHER_TLS=false
NEXT_PUBLIC_CORE_URL=https://app.sweetcontrol.be/core
NEXT_PUBLIC_PUSHER_KEY=app-key
NEXT_PUBLIC_SOKETI_HOST=app.sweetcontrol.be
NEXT_PUBLIC_SOKETI_PORT=443
NEXT_PUBLIC_SOKETI_TLS=true
```

---

## Features Summary

- Real-time control & updates
- Multi-player safe synchronization
- Audio feedback (movement, grab, background)
- Persistent state (`state.json`)
- Hardware feedback (GPIO LEDs & motors)
- Secure access via Cloudflare Tunnel
- Containerized for easy deployment

---
