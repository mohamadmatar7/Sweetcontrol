import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Pusher from "pusher";
import fs from "fs";
import path from "path";
import { setDirection } from "./containers/motor/ledControl.js"; // 🟢 GPIO
import { playSound } from "./containers/audio/audio.js"; // 🔊 Audio playback

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- Pusher / Soketi setup ---
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  host: process.env.PUSHER_HOST,
  port: process.env.PUSHER_PORT,
  useTLS: process.env.PUSHER_TLS === "true",
});

// --- Helpers for saving/loading state ---
const stateFile = path.resolve("./data/state.json");

function loadState() {
  try {
    const raw = fs.readFileSync(stateFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// --- Load or initialize game state ---
let gameState =
  loadState() || {
    gameObjects: [],
    clawPos: { x: 0, y: 0 },
  };

// --- Load game data files ---
const foods = JSON.parse(fs.readFileSync("./data/food_bg_impact.json", "utf8"));
const exercises = JSON.parse(fs.readFileSync("./data/exercise_bg_effects.json", "utf8"));

// Utility: pick random items
const randomItems = (arr, count) =>
  arr.sort(() => 0.5 - Math.random()).slice(0, count);

// --- Generate new random objects for the game ---
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

// --- Initialize state if empty ---
if (!gameState.gameObjects.length) {
  gameState.gameObjects = generateObjects();
  saveState(gameState);
}

// --- ROUTES ---

app.get("/", (req, res) => res.send("✅ Sweetcontrol Core running"));

// 🔄 Main endpoint for all game events
app.post("/send-event", async (req, res) => {
  try {
    const { channel, event, data } = req.body;
    console.log(`📨 Event '${event}' →`, data);

    // 1️⃣ Game initialization request (from any client)
    // This does NOT reset the game unless it's completely finished.
    if (event === "init-game") {
      await pusher.trigger("joystick-channel", "objects-init", gameState.gameObjects);
      console.log("📤 Sent current game state to new client");
      return res.json({ success: true, gameState });
    }

    // 2️⃣ Handle move event (claw movement)
    if (event === "move") {
      const step = 20;
      const dir = data.direction;

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

      try {
        setDirection(dir); // GPIO control
        playSound("move"); // Audio feedback
      } catch (e) {
        console.warn("⚠️ Move GPIO/Audio failed:", e.message);
      }

      await pusher.trigger("joystick-channel", "move", {
        direction: dir,
        position: gameState.clawPos,
      });

      return res.json({ success: true });
    }

    // 3️⃣ Handle grab (catch) event
    if (event === "grab" && data.active) {
      try {
        setDirection("grab"); // GPIO
        playSound("grab"); // Sound effect
      } catch (e) {
        console.warn("⚠️ Grab GPIO/Audio failed:", e.message);
      }

      const clawX = gameState.clawPos.x + 130;
      const clawY = gameState.clawPos.y + 130;

      // Find the closest object to the claw
      let nearest = null;
      let nearestDist = Infinity;
      gameState.gameObjects.forEach((obj) => {
        const dx = clawX - obj.x;
        const dy = clawY - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = obj;
        }
      });

      if (nearest && nearestDist < 40) {
        console.log("🎯 Grabbed:", nearest.type, nearest.food || nearest.exercise);

        // Remove the grabbed object
        gameState.gameObjects = gameState.gameObjects.filter((o) => o !== nearest);
        saveState(gameState);

        await pusher.trigger("joystick-channel", "object-grabbed", nearest);

        // Calculate glucose impact
        let impact = 0;
        let name = "";
        if (nearest.type === "food") {
          impact = nearest.bg_rise_mgdl || nearest.bg_rise || 20;
          name = nearest.food;
        } else {
          impact = nearest.est_bg_change_mgdl || nearest.bg_rise || -20;
          name = nearest.exercise;
        }

        await pusher.trigger("joystick-channel", "bg-impact", {
          type: nearest.type,
          name,
          impact,
        });

        // If all objects are collected → start a new round
        if (gameState.gameObjects.length === 0) {
          console.log("🏁 Game finished — generating new round");
          gameState.gameObjects = generateObjects();
          gameState.clawPos = { x: 0, y: 0 };
          saveState(gameState);
          await pusher.trigger("joystick-channel", "objects-init", gameState.gameObjects);
        }
      } else {
        console.log("❌ No object close enough to grab");
      }

      return res.json({ success: true });
    }

    // 4️⃣ Fallback: forward any other custom event to the channel
    await pusher.trigger(channel, event, data);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(port, () => console.log(`🚀 Core server running on port ${port}`));
