import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Pusher from "pusher";
import fs from "fs";
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

// --- Game State ---
let gameObjects = [];

const foods = JSON.parse(fs.readFileSync("./data/food_bg_impact.json", "utf8"));
const exercises = JSON.parse(fs.readFileSync("./data/exercise_bg_effects.json", "utf8"));

const randomItems = (arr, count) => arr.sort(() => 0.5 - Math.random()).slice(0, count);

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

// --- ROUTES ---

app.get("/", (req, res) => res.send("✅ Sweetcontrol Core running"));

// 🔄 Main endpoint
app.post("/send-event", async (req, res) => {
  try {
    const { channel, event, data } = req.body;
    console.log(`📨 Event '${event}' →`, data);

    // 1️⃣ Initialize game
    if (event === "init-game") {
      gameObjects = generateObjects();
      await pusher.trigger("joystick-channel", "objects-init", gameObjects);
      console.log("🎮 Game initialized with 6 objects");
      return res.json({ success: true });
    }

    // 2️⃣ Handle grab event
    if (event === "grab" && data.active) {
      try {
        setDirection("grab"); // GPIO
        playSound("grab");    // 🔊
      } catch (e) {
        console.warn("⚠️ Grab GPIO/Audio failed:", e.message);
      }

      const { clawX, clawY } = data;
      if (clawX == null || clawY == null) {
        console.log("⚠️ Grab without coordinates");
        return res.json({ success: false });
      }

      let nearest = null;
      let nearestDist = Infinity;
      gameObjects.forEach((obj) => {
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
        gameObjects = gameObjects.filter((o) => o !== nearest);
        await pusher.trigger("joystick-channel", "object-grabbed", nearest);

        // 🧮 Calculate blood glucose impact and send to graphics
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
      } else {
        console.log("❌ No object close enough to grab");
      }

      return res.json({ success: true });
    }

    // 3️⃣ Handle move event
    if (event === "move") {
      if (!global.clawPos) global.clawPos = { x: 0, y: 0 };
      const step = 20;
      const dir = data.direction;

      switch (dir) {
        case "up": global.clawPos.y = Math.max(-120, global.clawPos.y - step); break;
        case "down": global.clawPos.y = Math.min(120, global.clawPos.y + step); break;
        case "left": global.clawPos.x = Math.max(-120, global.clawPos.x - step); break;
        case "right": global.clawPos.x = Math.min(120, global.clawPos.x + step); break;
      }

      try {
        setDirection(dir);  // GPIO
        playSound("move");  // 🔊
      } catch (e) {
        console.warn("⚠️ Move GPIO/Audio failed:", e.message);
      }

      await pusher.trigger("joystick-channel", "move", {
        direction: dir,
        position: global.clawPos,
      });
      return res.json({ success: true });
    }

    // 4️⃣ Generic event forwarding
    await pusher.trigger(channel, event, data);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(port, () => console.log(`🚀 Core server running on port ${port}`));
