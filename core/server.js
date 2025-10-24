import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Pusher from "pusher";
import fs from "fs";
import path from "path";
import { setDirection, setSugarLamp } from "./containers/motor/ledControl.js";
import { playSound } from "./containers/audio/audio.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ==========================================================
// 🔌 PUSHER / SOKETI SETUP
// ==========================================================
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  host: process.env.PUSHER_HOST,
  port: process.env.PUSHER_PORT,
  useTLS: process.env.PUSHER_TLS === "true",
});

// ==========================================================
// 🧠 STATE FILES
// ==========================================================
const stateFile = path.resolve("./data/state.json");
const joystickFile = path.resolve("./data/joystick_state.json");

// --- Game state helpers
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return { gameObjects: [], clawPos: { x: 0, y: 0 } };
  }
}
function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// --- Joystick queue helpers
function loadJoystickState() {
  try {
    return JSON.parse(fs.readFileSync(joystickFile, "utf8"));
  } catch {
    return { queue: [], activeSession: null };
  }
}
function saveJoystickState(state) {
  fs.writeFileSync(joystickFile, JSON.stringify(state, null, 2));
}

// ==========================================================
// 🎮 GAME INITIALIZATION
// ==========================================================
let gameState = loadState();
const foods = JSON.parse(fs.readFileSync("./data/food_bg_impact.json", "utf8"));
const exercises = JSON.parse(
  fs.readFileSync("./data/exercise_bg_effects.json", "utf8")
);

const randomItems = (arr, count) =>
  arr.sort(() => 0.5 - Math.random()).slice(0, count);

function generateObjects() {
  const used = [];
  const randomPos = () => {
    let x, y, tooClose;
    do {
      x = Math.random() * 220 + 10;
      y = Math.random() * 220 + 10;
      tooClose = used.some((p) => Math.hypot(p.x - x, p.y - y) < 35);
    } while (tooClose);
    used.push({ x, y });
    return { x, y };
  };

  const badFoods = randomItems(foods, 4).map((f) => ({
    ...f,
    type: "food",
    color: "bg-red-500",
    ...randomPos(),
  }));

  const goodExercises = randomItems(exercises, 2).map((e) => ({
    ...e,
    type: "exercise",
    color: "bg-green-500",
    ...randomPos(),
  }));

  return [...badFoods, ...goodExercises];
}

if (!gameState.gameObjects.length) {
  gameState.gameObjects = generateObjects();
  saveState(gameState);
}

// ==========================================================
// 🕹️ JOYSTICK QUEUE SYSTEM (REFRESH-SAFE)
// ==========================================================
let { queue: joystickQueue, activeSession: currentSession } =
  loadJoystickState();

const SESSION_DURATION = 30 * 1000; // 30 seconds test duration

// --- Broadcast queue state (with remaining time)
async function broadcastQueue() {
  const remaining = currentSession
    ? Math.max(0, Math.floor((currentSession.expiresAt - Date.now()) / 1000))
    : 0;

  await pusher.trigger("joystick-queue", "queue-update", {
    queue: joystickQueue.map((u, i) => ({ id: u.id, position: i + 1 })),
    activeId: currentSession ? currentSession.id : null,
    remaining,
  });

  saveJoystickState({ queue: joystickQueue, activeSession: currentSession });
}

// --- Start next session safely
async function startNextSession() {
  // 🛑 If a session is still active, skip
  if (currentSession && Date.now() < currentSession.expiresAt) return;

  if (joystickQueue.length === 0) {
    currentSession = null;
    saveJoystickState({ queue: joystickQueue, activeSession: currentSession });
    await broadcastQueue();
    return;
  }

  const nextUser = joystickQueue.shift();
  const expiresAt = Date.now() + SESSION_DURATION;
  currentSession = { id: nextUser.id, expiresAt };

  console.log(`🎮 Session started for ${nextUser.id} (30s)`);
  saveJoystickState({ queue: joystickQueue, activeSession: currentSession });
  await broadcastQueue();

  setTimeout(async () => {
    if (currentSession && Date.now() >= currentSession.expiresAt) {
      console.log(`⌛ Session expired for ${currentSession.id}`);
      currentSession = null;
      await startNextSession();
    }
  }, SESSION_DURATION + 500);
}

