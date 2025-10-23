import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// Sound file paths
const basePath = "./containers/audio/sounds";
const soundFiles = {
  move: `${basePath}/move.mp3`,
  grab: `${basePath}/grab.mp3`,
};

// Track timing and processes
let lastMoveTime = 0;
let currentProcess = null;

// Simple sound trigger with cooldown and cleanup
export function playSound(type) {
  const file = soundFiles[type];
  if (!file || !fs.existsSync(file)) {
    console.warn(`⚠️ Missing sound file for '${type}':`, file);
    return;
  }

  const now = Date.now();

  // 🕒 Apply cooldown for move sounds
  if (type === "move" && now - lastMoveTime < 300) {
    return; // ignore too frequent moves
  }
  if (type === "move") lastMoveTime = now;

  // 🧹 Stop previous sound if still playing
  if (currentProcess) {
    try {
      currentProcess.kill("SIGTERM");
    } catch {}
    currentProcess = null;
  }

  const fullPath = path.resolve(file);
  const args = ["-nodisp", "-loglevel", "quiet", "-autoexit", fullPath];
  const env = {
    ...process.env,
    PULSE_SERVER: process.env.PULSE_SERVER || "unix:/run/user/1000/pulse/native",
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || "/run/user/1000",
    HOME: process.env.HOME || "/home/pi",
  };

  const ff = spawn("ffplay", args, { env });
  currentProcess = ff;

  ff.on("error", (err) => console.error(`❌ ffplay error for ${type}:`, err.message));
  ff.on("exit", (code) => {
    currentProcess = null;
    if (code === 0) console.log(`🎵 Played: ${type}`);
    else console.warn(`⚠️ ffplay exited with code ${code} for ${type}`);
  });
}



