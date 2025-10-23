"use client";

import { useEffect, useState, useRef } from "react";
import Pusher from "pusher-js";

export default function JoystickPage() {
  const [grabbing, setGrabbing] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });

  // 🎯 Setup Pusher listener
useEffect(() => {
  const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    wsHost: process.env.NEXT_PUBLIC_SOKETI_HOST,
    wsPort: Number(process.env.NEXT_PUBLIC_SOKETI_PORT),
    forceTLS: process.env.NEXT_PUBLIC_SOKETI_TLS === "true",
    enabledTransports: ["ws", "wss"],
  });

  const channel = pusher.subscribe("joystick-channel");

  // ✅ Sync when connected
  pusher.connection.bind("connected", async () => {
    console.log("✅ Joystick connected — requesting latest game state...");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_CORE_URL}/send-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "joystick-channel",
          event: "init-game",
          data: {},
        }),
      });
    } catch (err) {
      console.error("❌ Failed to request init-game:", err);
    }
  });

  // 🌀 Reset joystick when new game starts
  channel.bind("objects-init", () => {
    console.log("♻️ Game reinitialized — resetting joystick position");
    lastPositionRef.current = { x: 0, y: 0 };
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 2000);
  });

  return () => {
    channel.unbind_all();
    pusher.unsubscribe("joystick-channel");
    pusher.disconnect();
  };
}, []);


  // 🚀 Send commands to Core
  const sendCommand = async (event, data) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_CORE_URL}/send-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "joystick-channel",
          event,
          data,
        }),
      });
      if (!response.ok) console.error("❌ Failed to send event:", response.statusText);
    } catch (err) {
      console.error("Error sending command:", err);
    }
  };

  // 🎮 Movement handler
  const move = (direction) => {
    const step = 20;
    const pos = { ...lastPositionRef.current };

    switch (direction) {
      case "up": pos.y = Math.max(-120, pos.y - step); break;
      case "down": pos.y = Math.min(120, pos.y + step); break;
      case "left": pos.x = Math.max(-120, pos.x - step); break;
      case "right": pos.x = Math.min(120, pos.x + step); break;
      default: break;
    }

    lastPositionRef.current = pos;
    sendCommand("move", { direction });
  };

  // ✋ Grab handler
  const handleGrab = async () => {
    if (grabbing) return;
    setGrabbing(true);
    const { x, y } = lastPositionRef.current;

    await sendCommand("grab", { active: true, clawX: x + 130, clawY: y + 130 });
    setTimeout(() => {
      sendCommand("grab", { active: false });
      setGrabbing(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6">
      <h1 className="text-3xl font-bold mb-8">Joystick Control</h1>

      {resetNotice && (
        <div className="mb-4 text-yellow-400 text-sm animate-pulse">
          ♻️ Game reinitialized — joystick reset
        </div>
      )}

      {/* Controls Grid */}
      <div className="grid grid-cols-3 gap-4 w-64 h-64 place-items-center">
        <div></div>
        <button
          onClick={() => move("up")}
          className="bg-gray-700 hover:bg-gray-600 rounded-xl w-16 h-16 text-lg font-bold"
        >
          ↑
        </button>
        <div></div>

        <button
          onClick={() => move("left")}
          className="bg-gray-700 hover:bg-gray-600 rounded-xl w-16 h-16 text-lg font-bold"
        >
          ←
        </button>

        <button
          onClick={handleGrab}
          disabled={grabbing}
          className={`rounded-xl w-16 h-16 text-lg font-bold transition-all ${
            grabbing ? "bg-red-500 hover:bg-red-400" : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {grabbing ? "🖐" : "🤚"}
        </button>

        <button
          onClick={() => move("right")}
          className="bg-gray-700 hover:bg-gray-600 rounded-xl w-16 h-16 text-lg font-bold"
        >
          →
        </button>

        <div></div>
        <button
          onClick={() => move("down")}
          className="bg-gray-700 hover:bg-gray-600 rounded-xl w-16 h-16 text-lg font-bold"
        >
          ↓
        </button>
        <div></div>
      </div>

      <p className="mt-8 text-gray-400 text-sm text-center max-w-xs">
        Use the arrows to move the claw.  
        Press <strong>🤚 Grab</strong> to pick up nearby objects.
      </p>
    </div>
  );
}