// --- Join joystick queue
app.post("/joystick-join", async (req, res) => {
  const userId = req.body.id;
  if (!userId)
    return res.status(400).json({ success: false, message: "Missing user ID" });

  // 🟢 Already active → refresh-safe reconnect
  if (currentSession?.id === userId) {
    const remaining = Math.max(
      0,
      Math.floor((currentSession.expiresAt - Date.now()) / 1000)
    );
    console.log(`♻️ User ${userId} reconnected — ${remaining}s left`);

    return res.json({
      success: true,
      active: true,
      position: 0,
      remaining,
    });
  }

  // 🟠 Already waiting in queue
  const existing = joystickQueue.find((u) => u.id === userId);
  if (existing) {
    const position = joystickQueue.indexOf(existing) + 1;
    return res.json({ success: true, position, active: false });
  }

  // 🔴 New user joins
  joystickQueue.push({ id: userId, joinedAt: Date.now() });
  console.log(`🕹️ User ${userId} joined queue (pos ${joystickQueue.length})`);
  saveJoystickState({ queue: joystickQueue, activeSession: currentSession });

  if (!currentSession) await startNextSession();

  const position = joystickQueue.findIndex((u) => u.id === userId) + 1;
  await broadcastQueue();
  res.json({ success: true, position, active: false });
});

// --- Leave joystick queue or active session
app.post("/joystick-leave", async (req, res) => {
  const userId = req.body.id;
  if (!userId) return res.status(400).json({ success: false });

  joystickQueue = joystickQueue.filter((u) => u.id !== userId);

  if (currentSession && currentSession.id === userId) {
    console.log(`👋 User ${userId} left active session`);
    currentSession = null;
    await startNextSession();
  } else {
    await broadcastQueue();
  }

  saveJoystickState({ queue: joystickQueue, activeSession: currentSession });
  res.json({ success: true });
});

// ==========================================================
// 🎮 GAME EVENTS
// ==========================================================
app.post("/send-event", async (req, res) => {
  try {
    const { channel, event, data } = req.body;
    console.log(`📨 Event '${event}' →`, data);

    // 1️⃣ Init
    if (event === "init-game") {
      await pusher.trigger("joystick-channel", "objects-init", gameState.gameObjects);
      console.log("📤 Sent current game state");

      if (data?.source === "graphic") {
        global.latestGlucose = 100;
        setSugarLamp(false);
        console.log("🩸 Glucose reset (graphic)");
      }
      return res.json({ success: true, gameState });
    }

    // 2️⃣ Move
    if (event === "move") {
      const dir = data.direction;
      const step = 20;

      switch (dir) {
        case "up":
          gameState.clawPos.y = Math.max(-120, gameState.clawPos.y - step);
          break;
        case "down":
          gameState.clawPos.y = Math.min(120, gameState.clawPos.y + step);
          break;
        case "left":
          gameState.clawPos.x = Math.max(-120, gameState.clawPos.x - step);
          break;
        case "right":
          gameState.clawPos.x = Math.min(120, gameState.clawPos.x + step);
          break;
      }

      saveState(gameState);
      setDirection(dir);
      playSound("move");

      await pusher.trigger("joystick-channel", "move", {
        direction: dir,
        position: gameState.clawPos,
      });

      return res.json({ success: true });
    }

    // 3️⃣ Grab
    if (event === "grab" && data.active) {
      setDirection("grab");
      playSound("grab");

      const clawX = gameState.clawPos.x + 130;
      const clawY = gameState.clawPos.y + 130;

      let nearest = null;
      let nearestDist = Infinity;
      for (const obj of gameState.gameObjects) {
        const dist = Math.hypot(clawX - obj.x, clawY - obj.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = obj;
        }
      }

      if (nearest && nearestDist < 40) {
        console.log("🎯 Grabbed:", nearest.type, nearest.food || nearest.exercise);
        gameState.gameObjects = gameState.gameObjects.filter((o) => o !== nearest);
        saveState(gameState);

        await pusher.trigger("joystick-channel", "object-grabbed", nearest);

        const impact =
          nearest.type === "food"
            ? nearest.bg_rise_mgdl || nearest.bg_rise || 20
            : nearest.est_bg_change_mgdl || nearest.bg_rise || -20;
        const name = nearest.food || nearest.exercise;

        await pusher.trigger("joystick-channel", "bg-impact", {
          type: nearest.type,
          name,
          impact,
        });

        const prev = global.latestGlucose || 100;
        const latest = Math.max(60, Math.min(250, prev + impact));
        global.latestGlucose = latest;
        setSugarLamp(latest > 200);

        if (gameState.gameObjects.length === 0) {
          console.log("🏁 New round");
          gameState.gameObjects = generateObjects();
          gameState.clawPos = { x: 0, y: 0 };
          saveState(gameState);
          await pusher.trigger("joystick-channel", "objects-init", gameState.gameObjects);
        }
      } else {
        console.log("❌ No object close enough");
      }

      return res.json({ success: true });
    }

    // Default fallback
    await pusher.trigger(channel, event, data);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================
// 🩸 STARTUP
// ==========================================================
try {
  if (!global.latestGlucose) global.latestGlucose = 100;
  setSugarLamp(global.latestGlucose > 200);
} catch (e) {
  console.warn("⚠️ Sugar lamp init failed:", e.message);
}

app.listen(port, () => console.log(`🚀 Core server running on port ${port}`));
